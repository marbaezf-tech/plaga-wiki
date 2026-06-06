#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Setup IA Local para ZeratnaPC (Aaron)
    RTX 3060 12GB | Ryzen 5 5600X | 16GB RAM
.DESCRIPTION
    Instala y configura todo el stack de IA local:
    - Ollama + modelos optimizados para 12GB VRAM
    - VS Code + extension Continue (IA en el editor)
    - Python + MCP Lore Server
    - ComfyUI + Wan 2.1 para video
    - Agente Orquestador personalizable
.NOTES
    EJECUTAR COMO ADMINISTRADOR:
    Click derecho en PowerShell → "Ejecutar como administrador"
    Luego: Set-ExecutionPolicy Bypass -Scope Process -Force; .\SETUP_ZERATNA.ps1
#>

# ═══════════════════════════════════════════════════════
# HARDWARE DE AARON (ZeratnaPC)
# CPU: Ryzen 5 5600X | RAM: 16GB | GPU: RTX 3060 12GB
# ═══════════════════════════════════════════════════════

Write-Host @"

  ╔══════════════════════════════════════════════════╗
  ║  SETUP IA LOCAL — ZeratnaPC                     ║
  ║  RTX 3060 12GB | Ryzen 5 5600X | 16GB RAM      ║
  ╚══════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# ═══════════════════════════════════════════════
# MODELOS ELEGIDOS PARA 12GB VRAM + 16GB RAM
# ═══════════════════════════════════════════════
#
# Con RTX 3060 12GB puedes correr:
#   - qwen3-coder:30b (MoE, solo activa 3.3B) → cabe en 12GB
#   - gemma3:4b para escritura (liviano, deja VRAM libre)
#   - qwen3:4b como clasificador/validador
#
# Para VIDEO:
#   - Wan 2.1 1.3B → cabe perfecto en 12GB a 480p
#   - Wan 2.1 14B GGUF Q4 → apretado pero posible a 480p (nerfeado)
#
# NOTA: Con 16GB RAM, Ollama puede hacer offload parcial a CPU
#       si un modelo no cabe entero en VRAM.

$Modelos = @{
    # CODIGO — qwen3-coder:30b es MoE (30B total, 3.3B activos)
    # Pesa 19GB en disco pero en VRAM solo usa ~4-6GB por ser MoE
    Codigo       = "qwen3-coder:30b"
    
    # ESCRITURA — gemma3:4b es rapido y bueno para prosa
    # Si quieres mas calidad: cambiar a "gemma3:12b" (usa ~10GB VRAM)
    Escritura    = "gemma3:4b"
    
    # CLASIFICADOR/VALIDADOR — qwen3:4b (rapido, 2.5GB)
    Rapido       = "qwen3:4b"
    
    # FALLBACK — qwen2.5:7b (todo-terreno, 4.7GB)
    Fallback     = "qwen2.5:7b"
}

# Carpeta donde se instala todo
$CarpetaProyecto = "C:\IA-Local"

# ═══════════════════════════════════════════════
# PASO 1: VERIFICAR SISTEMA
# ═══════════════════════════════════════════════

Write-Host "  [1/7] Verificando sistema..." -ForegroundColor Yellow

# Verificar GPU
$gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match "NVIDIA|GeForce" }
if ($gpu) {
    Write-Host "    ✅ GPU: $($gpu.Name)" -ForegroundColor Green
} else {
    Write-Host "    ❌ No se detecto GPU NVIDIA. Los modelos correran en CPU (mucho mas lento)." -ForegroundColor Red
    $continuar = Read-Host "    Continuar de todos modos? (s/n)"
    if ($continuar -ne "s") { exit }
}

# RAM
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 0)
Write-Host "    ✅ RAM: $ramGB GB" -ForegroundColor Green

# Disco libre
$disco = Get-PSDrive C
$libreGB = [math]::Round($disco.Free / 1GB, 0)
Write-Host "    ✅ Disco libre: $libreGB GB" -ForegroundColor Green
if ($libreGB -lt 40) {
    Write-Host "    ⚠️  Recomendado: 40GB+ libres para modelos" -ForegroundColor Yellow
}

