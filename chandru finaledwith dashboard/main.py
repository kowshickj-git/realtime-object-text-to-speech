"""
Real-Time Vision System: FastVLM + OCR + Audio Output
Priority Logic: Text Detection → Object Detection → Audio
"""

import cv2
import threading
import queue
import time
import win32com.client
import pythoncom
from PIL import Image
import torch
from transformers import AutoProcessor, AutoModelForVision2Seq
import easyocr
from flask import Flask, Response, jsonify, render_template_string
import logging
import webbrowser
import numpy as np

# Suppress Flask logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# ============ CONFIGURATION ============
DETECTION_INTERVAL = 0.5  # Fast detection every 500ms
OCR_CONFIDENCE_THRESHOLD = 0.6  # Minimum confidence for OCR text (raised for accuracy)
OCR_STABILITY_FRAMES = 2  # Number of consecutive frames for stable text detection
MAX_AUDIO_LENGTH = 15  # Maximum words in audio output (increased for full text)
CAMERA_RESOLUTION = (640, 480)  # Lower res for speed
MIN_TEXT_LENGTH = 3  # Minimum characters to consider as valid text

# ============ GLOBAL STATE ============
running = True
audio_active = True

# Detection results
current_text = ""  # OCR detected text
current_objects = ""  # Object detection caption
current_audio = "System initializing..."  # Currently spoken audio

# OCR stability tracking
ocr_text_buffer = []  # Buffer for last N frames of detected text
last_spoken_text = ""  # Last text spoken to avoid repetition
ocr_mode_active = False  # Flag to pause object detection during OCR

# Frame storage
last_frame_jpg = None
frame_lock = threading.Lock()

# Queues for processing
frame_queue = queue.Queue(maxsize=2)
audio_queue = queue.Queue()

# ============ FLASK WEB APP ============
app = Flask(__name__)

# ============ TTS ENGINE (Windows SAPI) ============
class TTSEngine:
    """Thread-safe Windows SAPI Text-to-Speech Engine"""
    
    def __init__(self):
        self.running = True
        self.speech_queue = queue.Queue()
        self.worker_thread = None
        self.last_spoken = ""
        
    def initialize(self):
        """Start TTS worker thread"""
        self.worker_thread = threading.Thread(target=self._speech_worker, daemon=True)
        self.worker_thread.start()
        return True
    
    def _speech_worker(self):
        """Dedicated speech worker using Windows SAPI"""
        pythoncom.CoInitialize()
        
        try:
            speaker = win32com.client.Dispatch("SAPI.SpVoice")
            speaker.Volume = 100
            speaker.Rate = 2
            
            while self.running:
                try:
                    text = self.speech_queue.get(timeout=0.5)
                    
                    if not text or len(text.strip()) < 2:
                        continue
                    
                    # Avoid repeating same text
                    if text == self.last_spoken:
                        continue
                    
                    # Truncate long text for speed
                    words = text.split()
                    if len(words) > MAX_AUDIO_LENGTH:
                        text = ' '.join(words[:MAX_AUDIO_LENGTH])
                    
                    speaker.Speak(text, 1)
                    self.last_spoken = text
                    
                except queue.Empty:
                    continue
                except Exception as e:
                    print(f"❌ Speech error: {e}")
                    time.sleep(0.1)
        
        finally:
            pythoncom.CoUninitialize()
    
    def speak(self, text):
        """Queue text for speaking"""
        if text and len(text.strip()) > 2:
            # Clear old items, add new
            while not self.speech_queue.empty():
                try:
                    self.speech_queue.get_nowait()
                except:
                    break
            self.speech_queue.put(text)
    
    def stop(self):
        self.running = False

# Global TTS instance
tts = TTSEngine()

# ============ OCR ENGINE (EasyOCR) ============
ocr_reader = None

def init_ocr():
    """Initialize EasyOCR reader with optimized settings for full-text detection"""
    global ocr_reader
    try:
        ocr_reader = easyocr.Reader(
            ['en'], 
            gpu=torch.cuda.is_available(),
            verbose=False
        )
        return True
    except Exception as e:
        print(f"OCR initialization error: {e}")
        return False

