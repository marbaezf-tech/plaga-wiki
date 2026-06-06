@echo off
chcp 65001 >nul
title Configurar Python - Variables de Entorno

echo.
echo  ══════════════════════════════════════════════════
echo   CONFIGURAR PYTHON — Variables de Entorno
echo   Ejecutar como ADMINISTRADOR
echo  ══════════════════════════════════════════════════
echo.

:: Verificar si Python ya está en PATH
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo   Python ya esta en PATH:
    python --version
    echo.
    echo   ¿Quieres reconfigurar de todos modos? (S/N)
    set /p RESP=   > 
    if /I not "%RESP%"=="S" goto :FIN
)

:: Buscar Python en ubicaciones comunes
echo   Buscando Python instalado...
echo.

set PYTHON_FOUND=

:: Ubicaciones comunes de Python en Windows
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python312"
    "%LOCALAPPDATA%\Programs\Python\Python311"
    "%LOCALAPPDATA%\Programs\Python\Python310"
    "C:\Python312"
    "C:\Python311"
    "C:\Python310"
    "%PROGRAMFILES%\Python312"
    "%PROGRAMFILES%\Python311"
    "%PROGRAMFILES%\Python310"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python312"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python311"
    "%USERPROFILE%\AppData\Local\Programs\Python\Python310"
) do (
    if exist "%%~P\python.exe" (
        echo   ENCONTRADO: %%~P
        set PYTHON_FOUND=%%~P
    )
)

if "%PYTHON_FOUND%"=="" (
    echo.
    echo   ❌ Python NO encontrado. Instalalo primero:
    echo      https://www.python.org/downloads/
    echo.
    echo   IMPORTANTE durante la instalacion:
    echo   ✅ Marca "Add Python to PATH"
    echo   ✅ Marca "Install for all users"
    echo.
    pause
    exit /b 1
)

echo.
echo   Usando: %PYTHON_FOUND%
echo.

:: Agregar Python al PATH del sistema (permanente)
echo   Agregando al PATH del sistema...

:: Python principal
setx PATH "%PYTHON_FOUND%;%PYTHON_FOUND%\Scripts;%PATH%" /M >nul 2>nul
if %errorlevel% neq 0 (
    echo   ⚠️  No se pudo modificar PATH del sistema.
    echo   Ejecuta este script como ADMINISTRADOR (click derecho → Ejecutar como admin)
    echo.
    echo   Alternativa: agregar manualmente al PATH del USUARIO:
    setx PATH "%PYTHON_FOUND%;%PYTHON_FOUND%\Scripts;%PATH%"
    echo   PATH de usuario actualizado.
) else (
    echo   ✅ PATH del sistema actualizado
)

:: Configurar variables de entorno útiles
echo.
echo   Configurando variables de entorno...

:: UTF-8 por defecto (evita problemas con acentos)
setx PYTHONUTF8 1 /M >nul 2>nul
if %errorlevel% neq 0 (
    setx PYTHONUTF8 1
)
echo   ✅ PYTHONUTF8=1 (soporte de acentos/español)

:: Evitar que Python genere .pyc (menos basura en las carpetas)
setx PYTHONDONTWRITEBYTECODE 1 /M >nul 2>nul
if %errorlevel% neq 0 (
    setx PYTHONDONTWRITEBYTECODE 1
)
echo   ✅ PYTHONDONTWRITEBYTECODE=1 (sin archivos .pyc)

:: Pip sin confirmación
setx PIP_DISABLE_PIP_VERSION_CHECK 1 /M >nul 2>nul
if %errorlevel% neq 0 (
    setx PIP_DISABLE_PIP_VERSION_CHECK 1
)
echo   ✅ PIP_DISABLE_PIP_VERSION_CHECK=1

echo.
echo  ══════════════════════════════════════════════════
echo   CONFIGURACION COMPLETADA
echo  ══════════════════════════════════════════════════
echo.
echo   Variables configuradas:
echo     PATH     → %PYTHON_FOUND% + Scripts
echo     PYTHONUTF8 → 1
echo     PYTHONDONTWRITEBYTECODE → 1
echo.
echo   IMPORTANTE: Cierra y reabre la terminal para que
echo   los cambios tomen efecto.
echo.
echo   Verificacion rapida (en nueva terminal):
echo     python --version
echo     pip --version
echo.

:FIN
pause
