@echo off
cd /d "%~dp0"
set "LUNA_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "LUNA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%LUNA_NODE%" build.mjs
if errorlevel 1 exit /b 1
"%LUNA_NODE%" serve.mjs
