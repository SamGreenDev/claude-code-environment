@echo off
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js 18+ is required on Windows
    exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set NODE_VER=%%v
set NODE_VER=%NODE_VER:v=%
if %NODE_VER% LSS 18 (
    echo ERROR: Node.js 18+ is required. Found v%NODE_VER%.
    exit /b 1
)
node "%~dp0install.mjs" %*
