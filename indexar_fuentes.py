"""
indexar_fuentes.py — Indexa todos los PDFs/documentos en resúmenes por artículo
═══════════════════════════════════════════════════════════════════════════════════
Deja corriendo de noche. Lee cada PDF, extrae cada artículo, y genera un
índice rápido para que las búsquedas sean instantáneas.

Resultado: book_data/indice_legal.json
  {
    "articulo_1": {"texto": "...", "fuente": "CODIGO CIVIL.pdf", "pagina": 5},
    "articulo_2": {"texto": "...", "fuente": "CODIGO CIVIL.pdf", "pagina": 5},
    ...
  }

Uso:
  python indexar_fuentes.py          → indexa todo
  python indexar_fuentes.py --stats  → muestra estadísticas sin re-indexar

Tiempo estimado: 2-5 min por PDF grande (sin GPU, solo CPU)
"""

import os
import sys
import json
import re
import time
from datetime import datetime

os.environ["PYTHONUTF8"] = "1"
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FUENTES_DIR = os.path.join(BASE_DIR, "book_data", "fuentes")
INDICE_FILE = os.path.join(BASE_DIR, "book_data", "indice_legal.json")
RESUMEN_FILE = os.path.join(BASE_DIR, "book_data", "resumen_fuentes.json")


def extraer_texto_pdf(filepath):
    """Extrae texto de un PDF."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(filepath)
        paginas = []
        for i, page in enumerate(reader.pages):
            texto = page.extract_text()
            if texto:
                paginas.append({"pagina": i + 1, "texto": texto})
        return paginas
    except Exception as e:
        print(f"  ❌ Error leyendo {filepath}: {e}")
        return []


def extraer_texto_txt(filepath):
    """Lee un archivo de texto plano."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return [{"pagina": 1, "texto": f.read()}]
    except Exception as e:
        print(f"  ❌ Error leyendo {filepath}: {e}")
        return []


def extraer_articulos(texto, fuente, pagina):
    """
    Extrae artículos individuales del texto.
    Busca patrones como: Art. 1°, Artículo 1, Art. 1545, etc.
    """
    articulos = []
    
    # Patrones de artículos legales chilenos
    patron = r'(Art(?:ículo|\.)\s*(\d+)[°º]?[\.\-\s])'
    
    # Dividir por artículos
    partes = re.split(patron, texto)
    
    # Reconstruir cada artículo con su contenido
    i = 0
    while i < len(partes):
        # Buscar inicio de artículo
        match = re.match(r'Art(?:ículo|\.)\s*(\d+)[°º]?', partes[i])
        if match:
            num = match.group(1)
            # El contenido es la siguiente parte
            contenido = partes[i]
            if i + 1 < len(partes):
                contenido += partes[i + 1]
            # Truncar en el siguiente artículo o a 2000 chars
            contenido = contenido[:2000]
            
            articulos.append({
                "numero": int(num),
                "clave": f"articulo_{num}",
                "texto": contenido.strip(),
                "fuente": fuente,
                "pagina": pagina,
            })
        i += 1
    
    # Método alternativo: buscar línea por línea
    if not articulos:
        lineas = texto.split("\n")
        current_art = None
        current_text = []
        
        for linea in lineas:
            match = re.match(r'\s*Art(?:ículo|\.)\s*(\d+)[°º]?[\.\-\s]*(.*)', linea)
            if match:
                # Guardar artículo anterior
                if current_art:
                    articulos.append({
                        "numero": current_art,
                        "clave": f"articulo_{current_art}",
                        "texto": "\n".join(current_text).strip()[:2000],
                        "fuente": fuente,
                        "pagina": pagina,
                    })
                current_art = int(match.group(1))
                current_text = [linea]
            elif current_art:
                current_text.append(linea)
        
        # Último artículo
        if current_art:
            articulos.append({
                "numero": current_art,
                "clave": f"articulo_{current_art}",
                "texto": "\n".join(current_text).strip()[:2000],
                "fuente": fuente,
                "pagina": pagina,
            })
    
    return articulos


