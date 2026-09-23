@echo off
cd /d "%~dp0"
echo Launching Emberweave Brain (Electron)...
"%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
pause
