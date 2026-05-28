/**
 * TORNEO PvP v2 — Con Antenas, Evasión, Atavismos y Danza
 * Plaga: La Descarada
 * 
 * Simula combates completos donde cada taxón usa:
 * - Ataques físicos (con evasión)
 * - Atavismos (melee -1 antena, social +1, utilidad neutral)
 * - Danza de Antenas (social puro)
 * - Sistema de Antenas (0=penalización, 10=bonus)
 * 
 * Ejecutar: node simulador_torneo_v2.js
 */

const TAXONES = {
    zancudo:     { nombre: "Zancudo",     emoji: "🦟", torax: 5, ganglios: 7, quitina: 5, sensilios: 6, cripsis: 8, feromonas: 3 },
    cucaracha:   { nombre: "Cucaracha",   emoji: "🪳", torax: 5, ganglios: 5, quitina: 7, sensilios: 7, cripsis: 6, feromonas: 1 },
    avispa:      { nombre: "Avispa",      emoji: "🐝", torax: 7, ganglios: 7, quitina: 5, sensilios: 4, cripsis: 3, feromonas: 4 },
    garrapata:   { nombre: "Garrapata",   emoji: "🕷️", torax: 5, ganglios: 2, quitina: 9, sensilios: 5, cripsis: 4, feromonas: 2 },
    chinche:     { nombre: "Chinche",     emoji: "🛏️", torax: 3, ganglios: 5, quitina: 4, sensilios: 6, cripsis: 7, feromonas: 9 },
    mariposa:    { nombre: "Mariposa",    emoji: "🦋", torax: 3, ganglios: 9, quitina: 3, sensilios: 7, cripsis: 5, feromonas: 10 },
    arana:       { nombre: "Araña",       emoji: "🕸️", torax: 6, ganglios: 5, quitina: 5, sensilios: 9, cripsis: 7, feromonas: 1 },
    escorpion:   { nombre: "Escorpión",   emoji: "🦂", torax: 7, ganglios: 4, quitina: 6, sensilios: 5, cripsis: 6, feromonas: 3 },
    vinchuca:    { nombre: "Vinchuca",    emoji: "🗡️", torax: 5, ganglios: 7, quitina: 5, sensilios: 8, cripsis: 10, feromonas: 2 },
    mosca:       { nombre: "Mosca",       emoji: "🪰", torax: 4, ganglios: 6, quitina: 5, sensilios: 7, cripsis: 2, feromonas: 5 },
    sanguijuela: { nombre: "Sanguijuela", emoji: "💉", torax: 4, ganglios: 4, quitina: 4, sensilios: 6, cripsis: 5, feromonas: 8 },
    polilla:     { nombre: "Polilla",     emoji: "🌙", torax: 3, ganglios: 7, quitina: 4, sensilios: 10, cripsis: 4, feromonas: 6 },
    pulga:       { nombre: "Pulga",       emoji: "⚡", torax: 4, ganglios: 10, quitina: 4, sensilios: 6, cripsis: 5, feromonas: 5 },
    tipula:      { nombre: "Típula",      emoji: "🦟", torax: 3, ganglios: 8, quitina: 3, sensilios: 10, cripsis: 8, feromonas: 9 },
};

// Atavismos por taxón: [melee, social, utilidad]
const ATAVISMOS = {
    zancudo:     [{tipo:"melee",val:4},{tipo:"social",val:0.3},{tipo:"util",val:0.4}],
    cucaracha:   [{tipo:"melee",val:1.5},{tipo:"social",val:1},{tipo:"util",val:1}],
    avispa:      [{tipo:"melee",val:0.6},{tipo:"social",val:1},{tipo:"melee",val:1.8}],
    garrapata:   [{tipo:"melee",val:0.15},{tipo:"social",val:1},{tipo:"util",val:4}],
    chinche:     [{tipo:"melee",val:0.1},{tipo:"social",val:1},{tipo:"util",val:0.35}],
    mariposa:    [{tipo:"melee",val:3},{tipo:"social",val:2},{tipo:"util",val:1}],
    arana:       [{tipo:"melee",val:6},{tipo:"social",val:2},{tipo:"util",val:0.25}],
    escorpion:   [{tipo:"melee",val:2.5},{tipo:"social",val:1},{tipo:"util",val:2}],
    vinchuca:    [{tipo:"melee",val:1.5},{tipo:"social",val:2},{tipo:"util",val:1}],
    mosca:       [{tipo:"melee",val:5},{tipo:"social",val:1},{tipo:"util",val:30}],
    sanguijuela: [{tipo:"melee",val:0.12},{tipo:"social",val:1},{tipo:"util",val:0.45}],
    polilla:     [{tipo:"melee",val:2},{tipo:"social",val:1},{tipo:"util",val:0.5}],
    pulga:       [{tipo:"melee",val:2},{tipo:"social",val:3},{tipo:"util",val:1}],
    tipula:      [{tipo:"melee",val:1.2},{tipo:"social",val:2},{tipo:"util",val:0.3}],
};

