"""
orquestador_escritor.py — Agente Orquestador para Escritura de Libros
══════════════════════════════════════════════════════════════════════════
Orquestador standalone para Aaron (ZeratnaPC).
Conecta con Ollama + Book Server para ayudar a escribir libros.

Funciones:
- Clasifica qué necesitás (investigar, estructurar, escribir, editar)
- Consulta el Book Server por fuentes relevantes (RAG)
- Genera texto con el modelo de escritura
- Valida coherencia antes de entregar
- Gestiona sesión (qué capítulos están escritos, cuáles faltan)

Uso:
  python orquestador_escritor.py                    → CLI interactivo
  python orquestador_escritor.py "escribe cap 3"   → ejecución directa
  python orquestador_escritor.py --status           → estado del libro

Requiere:
  - Ollama corriendo (http://localhost:11434)
  - Book Server corriendo (http://localhost:8430) — opcional pero recomendado
"""

import os
import sys
import json
import re
import time
import urllib.request
import urllib.parse
from datetime import datetime

os.environ["PYTHONUTF8"] = "1"
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# ═══════════════════════════════════════════════
# CONFIGURACIÓN — EDITA ESTO SEGÚN TU SETUP
# ═══════════════════════════════════════════════

OLLAMA_URL = "http://localhost:11434"
BOOK_SERVER_URL = "http://localhost:8430"
OLLAMA_TIMEOUT = 300

# Modelos — cambia según lo que tengas instalado
MODELOS = {
    "escritura": "gemma3:12b",        # Para escribir prosa (o gemma3:4b si poca VRAM)
    "clasificador": "qwen3:4b",       # Para clasificar tareas (rápido)
    "investigacion": "qwen2.5:7b",    # Para analizar/resumir fuentes
    "edicion": "gemma3:12b",          # Para editar/mejorar texto
}

# Regla de idioma — el modelo piensa en inglés, responde en español
REGLA_IDIOMA = (
    "You are an expert writing assistant. "
    "All internal reasoning must be in English, enclosed within <think> and </think> tags. "
    "Your final direct communication with the user MUST ALWAYS be strictly in Spanish. "
    "NUNCA me respondas en inglés.\n\n"
    "EXCEPTIONS (DO NOT TRANSLATE): Technical names, book titles, author names, "
    "citations, and quotes in their original language must remain unchanged.\n\n"
    "BEHAVIOR: Be direct and concise. Skip apologies and filler phrases. "
    "Go straight to the content. Write in a professional, clear style."
)

# ═══════════════════════════════════════════════
# CLIENTE OLLAMA
# ═══════════════════════════════════════════════

def _limpiar_think(texto):
    """Elimina <think>...</think> tags del output."""
    return re.sub(r'<think>.*?</think>', '', texto, flags=re.DOTALL).strip()


