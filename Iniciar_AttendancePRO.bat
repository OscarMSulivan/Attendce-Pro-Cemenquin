@echo off
title AttendancePRO v2.0 - Servidor Local
echo ========================================================
echo   Iniciando AttendancePRO v2.0 (Control de Asistencia)
echo ========================================================
echo.

if not exist "node_modules" (
    echo [1/2] Instalando dependencias por primera vez...
    call npm install
)

echo [2/2] Abriendo navegador en http://localhost:3000 ...
start http://localhost:3000
call npm run dev -- --port 3000
pause
