/**
 * BALANCE FINAL PvP — Stats calibrados manualmente
 * Plaga: La Descarada
 * 
 * Lógica: El combate depende de TOR (daño = TOR×2 - DEF) y QUI (HP = 80 + QUI×4, DEF = QUI)
 * Para spread ~44%: los guerreros necesitan TOR+QUI alto, los sociales TOR+QUI bajo.
 * GAN aporta evasión (GAN×3%) y velocidad (quién ataca primero).
 * 
 * Ejecutar: node balance_final.js
 */

// ===== STATS CALIBRADOS (respetando identidad de cada taxón) =====
// Regla: stats sociales (SEN, CRI, FER) NO se tocan — solo ajustamos TOR, GAN, QUI
const TAXONES = {
    // TIER GUERRERO — TOR+QUI = 12-13
    escorpion:   { nombre: "Escorpión",   emoji: "🦂", torax: 7, ganglios: 4, quitina: 6, sensilios: 5, cripsis: 6, feromonas: 3 },
    avispa:      { nombre: "Avispa",      emoji: "🐝", torax: 7, ganglios: 7, quitina: 5, sensilios: 4, cripsis: 3, feromonas: 4 },
    garrapata:   { nombre: "Garrapata",   emoji: "🕷️", torax: 4, ganglios: 2, quitina: 9, sensilios: 5, cripsis: 4, feromonas: 2 },
    cucaracha:   { nombre: "Cucaracha",   emoji: "🪳", torax: 5, ganglios: 5, quitina: 7, sensilios: 7, cripsis: 6, feromonas: 1 },
    
    // TIER MEDIO — TOR+QUI = 9-10
    vinchuca:    { nombre: "Vinchuca",    emoji: "🗡️", torax: 5, ganglios: 7, quitina: 5, sensilios: 8, cripsis: 10, feromonas: 2 },
    zancudo:     { nombre: "Zancudo",     emoji: "🦟", torax: 5, ganglios: 7, quitina: 5, sensilios: 6, cripsis: 8, feromonas: 3 },
    pulga:       { nombre: "Pulga",       emoji: "⚡", torax: 4, ganglios: 10, quitina: 4, sensilios: 6, cripsis: 5, feromonas: 5 },
    arana:       { nombre: "Araña",       emoji: "🕸️", torax: 4, ganglios: 5, quitina: 5, sensilios: 9, cripsis: 7, feromonas: 1 },
    mosca:       { nombre: "Mosca",       emoji: "🪰", torax: 4, ganglios: 6, quitina: 5, sensilios: 7, cripsis: 2, feromonas: 5 },
    
    // TIER SOCIAL — TOR+QUI = 6-8
    sanguijuela: { nombre: "Sanguijuela", emoji: "💉", torax: 4, ganglios: 4, quitina: 4, sensilios: 6, cripsis: 5, feromonas: 8 },
    polilla:     { nombre: "Polilla",     emoji: "🌙", torax: 3, ganglios: 7, quitina: 4, sensilios: 10, cripsis: 4, feromonas: 6 },
    chinche:     { nombre: "Chinche",     emoji: "🛏️", torax: 3, ganglios: 5, quitina: 4, sensilios: 6, cripsis: 7, feromonas: 9 },
    tipula:      { nombre: "Típula",      emoji: "🦟", torax: 3, ganglios: 8, quitina: 3, sensilios: 10, cripsis: 8, feromonas: 9 },
    mariposa:    { nombre: "Mariposa",    emoji: "🦋", torax: 3, ganglios: 9, quitina: 3, sensilios: 7, cripsis: 5, feromonas: 10 },
};

// ===== FÓRMULAS =====
function calcHP(t) { return 80 + t.quitina * 4; }
function calcDano(t) { return t.torax * 2; }
function calcDefensa(t) { return t.quitina; }
function calcVelocidad(t) { return (t.ganglios + t.sensilios) / 2; }
function calcEvasion(t) { return Math.min(0.55, t.ganglios * 0.035 + t.cripsis * 0.025); }

// Combate con TODOS los stats contribuyendo:
// TOR = daño, QUI = HP+defensa, GAN = evasión+velocidad, SEN = precisión, CRI = esquiva, FER = intimidación
function simularCombate(a, b) {
    let hpA = calcHP(a), hpB = calcHP(b);
    const dA = calcDano(a), dB = calcDano(b);
    const defA = calcDefensa(a) * 0.4, defB = calcDefensa(b) * 0.4; // Defensa reducida
    const evA = calcEvasion(a), evB = calcEvasion(b);
    const vA = calcVelocidad(a), vB = calcVelocidad(b);
    // Precisión basada en SEN (reduce evasión enemiga)
    const precA = a.sensilios * 0.02; // +2% precisión por SEN
    const precB = b.sensilios * 0.02;
    // Intimidación: chance de que el enemigo pierda turno (FER)
    const intimA = a.feromonas * 0.01; // 1% por FER
    const intimB = b.feromonas * 0.01;
    
    let turnoA = vA >= vB;
    let turnos = 0;
    
    while (hpA > 0 && hpB > 0 && turnos < 80) {
        turnos++;
        if (turnoA) {
            // Intimidación: chance de skip
            if (Math.random() < intimA) {
                // Enemigo intimidado, pierde turno
            } else if (Math.random() > Math.max(0.1, evB - precA)) {
                hpB -= Math.max(1, (dA - defB) * (0.85 + Math.random() * 0.3));
            }
        } else {
            if (Math.random() < intimB) {
                // Jugador intimidado
            } else if (Math.random() > Math.max(0.1, evA - precB)) {
                hpA -= Math.max(1, (dB - defA) * (0.85 + Math.random() * 0.3));
            }
        }
        turnoA = !turnoA;
    }
    return hpA > hpB ? "A" : "B";
}

