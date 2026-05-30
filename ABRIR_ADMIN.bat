@echo off
title Plaga Wiki - Servidor Admin
echo.
echo  Iniciando servidor de la wiki...
echo  Abre http://localhost:3001/admin.html en tu browser
echo.
echo  Para cerrar el servidor, cierra esta ventana.
echo.

cd /d "%~dp0"
start "" "http://localhost:3001/admin.html"
node server.js
pause
