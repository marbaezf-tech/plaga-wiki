# 08 — MoE Router: Mixture of Experts Casero

## Concepto

En vez de usar UN solo modelo para todo, tenés VARIOS modelos especializados y un "router" que decide cuál usar según la pregunta:

```
┌─────────────────────────────────────────────────┐
│  USUARIO pregunta algo                          │
│         ↓                                       │
│  🧠 ROUTER clasifica la intención               │
│         ↓                                       │
│  ┌──────────┬───────────────┬──────────────┐    │
│  │ CÓDIGO   │  NARRATIVA    │  LORE        │    │
│  │ qwen2.5  │  gemma2:9b    │  mi-modelo   │    │
│  │  :7b     │               │  (trained)   │    │
│  └──────────┴───────────────┴──────────────┘    │
│         ↓                                       │
│  Respuesta del experto correcto                 │
└─────────────────────────────────────────────────┘
```

## Clasificador de Intención

Basado en keywords y regex — NO usa IA para clasificar (sería lento):

```python
KEYWORDS = {
    "codigo": ["gdscript", "func", "variable", "bug", "implementa", "script"],
    "narrativa": ["describe", "escribe", "diálogo", "historia", "novela"],
    "lore": ["quién es", "qué es", "facción", "npc", "personaje"],
}

def clasificar(pregunta):
    scores = {cat: 0 for cat in KEYWORDS}
    for cat, words in KEYWORDS.items():
        for w in words:
            if w in pregunta.lower():
                scores[cat] += 1
    return max(scores, key=scores.get)
```

## Tareas Compuestas

Si la pregunta necesita MÁS DE UN experto:

```
"Escribe el GDScript del diálogo con Don Corleone"
  → Necesita LORE (quién es Corleone) + CÓDIGO (GDScript)
```

El router detecta esto y encadena:
1. Consulta al experto de Lore → obtiene datos del NPC
2. Pasa esos datos como contexto al experto de Código
3. El código se genera con información canónica correcta

## Integración con MCP (RAG)

El router puede consultar el MCP Lore Server ANTES de enviar al modelo:

```python
from lore_client import obtener_contexto_npc, esta_disponible

def preguntar(pregunta):
    categoria = clasificar(pregunta)
    
    # RAG: obtener contexto del Lore Server
    contexto_lore = ""
    if categoria in ("lore", "narrativa") and esta_disponible():
        contexto_lore = obtener_contexto_relevante(pregunta)
    
    # Construir prompt con contexto
    prompt = contexto_lore + "\n\n" + pregunta
    
    # Enviar al modelo correcto
    modelo = MODELOS[categoria]
    return consultar_ollama(modelo, prompt)
```

## Log y Mejora

Registrar cada decisión para analizar después:

```python
{"timestamp": "2026-06-05", "pregunta": "¿Quién es Vlad?", "modelo": "plaga-qwen3", "confianza": 0.85, "rag": true}
```

Con estos logs podés:
- Ver qué modelo se usa más
- Detectar clasificaciones incorrectas
- Mejorar las keywords del router

## Cuándo usar MoE vs un solo modelo

| Escenario | Recomendación |
|-----------|---------------|
| Dominio único (solo código) | Un solo modelo grande |
| Múltiples dominios (código + lore + narrativa) | MoE con modelos especializados |
| VRAM limitada | MoE con modelos chicos (3-4B cada uno) |
| VRAM abundante | Un modelo grande (13B+) para todo |
| Modelos fine-tuneados en dominios distintos | MoE obligatorio |