// Ventajas de Danza
const DANZA_VENTAJA = { acecho:"exposicion", exposicion:"vibracion", mimetismo:"acecho", vibracion:"mimetismo" };
const DANZA_STAT = { acecho:"torax", exposicion:"feromonas", mimetismo:"cripsis", vibracion:"sensilios" };

// === FÓRMULAS ===
function calcHP(t) { return 80 + t.quitina * 4; }
function calcDmg(t) { return t.torax * 2; }
function calcDef(t) { return t.quitina * 0.5; }
function calcEvasion(t, key) {
    // Pulga: pasivo "Evasión Maestra" — GAN cuenta x5.5% (cap 70%)
    if (key === "pulga") return Math.min(0.70, t.ganglios * 0.055 + t.cripsis * 0.025);
    return Math.min(0.55, t.ganglios * 0.035 + t.cripsis * 0.025);
}
function calcPrecision(t) { return t.sensilios * 0.02; }
function calcVel(t) { return (t.ganglios + t.sensilios) / 2; }

// === IA: elegir acción ===
function elegirAccion(t, antenas, hemo, enemyHP, enemyMax) {
    // Estrategia basada en stats y estado
    const socialPower = t.feromonas + t.sensilios;
    const combatPower = t.torax + t.quitina;
    
    // Si antenas bajas, priorizar social para no morir por Cordyceps
    if (antenas <= 2) return Math.random() < 0.6 ? "danza" : "social_atav";
    
    // Si enemigo bajo de HP, rematar
    if (enemyHP < enemyMax * 0.25) return "atacar";
    
    // Decisión basada en perfil
    const roll = Math.random();
    if (socialPower > combatPower) {
        // Taxón social: 40% danza, 25% social_atav, 20% util_atav, 15% atacar
        if (roll < 0.40) return "danza";
        if (roll < 0.65) return hemo >= 3 ? "social_atav" : "atacar";
        if (roll < 0.85) return hemo >= 3 ? "util_atav" : "atacar";
        return "atacar";
    } else {
        // Taxón guerrero: 45% atacar, 20% melee_atav, 15% danza, 10% util, 10% social
        if (roll < 0.45) return "atacar";
        if (roll < 0.65) return hemo >= 3 ? "melee_atav" : "atacar";
        if (roll < 0.80) return "danza";
        if (roll < 0.90) return hemo >= 3 ? "util_atav" : "atacar";
        return hemo >= 2 ? "social_atav" : "atacar";
    }
}