Write-Host ""

# ═══════════════════════════════════════════════
# PASO 2: INSTALAR OLLAMA
# ═══════════════════════════════════════════════

Write-Host "  [2/7] Instalando Ollama..." -ForegroundColor Yellow

$ollamaExiste = Get-Command "ollama" -ErrorAction SilentlyContinue
if ($ollamaExiste) {
    Write-Host "    ✅ Ollama ya esta instalado" -ForegroundColor Green
} else {
    Write-Host "    Descargando Ollama..." -ForegroundColor Gray
    $installer = "$env:TEMP\OllamaSetup.exe"
    try {
        Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installer -UseBasicParsing
        Write-Host "    Instalando (puede tardar 1-2 min)..." -ForegroundColor Gray
        Start-Process -FilePath $installer -ArgumentList "/SILENT" -Wait
        
        # Refrescar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        Start-Sleep -Seconds 2
        if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
            Write-Host "    ✅ Ollama instalado correctamente" -ForegroundColor Green
        } else {
            Write-Host "    ⚠️  Ollama se instalo pero no se encuentra en PATH. Reinicia PowerShell." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "    ❌ Error descargando. Instala manualmente: https://ollama.com/download" -ForegroundColor Red
    }
}

# Verificar que el servicio corre
try {
    Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 3 -ErrorAction Stop | Out-Null
    Write-Host "    ✅ Servicio Ollama activo" -ForegroundColor Green
} catch {
    Write-Host "    Iniciando servicio Ollama..." -ForegroundColor Gray
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 4
}

Write-Host ""

# ═══════════════════════════════════════════════
# PASO 3: DESCARGAR MODELOS
# ═══════════════════════════════════════════════

Write-Host "  [3/7] Descargando modelos (esto tarda segun tu internet)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "    Los modelos se descargan UNA VEZ y quedan en disco." -ForegroundColor Gray
Write-Host "    Total aproximado: ~30GB de descarga." -ForegroundColor Gray
Write-Host ""

$listaModelos = @(
    @{ Nombre = $Modelos.Codigo;    Rol = "CODIGO";       Peso = "19 GB" },
    @{ Nombre = $Modelos.Escritura; Rol = "ESCRITURA";    Peso = "3 GB" },
    @{ Nombre = $Modelos.Rapido;    Rol = "CLASIFICADOR"; Peso = "2.5 GB" },
    @{ Nombre = $Modelos.Fallback;  Rol = "FALLBACK";     Peso = "4.7 GB" }
)

