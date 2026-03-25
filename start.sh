#!/bin/bash

echo "🎬 YourTube - Starting Video Platform"
echo ""

# Check if .NET is installed
if ! command -v dotnet &> /dev/null
then
    echo "❌ .NET SDK not found. Please install .NET 8.0 or later."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js not found. Please install Node.js 18 or later."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Start .NET API in background
echo "🚀 Starting .NET API on port 5000..."
cd api
dotnet run &
API_PID=$!
cd ..

# Wait for API to start
sleep 3

# Start Next.js frontend
echo "🚀 Starting Next.js frontend on port 3000..."
cd ui

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

npm run dev &
UI_PID=$!
cd ..

echo ""
echo "✨ Platform is running!"
echo ""
echo "📺 Frontend: http://localhost:3000"
echo "🎥 API: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping services...'; kill $API_PID $UI_PID; exit" INT
wait
