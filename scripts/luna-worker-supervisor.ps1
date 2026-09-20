<#
.SYNOPSIS
    Luna Worker Supervisor (Windows Host -> WSL Ubuntu)
    Maintains a resilient foreground WSL worker process for autonomous task execution.
    Implements Section 9 of Luna Watcher: reliable task execution specification.

.DESCRIPTION
    Monitors node bin/luna-dev-worker.mjs in WSL Ubuntu.
    Restarts on unexpected crash with exponential backoff.
    Provides Start, Stop, Status, and Scheduled Task registration.
#>

param(
    [switch]$Start,
    [switch]$Stop,
    [switch]$Status,
    [switch]$InstallTask,
    [switch]$UninstallTask,
    [int]$MaxRestarts = 50
)

$LunaDir = "$env:USERPROFILE\.luna"
if (-not (Test-Path $LunaDir)) {
    New-Item -ItemType Directory -Path $LunaDir -Force | Out-Null
}

$PidFile = Join-Path $LunaDir "supervisor.pid"
$LogFile = Join-Path $LunaDir "supervisor.log"
$StatusFile = Join-Path $LunaDir "supervisor.status"
$TaskName = "LunaExecutionWorker"

function Write-Log {
    param([string]$Message)
    $timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
    $line = "[$timestamp] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding utf8
}

function Get-SupervisorProcess {
    if (Test-Path $PidFile) {
        $spid = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($spid) {
            $proc = Get-Process -Id $spid -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -match "powershell|pwsh") {
                return $proc
            }
        }
    }
    return $null
}

if ($Status) {
    $proc = Get-SupervisorProcess
    if ($proc) {
        Write-Host "[Luna Supervisor] Status: RUNNING (PID: $($proc.Id))" -ForegroundColor Green
        if (Test-Path $StatusFile) {
            Get-Content $StatusFile | Write-Host
        }
    } else {
        Write-Host "[Luna Supervisor] Status: STOPPED" -ForegroundColor Yellow
    }
    exit 0
}

if ($Stop) {
    Write-Host "[Luna Supervisor] Stopping supervisor and worker..." -ForegroundColor Cyan
    $proc = Get-SupervisorProcess
    if ($proc) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "[Luna Supervisor] Terminated supervisor process."
    }
    wsl.exe -d Ubuntu -u ben -e bash -c "pkill -f 'bin/luna-dev-worker.mjs' 2>/dev/null"
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
    Set-Content -Path $StatusFile -Value "STOPPED at $(Get-Date)"
    Write-Host "[Luna Supervisor] Successfully stopped." -ForegroundColor Green
    exit 0
}

if ($InstallTask) {
    Write-Host "[Luna Supervisor] Installing Windows Scheduled Task: $TaskName..." -ForegroundColor Cyan
    $scriptPath = $MyInvocation.MyCommand.Definition
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Start"
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Luna Autonomous Execution Worker Host Supervisor" -Force
    Write-Host "[Luna Supervisor] Scheduled task $TaskName registered successfully." -ForegroundColor Green
    exit 0
}

if ($UninstallTask) {
    Write-Host "[Luna Supervisor] Unregistering Scheduled Task: $TaskName..." -ForegroundColor Cyan
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "[Luna Supervisor] Scheduled task removed." -ForegroundColor Green
    exit 0
}

# ─── Start Supervisor Loop ───────────────────────────────────────────────────
$existing = Get-SupervisorProcess
if ($existing) {
    Write-Host "[Luna Supervisor] Already running under PID $($existing.Id). Use -Stop first if restarting." -ForegroundColor Yellow
    exit 0
}

$PID | Out-File -FilePath $PidFile -Encoding ascii -Force
Write-Log "[Luna Supervisor] Started supervisor under PID $PID"

$restarts = 0
$baseBackoffSec = 5

try {
    while ($restarts -lt $MaxRestarts) {
        $statusJson = @{
            status = "RUNNING"
            supervisorPid = $PID
            restarts = $restarts
            lastStartedAt = (Get-Date).ToString("o")
        } | ConvertTo-Json -Compress
        Set-Content -Path $StatusFile -Value $statusJson

        Write-Log "[Luna Supervisor] Launching worker in WSL (attempt $($restarts + 1))..."
        
        $wslArgs = @("-d", "Ubuntu", "-u", "ben", "--cd", "/home/ben/.openclaw/workspace/loops-app", "node", "bin/luna-dev-worker.mjs")
        $startTime = Get-Date
        
        $p = Start-Process -FilePath "wsl.exe" -ArgumentList $wslArgs -NoNewWindow -PassThru -Wait
        $exitCode = $p.ExitCode
        $runtime = (Get-Date) - $startTime

        Write-Log "[Luna Supervisor] Worker exited with code $exitCode after $([int]$runtime.TotalSeconds)s"

        if ($exitCode -eq 0) {
            $restarts = 0
            $backoff = $baseBackoffSec
        } else {
            $restarts++
            $backoff = [Math]::Min(60, $baseBackoffSec * [Math]::Pow(1.5, [Math]::Min($restarts, 6)))
        }

        Write-Log "[Luna Supervisor] Backing off for $([int]$backoff)s before next launch..."
        Start-Sleep -Seconds $backoff
    }
} finally {
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
    Set-Content -Path $StatusFile -Value "STOPPED at $(Get-Date)"
    Write-Log "[Luna Supervisor] Supervisor exiting."
}
