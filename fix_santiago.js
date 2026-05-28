/**
 * Reemplaza referencias a "Santiago de Chile" / "Santiago" 
 * por "El Gran Charco" o "la metrópolis" según contexto.
 * La ciudad ahora es anónima, año 20.000, post-humana.
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const replacements = [
    [/Santiago de Chile/g, "El Gran Charco"],
    [/santiago de chile/g, "el Gran Charco"],
    [/Santiago como mapa/g, "la metrópolis como mapa"],
    [/Santiago →/g, "La Metrópolis →"],
    [/Santiago es/g, "la metrópolis es"],
    [/en Santiago/g, "en el Gran Charco"],
    [/de Santiago/g, "del Gran Charco"],
    [/Santiago,/g, "el Gran Charco,"],
    [/Santiago\./g, "el Gran Charco."],
    [/Santiago</g, "El Gran Charco<"],
];

let totalChanges = 0;

for (const file of files) {
    const filepath = path.join(dir, file);
    let content = fs.readFileSync(filepath, 'utf8');
    let changes = 0;
    
    for (const [pattern, replacement] of replacements) {
        const matches = content.match(pattern);
        if (matches) {
            changes += matches.length;
            content = content.replace(pattern, replacement);
        }
    }
    
    if (changes > 0) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${file} (${changes} cambios)`);
        totalChanges += changes;
    }
}

console.log(`\n📊 ${totalChanges} reemplazos en total.`);
