/**
 * BALANCEADOR PvP AUTOMÁTICO — Plaga: La Descarada
 * 
 * Simula combates PvP, mide winrates, y ajusta stats iterativamente
 * hasta que el spread sea similar al social (~50% spread máximo)
 * con el Escorpión como #1 pero cerca del 70% (no 100%).
 * 
 * Objetivo: Escorpión ~69%, último ~25-30%, spread ~40-45%
 * (mismo patrón que el torneo social donde Típula=69.9%, Pulga=21.7%)
 * 
 * Ejecutar: node balanceador_pvp.js
 */

// ===== STATS BASE (los que vamos a calibrar) =====
// Formato: {torax, ganglios, quitina, sensilios, cripsis, feromonas}
// El combate PvP usa: torax (daño), ganglios (velocidad/evasión), quitina (HP/defensa)
let TAXONES = {
    zancudo:     { nombre: "Zancudo",     emoji: "🦟", torax: 5, ganglios: 7, quitina: 4, sensilios: 6, cripsis: 8, feromonas: 3 },
    cucaracha:   { nombre: "Cucaracha",   emoji: "🪳", torax: 6, ganglios: 5, quitina: 9, sensilios: 7, cripsis: 6, feromonas: 1 },
    avispa:      { nombre: "Avispa",      emoji: "🐝", torax: 8, ganglios: 7, quitina: 5, sensilios: 4, cripsis: 3, feromonas: 4 },
    garrapata:   { nombre: "Garrapata",   emoji: "🕷️", torax: 7, ganglios: 2, quitina: 10, sensilios: 5, cripsis: 4, feromonas: 2 },
    chinche:     { nombre: "Chinche",     emoji: "🛏️", torax: 3, ganglios: 4, quitina: 4, sensilios: 6, cripsis: 7, feromonas: 9 },
    mariposa:    { nombre: "Mariposa",    emoji: "🦋", torax: 2, ganglios: 9, quitina: 2, sensilios: 7, cripsis: 5, feromonas: 10 },
    arana:       { nombre: "Araña",       emoji: "🕸️", torax: 4, ganglios: 5, quitina: 5, sensilios: 9, cripsis: 7, feromonas: 1 },
    escorpion:   { nombre: "Escorpión",   emoji: "🦂", torax: 8, ganglios: 4, quitina: 8, sensilios: 5, cripsis: 6, feromonas: 3 },
    vinchuca:    { nombre: "Vinchuca",    emoji: "🗡️", torax: 5, ganglios: 6, quitina: 5, sensilios: 8, cripsis: 10, feromonas: 2 },
    mosca:       { nombre: "Mosca",       emoji: "🪰", torax: 4, ganglios: 6, quitina: 5, sensilios: 7, cripsis: 2, feromonas: 5 },
    sanguijuela: { nombre: "Sanguijuela", emoji: "💉", torax: 3, ganglios: 4, quitina: 6, sensilios: 6, cripsis: 5, feromonas: 8 },
    polilla:     { nombre: "Polilla",     emoji: "🌙", torax: 3, ganglios: 7, quitina: 3, sensilios: 10, cripsis: 4, feromonas: 6 },
    pulga:       { nombre: "Pulga",       emoji: "⚡", torax: 4, ganglios: 10, quitina: 3, sensilios: 6, cripsis: 5, feromonas: 5 },
    tipula:      { nombre: "Típula",      emoji: "🦟", torax: 3, ganglios: 8, quitina: 2, sensilios: 10, cripsis: 8, feromonas: 9 },
};

// ===== RANKING DESEADO (de mejor a peor en PvP) =====
// Basado en la lógica: los brutos dominan combate, los sociales son frágiles
const RANKING_OBJETIVO = [
    "escorpion",   // #1 — tanque + daño brutal
    "avispa",      // #2 — daño alto + velocidad
    "garrapata",   // #3 — tanque puro
    "cucaracha",   // #4 — resistente
    "vinchuca",    // #5 — asesina (cripsis = evasión)
    "zancudo",     // #6 — equilibrado
    "pulga",       // #7 — velocidad pura
    "arana",       // #8 — percepción + emboscada
    "mosca",       // #9 — mediocre
    "sanguijuela", // #10 — frágil
    "polilla",     // #11 — perceptiva pero débil
    "chinche",     // #12 — político, no guerrero
    "tipula",      // #13 — diplomática, cristal
    "mariposa",    // #14 — la más frágil físicamente
];

// ===== WINRATE OBJETIVO POR POSICIÓN =====
// Spread similar al social: #1=~69%, #14=~25%
const WINRATE_OBJETIVO = {
    1: 69, 2: 65, 3: 62, 4: 59, 5: 56,
    6: 52, 7: 49, 8: 46, 9: 43, 10: 40,
    11: 37, 12: 34, 13: 30, 14: 25,
};

