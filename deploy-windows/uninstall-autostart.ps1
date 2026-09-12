# ============================================================
# Cropbook — Disinstalla autostart Windows (Task Scheduler)
# ============================================================
# Esegui come Amministratore per rimuovere i 2 task pianificati.
# NON tocca la cartella del progetto o il DB.
# ============================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Continue'

Write-Host "`n[INFO] Rimuovo task pianificati Cropbook..." -ForegroundColor Yellow

foreach ($n in @('Cropbook-Server','Cropbook-Ngrok')) {
    $t = Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue
    if ($t) {
        Stop-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $n -Confirm:$false
        Write-Host "[OK] Rimosso: $n" -ForegroundColor Green
    } else {
        Write-Host "[SKIP] Non esiste: $n" -ForegroundColor Gray
    }
}

# Prova a killare eventuali processi ancora attivi
Get-Process -Name 'node','ngrok' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "[INFO] Chiudo processo $($_.ProcessName) (PID $($_.Id))" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "`n[OK] Autostart Cropbook rimosso.`n" -ForegroundColor Green
