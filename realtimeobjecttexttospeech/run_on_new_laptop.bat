@echo off
REM ============================================================
REM LIVE SCENE CAPTIONING SYSTEM - AUTO-RUN SCRIPT
REM Runs on any Windows laptop after ZIP extraction
REM ============================================================

echo.
echo ============================================================
echo    LIVE SCENE CAPTIONING SYSTEM - AUTO INSTALLER
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo.
    echo Please install Python 3.8+ from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo [1/4] Python detected successfully
echo.

REM Check if virtual environment exists
if exist ".venv" (
    echo [2/4] Virtual environment found
) else (
    echo [2/4] Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo Virtual environment created successfully
)
echo.

REM Activate virtual environment and install dependencies
echo [3/4] Installing dependencies...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    echo Trying without quiet mode for diagnostics...
    pip install -r requirements.txt
    pause
    exit /b 1
)
echo Dependencies installed successfully
echo.

REM Run the application
echo [4/4] Starting Live Scene Captioning System...
echo.
echo ============================================================
echo    SYSTEM STARTING - AUDIO WILL NARRATE EVERY 1 SECOND
echo ============================================================
echo.
python main.py

REM If program exits, pause to show any errors
if errorlevel 1 (
    echo.
    echo ============================================================
    echo    PROGRAM EXITED WITH ERROR
    echo ============================================================
    pause
)
