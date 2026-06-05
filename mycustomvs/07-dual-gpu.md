# 07 — Dual GPU: Optimización

## El Problema

Con modelos de 7B+ parámetros y contextos largos (32K tokens), una sola GPU de 8GB no alcanza. El modelo se derrama a CPU (RAM) y se vuelve MUY lento.

## Diagnóstico

```bash
# Ver cómo está distribuyéndose el modelo
ollama ps
```

Si ves `42%/58% CPU/GPU` → estás usando CPU para parte del modelo. Lento.
Si ves `100% GPU` → todo en GPU. Rápido.

## Solución: Dual GPU

### 1. Variables de entorno ANTES de iniciar Ollama:

```bash
set CUDA_VISIBLE_DEVICES=0,1     # Usar ambas GPUs
set OLLAMA_NUM_GPU=99            # Todas las capas a GPU
set OLLAMA_FLASH_ATTENTION=1     # Menos VRAM para KV-cache
set OLLAMA_MAX_LOADED_MODELS=2   # 2 modelos simultáneos
```

### 2. Reducir contexto si no cabe:

32K contexto = ~4GB extra de VRAM solo para KV-cache.
16K contexto = ~2GB. Suficiente para la mayoría de tareas.

En el Modelfile:
```dockerfile
PARAMETER num_ctx 16384    # En vez de 32768
PARAMETER num_gpu 99       # Forzar todo a GPU
```

### 3. Script de inicio optimizado:

```batch
@echo off
set CUDA_VISIBLE_DEVICES=0,1
set OLLAMA_NUM_GPU=99
set OLLAMA_MAX_LOADED_MODELS=2
set OLLAMA_KEEP_ALIVE=30m
set OLLAMA_FLASH_ATTENTION=1
ollama serve
```

## Distribución Automática

Ollama reparte las capas del modelo entre las GPUs automáticamente:
- GPU 0: primeras N capas
- GPU 1: capas restantes

No podés elegir "60% en GPU 0, 40% en GPU 1" exactamente, pero al meter todo en GPU con `num_gpu=99`, Ollama balancea solo.

## Monitoreo

```bash
# Ver VRAM en tiempo real (cada 2 segundos)
nvidia-smi -l 2

# Ver uso de GPU específicas
nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu --format=csv

# Ver qué modelos están cargados y dónde
ollama ps
```

## Tabla de Referencia (RTX 3060 Ti 8GB x2 = 16GB total)

| Modelo | VRAM (ctx 16K) | Cabe en 2x8GB? |
|--------|---------------|-----------------|
| Qwen2.5:7B Q4 | ~6GB | ✅ Sobra espacio |
| Gemma2:9B Q4 | ~7GB | ✅ Justo |
| Qwen3:4B Q4 | ~3GB | ✅ Cabe en 1 sola |
| Llama3:13B Q4 | ~10GB | ✅ Split entre 2 |
| Codestral:22B Q4 | ~14GB | ⚠️ Muy justo |
| Llama3:70B Q4 | ~40GB | ❌ No cabe |

## Tips

- Flash Attention reduce VRAM del KV-cache ~30%
- Si usás 2 modelos simultáneos, cada uno usa la mitad de la VRAM disponible
- Modelos Q4_K_M son el mejor balance calidad/tamaño
- Si un modelo no cabe, intentá Q3_K_M (más compresión, menos calidad)
