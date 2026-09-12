@echo off
REM ============================================================
REM Cropbook — Avvio Ngrok con dominio statico
REM ============================================================
REM PRIMA di eseguire questo script devi:
REM  1) Aver configurato ngrok authtoken (ngrok config add-authtoken ...)
REM  2) Aver riservato un dominio statico su
REM     https://dashboard.ngrok.com/domains
REM  3) Sostituito TUO-DOMINIO-STATICO.ngrok-free.app qui sotto con il tuo
REM ============================================================

set NGROK_DOMAIN=TUO-DOMINIO-STATICO.ngrok-free.app
set NGROK_PORT=3000

REM Cartella logs (comune con start-cropbook.bat)
set SCRIPT_DIR=%~dp0
set LOGS_DIR=%SCRIPT_DIR%logs
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

REM Verifica presenza ngrok
where ngrok >nul 2>nul
if errorlevel 1 (
    echo [ERRORE] ngrok non trovato nel PATH. Installalo da https://ngrok.com/download
    pause
    exit /b 1
)

if "%NGROK_DOMAIN%"=="TUO-DOMINIO-STATICO.ngrok-free.app" (
    echo [ERRORE] Modifica start-ngrok.bat: sostituisci TUO-DOMINIO-STATICO.ngrok-free.app
    echo         con il dominio che hai creato su https://dashboard.ngrok.com/domains
    pause
    exit /b 1
)

echo [INFO] Avvio tunnel Ngrok: https://%NGROK_DOMAIN% -^> http://localhost:%NGROK_PORT%
ngrok http --domain=%NGROK_DOMAIN% %NGROK_PORT% --log=stdout > "%LOGS_DIR%\ngrok.log" 2>&1

echo [WARN] Ngrok si e' arrestato. Controlla logs\ngrok.log
pause