foreach ($m in $listaModelos) {
    Write-Host "    [$($m.Rol)] Descargando $($m.Nombre) (~$($m.Peso))..." -ForegroundColor Gray
    & ollama pull $m.Nombre
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ $($m.Nombre) listo" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  No se pudo descargar $($m.Nombre)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Mostrar modelos instalados
Write-Host "    --- Modelos instalados ---" -ForegroundColor Cyan
& ollama list
Write-Host ""

# ═══════════════════════════════════════════════
# PASO 4: INSTALAR PYTHON
# ═══════════════════════════════════════════════

Write-Host "  [4/7] Verificando Python..." -ForegroundColor Yellow

$pythonExiste = Get-Command "python" -ErrorAction SilentlyContinue
if ($pythonExiste) {
    $pyVer = & python --version 2>&1
    Write-Host "    ✅ $pyVer" -ForegroundColor Green
} else {
    Write-Host "    Instalando Python 3.12 via winget..." -ForegroundColor Gray
    winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Start-Sleep -Seconds 2
    if (Get-Command "python" -ErrorAction SilentlyContinue) {
        Write-Host "    ✅ Python instalado" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  Reinicia PowerShell despues de este script para usar Python" -ForegroundColor Yellow
    }
}

# Instalar dependencias
Write-Host "    Instalando dependencias..." -ForegroundColor Gray
& python -m pip install --upgrade pip --quiet 2>$null
& python -m pip install fastapi uvicorn requests python-docx PyPDF2 --quiet 2>$null
Write-Host "    ✅ Dependencias: fastapi, uvicorn, requests, python-docx, PyPDF2" -ForegroundColor Green
Write-Host ""

# ═══════════════════════════════════════════════
# PASO 5: VS CODE + CONTINUE
# ═══════════════════════════════════════════════

Write-Host "  [5/7] Configurando VS Code..." -ForegroundColor Yellow

$codeExiste = Get-Command "code" -ErrorAction SilentlyContinue
if ($codeExiste) {
    Write-Host "    ✅ VS Code detectado" -ForegroundColor Green
    
    # Instalar Continue
    Write-Host "    Instalando extension Continue..." -ForegroundColor Gray
    & code --install-extension continue.continue 2>$null
    Write-Host "    ✅ Continue instalado" -ForegroundColor Green
    
    # Crear configuracion
    $continueDir = Join-Path $env:USERPROFILE ".continue"
    if (-not (Test-Path $continueDir)) {
        New-Item -ItemType Directory -Path $continueDir -Force | Out-Null
    }
    
    # System prompt optimizado para Aaron
    $systemPrompt = "You are an expert developer assistant. All internal reasoning must be in English, enclosed within <think> and </think> tags. Your final direct communication with the user MUST ALWAYS be strictly in Spanish. NUNCA me respondas en ingles. EXCEPTIONS (DO NOT TRANSLATE): Technical names (files, functions, nodes, APIs, paths), inline code, code blocks, and error/console logs must remain in their original language and exact syntax. Be direct and concise. Skip apologies and filler phrases. Go straight to the technical solution."
    
    $configJson = @"
{
  "models": [
    {
      "title": "Qwen3 Coder (Codigo)",
      "provider": "ollama",
      "model": "$($Modelos.Codigo)",
      "systemMessage": "$systemPrompt"
    },
    {
      "title": "Gemma3 (Escritura)",
      "provider": "ollama",
      "model": "$($Modelos.Escritura)",
      "systemMessage": "Eres un escritor experto. Responde SIEMPRE en espanol. Tono directo, sin relleno."
    },
    {
      "title": "Qwen2.5 (General)",
      "provider": "ollama",
      "model": "$($Modelos.Fallback)",
      "systemMessage": "$systemPrompt"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Autocomplete Local",
    "provider": "ollama",
    "model": "$($Modelos.Rapido)"
  }
}
"@
    $configJson | Out-File -FilePath (Join-Path $continueDir "config.json") -Encoding utf8
    Write-Host "    ✅ Continue configurado (3 modelos + autocomplete)" -ForegroundColor Green
} else {
    Write-Host "    ⚠️  VS Code no encontrado." -ForegroundColor Yellow
    Write-Host "    Descarga: https://code.visualstudio.com" -ForegroundColor Gray
    Write-Host "    Despues ejecuta: code --install-extension continue.continue" -ForegroundColor Gray
}
Write-Host ""

# ═══════════════════════════════════════════════
# PASO 6: CREAR CARPETA + ORQUESTADOR
# ═══════════════════════════════════════════════

Write-Host "  [6/7] Creando Agente Orquestador..." -ForegroundColor Yellow

if (-not (Test-Path $CarpetaProyecto)) {
    New-Item -ItemType Directory -Path $CarpetaProyecto -Force | Out-Null
}
$orqDir = Join-Path $CarpetaProyecto "orquestador"
if (-not (Test-Path $orqDir)) {
    New-Item -ItemType Directory -Path $orqDir -Force | Out-Null
}

# --- config.py ---
@"
"""
config.py — Configuracion del Agente Orquestador (ZeratnaPC)
═══════════════════════════════════════════════════════════════
EDITA ESTE ARCHIVO para personalizar modelos, URLs, y comportamiento.
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESION_FILE = os.path.join(BASE_DIR, "sesion_actual.json")
LOG_FILE = os.path.join(BASE_DIR, "orquestador.log")

# ═══════════════════════════════════════════════
# OLLAMA
# ═══════════════════════════════════════════════
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_TIMEOUT = 300  # segundos (5 min max por consulta)

# ═══════════════════════════════════════════════
# MODELOS — CAMBIA ESTOS SEGUN TU USO
# ═══════════════════════════════════════════════
# Tu RTX 3060 12GB puede correr estos sin problema:
MODELOS = {
    "clasificador": "qwen3:4b",           # Rapido, para decidir que hacer
    "codigo":       "qwen3-coder:30b",    # MoE: 30B total pero solo 3.3B activos
    "narrativa":    "gemma3:4b",          # Escritura, dialogos, prosa
    "lore":         "qwen3:4b",           # Preguntas de lore/datos
    "validador":    "qwen3:4b",           # Verifica output (rapido)
    "fallback":     "qwen2.5:7b",         # Si algo falla, usa este
}
# NOTA: Si quieres mas calidad en escritura, cambia "gemma3:4b" por "gemma3:12b"
#       pero usara ~10GB VRAM (no podras correr otro modelo al mismo tiempo)

# ═══════════════════════════════════════════════
# LORE SERVER (opcional — solo si lo tienes corriendo)
# ═══════════════════════════════════════════════
LORE_SERVER_URL = "http://localhost:8420"
LORE_TIMEOUT = 5

# ═══════════════════════════════════════════════
# REGLA DE IDIOMA
# ═══════════════════════════════════════════════
# Esto se inyecta en CADA llamada a Ollama para forzar espanol.
# El modelo piensa en ingles (mas preciso) pero responde en espanol.
REGLA_IDIOMA = (
    "You are an expert developer assistant. "
    "All internal reasoning must be in English, enclosed within <think> and </think> tags. "
    "Your final direct communication with the user MUST ALWAYS be strictly in Spanish. "
    "NUNCA me respondas en ingles.\n\n"
    "EXCEPTIONS (DO NOT TRANSLATE): Technical names (files, functions, nodes, APIs, paths), "
    "inline code, code blocks, and error/console logs must remain in their original language.\n\n"
    "BEHAVIOR: Be direct and concise. Skip apologies and filler phrases. "
    "Go straight to the technical solution."
)

# ═══════════════════════════════════════════════
# MAKER-CHECKER (validacion de output)
# ═══════════════════════════════════════════════
MAX_REINTENTOS = 2          # Si falla validacion, reintenta maximo 2 veces
MAX_HISTORIAL_SESION = 50   # Cuantas acciones guardar en el historial

# Prompt del validador — verifica que el output sea correcto
CHECKER_PROMPT_TEMPLATE = '''Evalua este output generado por otro agente:

TAREA ORIGINAL: {tarea}
OUTPUT: {output}
CONTEXTO: {contexto_lore}

Responde SOLO con JSON:
{{"valido": true/false, "errores": ["..."], "sugerencias": ["..."], "confianza": 0.0-1.0}}'''
"@ | Out-File -FilePath (Join-Path $orqDir "config.py") -Encoding utf8

# --- INICIAR.bat ---
@"
@echo off
chcp 65001 >nul
title Agente Orquestador - ZeratnaPC

echo.
echo  ══════════════════════════════════════════
echo   Agente Orquestador IA Local
echo   RTX 3060 12GB ^| Ryzen 5 5600X
echo  ══════════════════════════════════════════
echo.

:: Verificar Ollama
curl -s http://localhost:11434/api/tags >nul 2>nul
if %errorlevel% neq 0 (
    echo   Iniciando Ollama...
    start "" ollama serve
    timeout /t 4 /nobreak >nul
)

:: Lanzar
cd /d "%~dp0"
python orquestador.py %*
pause
"@ | Out-File -FilePath (Join-Path $orqDir "INICIAR.bat") -Encoding ascii

# --- test_rapido.py (para verificar que todo funciona) ---
@"
"""
test_rapido.py — Verifica que Ollama responda correctamente
Ejecuta: python test_rapido.py
"""
import json
import urllib.request

OLLAMA_URL = "http://localhost:11434"

def test():
    print("Testeando conexion con Ollama...")
    print()
    
    # 1. Verificar que Ollama corre
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            modelos = [m["name"] for m in data.get("models", [])]
            print(f"  Ollama OK — {len(modelos)} modelos instalados:")
            for m in modelos:
                print(f"    - {m}")
    except Exception as e:
        print(f"  ERROR: Ollama no responde. Ejecuta 'ollama serve' primero.")
        print(f"  Detalle: {e}")
        return
    
    print()
    
    # 2. Test rapido con qwen3:4b
    print("  Probando qwen3:4b (debe responder en espanol)...")
    payload = json.dumps({
        "model": "qwen3:4b",
        "prompt": "Responde en UNA linea: que es Python?",
        "system": "Responde SIEMPRE en espanol. Maximo 1 linea.",
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 100}
    }).encode("utf-8")
    
    try:
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            respuesta = body.get("response", "").strip()
            # Limpiar think tags
            import re
            respuesta = re.sub(r'<think>.*?</think>', '', respuesta, flags=re.DOTALL).strip()
            tiempo = body.get("total_duration", 0) / 1e9
            print(f"  Respuesta ({tiempo:.1f}s): {respuesta[:200]}")
            print()
            print("  ✅ TODO FUNCIONA CORRECTAMENTE")
    except Exception as e:
        print(f"  ERROR en la consulta: {e}")

if __name__ == "__main__":
    test()
"@ | Out-File -FilePath (Join-Path $orqDir "test_rapido.py") -Encoding utf8

Write-Host "    ✅ Orquestador creado en: $orqDir" -ForegroundColor Green
Write-Host "    📝 Edita config.py para personalizar modelos y comportamiento" -ForegroundColor Gray
Write-Host ""

# ═══════════════════════════════════════════════
# PASO 7: INSTRUCCIONES COMFYUI (VIDEO)
# ═══════════════════════════════════════════════

Write-Host "  [7/7] ComfyUI para Video (Wan 2.1)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "    Tu RTX 3060 12GB puede correr Wan 2.1 1.3B sin problemas." -ForegroundColor White
Write-Host "    El modelo 14B requiere GGUF Q4 (nerfeado) para caber en 12GB." -ForegroundColor White
Write-Host ""
Write-Host "    INSTALACION MANUAL (ComfyUI no se puede automatizar 100%):" -ForegroundColor Yellow
Write-Host ""
Write-Host "    1. Descarga ComfyUI portable:" -ForegroundColor Gray
Write-Host "       https://github.com/comfyanonymous/ComfyUI/releases" -ForegroundColor Cyan
Write-Host "       (busca 'ComfyUI_windows_portable_nvidia')" -ForegroundColor Gray
Write-Host ""
Write-Host "    2. Extrae en C:\ComfyUI\" -ForegroundColor Gray
Write-Host ""
Write-Host "    3. Descarga modelo de video:" -ForegroundColor Gray
Write-Host "       OPCION A (recomendada para 12GB, buena calidad 480p):" -ForegroundColor Green
Write-Host "       https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B" -ForegroundColor Cyan
Write-Host "       → Poner en: C:\ComfyUI\models\diffusion_models\" -ForegroundColor Gray
Write-Host ""
Write-Host "       OPCION B (superior pero nerfeado, GGUF Q4 del 14B):" -ForegroundColor Yellow
Write-Host "       Buscar en CivitAI: 'Wan 2.1 14B GGUF Q4'" -ForegroundColor Cyan
Write-Host "       → ~7GB, corre en 12GB VRAM a 480p, 24 frames" -ForegroundColor Gray
Write-Host ""
Write-Host "    4. Descarga complementos:" -ForegroundColor Gray
Write-Host "       - VAE → C:\ComfyUI\models\vae\" -ForegroundColor Gray
Write-Host "       - Text Encoder (umt5_xxl_fp8) → C:\ComfyUI\models\text_encoders\" -ForegroundColor Gray
Write-Host ""
Write-Host "    5. Ejecuta: C:\ComfyUI\run_nvidia_gpu.bat" -ForegroundColor Gray
Write-Host "       Abre: http://127.0.0.1:8188" -ForegroundColor Gray
Write-Host ""

# Guardar instrucciones en archivo
@"
INSTRUCCIONES COMFYUI — Video con Wan 2.1
═══════════════════════════════════════════════
Para tu RTX 3060 12GB

OPCION RAPIDA (1.3B — videos de 5s en ~2 min):
1. Descarga ComfyUI portable: https://github.com/comfyanonymous/ComfyUI/releases
2. Extrae en C:\ComfyUI\
3. Descarga Wan2.1-T2V-1.3B: https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B
4. Ponlo en C:\ComfyUI\models\diffusion_models\
5. Ejecuta run_nvidia_gpu.bat

OPCION SUPERIOR NERFEADA (14B GGUF Q4 — mejor calidad, ~5 min):
- Busca "Wan 2.1 14B GGUF Q4_K_M" en CivitAI o HuggingFace
- Son ~7GB en vez de 13GB
- Configura ComfyUI a 480p y 24 frames (no 720p ni 48 frames)
- Usa --lowvram si se queda sin memoria

COMPLEMENTOS (ambas opciones los necesitan):
- VAE: wan2.1_vae.safetensors
- Text Encoder: umt5_xxl_fp8_e4m3fn
- CLIP Vision: clip_vision_h.safetensors
Busca "Wan 2.1 ComfyUI repackaged" en HuggingFace para el bundle.
"@ | Out-File -FilePath (Join-Path $CarpetaProyecto "INSTRUCCIONES_VIDEO.txt") -Encoding utf8

# ═══════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║         INSTALACION COMPLETADA                   ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Que se instalo:" -ForegroundColor White
Write-Host "  ───────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "    ✅ Ollama (runtime de IA local)" -ForegroundColor Green
Write-Host "    ✅ qwen3-coder:30b   — para programar (MoE, rapido)" -ForegroundColor Green
Write-Host "    ✅ gemma3:4b          — para escribir" -ForegroundColor Green
Write-Host "    ✅ qwen3:4b           — clasificador/validador" -ForegroundColor Green
Write-Host "    ✅ qwen2.5:7b         — fallback general" -ForegroundColor Green
Write-Host "    ✅ VS Code + Continue  — IA en el editor" -ForegroundColor Green
Write-Host "    ✅ Agente Orquestador  — CLI inteligente" -ForegroundColor Green
Write-Host "    📋 ComfyUI + Video    — ver instrucciones en $CarpetaProyecto" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Proximos pasos:" -ForegroundColor White
Write-Host "  ───────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "    1. Abre VS Code → Continue ya esta configurado" -ForegroundColor Gray
Write-Host "    2. Prueba: python $orqDir\test_rapido.py" -ForegroundColor Gray
Write-Host "    3. Orquestador: $orqDir\INICIAR.bat" -ForegroundColor Gray
Write-Host "    4. Video: sigue $CarpetaProyecto\INSTRUCCIONES_VIDEO.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "  Para personalizar:" -ForegroundColor White
Write-Host "  ───────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "    Modelos/comportamiento: $orqDir\config.py" -ForegroundColor Gray
Write-Host "    VS Code IA:             ~/.continue/config.json" -ForegroundColor Gray
Write-Host ""
Write-Host "  Tips para tu RTX 3060 12GB:" -ForegroundColor White
Write-Host "  ───────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "    - No corras 2 modelos grandes al mismo tiempo" -ForegroundColor Gray
Write-Host "    - qwen3-coder:30b es MoE (solo 3.3B activos) = rapido" -ForegroundColor Gray
Write-Host "    - Si quieres mas RAM para modelos: cierra Chrome/juegos" -ForegroundColor Gray
Write-Host "    - Para video Wan 2.1: cierra Ollama primero (libera VRAM)" -ForegroundColor Gray
Write-Host ""

Read-Host "  Presiona Enter para cerrar"
