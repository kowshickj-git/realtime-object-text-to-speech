@echo off
REM ============================================================
REM Real-Time Vision System - Automatic Launcher
REM ============================================================

echo ============================================================
echo  Real-Time Vision System - Starting...
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo.
    echo Please install Python 3.8 or higher from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/4] Python detected successfully
echo.

REM Check if virtual environment exists
if not exist ".venv" (
    echo [2/4] Creating virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo Virtual environment created successfully
    echo.
) else (
    echo [2/4] Virtual environment already exists
    echo.
)

REM Activate virtual environment
echo [3/4] Activating virtual environment...
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment!
    pause
    exit /b 1
)
echo.

REM Install/upgrade dependencies
echo [4/4] Installing dependencies...
echo This may take a few minutes on first run...
echo.
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies!
    echo.
    echo Try running manually:
    echo   .venv\Scripts\activate
    echo   pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)
echo Dependencies installed successfully
echo.

REM Launch the application
echo ============================================================
echo  Starting Real-Time Vision System...
echo ============================================================
echo.
echo System will start in 2 seconds...
echo - Camera will activate automatically
echo - Dashboard will open at http://localhost:5000
echo - Audio will start automatically
echo.
echo Press Ctrl+C to stop the system
echo ============================================================
echo.

timeout /t 2 /nobreak >nul

REM Run the main application
python main.py

REM If the application exits with an error, keep window open
if %errorlevel% neq 0 (
    echo.
    echo ============================================================
    echo [ERROR] Application stopped with error code: %errorlevel%
    echo ============================================================
    echo.
    pause
)
