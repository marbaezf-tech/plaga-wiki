# 01 — Ollama: Instalación y Modelos Locales

## ¿Qué es Ollama?

Ollama es un runtime para correr modelos de lenguaje (LLMs) en tu PC local. No necesita internet, no cobra por token, y corre en tus GPUs.

## Instalación

1. Descargar de https://ollama.com/download
2. Instalar (Windows: ejecutar el .exe)
3. Verificar: abrir terminal y correr:
```
ollama --version
```

## Comandos Básicos

```bash
# Iniciar servidor (se necesita corriendo para todo lo demás)
ollama serve

# Listar modelos instalados
ollama list

# Descargar un modelo
ollama pull qwen2.5:7b

# Correr un modelo interactivo
ollama run qwen2.5:7b

# Ver modelos cargados en memoria
ollama ps

# Borrar un modelo
ollama rm nombre-modelo
```

## Crear un Modelo Personalizado (Modelfile)

Un Modelfile define un modelo con system prompt y parámetros custom:

```dockerfile
# Modelfile.mi-modelo
FROM qwen2.5:7b

PARAMETER temperature 0.7
PARAMETER num_ctx 16384
PARAMETER num_predict 2000
PARAMETER stop "<|im_end|>"

SYSTEM """Eres un asistente experto en GDScript y Godot 4.
Responde siempre en español. Da código completo."""
```

Para crearlo:
```bash
ollama create mi-modelo -f Modelfile.mi-modelo
```

## Parámetros Importantes

| Parámetro | Qué hace | Valor típico |
|-----------|----------|--------------|
| `temperature` | Creatividad (0=determinista, 1=random) | 0.3 código, 0.85 narrativa |
| `num_ctx` | Ventana de contexto (tokens) | 16384 o 32768 |
| `num_predict` | Máximo de tokens a generar | 400-4096 |
| `num_gpu` | Capas en GPU (99=todas) | 99 |
| `repeat_penalty` | Penaliza repetición | 1.1-1.2 |
| `stop` | Tokens que detienen generación | `<|im_end|>`, `---` |

## API REST

Ollama expone una API HTTP en `http://localhost:11434`:

```bash
# Generar texto
curl http://localhost:11434/api/generate -d '{
  "model": "mi-modelo",
  "prompt": "Escribe un script de movimiento"
}'

# Chat (con historial)
curl http://localhost:11434/api/chat -d '{
  "model": "mi-modelo",
  "messages": [{"role": "user", "content": "Hola"}]
}'

# Listar modelos
curl http://localhost:11434/api/tags
```

## Variables de Entorno

```bash
# Usar ambas GPUs
set CUDA_VISIBLE_DEVICES=0,1

# Meter todas las capas en GPU
set OLLAMA_NUM_GPU=99

# Permitir múltiples modelos en memoria
set OLLAMA_MAX_LOADED_MODELS=2

# Mantener modelo cargado 30 min
set OLLAMA_KEEP_ALIVE=30m

# Activar Flash Attention (menos VRAM)
set OLLAMA_FLASH_ATTENTION=1
```

## Modelos Recomendados para Desarrollo

| Modelo | Tamaño | Uso | VRAM necesaria |
|--------|--------|-----|----------------|
| `qwen2.5:7b` | 4.7GB | Código general | ~6GB |
| `qwen3:4b` | 2.5GB | Lore/chat rápido | ~3GB |
| `gemma2:9b` | 5.4GB | Narrativa/creatividad | ~7GB |
| `codestral:latest` | 12GB | Código avanzado | ~14GB |
| `llama3.2:3b` | 2GB | Tareas ligeras | ~3GB |
