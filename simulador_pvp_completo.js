/**
 * Simulador PvP Completo — Plaga: La Descarada
 * Incluye atavismos, genera narrativa para Gemini
 * Ramazzottius y Youti observan cada batalla
 * 
 * Uso: node simulador_pvp_completo.js
 */

const fs = require("fs");
const path = require("path");

const SIMS = 200; // combates por matchup

// === TAXONES ===
const TAXONES = {
    "Zancudo": { emoji: "🦟", torax: 5, ganglios: 7, quitina: 4, sensilios: 6, cripsis: 8, feromonas: 3 },
    "Cucaracha": { emoji: "🪳", torax: 6, ganglios: 5, quitina: 9, sensilios: 7, cripsis: 6, feromonas: 1 },
    "Avispa": { emoji: "🐝", torax: 8, ganglios: 7, quitina: 5, sensilios: 4, cripsis: 3, feromonas: 4 },
    "Garrapata": { emoji: "🕷️", torax: 7, ganglios: 2, quitina: 10, sensilios: 5, cripsis: 4, feromonas: 2 },
    "Chinche": { emoji: "🛏️", torax: 3, ganglios: 4, quitina: 4, sensilios: 6, cripsis: 7, feromonas: 9 },
    "Mariposa": { emoji: "🦋", torax: 2, ganglios: 9, quitina: 2, sensilios: 7, cripsis: 5, feromonas: 10 },
    "Araña": { emoji: "🕸️", torax: 4, ganglios: 5, quitina: 5, sensilios: 9, cripsis: 7, feromonas: 1 },
    "Escorpión": { emoji: "🦂", torax: 8, ganglios: 4, quitina: 8, sensilios: 5, cripsis: 6, feromonas: 3 },
    "Vinchuca": { emoji: "🗡️", torax: 5, ganglios: 6, quitina: 5, sensilios: 8, cripsis: 10, feromonas: 2 },
    "Mosca": { emoji: "💀", torax: 4, ganglios: 6, quitina: 5, sensilios: 7, cripsis: 2, feromonas: 5 },
    "Sanguijuela": { emoji: "🧪", torax: 3, ganglios: 4, quitina: 6, sensilios: 6, cripsis: 5, feromonas: 8 },
    "Polilla": { emoji: "🌙", torax: 3, ganglios: 7, quitina: 3, sensilios: 10, cripsis: 4, feromonas: 6 },
    "Pulga": { emoji: "⚡", torax: 4, ganglios: 10, quitina: 3, sensilios: 6, cripsis: 5, feromonas: 5 },
    "Típula": { emoji: "🦟", torax: 3, ganglios: 8, quitina: 2, sensilios: 9, cripsis: 7, feromonas: 6 },
};

// === ATAVISMOS (primer atavismo de cada taxón — el más usado) ===
const ATAVISMOS = {
    "Zancudo": { nombre: "Micro-Inyección", costo: 3, tipo: "debuff", valor: 0.5 },
    "Cucaracha": { nombre: "Caparazón", costo: 2, tipo: "inmune", valor: 1 },
    "Avispa": { nombre: "Picada Frenética", costo: 4, tipo: "multi", valor: 0.6 },
    "Garrapata": { nombre: "Anclaje Vital", costo: 3, tipo: "drain", valor: 0.1 },
    "Chinche": { nombre: "Decreto Real", costo: 2, tipo: "skip", valor: 1 },
    "Mariposa": { nombre: "Polvo Cegador", costo: 2, tipo: "miss", valor: 0.8 },
    "Araña": { nombre: "Red de Contención", costo: 4, tipo: "inmovil", valor: 2 },
    "Escorpión": { nombre: "Golpe de Pinza", costo: 5, tipo: "crit", valor: 2.5 },
    "Vinchuca": { nombre: "Mordida Silenciosa", costo: 3, tipo: "steal", valor: 1.5 },
    "Mosca": { nombre: "Invocar Larva", costo: 4, tipo: "summon", valor: 4 },
    "Sanguijuela": { nombre: "Éxtasis Tóxico", costo: 3, tipo: "stun", valor: 1 },
    "Polilla": { nombre: "Visión del Foco", costo: 2, tipo: "reveal", valor: 1 },
    "Pulga": { nombre: "Salto Dimensional", costo: 1, tipo: "dodge", valor: 1 },
    "Típula": { nombre: "Autotomía Táctica", costo: 2, tipo: "dodge", valor: 1 },
};

