#!/bin/bash
# EV-AI — Start full stack (backend + frontend)
# Usage: ./run.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "⚡ EV-AI Full Stack"
echo "===================="

# Check 3D model
if [ ! -f backend/ev_model.glb ]; then
    echo "📦 Generating 3D model..."
    python3 generate_model.py
fi

# Start backend
echo "🚀 Starting backend on :8000..."
backend/venv/bin/python backend/main.py &
BACKEND_PID=$!

# Start frontend
echo "🌐 Starting frontend on :3000..."
cd frontend && python3 -m http.server 3000 &
FRONTEND_PID=$!
cd ..

sleep 2
echo ""
echo "✅ Backend:  http://localhost:8000  (API docs: http://localhost:8000/docs)"
echo "✅ Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
