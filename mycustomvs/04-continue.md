# 04 — Continue: Extensión de IA para VS Code

## ¿Qué es Continue?

Extension open-source de IA para VS Code. Conecta con modelos locales (Ollama) o cloud (OpenAI, Anthropic). Soporta MCP servers.

## Instalación

1. VS Code → Extensions (Ctrl+Shift+X)
2. Buscar "Continue"
3. Instalar "Continue - open source AI code agent"

## Archivo de Configuración

Ubicación: `~/.continue/config.yaml` (C:\Users\TU_USUARIO\.continue\config.yaml)

### Estructura básica:

```yaml
name: Mi Config
version: 1.0.0
schema: v1

models:
  - name: Mi Modelo
    provider: ollama
    model: nombre-en-ollama
    apiBase: http://localhost:11434
    roles:
      - chat        # Responder preguntas
      - edit        # Editar código seleccionado
      - apply       # Aplicar cambios a archivos
    defaultCompletionOptions:
      temperature: 0.7
      maxTokens: 2000
      contextLength: 32768

rules:
  - Regla 1 que siempre se inyecta como system prompt
  - Regla 2

context:
  - provider: file       # Puede leer archivos abiertos
  - provider: code       # Puede ver código del proyecto
  - provider: diff       # Puede ver cambios git
  - provider: terminal   # Puede ver output de terminal

mcpServers:
  - name: Mi MCP Server
    command: python
    args:
      - C:\ruta\a\mi\server.py
    autoApprove:
      - herramienta_1
      - herramienta_2
```

## Roles de Modelos

| Rol | Qué hace | Cuándo se usa |
|-----|----------|---------------|
| `chat` | Responde en el chat | Siempre |
| `edit` | Edita código seleccionado | Ctrl+I sobre código |
| `apply` | Aplica diffs a archivos | Cuando sugiere cambios |
| `autocomplete` | Tab completion | Mientras escribís |

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl+L` | Abrir chat de Continue |
| `Ctrl+I` | Editar código seleccionado con IA |
| `Ctrl+'` | Cambiar modelo |
| `Ctrl+Alt+I` | Abrir chat (alternativo) |

## Modos de Continue

- **Agent** — ejecuta acciones (edita archivos, corre comandos)
- **Chat** — solo responde, no modifica nada
- **Plan** — planifica antes de actuar (análisis primero, código después)
- **Edit** — edita solo lo seleccionado

## autoApprove

Si ponés herramientas en `autoApprove`, Continue las ejecuta sin pedir permiso:

```yaml
mcpServers:
  - name: Mi Server
    command: python
    args: [server.py]
    autoApprove:
      - buscar_datos    # Se ejecuta automáticamente
      - listar_items    # Sin preguntar
```

Sin autoApprove, te pregunta "Accept / Reject" por cada tool call.

## Múltiples MCP Servers

Podés tener varios servers simultáneos:

```yaml
mcpServers:
  - name: Lore Server
    command: python
    args: [lore_server.py]
  - name: Web Fetch
    command: uvx
    args: [mcp-server-fetch]
```

## Tips

- Recargá config: Ctrl+Shift+P → "Developer: Reload Window"
- Si un MCP no conecta, revisá que el command esté en PATH
- Ollama debe estar corriendo ANTES de abrir Continue
- Las rules se inyectan en TODAS las conversaciones