// === MOTOR DE COMBATE CON ATAVISMOS ===
function simCombateFull(atkName, defName) {
    const atk = { ...TAXONES[atkName] };
    const def = { ...TAXONES[defName] };
    
    let atk_hp = 80 + atk.quitina * 4;
    let def_hp = 80 + def.quitina * 4;
    const atk_hp_max = atk_hp;
    const def_hp_max = def_hp;
    let atk_hemo = 30 + atk.sensilios * 4;
    let def_hemo = 30 + def.sensilios * 4;
    
    const atk_vel = (atk.ganglios + atk.sensilios) / 2;
    const def_vel = (def.ganglios + def.sensilios) / 2;
    
    let turnos = 0;
    let atk_used_atav = false;
    let def_used_atav = false;
    let atk_stunned = false;
    let def_stunned = false;
    let atk_dodge = false;
    let def_dodge = false;
    let def_agi_mod = 1.0;
    let atk_agi_mod = 1.0;
    let log = [];
    
    while (atk_hp > 0 && def_hp > 0 && turnos < 20) {
        turnos++;
        const atk_first = atk_vel * atk_agi_mod >= def_vel * def_agi_mod;
        
        // Función de turno individual
        const doTurn = (attacker, defender, aName, dName, isAtk) => {
            const stunned = isAtk ? atk_stunned : def_stunned;
            if (stunned) {
                if (isAtk) atk_stunned = false; else def_stunned = false;
                log.push(`  ${aName} está aturdido. Pierde turno.`);
                return;
            }
            
            // Decidir si usar atavismo (30% chance si tiene hemo y no lo usó)
            const atav = ATAVISMOS[aName];
            const hemo = isAtk ? atk_hemo : def_hemo;
            const used = isAtk ? atk_used_atav : def_used_atav;
            
            if (!used && hemo >= atav.costo && Math.random() < 0.35) {
                // Usar atavismo
                if (isAtk) { atk_hemo -= atav.costo; atk_used_atav = true; }
                else { def_hemo -= atav.costo; def_used_atav = true; }
                
                log.push(`  🧬 ${aName} usa ${atav.nombre}!`);
                
                switch (atav.tipo) {
                    case "debuff": // reduce agilidad
                        if (isAtk) def_agi_mod *= atav.valor; else atk_agi_mod *= atav.valor;
                        break;
                    case "multi": // 3 golpes
                        for (let i = 0; i < 3; i++) {
                            const d = Math.max(1, attacker.torax * atav.valor * 2 - defender.quitina) * (0.85 + Math.random()*0.3);
                            if (isAtk) def_hp -= d; else atk_hp -= d;
                        }
                        break;
                    case "crit": // daño x2.5
                        const cd = attacker.torax * atav.valor * 2;
                        if (isAtk) def_hp -= cd; else atk_hp -= cd;
                        break;
                    case "drain": // drena HP
                        const drain = (isAtk ? def_hp_max : atk_hp_max) * atav.valor;
                        if (isAtk) { def_hp -= drain; atk_hp = Math.min(atk_hp + drain, atk_hp_max); }
                        else { atk_hp -= drain; def_hp = Math.min(def_hp + drain, def_hp_max); }
                        break;
                    case "stun": case "skip":
                        if (isAtk) def_stunned = true; else atk_stunned = true;
                        break;
                    case "dodge":
                        if (isAtk) atk_dodge = true; else def_dodge = true;
                        break;
                    case "inmune":
                        // No recibe daño este turno (ya no ataca)
                        return;
                    case "inmovil":
                        if (isAtk) def_stunned = true; else atk_stunned = true;
                        break;
                    case "summon":
                        const sd = atav.valor * 3;
                        if (isAtk) def_hp -= sd; else atk_hp -= sd;
                        break;
                    case "steal":
                        const stealDmg = attacker.torax * atav.valor * 2 - defender.quitina;
                        if (isAtk) def_hp -= Math.max(1, stealDmg); else atk_hp -= Math.max(1, stealDmg);
                        break;
                    default: // reveal, miss — minor effect
                        break;
                }
                return;
            }
            
            // Ataque normal
            const dodging = isAtk ? def_dodge : atk_dodge;
            if (dodging) {
                log.push(`  ${dName} esquiva el ataque!`);
                if (isAtk) def_dodge = false; else atk_dodge = false;
                return;
            }
            
            const dmg = Math.max(1, (attacker.torax * 2 - defender.quitina) * (0.85 + Math.random()*0.3));
            if (isAtk) def_hp -= dmg; else atk_hp -= dmg;
        };
        
        if (atk_first) {
            doTurn(atk, def, atkName, defName, true);
            if (def_hp > 0) doTurn(def, atk, defName, atkName, false);
        } else {
            doTurn(def, atk, defName, atkName, false);
            if (atk_hp > 0) doTurn(atk, def, atkName, defName, true);
        }
    }
    
    return {
        ganador: atk_hp > 0 ? atkName : defName,
        perdedor: atk_hp > 0 ? defName : atkName,
        turnos,
        atk_hp_final: Math.max(0, atk_hp),
        def_hp_final: Math.max(0, def_hp),
        log: log.slice(-6), // últimas 6 líneas
    };
}

