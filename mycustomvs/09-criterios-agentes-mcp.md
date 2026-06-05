# 09 — Criterios para Agentes y MCP

## ¿Cuándo usar Sub-Agentes?

### 1. Especialización de tareas
Si le pides a un solo modelo que investigue, redacte, formatee y valide, pierde foco. Los sub-agentes brillan cuando divides un problema en dominios específicos:
- Agente investigador (busca datos)
- Agente redactor (genera contenido)
- Agente validador (revisa output)

### 2. Flujos Maker-Checker (Validación cruzada)
Un agente genera un entregable y otro lo evalúa:
- Agente 1: genera código
- Agente 2: valida contra convenciones
- Si falla → devuelve con correcciones

### 3. Uso intensivo de herramientas
Cuando la tarea requiere pausas para APIs, DBs o web scraping:
- Orquestador delega a sub-agentes especializados
- El sistema no se bloquea ni alucina mientras espera

### 4. Gestión de memoria y estado prolongado
Si un proceso requiere recordar contexto masivo:
- Sub-agente dedicado a buscar/recuperar info relevante
- No saturar la ventana de contexto del agente principal

## Criterio de Complejidad (Regla del 3)

| Complejidad | Acción | Ejemplo |
|-------------|--------|---------|
| Simple (1 tool call) | Responder directo | "¿Quién es Don Corleone?" |
| Media (1-2 archivos) | Tool + respuesta | "Arregla este error" |
| Alta (3+ archivos) | Delegar a sub-agentes | "Crea un NPC completo con diálogo y quest" |

## Criterios para herramientas MCP

### 1. Atomicidad (propósito único)
Cada herramienta hace UNA cosa bien:
- ❌ `gestionar_base_de_datos` (demasiado amplio)
- ✅ `buscar_npc`, `listar_facciones`, `validar_codigo` (específicas)

### 2. Esquemas estrictos
Inputs y outputs definidos en JSON Schema rígido:
```json
{
  "type": "object",
  "properties": {
    "nombre": {"type": "string", "description": "Nombre del NPC"}
  },
  "required": ["nombre"]
}
```
Si los params son ambiguos, el modelo alucinará los argumentos.

### 3. Principio de menor privilegio
Separar herramientas por permisos:
- **Solo lectura** (autoApprove): buscar_npc, consultar_lore, listar_taxones
- **Escritura** (requiere aprobación): crear_archivo, modificar_script
- **Destructivas** (Human in the Loop): borrar_archivo, resetear_datos

### 4. Latencia y determinismo
- Respuestas claras y rápidas (< 5 segundos)
- Si tarda más → el agente asume fallo
- Devolver datos estructurados, no texto ambiguo

## Aplicado a nuestro MCP (Plaga Lore Server)

| Herramienta | Tipo | Atómica | Determinista |
|-------------|------|---------|--------------|
| buscar_npc | Lectura | ✅ 1 NPC por nombre | ✅ Siempre mismo resultado |
| consultar_lore | Lectura | ✅ Búsqueda por tema | ✅ Basado en keywords |
| planificar_feature | Lectura | ✅ 1 plan por feature | ✅ Arquitectura fija |
| diagnosticar_error | Lectura | ✅ 1 error → diagnóstico | ✅ Errores catalogados |
| validar_codigo | Lectura | ✅ Snippet → warnings | ✅ Reglas fijas |
| delegar_tarea | Ejecución | ⚠️ Multi-paso | ⚠️ Depende de Ollama |
| sesion_estado | Escritura | ✅ Agregar/leer | ✅ JSON local |

## Anti-patrones (qué NO hacer)

- ❌ Herramienta que hace 5 cosas diferentes según un parámetro "modo"
- ❌ Tool que devuelve texto libre sin estructura
- ❌ Tool que tarda 60+ segundos sin feedback
- ❌ Tool de escritura sin confirmación humana
- ❌ Sub-agentes para consultas simples de 1 dato
- ❌ Depender de que el modelo "decida bien" cuándo delegar (modelos chicos fallan en esto)
