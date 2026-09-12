@echo off
REM ============================================================
REM Cropbook — Avvio server locale su Windows
REM ============================================================
REM Questo script:
REM  - Va nella cartella www/ del progetto
REM  - Crea la cartella logs/ se manca
REM  - Avvia il server Node in background scrivendo i log
REM ============================================================

REM Salva il percorso della cartella di questo script
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set LOGS_DIR=%SCRIPT_DIR%logs

REM Crea logs dir se non esiste
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

REM Vai nella cartella del backend
cd /d "%PROJECT_ROOT%\www"

REM Verifica presenza node
where node >nul 2>nul
if errorlevel 1 (
    echo [ERRORE] Node.js non trovato. Installalo da https://nodejs.org
    pause
    exit /b 1
)

REM Verifica presenza node_modules
if not exist "node_modules" (
    echo [INFO] node_modules mancante, eseguo npm install...
    call npm install
)

REM Avvia Cropbook, scrive log in logs/cropbook.log e stderr in logs/cropbook.err.log
echo [INFO] Avvio Cropbook su http://localhost:3000 ...
node server.js > "%LOGS_DIR%\cropbook.log" 2> "%LOGS_DIR%\cropbook.err.log"

REM Se arrivi qui il server si è spento
echo [WARN] Cropbook si e' arrestato. Controlla logs\cropbook.err.log
pause
