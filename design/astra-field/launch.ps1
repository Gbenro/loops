$ErrorActionPreference = 'Stop'
$lunaRepository = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $lunaRepository
& node node_modules/vite/bin/vite.js --config vite.astra-preview.config.js
