$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'Сайт буде доступний за адресою http://localhost:8080' -ForegroundColor Green
npx --yes serve -l 8080 .
