/**
 * Simulador de Balance — Plaga: La Descarada
 * Simula combates entre todos los taxones vs todos los enemigos
 * y entre taxones vs taxones (PvP)
 * 
 * Uso: node simulador_balance.js
 * Output: balance_report.html (para la wiki)
 */

const fs = require("fs");
const path = require("path");

const SIMULATIONS = 500; // combates por matchup

// === DATOS DE TAXONES (copiados de game_manager.gd) ===
const TAXONES = {
    "Zancudo": { torax: 5, ganglios: 7, quitina: 4, sensilios: 6, cripsis: 8, feromonas: 3 },
    "Cucaracha": { torax: 6, ganglios: 5, quitina: 9, sensilios: 7, cripsis: 6, feromonas: 1 },
    "Avispa": { torax: 8, ganglios: 7, quitina: 5, sensilios: 4, cripsis: 3, feromonas: 4 },
    "Garrapata": { torax: 7, ganglios: 2, quitina: 10, sensilios: 5, cripsis: 4, feromonas: 2 },
    "Chinche": { torax: 3, ganglios: 4, quitina: 4, sensilios: 6, cripsis: 7, feromonas: 9 },
    "Mariposa": { torax: 2, ganglios: 9, quitina: 2, sensilios: 7, cripsis: 5, feromonas: 10 },
    "Araña": { torax: 4, ganglios: 5, quitina: 5, sensilios: 9, cripsis: 7, feromonas: 1 },
    "Escorpión": { torax: 8, ganglios: 4, quitina: 8, sensilios: 5, cripsis: 6, feromonas: 3 },
    "Vinchuca": { torax: 5, ganglios: 6, quitina: 5, sensilios: 8, cripsis: 10, feromonas: 2 },
    "Mosca": { torax: 4, ganglios: 6, quitina: 5, sensilios: 7, cripsis: 2, feromonas: 5 },
    "Sanguijuela": { torax: 3, ganglios: 4, quitina: 6, sensilios: 6, cripsis: 5, feromonas: 8 },
    "Polilla": { torax: 3, ganglios: 7, quitina: 3, sensilios: 10, cripsis: 4, feromonas: 6 },
    "Pulga": { torax: 4, ganglios: 10, quitina: 3, sensilios: 6, cripsis: 5, feromonas: 5 },
    "Típula": { torax: 3, ganglios: 8, quitina: 2, sensilios: 9, cripsis: 7, feromonas: 6 },
};

// === DATOS DE ENEMIGOS ===
const ENEMIGOS = {
    "Garrapata Salvaje": { hp: 30, fuerza: 4, agilidad: 3, defensa: 2 },
    "Cucaracha Carroñera": { hp: 20, fuerza: 3, agilidad: 5, defensa: 1 },
    "Polilla Sedante": { hp: 15, fuerza: 2, agilidad: 4, defensa: 0 },
};

// === FÓRMULAS (replicadas del juego) ===
function calcHP(quitina) { return 80 + quitina * 4; }
function calcHemolinfa(sensilios) { return 30 + sensilios * 4; }
function calcVelocidad(ganglios, sensilios) { return (ganglios + sensilios) / 2; }
function calcDamage(torax, arma, defensa) {
    const base = (torax + arma) * 2 - defensa;
    return Math.max(1, base * (0.85 + Math.random() * 0.3));
}

