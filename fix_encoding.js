/**
 * Fix encoding issues across all wiki HTML files
 * Replaces corrupted sidebar + common Spanish character patterns
 */
const fs = require("fs");
const path = require("path");

const WIKI_DIR = __dirname;

// The correct sidebar that should be in ALL pages
const CORRECT_SIDEBAR = `    <nav id="sidebar">
        <div class="logo"><h1>🦟 PLAGA</h1><span class="subtitle">La Descarada — Wiki</span><button class="menu-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</button></div>
        <ul class="nav-links">
            <li><a href="index.html">🏠 Inicio</a></li>
            <li><a href="dashboard.html">📊 Dashboard</a></li>
            <li class="section-title">Lore</li>
            <li><a href="gran-eter.html">⚗ El Gran Éter</a></li>
            <li><a href="progenitores.html">👑 Progenitores Divinos</a></li>
            <li><a href="semidioses.html">⚔ Los 13 Semidioses</a></li>
            <li><a href="caida.html">💀 La Caída del Éter</a></li>
            <li><a href="profecias.html">🔮 El Retorno del 35%</a></li>
            <li><a href="silencio-verde.html">🍄 El Silencio Verde</a></li>
            <li class="section-title">Taxones</li>
            <li><a href="taxones.html">🧬 Los 14 Taxones</a></li>
            <li><a href="taxon-zancudos.html">🦟 Zancudos</a></li>
            <li><a href="taxon-cucarachas.html">🪳 Cucarachas</a></li>
            <li><a href="taxon-avispas.html">🐝 Avispas</a></li>
            <li><a href="taxon-garrapatas.html">🕷️ Garrapatas</a></li>
            <li><a href="taxon-chinches.html">🛏️ Chinches</a></li>
            <li><a href="taxon-mariposas.html">🦋 Mariposas</a></li>
            <li><a href="taxon-aranas.html">🕸️ Arañas</a></li>
            <li><a href="taxon-escorpiones.html">🦂 Escorpiones</a></li>
            <li><a href="taxon-vinchucas.html">🗡️ Vinchucas</a></li>
            <li><a href="taxon-moscas.html">💀 Moscas</a></li>
            <li><a href="taxon-sanguijuelas.html">🧪 Sanguijuelas</a></li>
            <li><a href="taxon-polillas.html">🌙 Polillas</a></li>
            <li><a href="taxon-pulgas.html">🎪 Pulgas</a></li>
            <li><a href="taxon-tipulas.html">🦟 Típulas</a></li>
            <li class="section-title">Mundo</li>
            <li><a href="facciones.html">⚔️ Facciones</a></li>
            <li><a href="sembradores.html">🍄 Sembradores</a></li>
            <li><a href="santiago.html">🏙️ El Gran Charco</a></li>
            <li><a href="fauna.html">🐜 Fauna</a></li>
            <li><a href="npcs.html">👤 NPCs</a></li>
            <li><a href="items.html">⚔️ Armas y Objetos</a></li>
            <li><a href="reliquias.html">💎 Reliquias</a></li>
            <li class="section-title">Referencia</li>
            <li><a href="sistemas.html">⚙️ Sistemas de Juego</a></li>
            <li><a href="glosario.html">📖 Glosario</a></li>
            <li><a href="equivalencias.html">🔄 Referencias</a></li>
        </ul>
    </nav>`;


