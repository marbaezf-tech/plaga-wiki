"""
book_server.py — MCP Book Server (Asistente de Escritura de Libros)
═══════════════════════════════════════════════════════════════════════
Servidor REST que ayuda a escribir libros:
- Sube fuentes (PDF, TXT, DOCX) como investigación
- Define estructura del libro (índice, capítulos)
- Genera contexto RAG de fuentes relevantes por capítulo
- Guarda capítulos escritos/editados

Puerto: 8430
Uso: python book_server.py
Docs: http://localhost:8430/docs
"""

import json
import os
import re
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Query
from fastapi.responses import JSONResponse
import uvicorn

# ═══════════════════════════════════════════════
# CONFIGURACIÓN
# ═══════════════════════════════════════════════

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "book_data")
FUENTES_DIR = os.path.join(DATA_DIR, "fuentes")
CAPITULOS_DIR = os.path.join(DATA_DIR, "capitulos")
ESTRUCTURA_FILE = os.path.join(DATA_DIR, "estructura.json")

# Crear carpetas si no existen
os.makedirs(FUENTES_DIR, exist_ok=True)
os.makedirs(CAPITULOS_DIR, exist_ok=True)

# ═══════════════════════════════════════════════
# CARGA DE FUENTES
# ═══════════════════════════════════════════════

# Cache de fuentes en memoria
_fuentes: dict = {}  # {nombre: {texto: str, tipo: str, fecha: str}}


