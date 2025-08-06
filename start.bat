@echo off

REM Set the title of the main window
TITLE Quotation App Launcher

REM Get the directory of the batch file
SET "BASE_DIR=%~dp0"

REM Function to check if a process is running on a specific port
:check_port
  echo Checking port %1...
  for /f "tokens=5" %%a in ('netstat -aon ^| find ":%1" ^| find "LISTENING"') do (
    if not "%%a"=="0" (
      echo Port %1 is in use by PID %%a.
      exit /b 1
    )
  )
  echo Port %1 is free.
  exit /b 0

REM Check if servers are already running
call :check_port 3002
if %errorlevel% equ 1 (
  echo Backend server may already be running.
)

call :check_port 3000
if %errorlevel% equ 1 (
  echo Frontend server may already be running.
)

REM --- Start Backend Server ---
echo Starting backend server...
cd /D "%BASE_DIR%"
if exist node_modules ( 
    start "Backend Server" cmd /c "node server.js"
) else (
    echo Backend node_modules not found. Running npm install...
    start "Backend Setup" cmd /c "npm install && node server.js"
)

REM Give the backend a moment to start up
timeout /t 5 /nobreak >nul

REM --- Start Frontend Server ---
echo Starting frontend server...
cd /D "%BASE_DIR%frontend"
if exist node_modules (
    start "Frontend Server" cmd /c "npm start"
) else (
    echo Frontend node_modules not found. Running npm install...
    start "Frontend Setup" cmd /c "npm install && npm start"
)

echo.
echo Both servers have been launched in separate windows.
echo This window will close in 10 seconds.
timeout /t 10 >nul