// ===== TORNEO =====
function torneo(rondas) {
    const keys = Object.keys(TAXONES);
    const res = {};
    for (const k of keys) res[k] = { wins: 0, total: 0 };
    
    for (let r = 0; r < rondas; r++) {
        for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
                const w = simularCombate(TAXONES[keys[i]], TAXONES[keys[j]]);
                res[keys[i]].total++;
                res[keys[j]].total++;
                if (w === "A") res[keys[i]].wins++;
                else res[keys[j]].wins++;
            }
        }
    }
    
    for (const k of keys) res[k].wr = (res[k].wins / res[k].total * 100);
    return res;
}

// ===== EJECUTAR =====
console.log("═══════════════════════════════════════════════════════════");
console.log("  ⚔️  BALANCE FINAL PvP — Stats Calibrados");
console.log("  🦟 Plaga: La Descarada");
console.log("═══════════════════════════════════════════════════════════\n");

const results = torneo(3000);
const ranking = Object.entries(results).sort((a, b) => b[1].wr - a[1].wr);

console.log("┌────┬──────────────────┬──────────┬──────────────────────────────────────────┐");
console.log("│ #  │ Taxón            │ Winrate  │ Stats (TOR/GAN/QUI/SEN/CRI/FER)          │");
console.log("├────┼──────────────────┼──────────┼──────────────────────────────────────────┤");

ranking.forEach(([key, data], i) => {
    const t = TAXONES[key];
    const pos = String(i + 1).padStart(2);
    const nombre = `${t.emoji} ${t.nombre}`.padEnd(16);
    const wr = `${data.wr.toFixed(1)}%`.padStart(7);
    const stats = `${t.torax}/${t.ganglios}/${t.quitina}/${t.sensilios}/${t.cripsis}/${t.feromonas}`;
    console.log(`│ ${pos} │ ${nombre} │ ${wr} │ ${stats.padEnd(40)} │`);
});

console.log("└────┴──────────────────┴──────────┴──────────────────────────────────────────┘");

const spread = ranking[0][1].wr - ranking[13][1].wr;
console.log(`\n  📏 Spread: ${spread.toFixed(1)}%`);
console.log(`  👑 #1: ${TAXONES[ranking[0][0]].emoji} ${TAXONES[ranking[0][0]].nombre} (${ranking[0][1].wr.toFixed(1)}%)`);
console.log(`  💀 #14: ${TAXONES[ranking[13][0]].emoji} ${TAXONES[ranking[13][0]].nombre} (${ranking[13][1].wr.toFixed(1)}%)`);

// Comparar con social
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  ⚖️  BALANCE CRUZADO (PvP vs Social)");
console.log("═══════════════════════════════════════════════════════════\n");

const socialRank = {tipula:1, mariposa:2, vinchuca:3, polilla:4, chinche:5, arana:6, sanguijuela:7, avispa:8, escorpion:9, zancudo:10, cucaracha:11, garrapata:12, mosca:13, pulga:14};

ranking.forEach(([key, data], i) => {
    const t = TAXONES[key];
    const pvpPos = i + 1;
    const socPos = socialRank[key] || "?";
    const balance = pvpPos + socPos;
    const icon = balance <= 10 ? "🌟" : balance <= 18 ? "⚖️" : "💀";
    console.log(`  ${icon} ${t.emoji} ${t.nombre.padEnd(12)} PvP:#${pvpPos.toString().padEnd(2)} Social:#${socPos.toString().padEnd(2)} (suma: ${balance})`);
});

console.log("\n  💡 Suma ideal = 15 (equilibrio perfecto entre PvP y Social)");
console.log("  🌟 = Versátil (suma ≤10) | ⚖️ = Equilibrado (11-18) | 💀 = Especialista (>18)\n");

// Output para game_manager.gd
console.log("═══════════════════════════════════════════════════════════");
console.log("  📋 COPIAR A game_manager.gd");
console.log("═══════════════════════════════════════════════════════════\n");

const order = ["zancudo","cucaracha","avispa","garrapata","chinche","mariposa","arana","escorpion","vinchuca","mosca","sanguijuela","polilla","pulga","tipula"];
for (const k of order) {
    const t = TAXONES[k];
    console.log(`"stats_base": {"torax": ${t.torax}, "ganglios": ${t.ganglios}, "quitina_base": ${t.quitina}, "sensilios": ${t.sensilios}, "cripsis": ${t.cripsis}, "feromonas": ${t.feromonas}},  # ${t.emoji} ${t.nombre}`);
}