// === TORNEO COMPLETO + NARRATIVA ===
function main() {
    console.log("🧬 ═══════════════════════════════════════════");
    console.log("   TORNEO DEL GRAN CHARCO — Simulación PvP");
    console.log("   Observadores: Ramazzottius 🐻 + Youti 🧬");
    console.log("🧬 ═══════════════════════════════════════════\n");
    
    const names = Object.keys(TAXONES);
    const results = {}; // {taxon: {wins, losses, matchups: {vs: winrate}}}
    const battles = []; // mejores batallas para narrativa
    
    // Inicializar
    names.forEach(n => { results[n] = { wins: 0, losses: 0, matchups: {} }; });
    
    // Simular todos vs todos
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const a = names[i], b = names[j];
            let a_wins = 0, b_wins = 0, total_turnos = 0;
            let best_battle = null;
            
            for (let s = 0; s < SIMS; s++) {
                const r = simCombateFull(a, b);
                if (r.ganador === a) a_wins++; else b_wins++;
                total_turnos += r.turnos;
                
                // Guardar la batalla más épica (más turnos = más épica)
                if (!best_battle || r.turnos > best_battle.turnos) {
                    best_battle = r;
                }
            }
            
            const a_wr = (a_wins / SIMS * 100).toFixed(1);
            const b_wr = (b_wins / SIMS * 100).toFixed(1);
            results[a].matchups[b] = a_wr;
            results[b].matchups[a] = b_wr;
            results[a].wins += a_wins;
            results[a].losses += b_wins;
            results[b].wins += b_wins;
            results[b].losses += a_wins;
            
            // Guardar batallas épicas (las más cerradas)
            if (Math.abs(a_wins - b_wins) < SIMS * 0.2) {
                battles.push({ a, b, a_wr, b_wr, turnos_avg: (total_turnos/SIMS).toFixed(1), best: best_battle });
            }
            
            console.log(`  ${TAXONES[a].emoji} ${a} vs ${TAXONES[b].emoji} ${b}: ${a_wr}% / ${b_wr}% (${(total_turnos/SIMS).toFixed(1)} turnos avg)`);
        }
    }
    
    // Ranking
    const ranking = names.map(n => ({
        name: n,
        emoji: TAXONES[n].emoji,
        wins: results[n].wins,
        losses: results[n].losses,
        winrate: (results[n].wins / (results[n].wins + results[n].losses) * 100).toFixed(1)
    })).sort((a, b) => b.winrate - a.winrate);
    
    console.log("\n🏆 RANKING FINAL:");
    ranking.forEach((r, i) => console.log(`  ${i+1}. ${r.emoji} ${r.name}: ${r.winrate}% (${r.wins}W/${r.losses}L)`));
    
    // === GENERAR PROMPT PARA GEMINI ===
    let prompt = `Eres el narrador omnisciente del universo "Plaga: La Descarada". Dos seres ancestrales observan un torneo entre los 14 Taxones del Gran Charco:\n\n`;
    prompt += `🐻 RAMAZZOTTIUS (530M años, Tardígrado): Comenta con cinismo y aburrimiento. Ha visto todo. Nada le impresiona.\n`;
    prompt += `🧬 YOUTI YUANSHI (520M años, Proto-artrópodo): Observa con dolor. Son todos sus hijos matándose. Cada golpe le duele.\n\n`;
    prompt += `=== RESULTADOS DEL TORNEO ===\n`;
    prompt += `Ranking de poder:\n`;
    ranking.forEach((r, i) => prompt += `${i+1}. ${r.emoji} ${r.name} — ${r.winrate}% winrate\n`);
    prompt += `\n=== BATALLAS MÁS ÉPICAS (las más cerradas) ===\n`;
    battles.slice(0, 8).forEach(b => {
        prompt += `${TAXONES[b.a].emoji} ${b.a} vs ${TAXONES[b.b].emoji} ${b.b}: ${b.a_wr}%/${b.b_wr}% en ${b.turnos_avg} turnos promedio\n`;
        prompt += `  Mejor batalla: ${b.best.ganador} ganó en ${b.best.turnos} turnos\n`;
    });
    prompt += `\n=== TAREA ===\n`;
    prompt += `Narra estas batallas como EVENTOS CANÓNICOS del lore. Para cada una de las 8 batallas épicas:\n`;
    prompt += `1. Ramazzottius comenta antes de la pelea (cínico, aburrido)\n`;
    prompt += `2. Descripción de la batalla (2-3 frases, visceral, descarada)\n`;
    prompt += `3. Youti reacciona después (dolor, decepción, pero también orgullo secreto)\n`;
    prompt += `4. Consecuencia política en el Gran Charco (quién ganó territorio, quién perdió estatus)\n\n`;
    prompt += `Tono: George R.R. Martin + humor negro chileno. Los insectos son arrogantes y descarados.\n`;
    prompt += `Responde en español.\n`;
    
    // Guardar prompt
    fs.writeFileSync(path.join(__dirname, "prompt_torneo_gemini.txt"), prompt, "utf8");
    console.log("\n📝 Prompt para Gemini guardado en: prompt_torneo_gemini.txt");
    
    // === GENERAR HTML DEL TORNEO ===
    let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Torneo PvP — Plaga: La Descarada</title><link rel="stylesheet" href="style.css">
