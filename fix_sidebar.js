/**
 * Actualiza el sidebar de todas las páginas HTML para incluir
 * las secciones de Desarrollo y Balance/Torneos.
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const newSection = `            <li class="section-title">Desarrollo</li>
            <li><a href="trazabilidad.html">🔗 Trazabilidad</a></li>
            <li><a href="qa.html">🧪 QA</a></li>
            <li><a href="arquitectura.html">📐 UML</a></li>
            <li><a href="diagnostico_gemini.html">🤖 Diagnóstico</a></li>
            <li><a href="multiplayer.html">🌐 Multiplayer</a></li>
            <li class="section-title">Balance / Torneos</li>
            <li><a href="torneo_pvp_v2.html">⚔️🐜 PvP v2 + META</a></li>
            <li><a href="torneo_social.html">💃 Social</a></li>
            <li><a href="torneo_pvp.html">⚔️ PvP v1</a></li>`;

let updated = 0;

for (const file of files) {
    const filepath = path.join(dir, file);
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Skip if already has torneo_pvp_v2
    if (content.includes('torneo_pvp_v2')) continue;
    
    // Find the closing </ul> of nav-links and insert before it
    const marker = '        </ul>\n    </nav>';
    if (content.includes(marker)) {
        content = content.replace(marker, newSection + '\n        </ul>\n    </nav>');
        fs.writeFileSync(filepath, content, 'utf8');
        updated++;
        console.log(`✅ ${file}`);
    }
}

console.log(`\n📊 ${updated} páginas actualizadas.`);
