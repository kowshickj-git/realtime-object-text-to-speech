================================================================================
  REAL-TIME VISION SYSTEM - CLIENT INSTALLATION & USAGE GUIDE
================================================================================

PROJECT OVERVIEW:
This system uses live camera feed to detect objects and text in real-time,
then converts visual information into speech audio using AI models.

FEATURES:
- Live webcam object detection (AI-powered)
- Text recognition (OCR)
- Real-time audio output (Text-to-Speech)
- Live web dashboard with video feed

================================================================================
  INSTALLATION STEPS
================================================================================

1. SYSTEM REQUIREMENTS:
   - Windows 10/11 (64-bit)
   - Python 3.8 or higher
   - Webcam (built-in or USB)
   - Internet connection (for first-time model download)
   - Minimum 4GB RAM (8GB recommended)

2. PYTHON INSTALLATION (if not already installed):
   - Download from: https://www.python.org/downloads/
   - During installation, CHECK "Add Python to PATH"
   - Verify installation: Open Command Prompt, type "python --version"

3. PROJECT INSTALLATION:
   - Extract the project folder to any location
   - No additional setup required

================================================================================
  HOW TO RUN
================================================================================

SIMPLE METHOD (RECOMMENDED):
1. Navigate to the project folder
2. Double-click "run_project.bat"
3. Wait for automatic setup (first run may take 5-10 minutes)
4. Dashboard will open automatically in your browser

The batch file will automatically:
- Create virtual environment
- Install all dependencies
- Download AI models (first run only)
- Start camera, detection, and audio
- Open web dashboard

================================================================================
  USING THE SYSTEM
================================================================================

AFTER STARTUP:
- Web dashboard opens at: http://localhost:5000
- Camera activates automatically
- Audio starts automatically (Windows Text-to-Speech)

DETECTION MODES:
1. TEXT MODE:
   - Show any printed text to the camera
   - System will read the text aloud
   - Examples: Book pages, signs, labels, screens

2. OBJECT MODE:
   - Point camera at any object/scene
   - System describes what it sees
   - Examples: "A person sitting", "A cat on a chair"

PRIORITY LOGIC:
- If text is visible → System reads TEXT
- If no text → System describes OBJECTS

================================================================================
  DASHBOARD FEATURES
================================================================================

The web dashboard displays:
1. Live camera feed
2. Currently spoken audio
3. Detected text (OCR results)
4. Detected objects (Vision AI results)

All information updates in real-time every 500ms.

================================================================================
  STOPPING THE SYSTEM
================================================================================

METHOD 1: Press Ctrl+C in the command window
METHOD 2: Close the command window
METHOD 3: Close browser and terminate Python process

The system will shut down cleanly and release the camera.

================================================================================
  TROUBLESHOOTING
================================================================================

PROBLEM: "Python is not installed"
SOLUTION: Install Python 3.8+ and add to PATH

PROBLEM: "Cannot open camera"
SOLUTION: 
- Check if camera is connected
- Close other apps using the camera (Zoom, Teams, etc.)
- Grant camera permissions in Windows Settings

PROBLEM: "Failed to install dependencies"
SOLUTION:
- Check internet connection
- Run as Administrator
- Manually run: .venv\Scripts\activate then pip install -r requirements.txt

PROBLEM: "Models downloading slowly"
SOLUTION: First run requires downloading ~2GB of AI models. Be patient.

PROBLEM: "No audio output"
SOLUTION:
- Check Windows volume settings
- Ensure speakers/headphones are connected
- Windows SAPI must be available (built into Windows 10/11)

PROBLEM: "OCR not detecting text"
SOLUTION:
- Ensure text is clear and well-lit
- Hold steady for 2 seconds
- Use high-contrast text (black on white works best)

================================================================================
  PROJECT FILES
================================================================================

run_project.bat     - Main launcher (double-click to start)
main.py             - Core application code
requirements.txt    - Python dependencies
README.txt          - This file

After first run, you'll also see:
.venv/              - Virtual environment (auto-created)

================================================================================
  TECHNICAL DETAILS
================================================================================

MODELS USED:
- Vision: BLIP (Salesforce/blip-image-captioning-base)
- OCR: EasyOCR (English language)
- TTS: Windows SAPI (built-in)

PERFORMANCE:
- Detection interval: 500ms (2 FPS)
- Camera resolution: 640x480 (optimized for speed)
- Text stability: 2-frame consistency check

PORTS USED:
- Web dashboard: http://localhost:5000
- Ensure port 5000 is not in use by other applications

================================================================================
  SUPPORT & NOTES
================================================================================

- First run requires internet to download AI models (~2GB)
- Subsequent runs work offline
- Models are cached locally in user directory
- System uses GPU if available (NVIDIA CUDA), otherwise CPU
- CPU mode is slower but fully functional

For best performance:
- Use well-lit environment
- Keep camera stable
- Show clear, high-contrast text
- Avoid background clutter

================================================================================
  CLIENT DEPLOYMENT CHECKLIST
================================================================================

Files to copy to client:
✓ run_project.bat
✓ main.py
✓ requirements.txt
✓ README.txt (this file)

Do NOT copy:
✗ .venv folder (auto-created)
✗ __pycache__ folders
✗ .pyc files

================================================================================
  END OF GUIDE
================================================================================
