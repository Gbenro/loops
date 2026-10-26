@echo off
setlocal
cd /d "%~dp0"
set "LUNA_JOURNEY_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "LUNA_JOURNEY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%LUNA_JOURNEY_NODE%" build.mjs
if errorlevel 1 goto done
echo Open http://127.0.0.1:5181/ in your browser. Keep this window open while reviewing.
"%LUNA_JOURNEY_NODE%" serve.mjs
:done
pause