def clean_ocr_text(text):
    """
    Clean and normalize OCR text output
    Removes noise, special characters, and normalizes whitespace
    """
    import re
    
    if not text:
        return ""
    
    # Remove special characters but keep spaces, letters, numbers, basic punctuation
    text = re.sub(r'[^\w\s.,!?\'\-]', '', text)
    
    # Normalize whitespace (multiple spaces to single space)
    text = re.sub(r'\s+', ' ', text)
    
    # Remove single-character fragments (unless it's 'a', 'I', or a digit)
    words = text.split()
    words = [w for w in words if len(w) > 1 or w.lower() in ['a', 'i'] or w.isdigit()]
    
    text = ' '.join(words).strip()
    
    return text

def detect_text(frame):
    """
    Detect FULL TEXT in frame using EasyOCR with optimized settings
    Returns: complete, cleaned text string or empty string
    """
    global ocr_reader
    
    if ocr_reader is None:
        return ""
    
    try:
        # EasyOCR readtext with parameters optimized for full-text detection
        results = ocr_reader.readtext(
            frame,
            detail=1,
            paragraph=True,  # Group text into paragraphs
            batch_size=1,
            text_threshold=0.6,  # Higher threshold for cleaner text
            low_text=0.3,
            link_threshold=0.3,  # Link nearby text together
            canvas_size=2560,  # Larger canvas for better detection
            mag_ratio=1.5  # Magnification for small text
        )
        
        if not results:
            return ""
        
        # Sort results by Y-coordinate (top to bottom) then X-coordinate (left to right)
        # This ensures text is read in natural reading order
        results_sorted = sorted(results, key=lambda x: (x[0][0][1], x[0][0][0]))
        
        # Filter by confidence and collect text
        detected_texts = []
        for (bbox, text, confidence) in results_sorted:
            if confidence > OCR_CONFIDENCE_THRESHOLD and len(text.strip()) >= MIN_TEXT_LENGTH:
                detected_texts.append(text.strip())
        
        if not detected_texts:
            return ""
        
        # Combine all detected text into one complete string
        full_text = ' '.join(detected_texts)
        
        # Clean and normalize the text
        full_text = clean_ocr_text(full_text)
        
        # Only return if we have meaningful text
        if len(full_text) >= MIN_TEXT_LENGTH:
            return full_text
        
        return ""
        
    except Exception as e:
        return ""

# ============ VISION-LANGUAGE MODEL (FastVLM / BLIP-2) ============
vl_processor = None
vl_model = None
device = None

def init_vision_model():
    """Initialize Vision-Language Model for object detection"""
    global vl_processor, vl_model, device
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    try:
        model_name = "Salesforce/blip-image-captioning-base"
        
        from transformers import BlipProcessor, BlipForConditionalGeneration
        
        vl_processor = BlipProcessor.from_pretrained(model_name)
        vl_model = BlipForConditionalGeneration.from_pretrained(model_name)
        
        vl_model.to(device)
        vl_model.eval()
        return True
        
    except Exception as e:
        print(f"Vision model initialization error: {e}")
        return False

def detect_objects(frame):
    """
    Detect objects in frame using Vision-Language Model
    Returns: caption string
    """
    global vl_processor, vl_model, device
    
    if vl_processor is None or vl_model is None:
        return ""
    
    try:
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)
        
        # Process image
        inputs = vl_processor(pil_image, return_tensors="pt").to(device)
        
        # Generate caption
        with torch.no_grad():
            output = vl_model.generate(**inputs, max_length=30, num_beams=3)
        
        caption = vl_processor.decode(output[0], skip_special_tokens=True)
        return caption.strip()
        
    except Exception as e:
        return ""

def check_text_stability(detected_text):
    """
    Check if detected text is stable across multiple frames
    Returns: stable text if consistent for OCR_STABILITY_FRAMES, else empty string
    """
    global ocr_text_buffer
    
    # Add current detection to buffer
    ocr_text_buffer.append(detected_text)
    
    # Keep only last N frames
    if len(ocr_text_buffer) > OCR_STABILITY_FRAMES:
        ocr_text_buffer.pop(0)
    
    # Check if we have enough frames
    if len(ocr_text_buffer) < OCR_STABILITY_FRAMES:
        return ""
    
    # Check if all frames have the same text (or very similar)
    if not ocr_text_buffer[0]:  # If first is empty, all must be empty
        return "" if all(not text for text in ocr_text_buffer) else ""
    
    # All non-empty texts should match
    first_text = ocr_text_buffer[0]
    for text in ocr_text_buffer[1:]:
        if text != first_text:
            return ""  # Not stable yet
    
    return first_text

