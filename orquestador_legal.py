"""
orquestador_legal.py — Asistente Legal con RAG (Diego)
═══════════════════════════════════════════════════════════
Orquestador que SIEMPRE busca en documentos legales antes de responder.
NUNCA inventa. Si no encuentra la info en las fuentes, lo dice.

Hardware: RTX 3050 4GB | Modelo: qwen3:4b / gemma3:4b

Flujo:
  1. Diego pregunta algo legal
  2. El orquestador busca en los PDFs cargados (Código Civil, Constitución, etc.)
  3. Si encuentra → le pasa el texto real a Qwen3 → responde citando
  4. Si NO encuentra → dice "No tengo esa info en mis fuentes"
  5. NUNCA inventa artículos, leyes ni sentencias

Uso:
  python orquestador_legal.py
  
Fuentes: poner PDFs en book_data/fuentes/
"""

import os
import sys
import json
import re
import time
import urllib.request
import urllib.parse

os.environ["PYTHONUTF8"] = "1"
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# ═══════════════════════════════════════════════
# CONFIGURACIÓN
# ═══════════════════════════════════════════════

OLLAMA_URL = "http://localhost:11434"
BOOK_SERVER_URL = "http://localhost:8430"
MODELO = "qwen3:4b"  # Mejor para seguir instrucciones y no alucinar
TIMEOUT = 180

# System prompt anti-alucinación
SYSTEM_LEGAL = (
    "Eres un asistente jurídico. Respondes SOLO con información de los documentos proporcionados.\n\n"
    "REGLAS:\n"
    "1. Cita TEXTUALMENTE lo que dicen los documentos. No interpretes, no juzgues si es el documento 'correcto'.\n"
    "2. Si los documentos contienen texto relevante a la pregunta, CÍTALO TAL CUAL.\n"
    "3. Si un documento dice 'Artículo 1°.-...' y te preguntan por el artículo 1, CITA ESE TEXTO.\n"
    "4. No digas 'este no es el documento correcto' ni 'no contiene el texto completo'. Solo cita lo que hay.\n"
    "5. Si realmente NO hay nada relevante en los fragmentos, di: 'No encontré información sobre eso en los fragmentos disponibles.'\n"
    "6. NUNCA inventes texto que no esté en los documentos.\n"
    "7. Responde en español. Tono directo.\n"
    "8. Formato: cita textual entre comillas → nombre del documento fuente.\n"
)

# ═══════════════════════════════════════════════
# FUNCIONES
# ═══════════════════════════════════════════════

def _limpiar(texto):
    return re.sub(r'<think>.*?</think>', '', texto, flags=re.DOTALL).strip()


def book_server_ok():
    try:
        req = urllib.request.Request(f"{BOOK_SERVER_URL}/health")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("status") == "ok"
    except Exception:
        return False


def ollama_ok():
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def buscar_en_fuentes(query, max_resultados=8):
    """Busca en los PDFs cargados via Book Server."""
    resultados = []
    
    # Búsqueda normal
    try:
        url = f"{BOOK_SERVER_URL}/fuentes/buscar?query={urllib.parse.quote(query)}&max={max_resultados}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            resultados = data.get("resultados", [])
    except Exception:
        pass

    # Si la pregunta menciona un artículo específico, buscar con variaciones
    art_match = re.search(r'art[ií]culo\s*(\d+)|art\.?\s*(\d+)', query.lower())
    if art_match:
        num = art_match.group(1) or art_match.group(2)
        variaciones = [
            f"Art. {num}",
            f"Artículo {num}",
            f"Art {num}",
            f"artículo {num}",
        ]
        for var in variaciones:
            try:
                url = f"{BOOK_SERVER_URL}/fuentes/buscar?query={urllib.parse.quote(var)}&max=3"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    extras = data.get("resultados", [])
                    for e in extras:
                        # No agregar duplicados
                        if not any(e["fragmento"][:50] == r["fragmento"][:50] for r in resultados):
                            resultados.append(e)
            except Exception:
                pass

    # Ordenar por relevancia y limitar
    resultados.sort(key=lambda x: x.get("relevancia", 0), reverse=True)
    return resultados[:max_resultados]


def listar_fuentes():
    """Lista las fuentes cargadas."""
    try:
        req = urllib.request.Request(f"{BOOK_SERVER_URL}/fuentes")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("fuentes", [])
    except Exception:
        return []