// ===== FÓRMULAS DE COMBATE (replican game_manager.gd + combat_manager.gd) =====
function calcHP(t) { return 80 + t.quitina * 4; }
function calcHemo(t) { return 30 + t.sensilios * 4; }
function calcVelocidad(t) { return (t.ganglios + t.sensilios) / 2; }
function calcDano(t) { return t.torax * 2; }
function calcDefensa(t) { return t.quitina; }
function calcEvasion(t) { return t.ganglios * 0.03 + t.cripsis * 0.02; } // % de esquivar

// ===== SIMULAR UN COMBATE 1v1 =====
function simularCombate(taxonA, taxonB) {
    let hpA = calcHP(taxonA);
    let hpB = calcHP(taxonB);
    const danoA = calcDano(taxonA);
    const danoB = calcDano(taxonB);
    const defA = calcDefensa(taxonA);
    const defB = calcDefensa(taxonB);
    const evasionA = calcEvasion(taxonA);
    const evasionB = calcEvasion(taxonB);
    const velA = calcVelocidad(taxonA);
    const velB = calcVelocidad(taxonB);
    
    // Determinar quién ataca primero
    let turnoA = velA >= velB;
    
    let turnos = 0;
    const MAX_TURNOS = 50;
    
    while (hpA > 0 && hpB > 0 && turnos < MAX_TURNOS) {
        turnos++;
        if (turnoA) {
            // A ataca a B
            if (Math.random() > evasionB) {
                const dmg = Math.max(1, (danoA - defB) * (0.85 + Math.random() * 0.3));
                hpB -= dmg;
            }
        } else {
            // B ataca a A
            if (Math.random() > evasionA) {
                const dmg = Math.max(1, (danoB - defA) * (0.85 + Math.random() * 0.3));
                hpA -= dmg;
            }
        }
        turnoA = !turnoA;
    }
    
    if (hpA > 0 && hpB <= 0) return "A";
    if (hpB > 0 && hpA <= 0) return "B";
    // Empate: gana el que tiene más HP
    return hpA >= hpB ? "A" : "B";
}

// ===== SIMULAR TORNEO COMPLETO =====
function simularTorneo(taxones, rondas = 1000) {
    const keys = Object.keys(taxones);
    const resultados = {};
    for (const k of keys) resultados[k] = { wins: 0, losses: 0 };
    
    for (let r = 0; r < rondas; r++) {
        for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
                const winner = simularCombate(taxones[keys[i]], taxones[keys[j]]);
                if (winner === "A") {
                    resultados[keys[i]].wins++;
                    resultados[keys[j]].losses++;
                } else {
                    resultados[keys[j]].wins++;
                    resultados[keys[i]].losses++;
                }
            }
        }
    }
    
    // Calcular winrates
    for (const k of keys) {
        const total = resultados[k].wins + resultados[k].losses;
        resultados[k].winrate = total > 0 ? (resultados[k].wins / total) * 100 : 50;
    }
    
    return resultados;
}

// ===== FUNCIÓN DE AJUSTE =====
function ajustarStats(taxones, resultados) {
    const ranking = Object.entries(resultados)
        .sort((a, b) => b[1].winrate - a[1].winrate)
        .map(([key], i) => ({ key, pos: i + 1, wr: resultados[key].winrate }));
    
    for (let i = 0; i < RANKING_OBJETIVO.length; i++) {
        const keyObjetivo = RANKING_OBJETIVO[i];
        const wrObjetivo = WINRATE_OBJETIVO[i + 1];
        const wrActual = resultados[keyObjetivo].winrate;
        const diff = wrObjetivo - wrActual;
        
        if (Math.abs(diff) < 2) continue; // Ya está bien
        
        const t = taxones[keyObjetivo];
        const ajuste = diff > 0 ? 1 : -1;
        
        if (diff > 5) {
            // Necesita buff grande — subir stat de combate principal
            if (t.torax < 10) t.torax = Math.min(10, t.torax + 1);
            else if (t.quitina < 10) t.quitina = Math.min(10, t.quitina + 1);
        } else if (diff > 2) {
            // Buff menor
            if (t.quitina < 10) t.quitina = Math.min(10, t.quitina + 1);
            else if (t.ganglios < 10) t.ganglios = Math.min(10, t.ganglios + 1);
        } else if (diff < -5) {
            // Necesita nerf grande
            if (t.torax > 2) t.torax = Math.max(2, t.torax - 1);
            else if (t.quitina > 2) t.quitina = Math.max(2, t.quitina - 1);
        } else if (diff < -2) {
            // Nerf menor
            if (t.quitina > 2) t.quitina = Math.max(2, t.quitina - 1);
            else if (t.torax > 2) t.torax = Math.max(2, t.torax - 1);
        }
    }
    
    return taxones;
}

// ===== EJECUTAR CALIBRACIÓN ITERATIVA =====
console.log("═══════════════════════════════════════════════════════════");
console.log("  ⚔️  BALANCEADOR PvP AUTOMÁTICO");
console.log("  🦟 Plaga: La Descarada");
console.log("═══════════════════════════════════════════════════════════\n");

const MAX_ITERACIONES = 20;
const RONDAS_SIM = 2000;
let mejorSpread = 999;
let mejorStats = null;

