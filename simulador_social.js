/**
 * SIMULADOR DE DUELOS SOCIALES — Danza de Antenas
 * Plaga: La Descarada
 * 
 * Simula enfrentamientos sociales entre los 14 taxones usando
 * el sistema de 4 posturas (Acecho/Exposición/Mimetismo/Vibración).
 * 
 * Ejecutar: node simulador_social.js
 */

// ===== DATOS DE TAXONES (stats sociales relevantes) =====
const TAXONES = {
    zancudo:     { nombre: "Zancudo",     emoji: "🦟", torax: 5, feromonas: 3, cripsis: 8, sensilios: 6 },
    cucaracha:   { nombre: "Cucaracha",   emoji: "🪳", torax: 6, feromonas: 1, cripsis: 6, sensilios: 7 },
    avispa:      { nombre: "Avispa",      emoji: "🐝", torax: 8, feromonas: 4, cripsis: 3, sensilios: 4 },
    garrapata:   { nombre: "Garrapata",   emoji: "🕷️", torax: 7, feromonas: 2, cripsis: 4, sensilios: 5 },
    chinche:     { nombre: "Chinche",     emoji: "🛏️", torax: 3, feromonas: 9, cripsis: 7, sensilios: 6 },
    mariposa:    { nombre: "Mariposa",    emoji: "🦋", torax: 2, feromonas: 10, cripsis: 5, sensilios: 7 },
    arana:       { nombre: "Araña",       emoji: "🕸️", torax: 4, feromonas: 1, cripsis: 7, sensilios: 9 },
    escorpion:   { nombre: "Escorpión",   emoji: "🦂", torax: 8, feromonas: 3, cripsis: 6, sensilios: 5 },
    vinchuca:    { nombre: "Vinchuca",    emoji: "🗡️", torax: 5, feromonas: 2, cripsis: 10, sensilios: 8 },
    mosca:       { nombre: "Mosca",       emoji: "🪰", torax: 4, feromonas: 5, cripsis: 2, sensilios: 7 },
    sanguijuela: { nombre: "Sanguijuela", emoji: "💉", torax: 3, feromonas: 8, cripsis: 5, sensilios: 6 },
    polilla:     { nombre: "Polilla",     emoji: "🌙", torax: 3, feromonas: 6, cripsis: 4, sensilios: 10 },
    pulga:       { nombre: "Pulga",       emoji: "⚡", torax: 4, feromonas: 5, cripsis: 5, sensilios: 6 },
    tipula:      { nombre: "Típula",      emoji: "🦟", torax: 3, feromonas: 9, cripsis: 8, sensilios: 10 },
};

// ===== POSTURAS Y VENTAJAS =====
const POSTURAS = {
    acecho:     { stat: "torax",     nombre: "Acecho",     emoji: "🦷" },
    exposicion: { stat: "feromonas", nombre: "Exposición", emoji: "💐" },
    mimetismo:  { stat: "cripsis",   nombre: "Mimetismo",  emoji: "🫥" },
    vibracion:  { stat: "sensilios", nombre: "Vibración",  emoji: "📡" },
};

// Ventaja: key es fuerte contra value
const VENTAJA = {
    acecho: "exposicion",
    exposicion: "vibracion",
    mimetismo: "acecho",
    vibracion: "mimetismo",
};

// ===== ESTRATEGIA DE ELECCIÓN =====
function elegirPostura(taxon, estrategia = "optima") {
    if (estrategia === "optima") {
        // Elige la postura donde tiene el stat más alto
        let mejor = "acecho";
        let mejorVal = 0;
        for (const [key, postura] of Object.entries(POSTURAS)) {
            const val = taxon[postura.stat];
            if (val > mejorVal) {
                mejorVal = val;
                mejor = key;
            }
        }
        // 70% óptima, 30% segunda mejor (para variedad)
        if (Math.random() < 0.7) return mejor;
        
        // Segunda mejor
        let segunda = "acecho";
        let segundaVal = 0;
        for (const [key, postura] of Object.entries(POSTURAS)) {
            const val = taxon[postura.stat];
            if (val > segundaVal && key !== mejor) {
                segundaVal = val;
                segunda = key;
            }
        }
        return segunda;
    }
    
    if (estrategia === "aleatoria") {
        const keys = Object.keys(POSTURAS);
        return keys[Math.floor(Math.random() * keys.length)];
    }
    
    if (estrategia === "contrarresta") {
        // Intenta contrarrestar la postura más probable del oponente
        // (no tiene info del oponente, así que elige su mejor counter)
        const keys = Object.keys(POSTURAS);
        return keys[Math.floor(Math.random() * keys.length)];
    }
    
    return "acecho";
}