def indexar():
    """Proceso principal de indexación."""
    print(f"""
  ══════════════════════════════════════════════════
  ⚖️  INDEXADOR LEGAL — Procesando fuentes
  ══════════════════════════════════════════════════
  Carpeta: {FUENTES_DIR}
  Índice: {INDICE_FILE}
  """)
    
    if not os.path.exists(FUENTES_DIR):
        print(f"  ❌ Carpeta de fuentes no existe: {FUENTES_DIR}")
        print(f"     Crea la carpeta y pon PDFs ahí.")
        return
    
    archivos = [f for f in os.listdir(FUENTES_DIR) 
                if f.lower().endswith(('.pdf', '.txt', '.md'))]
    
    if not archivos:
        print(f"  ❌ No hay archivos en {FUENTES_DIR}")
        return
    
    print(f"  📂 Archivos a procesar: {len(archivos)}")
    for a in archivos:
        tamanio = os.path.getsize(os.path.join(FUENTES_DIR, a)) / 1024 / 1024
        print(f"     • {a} ({tamanio:.1f} MB)")
    print()
    
    indice = {}
    stats = {
        "fecha_indexacion": datetime.now().isoformat(),
        "archivos_procesados": 0,
        "paginas_total": 0,
        "articulos_encontrados": 0,
        "caracteres_total": 0,
        "fuentes": [],
    }
    
    start_total = time.time()
    
    for archivo in archivos:
        filepath = os.path.join(FUENTES_DIR, archivo)
        print(f"  📖 Procesando: {archivo}...")
        start = time.time()
        
        # Extraer texto
        if archivo.lower().endswith('.pdf'):
            paginas = extraer_texto_pdf(filepath)
        else:
            paginas = extraer_texto_txt(filepath)
        
        if not paginas:
            print(f"     ⚠️ No se pudo extraer texto")
            continue
        
        chars_total = sum(len(p["texto"]) for p in paginas)
        articulos_archivo = 0
        
        # Extraer artículos de cada página
        for pagina_data in paginas:
            articulos = extraer_articulos(pagina_data["texto"], archivo, pagina_data["pagina"])
            for art in articulos:
                clave = art["clave"]
                # Si ya existe, quedarse con el más largo (más completo)
                if clave not in indice or len(art["texto"]) > len(indice[clave]["texto"]):
                    indice[clave] = art
                articulos_archivo += 1
        
        elapsed = time.time() - start
        print(f"     ✅ {len(paginas)} páginas, {articulos_archivo} artículos, {chars_total//1000}K chars ({elapsed:.1f}s)")
        
        stats["archivos_procesados"] += 1
        stats["paginas_total"] += len(paginas)
        stats["articulos_encontrados"] += articulos_archivo
        stats["caracteres_total"] += chars_total
        stats["fuentes"].append({
            "nombre": archivo,
            "paginas": len(paginas),
            "articulos": articulos_archivo,
            "chars": chars_total,
        })
    
    # Guardar índice
    os.makedirs(os.path.dirname(INDICE_FILE), exist_ok=True)
    with open(INDICE_FILE, "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)
    
    # Guardar stats
    with open(RESUMEN_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    elapsed_total = time.time() - start_total
    
    print(f"""
  ══════════════════════════════════════════════════
  ✅ INDEXACIÓN COMPLETADA
  ══════════════════════════════════════════════════
  Archivos procesados: {stats['archivos_procesados']}
  Páginas totales: {stats['paginas_total']}
  Artículos encontrados: {len(indice)}
  Caracteres totales: {stats['caracteres_total']:,}
  Tiempo: {elapsed_total:.1f}s
  
  Índice guardado en: {INDICE_FILE}
  
  Artículos indexados (primeros 20):""")
    
    for i, (clave, art) in enumerate(sorted(indice.items(), key=lambda x: x[1]["numero"])[:20]):
        print(f"    Art. {art['numero']:4d} | {art['fuente'][:30]} | {art['texto'][:60]}...")
    
    if len(indice) > 20:
        print(f"    ... y {len(indice) - 20} más")
    
    print()


def mostrar_stats():
    """Muestra estadísticas del índice existente."""
    if not os.path.exists(RESUMEN_FILE):
        print("  No hay índice. Ejecuta: python indexar_fuentes.py")
        return
    
    with open(RESUMEN_FILE, "r", encoding="utf-8") as f:
        stats = json.load(f)
    
    print(f"""
  ══════════════════════════════════════════════════
  📊 ESTADÍSTICAS DEL ÍNDICE LEGAL
  ══════════════════════════════════════════════════
  Última indexación: {stats['fecha_indexacion'][:16]}
  Archivos: {stats['archivos_procesados']}
  Páginas: {stats['paginas_total']}
  Artículos: {stats['articulos_encontrados']}
  Caracteres: {stats['caracteres_total']:,}
  
  Fuentes:""")
    for f in stats.get("fuentes", []):
        print(f"    • {f['nombre']} ({f['paginas']} págs, {f['articulos']} arts)")
    print()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--stats":
        mostrar_stats()
    else:
        indexar()