// === SIMULACIÓN DE COMBATE ===
function simularCombate(atacante, defensor) {
    // Atacante = taxón jugable
    const atk_hp_max = calcHP(atacante.quitina);
    let atk_hp = atk_hp_max;
    const atk_vel = calcVelocidad(atacante.ganglios, atacante.sensilios);
    
    // Defensor = enemigo o taxón
    let def_hp, def_fuerza, def_agilidad, def_defensa, def_vel;
    if (defensor.hp !== undefined) {
        // Es un enemigo
        def_hp = defensor.hp;
        def_fuerza = defensor.fuerza;
        def_agilidad = defensor.agilidad;
        def_defensa = defensor.defensa;
        def_vel = (def_agilidad + 5) / 2;
    } else {
        // Es otro taxón
        def_hp = calcHP(defensor.quitina);
        def_fuerza = defensor.torax;
        def_agilidad = defensor.ganglios;
        def_defensa = defensor.quitina;
        def_vel = calcVelocidad(defensor.ganglios, defensor.sensilios);
    }
    
    let turnos = 0;
    const maxTurnos = 30;
    
    while (atk_hp > 0 && def_hp > 0 && turnos < maxTurnos) {
        turnos++;
        
        // Determinar quién va primero
        const atk_first = atk_vel >= def_vel;
        
        if (atk_first) {
            // Atacante golpea
            const dmg = calcDamage(atacante.torax, 0, def_defensa);
            def_hp -= dmg;
            if (def_hp <= 0) break;
            // Defensor golpea
            const dmg2 = calcDamage(def_fuerza, 0, atacante.quitina);
            atk_hp -= dmg2;
        } else {
            // Defensor golpea primero
            const dmg2 = calcDamage(def_fuerza, 0, atacante.quitina);
            atk_hp -= dmg2;
            if (atk_hp <= 0) break;
            // Atacante golpea
            const dmg = calcDamage(atacante.torax, 0, def_defensa);
            def_hp -= dmg;
        }
    }
    
    return {
        victoria: def_hp <= 0,
        turnos: turnos,
        hp_restante: Math.max(0, atk_hp),
        hp_max: atk_hp_max,
    };
}

// === CORRER SIMULACIONES ===
function simularMatchup(atacante, defensor, n) {
    let victorias = 0, turnos_total = 0, hp_restante_total = 0;
    for (let i = 0; i < n; i++) {
        const r = simularCombate(atacante, defensor);
        if (r.victoria) victorias++;
        turnos_total += r.turnos;
        hp_restante_total += r.hp_restante;
    }
    return {
        winrate: (victorias / n * 100).toFixed(1),
        turnos_avg: (turnos_total / n).toFixed(1),
        hp_restante_avg: (hp_restante_total / n).toFixed(0),
    };
}