def generar_respuesta(pregunta, contexto):
    """Genera respuesta con Ollama usando contexto de las fuentes."""
    prompt = (
        f"=== DOCUMENTOS LEGALES (fuente de verdad) ===\n"
        f"{contexto}\n"
        f"=== FIN DOCUMENTOS ===\n\n"
        f"PREGUNTA DEL USUARIO: {pregunta}\n\n"
        f"Responde BASÁNDOTE SOLO en los documentos anteriores. "
        f"Si la información no está ahí, di que no la encontraste."
    )

    payload = json.dumps({
        "model": MODELO,
        "prompt": prompt,
        "system": SYSTEM_LEGAL,
        "stream": False,
        "options": {
            "temperature": 0.1,  # Muy bajo = casi no inventa
            "num_predict": 2048,
            "num_ctx": 16384,
            "top_p": 0.8,
            "repeat_penalty": 1.2,
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            texto = _limpiar(body.get("response", ""))
            tiempo = body.get("total_duration", 0) / 1e9
            return {"ok": True, "texto": texto, "tiempo": tiempo}
    except Exception as e:
        return {"ok": False, "texto": "", "error": str(e)}


def procesar(pregunta):
    """
    Flujo principal:
    1. Extraer keywords de la pregunta
    2. Buscar en fuentes (PDFs)
    3. Si encuentra → responder con contexto
    4. Si no encuentra → decirlo honestamente
    """
    print(f"\n  🔍 Buscando en fuentes legales...")

    # Extraer keywords para búsqueda
    # Quitar palabras comunes para mejorar la búsqueda
    stopwords = [
        "que", "qué", "dice", "el", "la", "los", "las", "un", "una",
        "del", "de", "en", "por", "para", "con", "como", "cómo",
        "es", "son", "fue", "era", "sobre", "me", "te", "se",
        "explicame", "indicame", "dime", "cual", "cuál",
    ]
    palabras = pregunta.lower().split()
    keywords = [p for p in palabras if p not in stopwords and len(p) > 2]
    query = " ".join(keywords)

    if not query:
        query = pregunta

    # Buscar en Book Server
    resultados = buscar_en_fuentes(query)

    if not resultados:
        # Intentar con menos keywords
        if len(keywords) > 2:
            query_corto = " ".join(keywords[:3])
            resultados = buscar_en_fuentes(query_corto)

    if not resultados:
        print(f"  ❌ No encontré información sobre '{query}' en las fuentes cargadas.")
        print(f"     Asegúrate de tener el PDF relevante en book_data/fuentes/")
        fuentes = listar_fuentes()
        if fuentes:
            print(f"     Fuentes disponibles:")
            for f in fuentes:
                print(f"       • {f['nombre']} ({f.get('palabras', '?')} palabras)")
        else:
            print(f"     ⚠️ No hay fuentes cargadas. Copia PDFs a book_data/fuentes/")
        return "No encontré esa información en mis fuentes. Verifica que el PDF correspondiente esté en la carpeta book_data/fuentes/"

    # Armar contexto con los fragmentos encontrados
    print(f"  ✅ Encontré {len(resultados)} fragmentos relevantes")
    contexto = ""
    for i, r in enumerate(resultados, 1):
        contexto += f"[Fuente: {r['fuente']}, Relevancia: {r['relevancia']}]\n"
        contexto += f"{r['fragmento']}\n\n"

    # Generar respuesta con Qwen3
    print(f"  🤖 Consultando {MODELO} (temp=0.1, anti-alucinación)...")
    print(f"     Contexto: {len(contexto)} chars de {len(resultados)} fragmentos")

    resultado = generar_respuesta(pregunta, contexto)

    if not resultado["ok"]:
        return f"❌ Error al consultar modelo: {resultado.get('error', '?')}"

    print(f"  ⏱️ Respondido en {resultado['tiempo']:.1f}s")
    return resultado["texto"]


# ═══════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════

def cli():
    print(f"""
  ══════════════════════════════════════════════════════
  ⚖️  ASISTENTE LEGAL — RAG Anti-Alucinación
  ══════════════════════════════════════════════════════
  
  Este asistente SOLO responde con info de tus documentos.
  Si no tiene la respuesta en los PDFs, lo dice honestamente.
  NUNCA inventa artículos, leyes ni sentencias.

  Modelo: {MODELO} | Temperatura: 0.1 (mínima creatividad)
  
  Servicios:
    Ollama: {'✅' if ollama_ok() else '❌ Ejecuta: ollama serve'}
    Book Server: {'✅' if book_server_ok() else '❌ Ejecuta: python book_server.py'}
""")

    # Mostrar fuentes
    if book_server_ok():
        fuentes = listar_fuentes()
        if fuentes:
            print(f"  📚 Fuentes cargadas ({len(fuentes)}):")
            for f in fuentes:
                print(f"     • {f['nombre']} ({f.get('palabras', '?')} palabras)")
        else:
            print(f"  ⚠️ Sin fuentes. Copia PDFs a book_data/fuentes/ y reinicia book_server.py")
    print()

    print(f"  Comandos: /fuentes, /salir")
    print(f"  ══════════════════════════════════════════════════════\n")

    while True:
        try:
            entrada = input("  ⚖️ > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  👋 Sesión terminada.")
            break

        if not entrada:
            continue
        if entrada == "/salir":
            break
        elif entrada == "/fuentes":
            fuentes = listar_fuentes()
            if fuentes:
                for f in fuentes:
                    print(f"    • {f['nombre']} ({f.get('palabras', '?')} palabras)")
            else:
                print("    Sin fuentes cargadas.")
            print()
        else:
            if not book_server_ok():
                print("  ❌ Book Server no está corriendo. Ejecuta en otra terminal:")
                print("     python book_server.py")
                continue
            if not ollama_ok():
                print("  ❌ Ollama no está corriendo. Ejecuta: ollama serve")
                continue

            respuesta = procesar(entrada)
            print(f"\n{'─' * 50}")
            print(respuesta)
            print(f"{'─' * 50}\n")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        pregunta = " ".join(sys.argv[1:])
        if book_server_ok() and ollama_ok():
            print(procesar(pregunta))
        else:
            print("❌ Necesitas book_server.py y ollama corriendo.")
    else:
        cli()
