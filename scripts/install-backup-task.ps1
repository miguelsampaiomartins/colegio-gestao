$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Este instalador funciona somente no Windows.' }
$project = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $project '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Arquivo .env nao encontrado no projeto.' }
$lines = Get-Content -LiteralPath $envFile
foreach ($name in @('DATABASE_URL', 'BACKUP_KEY')) {
  if (-not ($lines | Where-Object { $_ -match ('^\s*' + $name + '\s*=\s*\S+') })) {
    throw "$name ausente no .env. Veja BACKUP.md antes de instalar a tarefa."
  }
}
Get-Command pnpm.cmd -ErrorAction Stop | Out-Null
$scriptPath = Join-Path $PSScriptRoot 'run-backup.ps1'
$taskName = 'ColegioGestao-BackupDiario'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  throw "A tarefa $taskName ja existe. Confira-a no Agendador de Tarefas; nenhuma configuracao foi sobrescrita."
}
$at = Read-Host 'Horario diario (HH:mm, ex.: 18:30; computador ligado e usuario conectado)'
if ($at -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { throw 'Formato de horario invalido. Use HH:mm (24h).' }
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $project
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings
Register-ScheduledTask -TaskName $taskName -InputObject $task | Out-Null
Write-Host "Tarefa $taskName criada para $at. O computador deve estar ligado e o usuario conectado."
Write-Host 'Nao compartilhe .env nem BACKUP_KEY. Rode pnpm.cmd backup:run uma vez e confirme o status no painel do dono.'