// Common Spanish character replacements (context-based)
const SPANISH_FIXES = [
    // Vowels with accents (most common corruptions)
    [/\u00e1/g, "á"], // already correct but ensure
    [/\u00e9/g, "é"],
    [/\u00ed/g, "í"],
    [/\u00f3/g, "ó"],
    [/\u00fa/g, "ú"],
    [/\u00f1/g, "ñ"],
    // Common words with corrupted characters
    [/Tax\uFFFDn/g, "Taxón"],
    [/tax\uFFFDn/g, "taxón"],
    [/T\uFFFDpula/g, "Típula"],
    [/t\uFFFDpula/g, "típula"],
    [/Ara\uFFFDa/g, "Araña"],
    [/ara\uFFFDa/g, "araña"],
    [/Ca\uFFFDda/g, "Caída"],
    [/ca\uFFFDda/g, "caída"],
    [/\uFFFDter/g, "Éter"],
    [/Esp\uFFFDcimen/g, "Espécimen"],
    [/esp\uFFFDcimen/g, "espécimen"],
    [/par\uFFFDsit/g, "parásit"],
    [/prob\uFFFDscide/g, "probóscide"],
    [/quir\uFFFDrgic/g, "quirúrgic"],
    [/mec\uFFFDnic/g, "mecánic"],
    [/Mec\uFFFDnic/g, "Mecánic"],
    [/gen\uFFFDtic/g, "genétic"],
    [/Gen\uFFFDtic/g, "Genétic"],
    [/biol\uFFFDgic/g, "biológic"],
    [/Biol\uFFFDgic/g, "Biológic"],
    [/c\uFFFDsmic/g, "cósmic"],
    [/quir\uFFFDfano/g, "quirófano"],
    [/modificaci\uFFFDn/g, "modificación"],
    [/informaci\uFFFDn/g, "información"],
    [/evoluci\uFFFDn/g, "evolución"],
    [/destrucci\uFFFDn/g, "destrucción"],
    [/protecci\uFFFDn/g, "protección"],
    [/secci\uFFFDn/g, "sección"],
    [/Secci\uFFFDn/g, "Sección"],
    [/funci\uFFFDn/g, "función"],
    [/religi\uFFFDn/g, "religión"],
    [/precisi\uFFFDn/g, "precisión"],
    [/posici\uFFFDn/g, "posición"],
    [/condici\uFFFDn/g, "condición"],
    [/conexi\uFFFDn/g, "conexión"],
    [/infecci\uFFFDn/g, "infección"],
    [/acci\uFFFDn/g, "acción"],
    [/reacci\uFFFDn/g, "reacción"],
    [/creaci\uFFFDn/g, "creación"],
    [/generaci\uFFFDn/g, "generación"],
    [/adaptaci\uFFFDn/g, "adaptación"],
    [/mutaci\uFFFDn/g, "mutación"],
    [/manipulaci\uFFFDn/g, "manipulación"],
    [/dominaci\uFFFDn/g, "dominación"],
    [/alimentaci\uFFFDn/g, "alimentación"],
    [/comunicaci\uFFFDn/g, "comunicación"],
    [/civilizaci\uFFFDn/g, "civilización"],
    [/organizaci\uFFFDn/g, "organización"],
    [/poblaci\uFFFDn/g, "población"],
    [/producci\uFFFDn/g, "producción"],
    [/reproducci\uFFFDn/g, "reproducción"],
    [/tradici\uFFFDn/g, "tradición"],
    [/expansi\uFFFDn/g, "expansión"],
    [/invasi\uFFFDn/g, "invasión"],
    [/decisi\uFFFDn/g, "decisión"],
    [/presi\uFFFDn/g, "presión"],
    [/tensi\uFFFDn/g, "tensión"],
    [/dimensi\uFFFDn/g, "dimensión"],
    [/misi\uFFFDn/g, "misión"],
    [/visi\uFFFDn/g, "visión"],
    [/regi\uFFFDn/g, "región"],
    [/relaci\uFFFDn/g, "relación"],
    [/situaci\uFFFDn/g, "situación"],
    [/operaci\uFFFDn/g, "operación"],
    [/migraci\uFFFDn/g, "migración"],
    [/raz\uFFFDn/g, "razón"],
    [/coraz\uFFFDn/g, "corazón"],
    [/est\uFFFDmago/g, "estómago"],
    [/aut\uFFFDnomo/g, "autónomo"],
    [/fen\uFFFDmeno/g, "fenómeno"],
    [/\uFFFDnico/g, "único"],
    [/\uFFFDltim/g, "últim"],
    [/\uFFFDxido/g, "óxido"],
    [/ox\uFFFDgeno/g, "oxígeno"],
    [/Ox\uFFFDgeno/g, "Oxígeno"],
    [/ni\uFFFDo/g, "niño"],
    [/a\uFFFDo/g, "año"],
    [/A\uFFFDo/g, "Año"],
    [/da\uFFFDo/g, "daño"],
    [/Da\uFFFDo/g, "Daño"],
    [/sue\uFFFDo/g, "sueño"],
    [/due\uFFFDo/g, "dueño"],
    [/peque\uFFFDo/g, "pequeño"],
    [/rese\uFFFDa/g, "reseña"],
    [/se\uFFFDal/g, "señal"],
    [/compa\uFFFD/g, "compañ"],
    [/Espa\uFFFDa/g, "España"],
    [/estra\uFFFDo/g, "extraño"],
    [/enga\uFFFDo/g, "engaño"],
    [/tama\uFFFDo/g, "tamaño"],
    [/cari\uFFFDo/g, "cariño"],
    [/oto\uFFFDo/g, "otoño"],
    [/campa\uFFFDa/g, "campaña"],
    [/monta\uFFFDa/g, "montaña"],
    [/caba\uFFFDa/g, "cabaña"],
    [/ara\uFFFDa/g, "araña"],
    [/ensa\uFFFDa/g, "ensaña"],
    [/rega\uFFFDa/g, "regaña"],
    // Common accent patterns
    [/m\uFFFDs/g, "más"],
    [/dem\uFFFDs/g, "demás"],
    [/adem\uFFFDs/g, "además"],
    [/jam\uFFFDs/g, "jamás"],
    [/quiz\uFFFDs/g, "quizás"],
    [/ser\uFFFD/g, "será"],
    [/est\uFFFD /g, "está "],
    [/est\uFFFDn/g, "están"],
    [/har\uFFFD/g, "hará"],
    [/podr\uFFFD/g, "podrá"],
    [/tendr\uFFFD/g, "tendrá"],
    [/vendr\uFFFD/g, "vendrá"],
    [/habr\uFFFD/g, "habrá"],
    [/tambi\uFFFDn/g, "también"],
    [/Tambi\uFFFDn/g, "También"],
    [/seg\uFFFDn/g, "según"],
    [/com\uFFFDn/g, "común"],
    [/ning\uFFFDn/g, "ningún"],
    [/alg\uFFFDn/g, "algún"],
    [/j\uFFFDven/g, "jóven"],
    [/\uFFFDrbol/g, "árbol"],
    [/h\uFFFDbitat/g, "hábitat"],
    [/cr\uFFFDneo/g, "cráneo"],
    [/p\uFFFDnico/g, "pánico"],
    [/t\uFFFDxico/g, "tóxico"],
    [/T\uFFFDxico/g, "Tóxico"],
    [/cl\uFFFDsic/g, "clásic"],
    [/b\uFFFDsic/g, "básic"],
    [/m\uFFFDgic/g, "mágic"],
    [/tr\uFFFDgic/g, "trágic"],
    [/l\uFFFDgic/g, "lógic"],
    [/f\uFFFDsic/g, "físic"],
    [/qu\uFFFDmic/g, "químic"],
    [/Qu\uFFFDmic/g, "Químic"],
    [/jer\uFFFDrquic/g, "jerárquic"],
    [/hist\uFFFDric/g, "históric"],
    [/Hist\uFFFDric/g, "Históric"],
    [/\u2014/g, "—"], // em dash (already correct)
    // Remaining single FFFD → common Spanish letters based on context
    [/reci\uFFFDn/g, "recién"],
    [/qui\uFFFDn/g, "quién"],
    [/Qui\uFFFDn/g, "Quién"],
    [/d\uFFFDnde/g, "dónde"],
    [/c\uFFFDmo/g, "cómo"],
    [/C\uFFFDmo/g, "Cómo"],
    [/\uFFFDl /g, "él "],
    [/ \uFFFDl/g, " él"],
    [/s\uFFFDlo/g, "sólo"],
    [/ej\uFFFDrcit/g, "ejércit"],
    [/p\uFFFDrdida/g, "pérdida"],
    [/\uFFFDpoca/g, "época"],
    [/\uFFFDpic/g, "épic"],
    [/t\uFFFDcnic/g, "técnic"],
    [/T\uFFFDcnic/g, "Técnic"],
    [/pr\uFFFDctic/g, "práctic"],
    [/est\uFFFDtic/g, "estétic"],
    [/gen\uFFFDric/g, "genéric"],
    [/num\uFFFDric/g, "numéric"],
    [/atm\uFFFDsfer/g, "atmósfer"],
    [/aut\uFFFDntic/g, "auténtic"],
    [/pat\uFFFDtic/g, "patétic"],
    [/dram\uFFFDtic/g, "dramátic"],
    [/sistem\uFFFDtic/g, "sistemátic"],
    [/cinem\uFFFDtic/g, "cinemátic"],
    [/problem\uFFFDtic/g, "problemátic"],
    [/espec\uFFFDfic/g, "específic"],
    [/cient\uFFFDfic/g, "científic"],
    [/magn\uFFFDfic/g, "magnífc"],
    [/pac\uFFFDfic/g, "pacífic"],
    [/terr\uFFFDfic/g, "terrífc"],
    // Title dash
    [/ \uFFFD /g, " — "],
];

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, "utf8");
    let original = content;
    
    // 1. Replace the entire sidebar block
    const sidebarRegex = /\s*<nav id="sidebar">[\s\S]*?<\/nav>/;
    if (sidebarRegex.test(content)) {
        content = content.replace(sidebarRegex, "\n" + CORRECT_SIDEBAR);
    }
    
    // 2. Apply Spanish character fixes
    for (const [pattern, replacement] of SPANISH_FIXES) {
        content = content.replace(pattern, replacement);
    }
    
    // 3. Replace remaining isolated ? that are clearly emoji placeholders in specific patterns
    // "??" at start of text content (was a 4-byte emoji)
    content = content.replace(/<h1>\?\? /g, "<h1>🦟 ");
    content = content.replace(/<h1>\? /g, "<h1>⚙️ ");
    content = content.replace(/<h2>\?\? /g, "<h2>🧬 ");
    content = content.replace(/<h2>\? /g, "<h2>⚔️ ");
    content = content.replace(/<h3>\?\? /g, "<h3>📜 ");
    content = content.replace(/<h4>\?\? /g, "<h4>⚙️ ");
    content = content.replace(/<h4>\? /g, "<h4>📜 ");
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, "utf8");
        return true;
    }
    return false;
}

// Main
const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith(".html") && f !== "sistemas.html" && f !== "dashboard.html");
let fixed = 0;
let remaining = [];

for (const file of files) {
    const filePath = path.join(WIKI_DIR, file);
    const wasFixed = fixFile(filePath);
    if (wasFixed) fixed++;
    
    // Check remaining FFFD
    const content = fs.readFileSync(filePath, "utf8");
    let count = 0;
    for (let i = 0; i < content.length; i++) {
        if (content.charCodeAt(i) === 0xFFFD) count++;
    }
    if (count > 0) remaining.push({ file, count });
}

console.log(`\n✅ Fixed ${fixed} files.`);
if (remaining.length > 0) {
    console.log(`\n⚠️ Files still with corrupted chars:`);
    remaining.forEach(r => console.log(`   ${r.file}: ${r.count} remaining`));
} else {
    console.log(`\n🎉 All files clean!`);
}