// === GENERAR REPORTE HTML ===
function generarReporte() {
    console.log("🧬 Simulador de Balance — Plaga: La Descarada");
    console.log(`   Simulando ${SIMULATIONS} combates por matchup...\n`);
    
    let html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Balance Report — Plaga: La Descarada</title><link rel="stylesheet" href="style.css">
<style>
.win-high { color: #3fb950; font-weight: 600; }
.win-mid { color: #d29922; font-weight: 600; }
.win-low { color: #f85149; font-weight: 600; }
.balance-table td, .balance-table th { font-size: 0.8em; padding: 4px 8px; text-align: center; }
.balance-table th { background: #1c2128; }
</style></head><body>
<main id="content" style="max-width:1200px;margin:0 auto;padding:20px;">
<article>
<h1>📊 Reporte de Balance — Simulación de Combate</h1>
<p style="color:#8b949e;">Generado: ${new Date().toLocaleString("es-CL")} | ${SIMULATIONS} simulaciones por matchup</p>
<p>Winrate: <span class="win-high">70%+ = muy fácil</span> | <span class="win-mid">40-69% = equilibrado</span> | <span class="win-low">&lt;40% = muy difícil</span></p>\n`;

    // === SECCIÓN 1: Taxones vs Enemigos ===
    html += `<h2>⚔️ Taxones vs Enemigos (PvE)</h2>\n<table class="balance-table"><tr><th>Taxón</th>`;
    for (const eName of Object.keys(ENEMIGOS)) {
        html += `<th>${eName}</th>`;
    }
    html += `<th>Promedio</th></tr>\n`;
    
    const pveResults = {};
    for (const [tName, tStats] of Object.entries(TAXONES)) {
        html += `<tr><td><strong>${tName}</strong></td>`;
        let totalWin = 0;
        for (const [eName, eStats] of Object.entries(ENEMIGOS)) {
            const r = simularMatchup(tStats, eStats, SIMULATIONS);
            const wr = parseFloat(r.winrate);
            totalWin += wr;
            const cls = wr >= 70 ? "win-high" : wr >= 40 ? "win-mid" : "win-low";
            html += `<td class="${cls}">${r.winrate}%<br><small>${r.turnos_avg}t</small></td>`;
        }
        const avg = (totalWin / Object.keys(ENEMIGOS).length).toFixed(1);
        const avgCls = avg >= 70 ? "win-high" : avg >= 40 ? "win-mid" : "win-low";
        html += `<td class="${avgCls}"><strong>${avg}%</strong></td></tr>\n`;
        pveResults[tName] = avg;
        console.log(`  ${tName}: ${avg}% winrate promedio vs enemigos`);
    }
    html += `</table>\n`;

    // === SECCIÓN 2: Taxones vs Taxones (PvP) ===
    html += `<h2>🧬 Taxones vs Taxones (PvP)</h2>\n<table class="balance-table"><tr><th>Atacante \\ Defensor</th>`;
    const taxonNames = Object.keys(TAXONES);
    for (const name of taxonNames) {
        html += `<th>${name.substring(0,4)}</th>`;
    }
    html += `</tr>\n`;
    
    const pvpWins = {};
    for (const [atkName, atkStats] of Object.entries(TAXONES)) {
        html += `<tr><td><strong>${atkName}</strong></td>`;
        let wins = 0;
        for (const [defName, defStats] of Object.entries(TAXONES)) {
            if (atkName === defName) {
                html += `<td>—</td>`;
            } else {
                const r = simularMatchup(atkStats, defStats, SIMULATIONS);
                const wr = parseFloat(r.winrate);
                wins += wr;
                const cls = wr >= 60 ? "win-high" : wr >= 40 ? "win-mid" : "win-low";
                html += `<td class="${cls}">${r.winrate}%</td>`;
            }
        }
        const avgPvp = (wins / (taxonNames.length - 1)).toFixed(1);
        pvpWins[atkName] = avgPvp;
        html += `</tr>\n`;
    }
    html += `</table>\n`;

    // === SECCIÓN 3: Ranking ===
    html += `<h2>🏆 Ranking de Poder</h2>\n<table class="balance-table"><tr><th>#</th><th>Taxón</th><th>PvE Winrate</th><th>PvP Winrate</th><th>Score</th></tr>\n`;
    
    const ranking = taxonNames.map(name => ({
        name,
        pve: parseFloat(pveResults[name]),
        pvp: parseFloat(pvpWins[name]),
        score: (parseFloat(pveResults[name]) * 0.6 + parseFloat(pvpWins[name]) * 0.4).toFixed(1)
    })).sort((a, b) => b.score - a.score);
    
    ranking.forEach((r, i) => {
        html += `<tr><td>${i+1}</td><td><strong>${r.name}</strong></td><td>${r.pve}%</td><td>${r.pvp}%</td><td><strong>${r.score}</strong></td></tr>\n`;
    });
    html += `</table>\n`;

    // === SECCIÓN 4: Alertas de balance ===
    html += `<h2>⚠️ Alertas de Balance</h2>\n<ul>\n`;
    ranking.forEach(r => {
        if (parseFloat(r.score) > 75) html += `<li class="win-high">⚠️ <strong>${r.name}</strong> puede estar OP (score ${r.score}). Considerar nerf.</li>\n`;
        if (parseFloat(r.score) < 35) html += `<li class="win-low">⚠️ <strong>${r.name}</strong> puede estar muy débil (score ${r.score}). Considerar buff.</li>\n`;
    });
    if (!ranking.some(r => parseFloat(r.score) > 75 || parseFloat(r.score) < 35)) {
        html += `<li>✅ No se detectaron desbalances críticos. El rango de scores está dentro de lo aceptable.</li>\n`;
    }
    html += `</ul>\n`;

    html += `<blockquote>"Los números no mienten. Pero los bichos sí. Siempre revisa si el 'balance' se siente bien al jugar, no solo en la hoja de cálculo."<br>— Ramazzottius, sobre game design</blockquote>`;
    html += `</article></main></body></html>`;

    const outputPath = path.join(__dirname, "balance_report.html");
    fs.writeFileSync(outputPath, html, "utf8");
    console.log(`\n📊 Reporte generado: ${outputPath}`);
    console.log("   Ábrelo en el navegador o súbelo a la wiki.");
}

generarReporte();