def ollama_disponible():
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def generar(modelo, prompt, system=None, temperatura=0.7, max_tokens=4096):
    """Genera texto con Ollama."""
    system_final = REGLA_IDIOMA
    if system:
        system_final = f"{system}\n\n{REGLA_IDIOMA}"

    payload = json.dumps({
        "model": modelo,
        "prompt": prompt,
        "system": system_final,
        "stream": False,
        "options": {"temperature": temperatura, "num_predict": max_tokens, "num_ctx": 32768}
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            texto = _limpiar_think(body.get("response", ""))
            tiempo = body.get("total_duration", 0) / 1e9
            return {"ok": True, "texto": texto, "tiempo": tiempo}
    except Exception as e:
        return {"ok": False, "texto": "", "tiempo": 0, "error": str(e)}


# ═══════════════════════════════════════════════
# CLIENTE BOOK SERVER
# ═══════════════════════════════════════════════

def _book_get(path):
    try:
        req = urllib.request.Request(f"{BOOK_SERVER_URL}{path}")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def _book_post(path, data):
    try:
        payload = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            f"{BOOK_SERVER_URL}{path}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def book_disponible():
    result = _book_get("/health")
    return result is not None and result.get("status") == "ok"


def obtener_contexto_capitulo(num):
    """Obtiene contexto RAG de las fuentes para un capítulo."""
    result = _book_get(f"/contexto/{num}")
    if result:
        return result.get("contexto", "")
    return ""


def obtener_estructura():
    return _book_get("/estructura")


def obtener_resumen_libro():
    return _book_get("/resumen")


def guardar_capitulo(num, texto):
    return _book_post(f"/capitulo/{num}", {"texto": texto})


def buscar_fuentes(query):
    result = _book_get(f"/fuentes/buscar?query={urllib.parse.quote(query)}")
    if result:
        return result.get("resultados", [])
    return []


# ═══════════════════════════════════════════════
# CLASIFICADOR
# ═══════════════════════════════════════════════

def clasificar(tarea):
    """Clasifica qué tipo de acción necesita el usuario."""
    tarea_lower = tarea.lower()

    # Detectar tipo por heurísticas
    if any(k in tarea_lower for k in ["escribe cap", "escribe capitulo", "genera cap", "redacta"]):
        # Extraer número de capítulo
        num = re.search(r'(\d+)', tarea)
        return {"tipo": "escribir", "capitulo": int(num.group(1)) if num else 1}

    elif any(k in tarea_lower for k in ["edita", "mejora", "reescribe", "corrige"]):
        num = re.search(r'(\d+)', tarea)
        return {"tipo": "editar", "capitulo": int(num.group(1)) if num else 1}

    elif any(k in tarea_lower for k in ["busca", "investiga", "fuentes sobre", "info sobre"]):
        query = tarea_lower
        for prefix in ["busca ", "investiga ", "fuentes sobre ", "info sobre "]:
            if query.startswith(prefix):
                query = query[len(prefix):]
                break
        return {"tipo": "investigar", "query": query}

    elif any(k in tarea_lower for k in ["estructura", "indice", "índice", "capitulos", "organiza"]):
        return {"tipo": "estructurar"}

    elif any(k in tarea_lower for k in ["estado", "resumen", "progreso", "como va"]):
        return {"tipo": "estado"}

    elif any(k in tarea_lower for k in ["resume", "sintetiza", "resumen de"]):
        return {"tipo": "resumir", "query": tarea}

    else:
        # Default: pregunta general al modelo de escritura
        return {"tipo": "general", "query": tarea}


# ═══════════════════════════════════════════════
# ACCIONES
# ═══════════════════════════════════════════════

def accion_escribir(capitulo_num, verbose=True):
    """Escribe un capítulo completo usando fuentes como contexto."""
    if verbose:
        print(f"\n  ✍️  Escribiendo Capítulo {capitulo_num}...")

    # Obtener contexto RAG del Book Server
    contexto = ""
    if book_disponible():
        contexto = obtener_contexto_capitulo(capitulo_num)
        if contexto and verbose:
            print(f"  📚 Contexto RAG inyectado ({len(contexto)} chars)")

        # Obtener info del capítulo de la estructura
        estructura = obtener_estructura()
        cap_info = None
        if estructura:
            for cap in estructura.get("capitulos", []):
                if cap.get("num") == capitulo_num:
                    cap_info = cap
                    break

    # Construir prompt
    prompt = f"Escribe el Capítulo {capitulo_num} completo."
    if cap_info:
        titulo = cap_info.get("titulo", "")
        temas = ", ".join(cap_info.get("temas", []))
        prompt = (
            f"Escribe el Capítulo {capitulo_num}: \"{titulo}\"\n"
            f"Temas a cubrir: {temas}\n"
            f"Escribe mínimo 1500 palabras. Prosa clara y profesional."
        )
    if contexto:
        prompt = f"{contexto}\n\nCon base en las fuentes anteriores:\n{prompt}"

    if verbose:
        print(f"  🤖 Generando con {MODELOS['escritura']} (32K ctx)...")
        print(f"  ⏳ Puede tardar 2-5 minutos...")

    resultado = generar(MODELOS["escritura"], prompt, temperatura=0.8, max_tokens=4096)

    if not resultado["ok"]:
        return f"❌ Error: {resultado.get('error', 'desconocido')}"

    texto = resultado["texto"]
    if verbose:
        print(f"  ✅ Generado: {len(texto.split())} palabras, {resultado['tiempo']:.0f}s")

    # Guardar en Book Server
    if book_disponible():
        guardar_capitulo(capitulo_num, texto)
        if verbose:
            print(f"  💾 Guardado en Book Server")

    return texto


def accion_editar(capitulo_num, verbose=True):
    """Mejora un capítulo existente."""
    if verbose:
        print(f"\n  ✏️  Editando Capítulo {capitulo_num}...")

    # Obtener capítulo existente
    cap_data = _book_get(f"/capitulo/{capitulo_num}")
    if not cap_data or not cap_data.get("texto"):
        return f"❌ Capítulo {capitulo_num} no existe aún. Usa 'escribe cap {capitulo_num}' primero."

    texto_original = cap_data["texto"]
    if verbose:
        print(f"  📄 Original: {len(texto_original.split())} palabras")

    prompt = (
        f"TEXTO ORIGINAL DEL CAPÍTULO {capitulo_num}:\n\n"
        f"{texto_original}\n\n"
        f"INSTRUCCIÓN: Mejora este texto. Hazlo más claro, mejor estructurado, "
        f"con mejor flujo narrativo. Corrige errores. Mantén el contenido y las ideas "
        f"pero eleva la calidad de la prosa. Devuelve el capítulo completo reescrito."
    )

    resultado = generar(MODELOS["edicion"], prompt, temperatura=0.6, max_tokens=4096)

    if not resultado["ok"]:
        return f"❌ Error: {resultado.get('error', 'desconocido')}"

    texto_mejorado = resultado["texto"]
    if verbose:
        print(f"  ✅ Mejorado: {len(texto_mejorado.split())} palabras")

    # Guardar versión mejorada
    if book_disponible():
        guardar_capitulo(capitulo_num, texto_mejorado)
        if verbose:
            print(f"  💾 Guardado (sobreescribe original)")

    return texto_mejorado


def accion_investigar(query, verbose=True):
    """Busca en las fuentes y presenta un resumen."""
    if verbose:
        print(f"\n  🔍 Investigando: {query}")

    if not book_disponible():
        return "❌ Book Server no disponible. Ejecuta: python book_server.py"

    resultados = buscar_fuentes(query)
    if not resultados:
        return f"No encontré nada sobre '{query}' en las fuentes cargadas."

    # Formatear resultados
    texto = f"📚 Encontré {len(resultados)} fragmentos sobre '{query}':\n\n"
    for i, r in enumerate(resultados, 1):
        texto += f"── [{i}] Fuente: {r['fuente']} (relevancia: {r['relevancia']})\n"
        texto += f"   {r['fragmento'][:300]}\n\n"

    # Opcionalmente, pedir al modelo que sintetice
    if len(resultados) > 2:
        if verbose:
            print(f"  🤖 Sintetizando {len(resultados)} fragmentos...")
        prompt = f"Resume estos fragmentos de investigación en 3-5 puntos clave:\n\n{texto}"
        resumen = generar(MODELOS["investigacion"], prompt, temperatura=0.3, max_tokens=1000)
        if resumen["ok"]:
            texto += f"\n{'─' * 40}\n📝 SÍNTESIS:\n{resumen['texto']}"

    return texto


def accion_estado(verbose=True):
    """Muestra el estado del libro."""
    if not book_disponible():
        return "❌ Book Server no disponible."

    resumen = obtener_resumen_libro()
    if not resumen:
        return "No hay libro configurado aún. Usa 'estructura' para definirlo."

    texto = (
        f"\n  ══ ESTADO DEL LIBRO ══\n"
        f"  Título: {resumen.get('titulo', '?')}\n"
        f"  Autor: {resumen.get('autor', '?')}\n"
        f"  ─────────────────────────────\n"
        f"  Capítulos: {resumen.get('capitulos_escritos', 0)}/{resumen.get('capitulos_total', 0)}\n"
        f"  Pendientes: {resumen.get('capitulos_pendientes', 0)}\n"
        f"  Palabras total: {resumen.get('palabras_total', 0):,}\n"
        f"  Fuentes cargadas: {resumen.get('fuentes_cargadas', 0)}\n"
    )

    # Detalle por capítulo
    estructura = obtener_estructura()
    if estructura and estructura.get("capitulos"):
        texto += f"\n  ── Capítulos ──\n"
        for cap in estructura["capitulos"]:
            estado = "✅" if cap.get("estado") == "escrito" else "⏳"
            palabras = cap.get("palabras", 0)
            titulo = cap.get("titulo", f"Cap {cap.get('num', '?')}")
            texto += f"  {estado} {cap.get('num', '?')}. {titulo}"
            if palabras:
                texto += f" ({palabras:,} palabras)"
            texto += "\n"

    return texto


def accion_estructurar(verbose=True):
    """Ayuda a crear/editar la estructura del libro."""
    if verbose:
        print(f"\n  📋 Modo estructura")

    estructura_actual = obtener_estructura() if book_disponible() else None

    if estructura_actual and estructura_actual.get("capitulos"):
        print(f"  Ya hay estructura definida:")
        print(accion_estado(False))
        print(f"\n  Para redefinir, responde las preguntas:")
    else:
        print(f"  No hay estructura definida. Vamos a crearla:")

    # Interactivo
    titulo = input("  Título del libro: ").strip() or "Mi Libro"
    autor = input("  Autor: ").strip() or "Aaron"
    n_caps = input("  ¿Cuántos capítulos? (número): ").strip()
    try:
        n_caps = int(n_caps)
    except ValueError:
        n_caps = 5

    capitulos = []
    for i in range(1, n_caps + 1):
        titulo_cap = input(f"  Cap {i} título: ").strip() or f"Capítulo {i}"
        temas = input(f"  Cap {i} temas (separados por coma): ").strip()
        temas_list = [t.strip() for t in temas.split(",") if t.strip()] if temas else []
        capitulos.append({
            "num": i,
            "titulo": titulo_cap,
            "temas": temas_list,
            "estado": "pendiente",
            "palabras": 0,
        })

    nueva_estructura = {
        "titulo": titulo,
        "autor": autor,
        "capitulos": capitulos,
        "notas": "",
    }

    if book_disponible():
        _book_post("/estructura", nueva_estructura)
        print(f"\n  ✅ Estructura guardada en Book Server ({n_caps} capítulos)")
    else:
        # Guardar local
        with open("estructura_libro.json", "w", encoding="utf-8") as f:
            json.dump(nueva_estructura, f, ensure_ascii=False, indent=2)
        print(f"\n  ✅ Estructura guardada localmente (estructura_libro.json)")

    return f"Estructura definida: {titulo} — {n_caps} capítulos"


# ═══════════════════════════════════════════════
# PROCESADOR PRINCIPAL
# ═══════════════════════════════════════════════

def procesar(tarea, verbose=True):
    """Punto de entrada: clasifica y ejecuta."""
    clasificacion = clasificar(tarea)
    tipo = clasificacion["tipo"]

    if verbose:
        print(f"  🧠 Clasificado: {tipo}")

    if tipo == "escribir":
        return accion_escribir(clasificacion["capitulo"], verbose)
    elif tipo == "editar":
        return accion_editar(clasificacion["capitulo"], verbose)
    elif tipo == "investigar":
        return accion_investigar(clasificacion["query"], verbose)
    elif tipo == "estructurar":
        return accion_estructurar(verbose)
    elif tipo == "estado":
        return accion_estado(verbose)
    elif tipo == "resumir":
        resultado = generar(MODELOS["investigacion"], clasificacion["query"], temperatura=0.4)
        return resultado["texto"] if resultado["ok"] else f"❌ {resultado.get('error')}"
    else:
        # General: pasar directo al modelo de escritura
        resultado = generar(MODELOS["escritura"], tarea, temperatura=0.7)
        return resultado["texto"] if resultado["ok"] else f"❌ {resultado.get('error')}"


# ═══════════════════════════════════════════════
# CLI INTERACTIVO
# ═══════════════════════════════════════════════

def cli():
    print(f"""
  ══════════════════════════════════════════════════
  📚 ORQUESTADOR DE ESCRITURA — ZeratnaPC
  ══════════════════════════════════════════════════

  Comandos naturales:
    "escribe cap 1"          → genera capítulo 1 con contexto de fuentes
    "edita cap 2"            → mejora un capítulo existente
    "busca revolución"       → busca en tus fuentes cargadas
    "estructura"             → define/edita índice del libro
    "estado"                 → ver progreso del libro
    "resume el cap 3"        → resumen de un capítulo
    (cualquier otra cosa)    → pregunta libre al modelo

  Servicios:
    Ollama: {OLLAMA_URL} {'✅' if ollama_disponible() else '❌'}
    Book Server: {BOOK_SERVER_URL} {'✅' if book_disponible() else '❌'}

  /modelos  → ver modelos configurados
  /salir    → salir
  ══════════════════════════════════════════════════
""")

    while True:
        try:
            entrada = input("  📖 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  👋 ¡Hasta la próxima sesión!")
            break

        if not entrada:
            continue
        if entrada == "/salir":
            print("  👋 ¡Guardado!")
            break
        elif entrada == "/modelos":
            print(f"\n  Modelos configurados:")
            for rol, modelo in MODELOS.items():
                print(f"    {rol:15s} → {modelo}")
            print(f"\n  (edita MODELOS en el script para cambiarlos)\n")
        elif entrada == "/estado":
            print(accion_estado())
        else:
            resultado = procesar(entrada)
            print(f"\n{'─' * 50}")
            print(resultado)
            print(f"{'─' * 50}\n")


# ═══════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--status":
            print(accion_estado())
        elif arg == "--help":
            print(__doc__)
        else:
            tarea = " ".join(sys.argv[1:])
            resultado = procesar(tarea)
            print(resultado)
    else:
        cli()
