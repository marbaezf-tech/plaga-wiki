@echo off
chcp 65001 >nul
title Instalador ComfyUI + Wan 2.1 (Video IA Local)

echo.
echo  ══════════════════════════════════════════════════
echo   INSTALADOR COMFYUI + WAN 2.1 (Video IA Local)
echo   Para RTX 3060 12GB / RTX 3060 Ti 8GB
echo  ══════════════════════════════════════════════════
echo.

:: Configuracion
set COMFY_DIR=C:\ComfyUI
set MODELO=1.3B

:: HuggingFace URLs (Comfy-Org repackaged)
set BASE_URL=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main
set COMFYUI_URL=https://github.com/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_nvidia.7z

echo  [1/5] Verificando curl...
where curl >nul 2>nul
if %errorlevel% neq 0 (
    echo   ERROR: curl no encontrado. Necesitas Windows 10+ o instalar curl.
    pause
    exit /b 1
)
echo   OK
echo.

:: Crear carpetas
echo  [2/5] Creando estructura de carpetas...
if not exist "%COMFY_DIR%" mkdir "%COMFY_DIR%"
if not exist "%COMFY_DIR%\models\diffusion_models" mkdir "%COMFY_DIR%\models\diffusion_models"
if not exist "%COMFY_DIR%\models\vae" mkdir "%COMFY_DIR%\models\vae"
if not exist "%COMFY_DIR%\models\text_encoders" mkdir "%COMFY_DIR%\models\text_encoders"
if not exist "%COMFY_DIR%\models\clip_vision" mkdir "%COMFY_DIR%\models\clip_vision"
echo   OK: %COMFY_DIR%
echo.

:: Descargar ComfyUI portable
echo  [3/5] Descargando ComfyUI portable...
echo   NOTA: Si ya tienes ComfyUI instalado, salta este paso (Ctrl+C y ejecuta de nuevo)
echo.
if exist "%COMFY_DIR%\run_nvidia_gpu.bat" (
    echo   ComfyUI ya existe, saltando...
) else (
    echo   Descargando desde GitHub (~1.5GB, puede tardar)...
    echo   URL: %COMFYUI_URL%
    echo.
    echo   IMPORTANTE: ComfyUI viene como .7z
    echo   Si no tienes 7-Zip, descarga manual:
    echo   https://github.com/comfyanonymous/ComfyUI/releases
    echo   Extrae el contenido en %COMFY_DIR%\
    echo.
    curl -L -o "%COMFY_DIR%\ComfyUI_portable.7z" "%COMFYUI_URL%"
    if %errorlevel% equ 0 (
        echo   Descargado. Extrae con 7-Zip en %COMFY_DIR%\
        echo   (mueve el contenido de la carpeta interna a %COMFY_DIR%\)
    ) else (
        echo   Error en descarga. Descarga manual desde el link de arriba.
    )
)
echo.

:: Descargar modelo Wan 2.1 1.3B (Text-to-Video)
echo  [4/5] Descargando modelos Wan 2.1...
echo.

echo   --- Modelo T2V 1.3B (~2.8GB) ---
if exist "%COMFY_DIR%\models\diffusion_models\wan2.1_t2v_1.3B_bf16.safetensors" (
    echo   Ya existe, saltando.
) else (
    echo   Descargando wan2.1_t2v_1.3B_bf16.safetensors ...
    curl -L -o "%COMFY_DIR%\models\diffusion_models\wan2.1_t2v_1.3B_bf16.safetensors" "%BASE_URL%/split_files/diffusion_models/wan2.1_t2v_1.3B_bf16.safetensors?download=true"
    if %errorlevel% equ 0 ( echo   OK ) else ( echo   ERROR en descarga )
)
echo.

echo   --- VAE (~300MB) ---
if exist "%COMFY_DIR%\models\vae\wan2.1_vae.safetensors" (
    echo   Ya existe, saltando.
) else (
    echo   Descargando wan2.1_vae.safetensors ...
    curl -L -o "%COMFY_DIR%\models\vae\wan2.1_vae.safetensors" "%BASE_URL%/split_files/vae/wan2.1_vae.safetensors?download=true"
    if %errorlevel% equ 0 ( echo   OK ) else ( echo   ERROR en descarga )
)
echo.

echo   --- Text Encoder UMT5-XXL fp8 (~5GB) ---
if exist "%COMFY_DIR%\models\text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors" (
    echo   Ya existe, saltando.
) else (
    echo   Descargando umt5_xxl_fp8_e4m3fn_scaled.safetensors ...
    curl -L -o "%COMFY_DIR%\models\text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors" "%BASE_URL%/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors?download=true"
    if %errorlevel% equ 0 ( echo   OK ) else ( echo   ERROR en descarga )
)
echo.

echo   --- CLIP Vision (~1.2GB) ---
if exist "%COMFY_DIR%\models\clip_vision\clip_vision_h.safetensors" (
    echo   Ya existe, saltando.
) else (
    echo   Descargando clip_vision_h.safetensors ...
    curl -L -o "%COMFY_DIR%\models\clip_vision\clip_vision_h.safetensors" "%BASE_URL%/split_files/clip_vision/clip_vision_h.safetensors?download=true"
    if %errorlevel% equ 0 ( echo   OK ) else ( echo   ERROR en descarga )
)
echo.

:: Resumen
echo  [5/5] RESUMEN
echo  ══════════════════════════════════════════════════
echo.
echo   Carpeta: %COMFY_DIR%
echo.
echo   Archivos descargados:
echo     models\diffusion_models\wan2.1_t2v_1.3B_bf16.safetensors
echo     models\vae\wan2.1_vae.safetensors
echo     models\text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors
echo     models\clip_vision\clip_vision_h.safetensors
echo.
echo   PASOS SIGUIENTES:
echo   1. Si descargaste el .7z, extraelo en %COMFY_DIR%\
echo      (que quede run_nvidia_gpu.bat en la raiz)
echo   2. Ejecuta: %COMFY_DIR%\run_nvidia_gpu.bat
echo   3. Abre en navegador: http://127.0.0.1:8188
echo   4. Carga un workflow de Wan 2.1 Text-to-Video
echo.
echo   TIPS para 12GB VRAM:
echo   - Usa 480p (no 720p)
echo   - Usa 24-33 frames (no 48+)
echo   - Si crashea, cierra Ollama primero: taskkill /f /im ollama.exe
echo.
echo  ══════════════════════════════════════════════════
pause