// ===== RESOLVER DUELO SOCIAL =====
function resolverDuelo(taxonA, taxonB, posturaA, posturaB) {
    const statA = POSTURAS[posturaA].stat;
    const statB = POSTURAS[posturaB].stat;
    
    let valorA = taxonA[statA];
    let valorB = taxonB[statB];
    
    // Bonus por ventaja (+3)
    const ventajaA = VENTAJA[posturaA] === posturaB;
    const ventajaB = VENTAJA[posturaB] === posturaA;
    
    if (ventajaA) valorA += 3;
    if (ventajaB) valorB += 3;
    
    // Variación aleatoria (±2)
    valorA += Math.floor(Math.random() * 5) - 2;
    valorB += Math.floor(Math.random() * 5) - 2;
    
    return {
        rollA: valorA,
        rollB: valorB,
        winner: valorA >= valorB ? "A" : "B",
        ventajaA,
        ventajaB,
        posturaA,
        posturaB,
    };
}

// ===== SIMULACIÓN COMPLETA: TODOS VS TODOS =====
function simularTorneo(rondas = 1000) {
    const taxonKeys = Object.keys(TAXONES);
    const resultados = {};
    const matchups = {};
    
    // Inicializar
    for (const key of taxonKeys) {
        resultados[key] = { victorias: 0, derrotas: 0, empates: 0 };
        matchups[key] = {};
        for (const opp of taxonKeys) {
            if (opp !== key) matchups[key][opp] = { wins: 0, losses: 0 };
        }
    }
    
    // Simular
    for (let r = 0; r < rondas; r++) {
        for (let i = 0; i < taxonKeys.length; i++) {
            for (let j = i + 1; j < taxonKeys.length; j++) {
                const keyA = taxonKeys[i];
                const keyB = taxonKeys[j];
                const taxonA = TAXONES[keyA];
                const taxonB = TAXONES[keyB];
                
                const posturaA = elegirPostura(taxonA);
                const posturaB = elegirPostura(taxonB);
                
                const resultado = resolverDuelo(taxonA, taxonB, posturaA, posturaB);
                
                if (resultado.winner === "A") {
                    resultados[keyA].victorias++;
                    resultados[keyB].derrotas++;
                    matchups[keyA][keyB].wins++;
                    matchups[keyB][keyA].losses++;
                } else {
                    resultados[keyB].victorias++;
                    resultados[keyA].derrotas++;
                    matchups[keyB][keyA].wins++;
                    matchups[keyA][keyB].losses++;
                }
            }
        }
    }
    
    return { resultados, matchups, rondas };
}

// ===== SIMULACIÓN POR POSTURA (análisis de qué postura gana más) =====
function simularPosturas(rondas = 5000) {
    const posturaStats = {};
    for (const key of Object.keys(POSTURAS)) {
        posturaStats[key] = { usada: 0, victorias: 0 };
    }
    
    const taxonKeys = Object.keys(TAXONES);
    
    for (let r = 0; r < rondas; r++) {
        const keyA = taxonKeys[Math.floor(Math.random() * taxonKeys.length)];
        const keyB = taxonKeys[Math.floor(Math.random() * taxonKeys.length)];
        if (keyA === keyB) continue;
        
        const taxonA = TAXONES[keyA];
        const taxonB = TAXONES[keyB];
        const posturaA = elegirPostura(taxonA);
        const posturaB = elegirPostura(taxonB);
        
        posturaStats[posturaA].usada++;
        posturaStats[posturaB].usada++;
        
        const resultado = resolverDuelo(taxonA, taxonB, posturaA, posturaB);
        
        if (resultado.winner === "A") {
            posturaStats[posturaA].victorias++;
        } else {
            posturaStats[posturaB].victorias++;
        }
    }
    
    return posturaStats;
}

// ===== EJECUTAR Y MOSTRAR RESULTADOS =====
console.log("═══════════════════════════════════════════════════════════");
console.log("  💃 SIMULADOR DE DUELOS SOCIALES — Danza de Antenas");
console.log("  🦟 Plaga: La Descarada");
console.log("═══════════════════════════════════════════════════════════\n");

const RONDAS = 2000;
console.log(`⚙️  Simulando ${RONDAS} rondas de todos vs todos...\n`);

const { resultados, matchups, rondas } = simularTorneo(RONDAS);

// Ranking
const ranking = Object.entries(resultados)
    .map(([key, r]) => ({
        key,
        ...TAXONES[key],
        ...r,
        total: r.victorias + r.derrotas,
        winrate: ((r.victorias / (r.victorias + r.derrotas)) * 100).toFixed(1),
    }))
    .sort((a, b) => b.victorias - a.victorias);

console.log("┌─────────────────────────────────────────────────────────┐");
console.log("│  RANKING SOCIAL — Danza de Antenas (Todos vs Todos)     │");
console.log("├────┬──────────────────┬──────────┬──────────┬───────────┤");
console.log("│ #  │ Taxón            │ Victorias│ Derrotas │ Winrate   │");
console.log("├────┼──────────────────┼──────────┼──────────┼───────────┤");

