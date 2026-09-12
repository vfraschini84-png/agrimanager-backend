# ============================================================
# Cropbook — Installa autostart Windows (Task Scheduler)
# ============================================================
# Esegui questo script UNA SOLA VOLTA come Amministratore:
#   PowerShell (Amministratore) → cd deploy-windows → .\install-autostart.ps1
# ============================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  CROPBOOK — Installazione autostart Windows" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# 1) Chiedi percorso Cropbook
$defaultDir = (Resolve-Path "$PSScriptRoot\..").Path
$projectDir = Read-Host "Percorso completo della cartella Cropbook [$defaultDir]"
if ([string]::IsNullOrWhiteSpace($projectDir)) { $projectDir = $defaultDir }
if (-not (Test-Path "$projectDir\www\server.js")) {
    Write-Host "[ERRORE] Non trovo www\server.js in '$projectDir'" -ForegroundColor Red
    exit 1
}

# 2) Chiedi dominio ngrok
$ngrokDomain = Read-Host "Il tuo dominio ngrok statico (es. cropbook-mario.ngrok-free.app)"
if ([string]::IsNullOrWhiteSpace($ngrokDomain)) {
    Write-Host "[ERRORE] Dominio ngrok obbligatorio" -ForegroundColor Red
    exit 1
}

# 3) Aggiorna start-ngrok.bat con il dominio
$ngrokBat = Join-Path $PSScriptRoot 'start-ngrok.bat'
if (Test-Path $ngrokBat) {
    $content = Get-Content $ngrokBat -Raw
    $content = $content -replace 'set NGROK_DOMAIN=.*', "set NGROK_DOMAIN=$ngrokDomain"
    Set-Content -Path $ngrokBat -Value $content -Encoding ASCII
    Write-Host "[OK] start-ngrok.bat aggiornato con dominio: $ngrokDomain" -ForegroundColor Green
}

# 4) Aggiorna .env — aggiunge il dominio ngrok in ALLOWED_ORIGINS e PUBLIC_URL
$envFile = Join-Path $projectDir 'www\.env'
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    $publicUrl  = "https://$ngrokDomain"

    # ALLOWED_ORIGINS: append se non già presente
    if ($envContent -notmatch [regex]::Escape($publicUrl)) {
        $envContent = $envContent -replace '(ALLOWED_ORIGINS=[^\r\n]*)', "`$1,$publicUrl"
    }
    # PUBLIC_URL: sostituisci con nuovo valore
    if ($envContent -match 'PUBLIC_URL=') {
        $envContent = $envContent -replace 'PUBLIC_URL=[^\r\n]*', "PUBLIC_URL=$publicUrl"
    } else {
        $envContent += "`nPUBLIC_URL=$publicUrl`n"
    }
    Set-Content -Path $envFile -Value $envContent -Encoding UTF8
    Write-Host "[OK] .env aggiornato con ALLOWED_ORIGINS + PUBLIC_URL" -ForegroundColor Green
}

# 5) Crea i due Task Scheduler
$serverBat = Join-Path $PSScriptRoot 'start-cropbook.bat'
$ngrokBat  = Join-Path $PSScriptRoot 'start-ngrok.bat'

# Rimuovi task esistenti (idempotente)
foreach ($n in @('Cropbook-Server','Cropbook-Ngrok')) {
    if (Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $n -Confirm:$false
        Write-Host "[INFO] Rimosso task esistente: $n" -ForegroundColor Yellow
    }
}

# Task 1: Cropbook Server (trigger at startup)
$serverAction  = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$serverBat`""
$serverTrigger = New-ScheduledTaskTrigger -AtStartup
$serverSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
$serverPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Cropbook-Server' -Action $serverAction -Trigger $serverTrigger -Settings $serverSettings -Principal $serverPrincipal -Description 'Avvia il server Cropbook (Node.js) automaticamente al boot' | Out-Null
Write-Host "[OK] Task 'Cropbook-Server' registrato (parte al boot)" -ForegroundColor Green

# Task 2: Ngrok Tunnel (trigger at startup, delayed 20s)
$ngrokAction   = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$ngrokBat`""
$ngrokTrigger  = New-ScheduledTaskTrigger -AtStartup
$ngrokTrigger.Delay = 'PT20S'  # aspetta 20s che il server sia su
$ngrokSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
$ngrokPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Cropbook-Ngrok' -Action $ngrokAction -Trigger $ngrokTrigger -Settings $ngrokSettings -Principal $ngrokPrincipal -Description 'Avvia il tunnel HTTPS ngrok verso Cropbook' | Out-Null
Write-Host "[OK] Task 'Cropbook-Ngrok' registrato (parte 20s dopo il boot)" -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  ✅ INSTALLAZIONE COMPLETATA" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Riavvia il PC per testare l'autostart, oppure lancia subito:" -ForegroundColor White
Write-Host "     Start-ScheduledTask -TaskName 'Cropbook-Server'" -ForegroundColor Gray
Write-Host "     Start-ScheduledTask -TaskName 'Cropbook-Ngrok'" -ForegroundColor Gray
Write-Host ""
Write-Host "  App locale:    http://localhost:3000" -ForegroundColor White
Write-Host "  App pubblica:  https://$ngrokDomain" -ForegroundColor White
Write-Host ""
Write-Host "  Per rimuovere:  .\uninstall-autostart.ps1" -ForegroundColor Gray
Write-Host "============================================================`n" -ForegroundColor Cyan