<style>.win-high{color:#3fb950;font-weight:600}.win-mid{color:#d29922;font-weight:600}.win-low{color:#f85149;font-weight:600}
.torneo-table td,.torneo-table th{font-size:0.75em;padding:3px 6px;text-align:center}</style></head><body>
<main id="content" style="max-width:1200px;margin:0 auto;padding:20px;"><article>
<h1>🏆 Torneo del Gran Charco — PvP con Atavismos</h1>
<p style="color:#8b949e;">Simulación: ${SIMS} combates por matchup | Incluye uso de Atavismos (35% chance/turno)</p>
<p style="color:#8b949e;">Generado: ${new Date().toLocaleString("es-CL")}</p>\n`;
    
    // Ranking
    html += `<h2>🏆 Ranking de Poder</h2><table class="torneo-table"><tr><th>#</th><th>Taxón</th><th>Victorias</th><th>Derrotas</th><th>Winrate</th></tr>\n`;
    ranking.forEach((r, i) => {
        const cls = parseFloat(r.winrate) >= 60 ? "win-high" : parseFloat(r.winrate) >= 40 ? "win-mid" : "win-low";
        html += `<tr><td>${i+1}</td><td>${r.emoji} <strong>${r.name}</strong></td><td>${r.wins}</td><td>${r.losses}</td><td class="${cls}">${r.winrate}%</td></tr>\n`;
    });
    html += `</table>\n`;
    
    // Batallas épicas
    html += `<h2>⚔️ Batallas Más Épicas (las más cerradas)</h2>\n`;
    battles.slice(0, 8).forEach(b => {
        html += `<div class="stat-block"><h3>${TAXONES[b.a].emoji} ${b.a} vs ${TAXONES[b.b].emoji} ${b.b}</h3>`;
        html += `<p>Winrate: ${b.a_wr}% / ${b.b_wr}% | Turnos promedio: ${b.turnos_avg}</p>`;
        html += `<p><em>Batalla más larga: ${b.best.ganador} ganó en ${b.best.turnos} turnos</em></p></div>\n`;
    });
    
    // Observadores
    html += `<h2>👁️ Los Observadores</h2>`;
    html += `<blockquote>"${ranking.length} linajes. ${SIMS * names.length * (names.length-1) / 2} combates simulados. Y el resultado es el mismo de siempre: los que pegan fuerte ganan. 530 millones de años y la evolución sigue premiando la violencia. Qué aburrido."<br>— 🐻 Ramazzottius, bostezando</blockquote>`;
    html += `<blockquote>"Cada número en esa tabla es un hijo mío golpeando a otro hijo mío. ${results[ranking[0].name].wins} victorias del ${ranking[0].name}. ${results[ranking[ranking.length-1].name].losses} derrotas de la ${ranking[ranking.length-1].name}. Y yo aquí, dormido, sin poder hacer nada. Quizás es mejor así."<br>— 🧬 Youti Yuanshi, desde su criptobiosis</blockquote>`;
    
    html += `<h2>📝 Prompt para Gemini</h2><p>El archivo <code>prompt_torneo_gemini.txt</code> contiene un prompt listo para que Gemini narre estas batallas como eventos canónicos del lore. Ejecútalo cuando tengas cuota.</p>`;
    html += `</article></main></body></html>`;
    
    fs.writeFileSync(path.join(__dirname, "torneo_pvp.html"), html, "utf8");
    console.log("📊 Reporte HTML: torneo_pvp.html");
}

main();
