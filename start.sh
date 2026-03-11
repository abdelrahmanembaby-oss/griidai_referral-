#!/bin/bash

# Script to run both frontend and backend

echo "Starting GriidAi Application..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python is not installed"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Setup and start backend
echo "Installing backend dependencies..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

# Start backend in background
echo "Starting FastAPI backend on http://localhost:8000..."
python main.py &
BACKEND_PID=$!

# Go back to root
cd ..

# Setup and start frontend
echo "Checking frontend dependencies..."
cd app

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start frontend
echo "Starting React frontend on http://localhost:5173..."
npm run dev

# Cleanup
wait $BACKEND_PID
