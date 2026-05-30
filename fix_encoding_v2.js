/**
 * Fix encoding masivo v2 — corrige mojibake en todas las páginas HTML
 * Causado por PowerShell Set-Content sin -Encoding UTF8
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

// Mapa de reemplazos: mojibake → carácter correcto
const fixes = [
    // Vocales con tilde
    ['ó', 'ó'], ['Ó', 'Ó'],
    ['á', 'á'], ['Á', 'Á'],
    ['é', 'é'], ['É', 'É'],
    ['í', 'í'], ['Í', 'Í'],
    ['ú', 'ú'], ['Ú', 'Ú'],
    ['ñ', 'ñ'], ['Ñ', 'Ñ'],
    ['ü', 'ü'], ['Ü', 'Ü'],
    // Puntuación especial
    ['¿', '¿'], ['¡', '¡'],
    ['«', '«'], ['»', '»'],
    // Variantes adicionales de mojibake
    ['Ã³', 'ó'], ['Ã¡', 'á'], ['Ã©', 'é'],
    ['Ã­', 'í'], ['Ãº', 'ú'], ['Ã±', 'ñ'],
    ['Ã"', 'Ó'], ['Ã', 'Á'], ['Ã‰', 'É'],
];

let totalFiles = 0;
let totalChanges = 0;

for (const file of files) {
    const filepath = path.join(dir, file);
    let content = fs.readFileSync(filepath, 'utf8');
    let changes = 0;

    for (const [bad, good] of fixes) {
        const count = (content.split(bad).length - 1);
        if (count > 0) {
            content = content.split(bad).join(good);
            changes += count;
        }
    }

    if (changes > 0) {
        fs.writeFileSync(filepath, content, { encoding: 'utf8' });
        console.log(`✅ ${file} (${changes} fixes)`);
        totalFiles++;
        totalChanges += changes;
    }
}

console.log(`\n📊 ${totalFiles} archivos corregidos, ${totalChanges} caracteres reparados.`);
