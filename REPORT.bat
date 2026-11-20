@echo off
setlocal DisableDelayedExpansion
set "LMR_PWSH="
for %%P in (pwsh.exe) do set "LMR_PWSH=%%~$PATH:P"
if not defined LMR_PWSH (
  >&2 echo LOCAL MAINTENANCE BLOCKED: POWERSHELL_7_NOT_FOUND
  exit /b 78
)
"%LMR_PWSH%" -NoLogo -NoProfile -NonInteractive -Command "if ($PSVersionTable.PSEdition -ne 'Core' -or $PSVersionTable.PSVersion.Major -lt 7) { exit 78 }; exit 0"
if not "%errorlevel%"=="0" (
  >&2 echo LOCAL MAINTENANCE BLOCKED: OPERATOR_REQUIRES_POWERSHELL_7
  exit /b 78
)
"%LMR_PWSH%" -NoLogo -NoProfile -File "%~dp0scripts\local-maintenance\runner.ps1" -Mode Report %*
exit /b %errorlevel%