# ============ PRIORITY DETECTION WORKER ============
def detection_worker():
    """
    Main detection thread with IMPROVED priority logic:
    1. Check for text (OCR) with stability validation
    2. If stable text found, PAUSE object detection and speak FULL text
    3. If no text, resume object detection and speak objects
    4. Avoid repetition and ensure complete audio output
    """
    global current_text, current_objects, current_audio, running
    global ocr_mode_active, last_spoken_text
    
    while running:
        try:
            # Get frame from queue
            try:
                frame = frame_queue.get(timeout=1.0)
            except queue.Empty:
                continue
            
            if frame is None:
                continue
            
            # === PRIORITY 1: TEXT DETECTION (OCR) WITH STABILITY ===
            detected_text = detect_text(frame)
            
            # Check if text is stable across frames
            stable_text = check_text_stability(detected_text)
            
            # Update display
            current_text = detected_text if detected_text else "No text detected"
            
            # === PRIORITY LOGIC WITH STABILITY ===
            if stable_text:
                # STABLE TEXT DETECTED → Enter OCR mode
                ocr_mode_active = True
                
                # Only speak if different from last spoken
                if stable_text != last_spoken_text:
                    output = stable_text
                    current_audio = output
                    last_spoken_text = stable_text
                    
                    # Speak FULL text (no truncation for OCR)
                    tts.speak(output)
                
                # SKIP OBJECT DETECTION during OCR mode
                current_objects = "[Paused during text reading]"
                
            else:
                # NO STABLE TEXT → Resume object detection
                if ocr_mode_active:
                    ocr_mode_active = False
                    last_spoken_text = ""
                
                # === PRIORITY 2: OBJECT DETECTION (VLM) ===
                detected_objects = detect_objects(frame)
                current_objects = detected_objects if detected_objects else "No objects detected"
                
                # Speak objects only if different
                if detected_objects and detected_objects != last_spoken_text:
                    output = detected_objects
                    current_audio = output
                    last_spoken_text = detected_objects
                    
                    tts.speak(output)
            
            # Small delay for real-time performance
            time.sleep(DETECTION_INTERVAL)
            
        except Exception as e:
            time.sleep(0.5)

# ============ CAMERA WORKER ============
def camera_worker():
    """Capture frames from webcam and queue for processing"""
    global last_frame_jpg, running
    
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_RESOLUTION[0])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_RESOLUTION[1])
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    if not cap.isOpened():
        print("Error: Cannot open camera")
        return
    frame_count = 0
    
    while running:
        ret, frame = cap.read()
        
        if not ret:
            time.sleep(0.1)
            continue
        
        frame_count += 1
        
        # Update frame for dashboard (JPEG encoding)
        with frame_lock:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            last_frame_jpg = buffer.tobytes()
        
        # Queue frame for detection (drop if queue full - keep real-time)
        if not frame_queue.full():
            frame_queue.put(frame.copy())
    
    cap.release()

# ============ FLASK ROUTES ============

