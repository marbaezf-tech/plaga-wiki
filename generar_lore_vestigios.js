/**
 * Generador de Lore para Vestigios de los Antiguos
 * Usa la API de Gemini como "Editor Experto en Lore" estilo GRRM
 * 
 * Uso: node generar_lore_vestigios.js
 * Requiere: GEMINI_API_KEY en el entorno o hardcodeada
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// --- CONFIG ---
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBFAXlPKmS-H8ZdKg_ocQtHr5pWpd3VVEk";
const RETRY_WAIT_MS = 120000; // 2 minutos
const MAX_RETRIES = 2;

const genAI = new GoogleGenerativeAI(API_KEY);

// --- LEER CONTEXTO DE LA WIKI ---
function loadWikiContext() {
    const wikiDir = __dirname;
    const filesToRead = [
        "sistemas.html",
        "gran-eter.html", 
        "semidioses.html",
        "reliquias.html",
        "silencio-verde.html",
        "taxon-zancudos.html",
        "npcs.html",
        "glosario.html"
    ];
    
    let context = "";
    for (const file of filesToRead) {
        const filePath = path.join(wikiDir, file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf8");
            // Extraer solo texto relevante (sin HTML tags)
            const textOnly = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            context += `\n\n--- ${file} ---\n${textOnly.substring(0, 4000)}`;
        }
    }
    return context;
}

// --- PROMPT DEL EDITOR EXPERTO ---
function buildPrompt(wikiContext) {
    return `Eres un EDITOR EXPERTO EN LORE para el universo de "Plaga: La Descarada", un RPG de insectos ambientado en el año 20.000. Tu estilo narrativo es el de George R.R. Martin: cínico, detallado, con citas de personajes que revelan información estratégica sin decirlo todo.

REGLAS DE ESCRITURA:
- Cada Vestigio debe tener una historia de QUIÉN fue el Antiguo que lo dejó
- Usa citas directas de personajes del universo (Ramazzottius el Tardígrado narrador de 530M años, Don Rufino la Chinche, Roxana la Mariposa, La Tejedora la Araña, etc.)
- Las citas deben revelar información de forma oblicua, como pistas — nunca explicar todo directamente
- Tono: arrogante, descarado, cínico. Los insectos se creen superiores a todo
- El Silencio Verde (Cordyceps) siempre acecha como amenaza de fondo
- La Colmena Silenciosa avanza desde el SUR (Antártida)
- El Holoceno AGONIZA (transición a glaciación)
- Los humanos son "Gigantes" — ganado torpe e ignorante

CONTEXTO DEL UNIVERSO (extractos de la wiki):
${wikiContext.substring(0, 15000)}

TAREA: Genera el lore detallado para estos 5 Vestigios de los Antiguos. Para cada uno necesito:
1. Nombre completo y poético del Vestigio
2. Historia del Antiguo que lo dejó (quién era, qué Grado tenía, cómo murió)
3. Dónde se encuentra en el Gran Charco (ubicación específica)
4. Efecto mecánico (ya definido, solo confírmalo narrativamente)
5. Una cita de un personaje del universo que hable del Vestigio (estilo GRRM)

LOS 5 VESTIGIOS:
1. Fragmento de Exoesqueleto Ancestral — buff temporal +1 Grado por 1 combate
2. Gota de Hemolinfa Cristalizada — buff temporal +1 Grado + restaura Hemolinfa, 3 turnos
3. Espora de Atavismo Extinto — desbloquea 1 Atavismo de Grado superior, 1 uso
4. Ámbar de Progenitor — ascenso PERMANENTE de Grado (ultra raro)
5. Raíz de Éter Fosilizada — buff temporal +1 Grado + inmunidad al Silencio Verde, 1 día

Responde en formato JSON con esta estructura:
{
  "vestigios": [
    {
      "nombre_poetico": "string",
      "historia_antiguo": "string (2-3 párrafos)",
      "ubicacion": "string",
      "efecto_narrativo": "string",
      "cita": { "texto": "string", "autor": "string", "contexto": "string" }
    }
  ]
}`;
}

// --- LLAMADA A GEMINI CON RETRY ---
async function callGemini(prompt) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
            console.log(`\n🦟 Intento ${attempt}/${MAX_RETRIES + 1} — Invocando API de Gemini...`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            console.log("✅ Respuesta recibida de Gemini.");
            return text;
        } catch (error) {
            console.error(`❌ Error en intento ${attempt}: ${error.message}`);
            if (attempt <= MAX_RETRIES) {
                console.log(`⏳ Esperando ${RETRY_WAIT_MS / 1000} segundos antes de reintentar...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS));
            } else {
                console.log("\n⚠️ Se agotaron los reintentos. Revisa la API key o la conexión.");
                console.log("   Puedes volver a ejecutar: node generar_lore_vestigios.js");
                return null;
            }
        }
    }
}

// --- PARSEAR Y GUARDAR RESULTADO ---
function saveResult(rawText) {
    // Intentar extraer JSON del texto
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    } else {
        // Intentar encontrar el JSON directamente
        const startIdx = rawText.indexOf("{");
        const endIdx = rawText.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = rawText.substring(startIdx, endIdx + 1);
        }
    }

    try {
        const data = JSON.parse(jsonStr);
        const outputPath = path.join(__dirname, "vestigios_lore.json");
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
        console.log(`\n📁 Lore guardado en: ${outputPath}`);
        return data;
    } catch (e) {
        // Si no parsea como JSON, guardar como texto raw
        const outputPath = path.join(__dirname, "vestigios_lore_raw.txt");
        fs.writeFileSync(outputPath, rawText, "utf8");
        console.log(`\n📁 Respuesta raw guardada en: ${outputPath}`);
        console.log("   (No se pudo parsear como JSON, revisa el archivo)");
        return null;
    }
}

// --- GENERAR HTML PARA LA WIKI ---
function generateHTML(data) {
    if (!data || !data.vestigios) return;
    
    let html = `\n<!-- LORE DE VESTIGIOS (generado por Gemini) -->\n`;
    html += `<h3>📖 Historias de los Vestigios</h3>\n`;
    html += `<div class="info-box lore">\n`;
    html += `    <h4>📜 Relatos de los que Tocaron el Poder</h4>\n`;
    html += `    <p>Cada Vestigio tiene una historia. Cada historia tiene un muerto.</p>\n`;
    html += `</div>\n\n`;

    for (const v of data.vestigios) {
        html += `<div class="stat-block">\n`;
        html += `    <h3>${v.nombre_poetico}</h3>\n`;
        html += `    <p>${v.historia_antiguo}</p>\n`;
        html += `    <p><strong>Ubicación:</strong> ${v.ubicacion}</p>\n`;
        html += `    <p><strong>Efecto:</strong> ${v.efecto_narrativo}</p>\n`;
        if (v.cita) {
            html += `    <blockquote>\n`;
            html += `        <p><em>"${v.cita.texto}"</em></p>\n`;
            html += `        <p>— <strong>${v.cita.autor}</strong>, ${v.cita.contexto}</p>\n`;
            html += `    </blockquote>\n`;
        }
        html += `</div>\n\n`;
    }

    const outputPath = path.join(__dirname, "vestigios_lore_fragment.html");
    fs.writeFileSync(outputPath, html, "utf8");
    console.log(`📄 Fragmento HTML generado: ${outputPath}`);
    console.log("   Puedes insertarlo en sistemas.html después de la tabla de Vestigios.");
}

// --- MAIN ---
async function main() {
    console.log("🧬 ═══════════════════════════════════════════════");
    console.log("   PLAGA: LA DESCARADA — Generador de Lore");
    console.log("   Editor Experto en Lore (estilo GRRM)");
    console.log("🧬 ═══════════════════════════════════════════════\n");

    console.log("📚 Cargando contexto de la wiki...");
    const wikiContext = loadWikiContext();
    console.log(`   ${wikiContext.length} caracteres de contexto cargados.`);

    const prompt = buildPrompt(wikiContext);
    console.log(`📝 Prompt construido (${prompt.length} chars).`);

    const rawResponse = await callGemini(prompt);
    if (!rawResponse) {
        process.exit(1);
    }

    const data = saveResult(rawResponse);
    generateHTML(data);

    console.log("\n🦟 ¡Lore generado con éxito! El Gran Charco se expande.");
}

main();