def _extraer_texto_pdf(filepath: str) -> str:
    """Extrae texto de un PDF."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(filepath)
        textos = []
        for page in reader.pages:
            texto = page.extract_text()
            if texto:
                textos.append(texto)
        return "\n\n".join(textos)
    except Exception as e:
        return f"[Error leyendo PDF: {e}]"


def _extraer_texto_docx(filepath: str) -> str:
    """Extrae texto de un DOCX."""
    try:
        from docx import Document
        doc = Document(filepath)
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        return f"[Error leyendo DOCX: {e}]"


def _cargar_fuentes():
    """Carga todas las fuentes del disco a memoria."""
    global _fuentes
    _fuentes = {}
    
    if not os.path.exists(FUENTES_DIR):
        return

    for archivo in os.listdir(FUENTES_DIR):
        filepath = os.path.join(FUENTES_DIR, archivo)
        nombre = archivo
        texto = ""
        tipo = "txt"

        if archivo.lower().endswith(".pdf"):
            texto = _extraer_texto_pdf(filepath)
            tipo = "pdf"
        elif archivo.lower().endswith(".docx"):
            texto = _extraer_texto_docx(filepath)
            tipo = "docx"
        elif archivo.lower().endswith((".txt", ".md")):
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                texto = f.read()
            tipo = "txt"
        else:
            continue

        _fuentes[nombre] = {
            "texto": texto,
            "tipo": tipo,
            "chars": len(texto),
            "fecha": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat(),
        }


def _buscar_en_fuentes(query: str, max_resultados: int = 5) -> list:
    """Busca fragmentos relevantes en las fuentes por keywords."""
    query_terms = [t.lower().strip() for t in re.split(r"[\s,]+", query) if len(t) > 2]
    if not query_terms:
        return []

    resultados = []
    for nombre, data in _fuentes.items():
        texto = data["texto"]
        # Dividir en párrafos
        parrafos = [p.strip() for p in texto.split("\n\n") if len(p.strip()) > 50]
        
        for parrafo in parrafos:
            parrafo_lower = parrafo.lower()
            score = sum(1 for t in query_terms if t in parrafo_lower)
            if score > 0:
                resultados.append({
                    "fuente": nombre,
                    "fragmento": parrafo[:500],
                    "relevancia": score,
                })

    resultados.sort(key=lambda x: x["relevancia"], reverse=True)
    return resultados[:max_resultados]


# ═══════════════════════════════════════════════
# ESTRUCTURA DEL LIBRO
# ═══════════════════════════════════════════════

def _cargar_estructura() -> dict:
    """Carga la estructura del libro."""
    if os.path.exists(ESTRUCTURA_FILE):
        with open(ESTRUCTURA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "titulo": "Mi Libro",
        "autor": "Aaron",
        "capitulos": [],
        "notas": "",
    }


def _guardar_estructura(estructura: dict):
    """Guarda la estructura del libro."""
    with open(ESTRUCTURA_FILE, "w", encoding="utf-8") as f:
        json.dump(estructura, f, ensure_ascii=False, indent=2)


# ═══════════════════════════════════════════════
# APP FASTAPI
# ═══════════════════════════════════════════════

app = FastAPI(
    title="Book Server — Asistente de Escritura",
    description="MCP para escribir libros con IA local. Maneja fuentes, estructura y capítulos.",
    version="1.0.0",
)


@app.on_event("startup")
async def startup():
    _cargar_fuentes()
    estructura = _cargar_estructura()
    print(f"📚 Book Server — listo")
    print(f"   Fuentes cargadas: {len(_fuentes)}")
    print(f"   Libro: {estructura.get('titulo', '?')}")
    print(f"   Capítulos definidos: {len(estructura.get('capitulos', []))}")


# --- HEALTH ---
@app.get("/health")
async def health():
    return {"status": "ok", "server": "book-server", "version": "1.0.0"}


# --- FUENTES ---

@app.get("/fuentes")
async def listar_fuentes():
    """Lista todas las fuentes de investigación cargadas."""
    resumen = []
    for nombre, data in _fuentes.items():
        resumen.append({
            "nombre": nombre,
            "tipo": data["tipo"],
            "chars": data["chars"],
            "palabras": len(data["texto"].split()),
            "fecha": data["fecha"],
        })
    return {"total": len(resumen), "fuentes": resumen}


@app.post("/fuentes/subir")
async def subir_fuente(file: UploadFile = File(...)):
    """Sube un archivo como fuente (PDF, TXT, DOCX, MD)."""
    if not file.filename:
        return JSONResponse(status_code=400, content={"error": "Archivo sin nombre"})
    
    # Guardar archivo
    filepath = os.path.join(FUENTES_DIR, file.filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Recargar fuentes
    _cargar_fuentes()
    
    info = _fuentes.get(file.filename, {})
    return {
        "ok": True,
        "archivo": file.filename,
        "chars": info.get("chars", 0),
        "palabras": len(info.get("texto", "").split()),
    }


@app.get("/fuentes/buscar")
async def buscar_fuentes(
    query: str = Query(..., description="Keywords para buscar en las fuentes"),
    max: int = Query(5, description="Máximo de resultados"),
):
    """Busca fragmentos relevantes en las fuentes por keywords."""
    resultados = _buscar_en_fuentes(query, max)
    return {"query": query, "resultados": resultados}


@app.get("/fuentes/{nombre}")
async def get_fuente(nombre: str):
    """Obtiene el texto completo de una fuente."""
    if nombre in _fuentes:
        return {"nombre": nombre, "texto": _fuentes[nombre]["texto"]}
    return JSONResponse(status_code=404, content={"error": f"Fuente '{nombre}' no encontrada"})


# --- ESTRUCTURA ---

@app.get("/estructura")
async def get_estructura():
    """Obtiene la estructura actual del libro."""
    return _cargar_estructura()


@app.post("/estructura")
async def set_estructura(body: dict):
    """Define o actualiza la estructura del libro.
    
    Body esperado:
    {
        "titulo": "Mi Libro",
        "autor": "Nombre",
        "capitulos": [
            {"num": 1, "titulo": "Introducción", "temas": ["tema1", "tema2"], "estado": "pendiente"},
            {"num": 2, "titulo": "Capítulo 2", "temas": [...], "estado": "pendiente"},
        ],
        "notas": "notas generales del libro"
    }
    """
    _guardar_estructura(body)
    return {"ok": True, "capitulos": len(body.get("capitulos", []))}


# --- CAPÍTULOS ---

@app.get("/capitulo/{num}")
async def get_capitulo(num: int):
    """Obtiene un capítulo escrito."""
    filepath = os.path.join(CAPITULOS_DIR, f"cap{num}.md")
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            texto = f.read()
        return {"num": num, "texto": texto, "palabras": len(texto.split())}
    return JSONResponse(status_code=404, content={"error": f"Capítulo {num} no escrito aún"})


@app.post("/capitulo/{num}")
async def guardar_capitulo(num: int, body: dict):
    """Guarda un capítulo escrito o editado."""
    texto = body.get("texto", "")
    if not texto:
        return JSONResponse(status_code=400, content={"error": "Campo 'texto' requerido"})
    
    filepath = os.path.join(CAPITULOS_DIR, f"cap{num}.md")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(texto)
    
    # Actualizar estado en estructura
    estructura = _cargar_estructura()
    for cap in estructura.get("capitulos", []):
        if cap.get("num") == num:
            cap["estado"] = "escrito"
            cap["palabras"] = len(texto.split())
            cap["ultima_edicion"] = datetime.now().isoformat()
    _guardar_estructura(estructura)
    
    return {"ok": True, "palabras": len(texto.split()), "archivo": filepath}


# --- CONTEXTO RAG ---

@app.get("/contexto/{num}")
async def get_contexto_capitulo(num: int):
    """
    Genera contexto RAG de las fuentes relevantes para un capítulo.
    Busca los temas del capítulo en las fuentes y devuelve fragmentos útiles.
    Ideal para inyectar como contexto antes de pedirle al LLM que escriba.
    """
    estructura = _cargar_estructura()
    capitulo_info = None
    for cap in estructura.get("capitulos", []):
        if cap.get("num") == num:
            capitulo_info = cap
            break
    
    if not capitulo_info:
        return JSONResponse(status_code=404, content={"error": f"Capítulo {num} no definido en estructura"})
    
    # Buscar por temas del capítulo
    temas = capitulo_info.get("temas", [])
    titulo = capitulo_info.get("titulo", "")
    query = " ".join(temas) + " " + titulo
    
    fragmentos = _buscar_en_fuentes(query, max_resultados=10)
    
    # Formatear como contexto para LLM
    contexto_texto = f"=== CONTEXTO PARA: Capítulo {num} — {titulo} ===\n"
    contexto_texto += f"Temas: {', '.join(temas)}\n\n"
    for frag in fragmentos:
        contexto_texto += f"[Fuente: {frag['fuente']}]\n{frag['fragmento']}\n\n---\n\n"
    
    return {
        "capitulo": num,
        "titulo": titulo,
        "temas": temas,
        "contexto": contexto_texto,
        "fragmentos": len(fragmentos),
    }


# --- RESUMEN ---

@app.get("/resumen")
async def get_resumen():
    """Resumen del estado del libro."""
    estructura = _cargar_estructura()
    capitulos = estructura.get("capitulos", [])
    
    escritos = sum(1 for c in capitulos if c.get("estado") == "escrito")
    pendientes = sum(1 for c in capitulos if c.get("estado") != "escrito")
    palabras_total = sum(c.get("palabras", 0) for c in capitulos)
    
    return {
        "titulo": estructura.get("titulo", "?"),
        "autor": estructura.get("autor", "?"),
        "capitulos_total": len(capitulos),
        "capitulos_escritos": escritos,
        "capitulos_pendientes": pendientes,
        "palabras_total": palabras_total,
        "fuentes_cargadas": len(_fuentes),
    }


# ═══════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("BOOK_PORT", 8430))
    print(f"\n📚 Book Server — Asistente de Escritura")
    print(f"   http://localhost:{port}")
    print(f"   Docs: http://localhost:{port}/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