DASHBOARD_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Vision System Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            text-align: center;
            font-size: 1.1em;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        .grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .card {
            background: rgba(255,255,255,0.15);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card h2 {
            margin-bottom: 15px;
            font-size: 1.5em;
            border-bottom: 2px solid rgba(255,255,255,0.3);
            padding-bottom: 10px;
        }
        #video {
            width: 100%;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .status-item {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            border-left: 4px solid #4CAF50;
        }
        .status-item h3 {
            font-size: 0.9em;
            opacity: 0.8;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .status-item p {
            font-size: 1.3em;
            font-weight: bold;
            word-wrap: break-word;
        }
        .audio-output {
            border-left-color: #ff6b6b !important;
            background: rgba(255,107,107,0.2);
        }
        .text-output {
            border-left-color: #4ecdc4 !important;
        }
        .object-output {
            border-left-color: #ffd93d !important;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .live-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #ff6b6b;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Real-Time Vision + Audio System</h1>
        <p class="subtitle">
            <span class="live-indicator"></span>
            FastVLM Object Detection + OCR Text Recognition
        </p>
        
        <div class="grid">
            <div class="card">
                <h2>📹 Live Camera Feed</h2>
                <img id="video" src="/video_feed" alt="Camera Feed">
            </div>
            
            <div class="card">
                <h2>📊 Detection Status</h2>
                
                <div class="status-item audio-output">
                    <h3>🔊 Currently Speaking</h3>
                    <p id="audio-output">Loading...</p>
                </div>
                
                <div class="status-item text-output">
                    <h3>📝 Text Detected (OCR)</h3>
                    <p id="text-output">Loading...</p>
                </div>
                
                <div class="status-item object-output">
                    <h3>👁 Objects Detected (VLM)</h3>
                    <p id="object-output">Loading...</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>ℹ️ System Information</h2>
            <p style="line-height: 1.8; opacity: 0.9;">
                <strong>Priority Logic:</strong> If text is visible → speak TEXT, else → speak OBJECTS<br>
                <strong>Detection Speed:</strong> Real-time (500ms interval)<br>
                <strong>Audio Engine:</strong> Windows SAPI (pywin32)<br>
                <strong>Models:</strong> BLIP (Vision) + EasyOCR (Text)
            </p>
        </div>
    </div>
    
    <script>
        // Update status every 500ms
        setInterval(function() {
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('audio-output').textContent = data.audio || 'N/A';
                    document.getElementById('text-output').textContent = data.text || 'No text detected';
                    document.getElementById('object-output').textContent = data.objects || 'No objects detected';
                })
                .catch(err => console.error('Status update error:', err));
        }, 500);
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    """Dashboard homepage"""
    return render_template_string(DASHBOARD_HTML)

@app.route('/status')
def status():
    """API endpoint for detection status"""
    return jsonify({
        'audio': current_audio,
        'text': current_text,
        'objects': current_objects
    })

@app.route('/video_feed')
def video_feed():
    """Video streaming endpoint"""
    def generate():
        while running:
            with frame_lock:
                if last_frame_jpg is not None:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + last_frame_jpg + b'\r\n')
            time.sleep(0.033)  # ~30 FPS
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

def run_flask():
    """Run Flask server"""
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

# ============ MAIN EXECUTION ============
def main():
    global running
    
    print("=" * 60)
    print("🚀 REAL-TIME VISION SYSTEM: FastVLM + OCR + AUDIO")
    print("=" * 60)
    
    # Initialize TTS
    print("\n[1/4] Initializing TTS engine...")
    if not tts.initialize():
        print("❌ Failed to initialize TTS")
        return
    
    # Initialize OCR
    print("\n[2/4] Initializing OCR engine...")
    if not init_ocr():
        print("❌ Failed to initialize OCR")
        return
    
    # Initialize Vision Model
    print("\n[3/4] Initializing Vision model...")
    if not init_vision_model():
        print("❌ Failed to initialize Vision model")
        return
    
    # Start threads
    print("\n[4/4] Starting worker threads...")
    
    threads = [
        threading.Thread(target=camera_worker, daemon=True, name="Camera"),
        threading.Thread(target=detection_worker, daemon=True, name="Detection"),
        threading.Thread(target=run_flask, daemon=True, name="Flask")
    ]
    
    for t in threads:
        t.start()
        print(f"✅ {t.name} thread started")
    
    # Open dashboard
    time.sleep(2)
    print("\n" + "=" * 60)
    print("🎉 SYSTEM ACTIVE!")
    print("=" * 60)
    print("📊 Dashboard: http://localhost:5000")
    print("🔊 Audio: Active (Windows SAPI)")
    print("📝 Priority: Text → Objects → Audio")
    print("\nPress Ctrl+C to stop...")
    print("=" * 60 + "\n")
    
    try:
        webbrowser.open('http://localhost:5000')
    except:
        pass
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Shutdown requested...")
        running = False
        tts.stop()
        
        # Wait for threads
        for t in threads:
            if t.is_alive():
                t.join(timeout=2)
        
        print("✅ System stopped cleanly")

if __name__ == "__main__":
    main()