console.log("🎯 Objetivo: Escorpión ~69%, Mariposa ~25%, Spread ~44%\n");
console.log("⚙️  Iterando hasta convergencia...\n");

for (let iter = 0; iter < MAX_ITERACIONES; iter++) {
    const resultados = simularTorneo(TAXONES, RONDAS_SIM);
    
    // Calcular ranking actual
    const ranking = Object.entries(resultados)
        .sort((a, b) => b[1].winrate - a[1].winrate);
    
    const top = ranking[0][1].winrate;
    const bottom = ranking[ranking.length - 1][1].winrate;
    const spread = top - bottom;
    
    // Verificar si el ranking coincide con el objetivo
    let rankingCorrecto = true;
    for (let i = 0; i < 3; i++) {
        if (ranking[i][0] !== RANKING_OBJETIVO[i]) rankingCorrecto = false;
    }
    
    const escorpionWR = resultados["escorpion"].winrate;
    
    console.log(`  Iteración ${iter + 1}: Escorpión=${escorpionWR.toFixed(1)}% | Top=${top.toFixed(1)}% | Bottom=${bottom.toFixed(1)}% | Spread=${spread.toFixed(1)} | Ranking OK: ${rankingCorrecto ? "✅" : "❌"}`);
    
    // Guardar mejor resultado
    if (Math.abs(spread - 44) < Math.abs(mejorSpread - 44)) {
        mejorSpread = spread;
        mejorStats = JSON.parse(JSON.stringify(TAXONES));
    }
    
    // Convergencia: spread entre 38-50 y escorpión entre 65-73
    if (spread >= 38 && spread <= 50 && escorpionWR >= 65 && escorpionWR <= 73) {
        console.log("\n  ✅ ¡CONVERGENCIA ALCANZADA!\n");
        break;
    }
    
    // Ajustar
    TAXONES = ajustarStats(TAXONES, resultados);
}

// ===== RESULTADO FINAL =====
const finalResults = simularTorneo(mejorStats || TAXONES, 3000);
const finalRanking = Object.entries(finalResults)
    .sort((a, b) => b[1].winrate - a[1].winrate);

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  🏆 RANKING PvP FINAL (BALANCEADO)");
console.log("═══════════════════════════════════════════════════════════\n");

console.log("┌────┬──────────────────┬──────────┬───────────┬─────────────────────────────┐");
console.log("│ #  │ Taxón            │ Winrate  │ Objetivo  │ Stats (TOR/GAN/QUI)         │");
console.log("├────┼──────────────────┼──────────┼───────────┼─────────────────────────────┤");

const usedStats = mejorStats || TAXONES;
finalRanking.forEach(([key, data], i) => {
    const t = usedStats[key];
    const pos = String(i + 1).padStart(2);
    const nombre = `${t.emoji} ${t.nombre}`.padEnd(16);
    const wr = `${data.winrate.toFixed(1)}%`.padStart(7);
    const obj = RANKING_OBJETIVO.indexOf(key);
    const wrObj = obj >= 0 ? `${WINRATE_OBJETIVO[obj + 1]}%`.padStart(4) : " — ";
    const stats = `TOR:${t.torax} GAN:${t.ganglios} QUI:${t.quitina} SEN:${t.sensilios} CRI:${t.cripsis} FER:${t.feromonas}`;
    console.log(`│ ${pos} │ ${nombre} │ ${wr} │   ${wrObj}    │ ${stats} │`);
});

console.log("└────┴──────────────────┴──────────┴───────────┴─────────────────────────────┘");

const topWR = finalRanking[0][1].winrate;
const botWR = finalRanking[finalRanking.length - 1][1].winrate;
console.log(`\n  📏 Spread final: ${(topWR - botWR).toFixed(1)}% (objetivo: ~44%)`);
console.log(`  👑 #1: ${usedStats[finalRanking[0][0]].emoji} ${usedStats[finalRanking[0][0]].nombre} (${topWR.toFixed(1)}%)`);
console.log(`  💀 #14: ${usedStats[finalRanking[13][0]].emoji} ${usedStats[finalRanking[13][0]].nombre} (${botWR.toFixed(1)}%)`);

// ===== GENERAR CÓDIGO GDScript PARA COPIAR =====
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  📋 STATS BALANCEADOS — Copiar a game_manager.gd");
console.log("═══════════════════════════════════════════════════════════\n");

const gdOrder = ["zancudo","cucaracha","avispa","garrapata","chinche","mariposa","arana","escorpion","vinchuca","mosca","sanguijuela","polilla","pulga","tipula"];
for (const key of gdOrder) {
    const t = usedStats[key];
    console.log(`  ${t.emoji} ${t.nombre.padEnd(12)} → "stats_base": {"torax": ${t.torax}, "ganglios": ${t.ganglios}, "quitina_base": ${t.quitina}, "sensilios": ${t.sensilios}, "cripsis": ${t.cripsis}, "feromonas": ${t.feromonas}}`);
}

console.log("\n  📜 \"El balance perfecto no existe. Solo existe el balance");
console.log("     que nadie se queja lo suficiente como para romper.\"");
console.log("     — Ramazzottius, sobre game design\n");
