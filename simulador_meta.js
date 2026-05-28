/**
 * SIMULADOR META — Cada taxón juega su estrategia óptima
 * Plaga: La Descarada — 29 Mayo 2026
 * 
 * Cada taxón tiene una IA personalizada que explota su nicho:
 * - Pulga: spamea evasión, nunca ataca directo, desgasta
 * - Araña: stun → stun → remate crítico
 * - Mosca: invoca tanque + espíritu, se esconde
 * - Garrapata: coraza + drenar, nunca muere
 * - Escorpión: burst damage, mata rápido
 * - Típula: danza + social, gana sin pegar
 * - Mariposa: evasión + stun + danza
 * etc.
 * 
 * Ejecutar: node simulador_meta.js
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

// === FÓRMULAS ===
function calcHP(t) { return 80 + t.quitina * 4; }
function calcDmg(t) { return t.torax * 2; }
function calcDef(t) { return t.quitina * 0.5; }
function calcEvasion(t, key) {
    if (key === "pulga") return Math.min(0.70, t.ganglios * 0.055 + t.cripsis * 0.025);
    return Math.min(0.55, t.ganglios * 0.035 + t.cripsis * 0.025);
}
function calcPrec(t) { return t.sensilios * 0.02; }
function calcVel(t) { return (t.ganglios + t.sensilios) / 2; }

// Danza simplificada
function danzaRoll(t) { return Math.max(t.feromonas, t.sensilios, t.cripsis) + Math.floor(Math.random()*5)-2; }

// === ESTRATEGIAS META POR TAXÓN ===
// Cada función retorna: "atacar", "melee_atav", "social_atav", "util_atav", "danza"
const META = {
    // PULGA: Evasión maestra. Nunca ataca directo. Usa esquiva + desgaste + danza
    pulga: (state) => {
        if (state.hemo >= 1 && !state.esquivaActiva) return "util_atav"; // Salto Dimensional (esquiva 100%)
        if (state.antenas <= 3) return "danza"; // Mantener antenas
        if (state.enemyHP < 20) return "atacar"; // Rematar
        return Math.random() < 0.5 ? "danza" : "atacar"; // Desgastar
    },
    // ARAÑA: Stun lock → remate. Siempre stun primero.
    arana: (state) => {
        if (state.hemo >= 3 && !state.enemyStunned) return "social_atav"; // Red de Contención (stun 2)
        if (state.hemo >= 2 && state.enemyStunned && !state.criticoListo) return "util_atav"; // Emboscada (stun+crit)
        if (state.enemyStunned || state.criticoListo) return "melee_atav"; // Necrosis Letal x2.5
        return "atacar";
    },
    // MOSCA: Invocar tanque → espíritu → esconderse con stun
    mosca: (state) => {
        if (state.hemo >= 4 && !state.tanqueActivo) return "util_atav"; // Larva Tanque
        if (state.hemo >= 3 && !state.espirituActivo) return "melee_atav"; // Espíritu de Carroña
        if (state.hemo >= 2 && state.turno % 4 === 0) return "social_atav"; // Hedor Paralizante
        return "danza"; // Mientras los muertos pelean, ella socializa
    },
    // GARRAPATA: Coraza → drenar → nunca morir
    garrapata: (state) => {
        if (state.hemo >= 4 && state.turno <= 3) return "util_atav"; // Coraza Ancestral (+6 def)
        if (state.hpPct < 0.6) return "melee_atav"; // Anclaje Vital (drenar 20% + heal)
        if (state.antenas <= 2) return "social_atav"; // Presión Parasitaria (stun + mantener antenas)
        return "atacar"; // Golpe lento pero seguro
    },
    // ESCORPIÓN: Burst. Matar en 3 turnos o menos.
    escorpion: (state) => {
        if (state.hemo >= 3 && !state.criticoListo) return "util_atav"; // Sombra de Pinza (próximo = crit)
        if (state.criticoListo || state.hemo >= 5) return "melee_atav"; // Golpe de Pinza x2.5
        if (state.antenas <= 1) return "danza"; // Emergencia antenas
        return "atacar"; // Golpe directo fuerte
    },
    // TÍPULA: Pura diplomacia. Gana sin pegar.
    tipula: (state) => {
        if (state.antenas <= 4) return "social_atav"; // Ocelo Ancestral (+antena)
        if (state.hpPct < 0.5 && state.hemo >= 4) return "util_atav"; // Extracción del Terror (heal 30%)
        return "danza"; // Danza de Antenas siempre
    },
    // MARIPOSA: Stun + evasión + danza. Nunca pelea directo.
    mariposa: (state) => {
        if (state.hemo >= 3 && !state.enemyStunned) return "social_atav"; // Mirada Morpho (stun 2)
        if (state.hemo >= 4 && state.hpPct < 0.7) return "util_atav"; // Aleteo Dimensional (esquiva)
        return "danza"; // Diplomacia pura
    },
    // VINCHUCA: Asesina invisible. Esquiva → ataque letal.
    vinchuca: (state) => {
        if (state.hemo >= 2 && !state.esquivaActiva) return "util_atav"; // Desvanecimiento (invisible)
        if (state.esquivaActiva) return "melee_atav"; // Mordida Silenciosa (desde sigilo)
        if (state.antenas <= 3) return "social_atav"; // Regalo de Chagas
        return "atacar";
    },
    // AVISPA: Berserker. Multi-hit + intimidar.
    avispa: (state) => {
        if (state.hemo >= 4) return "melee_atav"; // Picada Frenética (3 hits)
        if (state.hemo >= 3 && state.turno % 3 === 0) return "social_atav"; // Feromona de Guerra
        return "atacar"; // Golpe directo fuerte (TOR 7)
    },
    // CHINCHE: Político. Confunde + esquiva + danza.
    chinche: (state) => {
        if (state.hemo >= 2 && !state.enemyStunned) return "social_atav"; // Decreto Real (confuso)
        if (state.hemo >= 3 && state.hpPct < 0.6) return "util_atav"; // Sábanas de Seda (evasión)
        return "danza";
    },
    // SANGUIJUELA: Drenar + stun + evasión. Vampiro clásico.
    sanguijuela: (state) => {
        if (state.hemo >= 3 && state.hpPct < 0.7) return "melee_atav"; // Éxtasis Tóxico (drenar)
        if (state.hemo >= 3 && !state.enemyStunned) return "social_atav"; // Anestesia Extática (stun)
        if (state.hemo >= 2) return "util_atav"; // Camuflaje Adaptativo (evasión)
        return "danza";
    },
    // POLILLA: Revelar + confundir + evasión. Info warfare.
    polilla: (state) => {
        if (state.hemo >= 3 && state.turno <= 2) return "social_atav"; // Síndrome del Foco (confuso)
        if (state.hemo >= 2) return "util_atav"; // Polvo de Ala (evasión 50%)
        return "danza";
    },
    // CUCARACHA: Tanque defensivo. Inmune + armadura + golpe.
    cucaracha: (state) => {
        if (state.hpPct < 0.4 && state.hemo >= 4) return "util_atav"; // Caparazón (inmune 1 turno)
        if (state.hemo >= 2 && state.turno % 3 === 0) return "social_atav"; // Aura de Asco (stun)
        if (state.hemo >= 3) return "melee_atav"; // Embestida Quitinosa
        return "atacar";
    },
    // ZANCUDO: Veneno + evasión + zumbido. Desgaste.
    zancudo: (state) => {
        if (state.hemo >= 3 && state.turno <= 2) return "melee_atav"; // Micro-Inyección (veneno)
        if (state.hemo >= 2 && !state.enemyStunned) return "social_atav"; // Zumbido Hipnótico
        if (state.hemo >= 3) return "util_atav"; // Vuelo Errático (evasión)
        return "atacar";
    },
};

// === COMBATE CON META ===
function simularCombate(keyA, keyB) {
    const a = TAXONES[keyA], b = TAXONES[keyB];
    let hpA = calcHP(a), hpB = calcHP(b);
    const hpMaxA = hpA, hpMaxB = hpB;
    let hemoA = 30 + a.sensilios * 4, hemoB = 30 + b.sensilios * 4;
    let antenasA = 5, antenasB = 5;
    let stunA = 0, stunB = 0; // turnos de stun restantes
    let esquivaA = false, esquivaB = false;
    let criticoA = false, criticoB = false;
    let tanqueA = 0, tanqueB = 0; // HP del tanque invocado
    let espirituA = 0, espirituB = 0; // turnos de espíritu
    let turnoDeA = calcVel(a) >= calcVel(b);
    let turno = 0;

    while (hpA > 0 && hpB > 0 && turno < 50) {
        turno++;
        const atkKey = turnoDeA ? keyA : keyB;
        const defKey = turnoDeA ? keyB : keyA;
        const atk = turnoDeA ? a : b;
        const def = turnoDeA ? b : a;
        let hpAtk = turnoDeA ? hpA : hpB, hpDef = turnoDeA ? hpB : hpA;
        let hemoAtk = turnoDeA ? hemoA : hemoB;
        let antAtk = turnoDeA ? antenasA : antenasB;
        let stunAtk = turnoDeA ? stunA : stunB;
        let stunDef = turnoDeA ? stunB : stunA;
        let esquivaAtk = turnoDeA ? esquivaA : esquivaB;
        let esquivaDef = turnoDeA ? esquivaB : esquivaA;
        let criticoAtk = turnoDeA ? criticoA : criticoB;
        let tanqueAtk = turnoDeA ? tanqueA : tanqueB;
        let tanqueDef = turnoDeA ? tanqueB : tanqueA;
        let espAtk = turnoDeA ? espirituA : espirituB;
        let espDef = turnoDeA ? espirituB : espirituA;
        const hpAtkMax = turnoDeA ? hpMaxA : hpMaxB;

        // Pasivo Garrapata: regen 3%
        if (atkKey === "garrapata") hpAtk = Math.min(hpAtkMax, hpAtk + hpAtkMax * 0.03);

        // Espíritu activo hace daño
        if (espAtk > 0) { hpDef -= 6; espAtk--; }

        // Si stunneado, pierde turno
        if (stunAtk > 0) { stunAtk--; turnoDeA = !turnoDeA; 
            if(turnoDeA){hpA=hpAtk;hpB=hpDef;hemoA=hemoAtk;antenasA=antAtk;stunA=stunAtk;stunB=stunDef;esquivaA=esquivaAtk;esquivaB=esquivaDef;criticoA=criticoAtk;tanqueA=tanqueAtk;tanqueB=tanqueDef;espirituA=espAtk;espirituB=espDef;}
            else{hpB=hpAtk;hpA=hpDef;hemoB=hemoAtk;antenasB=antAtk;stunB=stunAtk;stunA=stunDef;esquivaB=esquivaAtk;esquivaA=esquivaDef;criticoB=criticoAtk;tanqueB=tanqueAtk;tanqueA=tanqueDef;espirituB=espAtk;espirituA=espDef;}
            continue; 
        }

        // IA elige acción según META
        const state = { hemo: hemoAtk, antenas: antAtk, hpPct: hpAtk/hpAtkMax, enemyHP: hpDef, 
            enemyStunned: stunDef > 0, esquivaActiva: esquivaAtk, criticoListo: criticoAtk,
            tanqueActivo: tanqueAtk > 0, espirituActivo: espAtk > 0, turno };
        let accion = META[atkKey](state);

        // Ejecutar acción
        switch(accion) {
            case "atacar": {
                if (esquivaDef) { esquivaDef = false; break; }
                const ev = Math.max(0.05, calcEvasion(def, defKey) - calcPrec(atk));
                if (Math.random() > ev) {
                    let dmg = Math.max(1, (calcDmg(atk) - calcDef(def)) * (0.85+Math.random()*0.3));
                    if (criticoAtk) { dmg *= 2; criticoAtk = false; }
                    if (tanqueDef > 0) { tanqueDef = Math.max(0, tanqueDef - dmg); }
                    else { hpDef -= dmg; }
                }
                antAtk = Math.max(0, antAtk - (turno % 3 === 0 ? 1 : 0));
                break;
            }
            case "melee_atav": {
                hemoAtk -= 3;
                if (esquivaDef) { esquivaDef = false; antAtk = Math.max(0, antAtk-1); break; }
                let dmg = calcDmg(atk) * 2.0 * (0.85+Math.random()*0.3);
                if (criticoAtk) { dmg *= 2; criticoAtk = false; }
                // Drenar: heal
                if (atkKey === "garrapata" || atkKey === "sanguijuela") {
                    const drain = hpDef * 0.2;
                    hpDef -= drain; hpAtk = Math.min(hpAtkMax, hpAtk + drain);
                } else {
                    if (tanqueDef > 0) { tanqueDef = Math.max(0, tanqueDef - dmg); }
                    else { hpDef -= Math.max(1, dmg - calcDef(def)); }
                }
                antAtk = Math.max(0, antAtk - 1);
                break;
            }
            case "social_atav": {
                hemoAtk -= 2;
                const chance = (atk.feromonas + atk.sensilios) / 18;
                if (Math.random() < chance) { stunDef = (atkKey==="arana"||atkKey==="mariposa") ? 2 : 1; }
                antAtk = Math.min(10, antAtk + 1);
                break;
            }
            case "util_atav": {
                hemoAtk -= 3;
                if (atkKey === "pulga" || atkKey === "vinchuca" || atkKey === "mariposa") {
                    esquivaAtk = true; // Esquiva 100% próximo
                } else if (atkKey === "garrapata") {
                    // Coraza +6 def (simplificado: heal 20%)
                    hpAtk = Math.min(hpAtkMax, hpAtk + hpAtkMax * 0.2);
                } else if (atkKey === "mosca") {
                    tanqueAtk = 25; // Larva tanque
                } else if (atkKey === "arana") {
                    stunDef = 1; criticoAtk = true; // Emboscada
                } else if (atkKey === "escorpion") {
                    criticoAtk = true; // Sombra de Pinza
                } else if (atkKey === "tipula") {
                    hpAtk = Math.min(hpAtkMax, hpAtk + hpAtkMax * 0.3); // Extracción Terror
                } else if (atkKey === "cucaracha") {
                    esquivaAtk = true; // Caparazón inmune
                } else {
                    // Evasión genérica
                    esquivaAtk = true;
                }
                break;
            }
            case "danza": {
                const rollA = danzaRoll(atk) + (antAtk >= 9 ? 3 : antAtk >= 7 ? 2 : 0);
                const rollB = danzaRoll(def);
                if (rollA >= rollB) {
                    antAtk = Math.min(10, antAtk + 1);
                    hpDef -= atk.feromonas * 0.8; // Daño social
                    if (Math.random() < 0.3) stunDef = 1; // 30% stun por victoria social
                } 
                break;
            }
        }

        // Penalización Cordyceps
        if (antAtk <= 0) hpAtk -= 5;

        // Guardar estado
        if (turnoDeA) { hpA=hpAtk;hpB=hpDef;hemoA=hemoAtk;antenasA=antAtk;stunA=stunAtk;stunB=stunDef;esquivaA=esquivaAtk;esquivaB=esquivaDef;criticoA=criticoAtk;tanqueA=tanqueAtk;tanqueB=tanqueDef;espirituA=espAtk;espirituB=espDef; }
        else { hpB=hpAtk;hpA=hpDef;hemoB=hemoAtk;antenasB=antAtk;stunB=stunAtk;stunA=stunDef;esquivaB=esquivaAtk;esquivaA=esquivaDef;criticoB=criticoAtk;tanqueB=tanqueAtk;tanqueA=tanqueDef;espirituB=espAtk;espirituA=espDef; }
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
                const w = simularCombate(keys[i], keys[j]);
                res[w].wins++;
                res[w === keys[i] ? keys[j] : keys[i]].losses++;
            }
        }
    }
    return res;
}

// === EJECUTAR ===
console.log("═══════════════════════════════════════════════════════════");
console.log("  🧠 TORNEO META — Cada taxón juega su estrategia óptima");
console.log("  🦟 Plaga: La Descarada — 29 Mayo 2026");
console.log("═══════════════════════════════════════════════════════════\n");

const RONDAS = 2000;
console.log(`⚙️  ${RONDAS} rondas. IA personalizada por taxón.\n`);

const results = torneo(RONDAS);
const ranking = Object.entries(results)
    .map(([k,v]) => ({key:k,...TAXONES[k],...v,total:v.wins+v.losses,wr:(v.wins/(v.wins+v.losses)*100)}))
    .sort((a,b) => b.wr - a.wr);

console.log("┌────┬──────────────────┬─────────┬────────┬──────────────────────────────────┐");
console.log("│ #  │ Taxón            │ Wins    │ WR%    │ Meta                             │");
console.log("├────┼──────────────────┼─────────┼────────┼──────────────────────────────────┤");

const metas = {
    pulga:"Evasión maestra + desgaste", arana:"Stun lock → remate x2.5",
    mosca:"Nigromante (tanque+espíritu)", garrapata:"Tanque regen + drenar",
    escorpion:"Burst (crit x2.5 en 3 turnos)", tipula:"Diplomacia pura (danza)",
    mariposa:"Stun + evasión + danza", vinchuca:"Invisible → mordida letal",
    avispa:"Berserker multi-hit", chinche:"Confusión + danza",
    sanguijuela:"Drenar + stun + evasión", polilla:"Info + confusión + evasión",
    cucaracha:"Tanque defensivo + inmune", zancudo:"Veneno + evasión + zumbido"
};

ranking.forEach((t, i) => {
    const pos = String(i+1).padStart(2);
    const nombre = `${t.emoji} ${t.nombre}`.padEnd(16);
    const w = String(t.wins).padStart(6);
    const wr = `${t.wr.toFixed(1)}%`.padStart(6);
    const meta = (metas[t.key]||"").padEnd(32);
    console.log(`│ ${pos} │ ${nombre} │ ${w} │ ${wr} │ ${meta} │`);
});
console.log("└────┴──────────────────┴─────────┴────────┴──────────────────────────────────┘");

const spread = ranking[0].wr - ranking[13].wr;
console.log(`\n  📏 Spread: ${spread.toFixed(1)}%`);
console.log(`  👑 #1: ${ranking[0].emoji} ${ranking[0].nombre} (${ranking[0].wr.toFixed(1)}%) — ${metas[ranking[0].key]}`);
console.log(`  💀 #14: ${ranking[13].emoji} ${ranking[13].nombre} (${ranking[13].wr.toFixed(1)}%) — ${metas[ranking[13].key]}`);

// Balance cruzado
const socialRank = {tipula:1,mariposa:2,polilla:3,chinche:4,vinchuca:5,arana:6,avispa:7,sanguijuela:8,escorpion:9,zancudo:10,cucaracha:11,garrapata:12,mosca:13,pulga:14};
console.log("\n  ⚖️  BALANCE CRUZADO:");
ranking.forEach((t, i) => {
    const pvp = i+1, soc = socialRank[t.key], sum = pvp+soc;
    const icon = sum<=10?"🌟":sum<=16?"⚖️":"💀";
    console.log(`  ${icon} ${t.emoji} ${t.nombre.padEnd(12)} PvP:#${String(pvp).padEnd(2)} Social:#${String(soc).padEnd(2)} Suma:${sum}`);
});

console.log("\n  📜 \"Cuando cada especie juega su juego, el balance emerge solo.");
console.log("     La evolución no necesita parches. Solo nichos ecológicos.\"");
console.log("     — Ramazzottius\n");
