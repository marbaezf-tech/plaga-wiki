# 05 — Integración: MCP + Continue + Ollama

## Flujo Completo

```
┌─────────────────────────────────────────────────────┐
│  VS Code + Continue                                 │
│  (El usuario pregunta algo)                         │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Ollama (modelo local)                              │
│  Analiza la pregunta y decide si necesita tools     │
└─────────────┬───────────────────────────────────────┘
              │ tool_call: buscar_npc("Don Corleone")
              ▼
┌─────────────────────────────────────────────────────┐
│  MCP Server (tu server custom)                      │
│  Busca en JSONs/DB/APIs y devuelve datos reales     │
└─────────────┬───────────────────────────────────────┘
              │ resultado: {nombre: "Don Corleone", cargo: "Padrino"...}
              ▼
┌─────────────────────────────────────────────────────┐
│  Ollama genera respuesta CON datos reales           │
│  (no alucina porque tiene la fuente de verdad)      │
└─────────────────────────────────────────────────────┘
```

## Ejemplo Real: Plaga Lore Server

### 1. Datos fuente (JSONs)
```
wiki/data/criaturas.json    → 17 taxones con stats
wiki/data/npcs_organigrama.json → 35 NPCs con fichas
wiki/data/objetos.json      → 9 objetos del juego
lore_fundacional.md         → Lore narrativo completo
```

### 2. Engine (lore_engine.py)
Lee los JSONs al inicio y expone funciones:
- `buscar_npc(nombre)` → dict con ficha completa
- `buscar_taxon(id)` → stats, facción, atavismos
- `consultar_lore(tema)` → secciones relevantes del markdown

### 3. Server MCP (server.py)
Envuelve el engine en protocolo MCP:
- Define tools con `@app.list_tools()`
- Ejecuta con `@app.call_tool()`
- Corre via stdio (lo lanza Continue automáticamente)

### 4. Config de Continue (config.yaml)
```yaml
mcpServers:
  - name: Plaga Lore Server
    command: python
    args:
      - C:\ruta\mcp-lore\server.py
    autoApprove:
      - buscar_npc
      - buscar_taxon
```

### 5. Rules que fuerzan el uso
```yaml
rules:
  - ANTES de escribir código, usa planificar_feature del MCP
  - CUANDO te pasen un error, usa diagnosticar_error primero
  - Usa buscar_npc para obtener datos canónicos
```

## RAG Casero (para moe_router.py)

Si querés que Ollama desde terminal también use el lore:

### HTTP Bridge
Levantá el server HTTP (`python http_bridge.py` → puerto 8420)

### Cliente Python
```python
from lore_client import obtener_contexto_npc, esta_disponible

if esta_disponible():
    contexto = obtener_contexto_npc("Don Corleone")
    prompt = f"{contexto}\n\nPregunta: ¿Qué relación tiene con Los Sueltos?"
    # Mandar a Ollama con el contexto inyectado
```

### Integración en moe_router.py
El router consulta el HTTP bridge ANTES de enviar al modelo:
1. Detecta keywords (NPCs, taxones, facciones, temas de lore)
2. Hace GET al lore server → obtiene contexto relevante
3. Lo inyecta al inicio del prompt
4. El modelo responde con datos canónicos reales

## Checklist de Integración

- [ ] Ollama corriendo (`ollama serve`)
- [ ] Modelos creados (`ollama list`)
- [ ] MCP Server funcional (`python server.py` sin errores)
- [ ] config.yaml apuntando al server correcto
- [ ] autoApprove configurado
- [ ] Rules que instruyen al modelo a usar las tools
- [ ] Probar: pregunta simple → verifica que llama al MCP
