@echo off
echo 🎬 YourTube - Starting Video Platform
echo.

REM Check if .NET is installed
where dotnet >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ .NET SDK not found. Please install .NET 8.0 or later.
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install Node.js 18 or later.
    exit /b 1
)

echo ✅ Prerequisites check passed
echo.

REM Start .NET API
echo 🚀 Starting .NET API on port 5000...
cd api
start "YourTube API" dotnet run
cd ..

REM Wait a moment for API to start
timeout /t 3 /nobreak >nul

REM Start Next.js frontend
echo 🚀 Starting Next.js frontend on port 3000...
cd ui

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

start "YourTube Frontend" npm run dev
cd ..

echo.
echo ✨ Platform is running!
echo.
echo 📺 Frontend: http://localhost:3000
echo 🎥 API: http://localhost:5000
echo.
echo Press any key to stop all services...
pause >nul

REM Attempt to close the services (may not work on all Windows versions)
taskkill /FI "WINDOWTITLE eq YourTube*" /F >nul 2>nul
