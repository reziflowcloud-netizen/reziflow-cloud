@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-maintenance\runner.ps1" -Mode Apply %*
exit /b %errorlevel%
