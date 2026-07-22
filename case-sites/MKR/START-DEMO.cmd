@echo off
rem MKR demo launcher — double-click me.
rem Serves this folder on http://localhost:8790 and opens:
rem   1) MKR showroom (live stock from hosted TruFlow Premium)
rem   2) TruFlow Premium DMS (hosted on Render)
cd /d "%~dp0"
start "MKR demo server" /min cmd /c "python -m http.server 8790"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8790"
start "" "https://trusaas-premium.onrender.com"
echo Demo running. Close the minimized "MKR demo server" window when done.