// === SIMULAR COMBATE COMPLETO ===
function simularCombate(keyA, keyB) {
    const a = TAXONES[keyA], b = TAXONES[keyB];
    let hpA = calcHP(a), hpB = calcHP(b);
    let hemoA = 30 + a.sensilios * 4, hemoB = 30 + b.sensilios * 4;
    let antenasA = 5, antenasB = 5;
    let turnosA = 0, turnosB = 0; // turnos sin social
    let turnoDeA = calcVel(a) >= calcVel(b);
    let turnos = 0;
    
    while (hpA > 0 && hpB > 0 && turnos < 40) {
        turnos++;
        const atkKey = turnoDeA ? keyA : keyB;
        const defKey = turnoDeA ? keyB : keyA;
        const atacante = turnoDeA ? a : b;
        const defensor = turnoDeA ? b : a;
        let hpAtk = turnoDeA ? hpA : hpB;
        let hpDef = turnoDeA ? hpB : hpA;
        let hemoAtk = turnoDeA ? hemoA : hemoB;
        let antAtk = turnoDeA ? antenasA : antenasB;
        let antDef = turnoDeA ? antenasB : antenasA;
        let tSinSoc = turnoDeA ? turnosA : turnosB;
        const hpDefMax = calcHP(defensor);
        const hpAtkMax = calcHP(atacante);
        
        // Pasivo Garrapata: regen 3% HP por turno
        if (atkKey === "garrapata") {
            hpAtk = Math.min(hpAtkMax, hpAtk + hpAtkMax * 0.03);
        }
        
        const accion = elegirAccion(atacante, antAtk, hemoAtk, hpDef, hpDefMax);
        
        switch(accion) {
            case "atacar": {
                const ev = Math.max(0.05, calcEvasion(defensor, defKey) - calcPrecision(atacante));
                if (Math.random() > ev) {
                    const dmg = Math.max(1, (calcDmg(atacante) - calcDef(defensor)) * (0.85 + Math.random()*0.3));
                    hpDef -= dmg;
                }
                tSinSoc++;
                if (tSinSoc >= 3) { tSinSoc = 0; antAtk = Math.max(0, antAtk - 1); }
                break;
            }
            case "melee_atav": {
                hemoAtk -= 3;
                const dmg = calcDmg(atacante) * 1.8 * (0.85 + Math.random()*0.3);
                hpDef -= Math.max(1, dmg - calcDef(defensor));
                antAtk = Math.max(0, antAtk - 1); // melee oscuro
                break;
            }
            case "social_atav": {
                hemoAtk -= 2;
                // Stun/confuso: enemigo pierde turno (50% chance basado en FER+SEN)
                const chance = (atacante.feromonas + atacante.sensilios) / 20;
                if (Math.random() < chance) { turnoDeA = !turnoDeA; } // skip enemy turn
                antAtk = Math.min(10, antAtk + 1); // social sube
                tSinSoc = 0;
                break;
            }
            case "util_atav": {
                hemoAtk -= 3;
                // Heal o evasión buff (simplificado: heal 20% HP)
                hpAtk = Math.min(turnoDeA ? calcHP(a) : calcHP(b), hpAtk + hpDefMax * 0.15);
                tSinSoc = 0; // neutral
                break;
            }
            case "danza": {
                // Danza de Antenas simplificada
                const posturas = ["acecho","exposicion","mimetismo","vibracion"];
                // Elige mejor postura
                let bestP = "acecho", bestV = 0;
                for (const p of posturas) {
                    const v = atacante[DANZA_STAT[p]];
                    if (v > bestV) { bestV = v; bestP = p; }
                }
                // Enemigo elige
                let bestPE = "acecho", bestVE = 0;
                for (const p of posturas) {
                    const v = defensor[DANZA_STAT[p]];
                    if (v > bestVE) { bestVE = v; bestPE = p; }
                }
                let rollA = atacante[DANZA_STAT[bestP]] + (DANZA_VENTAJA[bestP]===bestPE ? 3 : 0);
                let rollB = defensor[DANZA_STAT[bestPE]] + (DANZA_VENTAJA[bestPE]===bestP ? 3 : 0);
                rollA += Math.floor(Math.random()*5) - 2;
                rollB += Math.floor(Math.random()*5) - 2;
                // Bonus antenas
                if (antAtk >= 9) rollA += 3;
                else if (antAtk >= 7) rollA += 2;
                
                if (rollA >= rollB) {
                    antAtk = Math.min(10, antAtk + 1);
                    // Victoria social: daño psíquico o debuff
                    hpDef -= atacante.feromonas * 0.5;
                }
                tSinSoc = 0;
                break;
            }
        }
        
        // Penalización Cordyceps si antenas = 0
        if (antAtk <= 0) hpAtk -= 5; // daño por Cordyceps
        
        // Guardar estado
        if (turnoDeA) { hpA=hpAtk; hpB=hpDef; hemoA=hemoAtk; antenasA=antAtk; turnosA=tSinSoc; }
        else { hpB=hpAtk; hpA=hpDef; hemoB=hemoAtk; antenasB=antAtk; turnosB=tSinSoc; }
        
        turnoDeA = !turnoDeA;
    }
    return hpA > hpB ? keyA : keyB;
}

