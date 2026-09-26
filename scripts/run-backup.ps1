$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$folder = Join-Path $HOME 'ColegioGestaoBackups'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$logFile = Join-Path $folder 'backup-task.log'
$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$timestamp = Get-Date -Format o
Add-Content -Path $logFile -Value "[$timestamp] Iniciando backup automatico"
& $pnpm backup:run *>> $logFile
$exitCode = $LASTEXITCODE
$timestamp = Get-Date -Format o
Add-Content -Path $logFile -Value "[$timestamp] Codigo de saida: $exitCode"
exit $exitCode
