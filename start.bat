@echo off
REM Script to run both frontend and backend

echo Starting GriidAi Application...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt

REM Start backend in a new window
echo Starting FastAPI backend on http://localhost:8000...
start "FastAPI Backend" python main.py

REM Go back to root
cd ..

REM Install frontend dependencies if needed
echo Checking frontend dependencies...
cd app
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
)

REM Start frontend
echo Starting React frontend on http://localhost:5173...
npm run dev

pause