// === TORNEO ===
function torneo(rondas) {
    const keys = Object.keys(TAXONES);
    const res = {};
    for (const k of keys) res[k] = { wins: 0, losses: 0 };
    
    for (let r = 0; r < rondas; r++) {
        for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
                const winner = simularCombate(keys[i], keys[j]);
                res[winner].wins++;
                res[winner === keys[i] ? keys[j] : keys[i]].losses++;
            }
        }
    }
    return res;
}

// === EJECUTAR ===
console.log("═══════════════════════════════════════════════════════════");
console.log("  ⚔️🐜 TORNEO PvP v2 — Con Antenas, Evasión y Danza");
console.log("  🦟 Plaga: La Descarada");
console.log("═══════════════════════════════════════════════════════════\n");

const RONDAS = 2000;
console.log(`⚙️  Simulando ${RONDAS} rondas (combate completo con IA)...\n`);

const results = torneo(RONDAS);
const ranking = Object.entries(results)
    .map(([k,v]) => ({key:k, ...TAXONES[k], ...v, total:v.wins+v.losses, wr:(v.wins/(v.wins+v.losses)*100)}))
    .sort((a,b) => b.wr - a.wr);

console.log("┌────┬──────────────────┬─────────┬─────────┬────────┬──────────────────────┐");
console.log("│ #  │ Taxón            │ Wins    │ Losses  │ WR%    │ Perfil               │");
console.log("├────┼──────────────────┼─────────┼─────────┼────────┼──────────────────────┤");

ranking.forEach((t, i) => {
    const pos = String(i+1).padStart(2);
    const nombre = `${t.emoji} ${t.nombre}`.padEnd(16);
    const w = String(t.wins).padStart(6);
    const l = String(t.losses).padStart(6);
    const wr = `${t.wr.toFixed(1)}%`.padStart(6);
    const social = t.feromonas + t.sensilios;
    const combat = t.torax + t.quitina;
    const perfil = social > combat ? "Social" : combat > social+3 ? "Guerrero" : "Híbrido";
    console.log(`│ ${pos} │ ${nombre} │ ${w} │ ${l} │ ${wr} │ ${perfil.padEnd(20)} │`);
});

console.log("└────┴──────────────────┴─────────┴─────────┴────────┴──────────────────────┘");

const spread = ranking[0].wr - ranking[13].wr;
console.log(`\n  📏 Spread: ${spread.toFixed(1)}%`);
console.log(`  👑 #1: ${ranking[0].emoji} ${ranking[0].nombre} (${ranking[0].wr.toFixed(1)}%)`);
console.log(`  💀 #14: ${ranking[13].emoji} ${ranking[13].nombre} (${ranking[13].wr.toFixed(1)}%)`);

// Balance cruzado
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  ⚖️  BALANCE CRUZADO (PvP v2 vs Social)");
console.log("═══════════════════════════════════════════════════════════\n");

const socialRank = {tipula:1,mariposa:2,vinchuca:3,polilla:4,chinche:5,arana:6,sanguijuela:7,avispa:8,escorpion:9,zancudo:10,cucaracha:11,garrapata:12,mosca:13,pulga:14};
ranking.forEach((t, i) => {
    const pvp = i+1;
    const soc = socialRank[t.key];
    const sum = pvp + soc;
    const icon = sum <= 10 ? "🌟" : sum <= 18 ? "⚖️" : "💀";
    console.log(`  ${icon} ${t.emoji} ${t.nombre.padEnd(12)} PvP:#${String(pvp).padEnd(2)} Social:#${String(soc).padEnd(2)} Suma:${sum}`);
});

console.log("\n  📜 \"Las antenas no son decoración. Son tu conexión con");
console.log("     la colonia. Sin ellas, eres carne para el hongo.\"");
console.log("     — Ramazzottius, sobre el sistema de Antenas\n");
