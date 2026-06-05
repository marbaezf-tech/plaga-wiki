# 03 — MCP Server: Crear tu propio servidor

## ¿Qué es MCP?

Model Context Protocol — un estándar para que los LLMs puedan usar "herramientas". En vez de que el modelo invente datos, consulta tu servidor para obtener datos reales.

## Arquitectura

```
Usuario pregunta algo
       ↓
LLM analiza la pregunta
       ↓
LLM decide usar una herramienta (tool call)
       ↓
MCP Client envía la llamada al MCP Server
       ↓
MCP Server ejecuta la lógica (leer JSON, consultar DB, etc.)
       ↓
Devuelve resultado al LLM
       ↓
LLM genera respuesta con datos reales
```

## Requisitos

```bash
pip install mcp fastapi uvicorn
```

## Estructura de un MCP Server

```
mi-mcp-server/
├── server.py          # Server MCP (stdio) — para IDEs
├── http_bridge.py     # Server HTTP — para scripts/Ollama
├── engine.py          # Lógica de datos
├── requirements.txt
└── data/              # Tus fuentes de datos
    ├── personajes.json
    └── items.json
```

## Ejemplo Mínimo: server.py

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import json

app = Server("mi-server")

# Datos en memoria
PERSONAJES = [
    {"nombre": "Vlad", "clase": "guerrero", "nivel": 5},
    {"nombre": "Luna", "clase": "maga", "nivel": 3},
]

# Definir herramientas disponibles
@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="buscar_personaje",
            description="Busca un personaje por nombre",
            inputSchema={
                "type": "object",
                "properties": {
                    "nombre": {
                        "type": "string",
                        "description": "Nombre del personaje"
                    }
                },
                "required": ["nombre"]
            }
        ),
    ]

# Ejecutar herramientas
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "buscar_personaje":
        query = arguments["nombre"].lower()
        for p in PERSONAJES:
            if query in p["nombre"].lower():
                return [TextContent(type="text", text=json.dumps(p, indent=2))]
        return [TextContent(type="text", text="No encontrado")]
    return [TextContent(type="text", text="Herramienta no reconocida")]

# Main
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## Ejemplo: HTTP Bridge (para Ollama/scripts)

```python
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Mi Server")

PERSONAJES = [
    {"nombre": "Vlad", "clase": "guerrero", "nivel": 5},
    {"nombre": "Luna", "clase": "maga", "nivel": 3},
]

@app.get("/personaje/{nombre}")
async def buscar(nombre: str):
    for p in PERSONAJES:
        if nombre.lower() in p["nombre"].lower():
            return p
    return {"error": "No encontrado"}

@app.get("/personajes")
async def listar():
    return {"personajes": PERSONAJES}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8420)
```

## Testear

```bash
# Modo stdio (para IDEs)
python server.py

# Modo HTTP (para scripts)
python http_bridge.py
# Luego: http://localhost:8420/docs
```

## Tips

- Las herramientas deben ser de LECTURA (no escribir archivos desde el MCP)
- Devolver datos concisos — no saturar al modelo con 10K tokens
- Usar JSON para datos estructurados, texto plano para contexto narrativo
- El inputSchema es lo que el LLM usa para saber qué parámetros pasarte