ranking.forEach((t, i) => {
    const pos = String(i + 1).padStart(2);
    const nombre = `${t.emoji} ${t.nombre}`.padEnd(16);
    const wins = String(t.victorias).padStart(7);
    const losses = String(t.derrotas).padStart(7);
    const wr = `${t.winrate}%`.padStart(8);
    console.log(`│ ${pos} │ ${nombre} │ ${wins} │ ${losses} │ ${wr}  │`);
});

console.log("└────┴──────────────────┴──────────┴──────────┴───────────┘\n");

// Análisis por postura
console.log("═══════════════════════════════════════════════════════════");
console.log("  📊 ANÁLISIS POR POSTURA");
console.log("═══════════════════════════════════════════════════════════\n");

const posturaResults = simularPosturas(10000);
for (const [key, data] of Object.entries(posturaResults)) {
    const postura = POSTURAS[key];
    const wr = data.usada > 0 ? ((data.victorias / data.usada) * 100).toFixed(1) : "0.0";
    console.log(`  ${postura.emoji} ${postura.nombre.padEnd(12)} — Usada: ${String(data.usada).padStart(5)} | Victorias: ${String(data.victorias).padStart(5)} | Winrate: ${wr}%`);
}

// Top matchups (quién domina a quién socialmente)
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  🏆 DOMINANCIAS SOCIALES (>70% winrate)");
console.log("═══════════════════════════════════════════════════════════\n");

const dominancias = [];
for (const keyA of Object.keys(matchups)) {
    for (const keyB of Object.keys(matchups[keyA])) {
        const m = matchups[keyA][keyB];
        const total = m.wins + m.losses;
        if (total > 0) {
            const wr = (m.wins / total) * 100;
            if (wr > 70) {
                dominancias.push({
                    dominador: TAXONES[keyA],
                    dominado: TAXONES[keyB],
                    winrate: wr.toFixed(1),
                    wins: m.wins,
                    total,
                });
            }
        }
    }
}

dominancias.sort((a, b) => parseFloat(b.winrate) - parseFloat(a.winrate));
dominancias.slice(0, 15).forEach(d => {
    console.log(`  ${d.dominador.emoji} ${d.dominador.nombre} → ${d.dominado.emoji} ${d.dominado.nombre}: ${d.winrate}% (${d.wins}/${d.total})`);
});

// Vulnerabilidades (quién pierde más)
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  ⚠️  VULNERABILIDADES SOCIALES (<30% winrate)");
console.log("═══════════════════════════════════════════════════════════\n");

const vulnerables = [];
for (const keyA of Object.keys(matchups)) {
    for (const keyB of Object.keys(matchups[keyA])) {
        const m = matchups[keyA][keyB];
        const total = m.wins + m.losses;
        if (total > 0) {
            const wr = (m.wins / total) * 100;
            if (wr < 30) {
                vulnerables.push({
                    debil: TAXONES[keyA],
                    contra: TAXONES[keyB],
                    winrate: wr.toFixed(1),
                });
            }
        }
    }
}

vulnerables.sort((a, b) => parseFloat(a.winrate) - parseFloat(b.winrate));
vulnerables.slice(0, 10).forEach(v => {
    console.log(`  ${v.debil.emoji} ${v.debil.nombre} vs ${v.contra.emoji} ${v.contra.nombre}: solo ${v.winrate}% winrate`);
});

// Conclusiones de balance
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  🧬 CONCLUSIONES DE BALANCE SOCIAL");
console.log("═══════════════════════════════════════════════════════════\n");

const top = ranking[0];
const bottom = ranking[ranking.length - 1];
const spread = parseFloat(top.winrate) - parseFloat(bottom.winrate);

console.log(`  👑 Mejor diplomático: ${top.emoji} ${top.nombre} (${top.winrate}% winrate)`);
console.log(`  💀 Peor diplomático:  ${bottom.emoji} ${bottom.nombre} (${bottom.winrate}% winrate)`);
console.log(`  📏 Spread: ${spread.toFixed(1)} puntos`);
console.log("");

if (spread > 40) {
    console.log("  ⚠️  DESBALANCEADO: Spread > 40%. Algunos taxones dominan socialmente.");
    console.log("  💡 Sugerencia: Subir Feromonas/Sensilios a los taxones de combate puro.");
} else if (spread > 25) {
    console.log("  🟡 ACEPTABLE: Spread 25-40%. Hay diferencias pero son temáticas.");
    console.log("  💡 Los taxones de combate son débiles socialmente — es intencional.");
} else {
    console.log("  ✅ BALANCEADO: Spread < 25%. Todos tienen oportunidad social.");
}

console.log("\n  📜 \"La fuerza bruta es el argumento de quien no tiene antenas.\"");
console.log("     — Doña Esperanza, Típula Cronista\n");
