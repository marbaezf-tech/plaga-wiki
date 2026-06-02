/**
 * server.js — Plaga: La Descarada Wiki
 * Servidor local con panel de admin protegido por sesión
 * Puerto: 3001
 */

const express  = require('express');
const session  = require('express-session');
const multer   = require('multer');
const crypto   = require('crypto');
const path     = require('path');
const fs       = require('fs');
const { execSync } = require('child_process');

// ── Cargar .env manualmente (sin dependencia extra) ─────────────────────────
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}
loadEnv();

const ADMIN_USER      = process.env.ADMIN_USER      || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH  || '';
const SESSION_SECRET  = process.env.SESSION_SECRET   || 'fallback-secret-change-me';
const GODOT_PATH      = process.env.GODOT_SPRITES_PATH || '';
const GIT_REPO_PATH   = process.env.GIT_REPO_PATH   || __dirname;

const app  = express();
const PORT = 3001;

// ── Directorios de uploads ──────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const IMG_DIR    = path.join(__dirname, 'img');
['uploads', 'img'].forEach(d => {
    const full = path.join(__dirname, d);
    if (!fs.existsSync(full)) fs.mkdirSync(full);
});

// ── Bloquear admin.html y bestiario-admin.html desde IPs externas ──────────
app.get(['/admin.html', '/bestiario-admin.html'], (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
        return res.status(403).send('<h1>403 — Acceso denegado</h1><p>El panel de admin solo está disponible desde localhost.</p>');
    }
    next();
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }  // 8 horas
}));
app.use(express.static(__dirname));

// ── Multer — configuración de uploads ──────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) => {
        // Preservar nombre original, sanitizado
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, safe);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB máx
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Solo se permiten imágenes (png, jpg, gif, webp, svg)'));
    }
});

// ── Bloquear rutas /api/ desde IPs externas ────────────────────────────────
app.use('/api', (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
        return res.status(403).json({ ok: false, error: 'API solo disponible desde localhost' });
    }
    next();
});

// ── Auth middleware ─────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).json({ ok: false, error: 'No autorizado' });
}

function hashPass(pass) {
    return crypto.createHash('sha256').update(pass).digest('hex');
}

// ── Rutas de autenticación ──────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === ADMIN_USER && hashPass(pass) === ADMIN_PASS_HASH) {
        req.session.isAdmin = true;
        res.json({ ok: true });
    } else {
        res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ── Rutas de imágenes ───────────────────────────────────────────────────────

// Listar imágenes disponibles
app.get('/api/images', requireAdmin, (req, res) => {
    const files = fs.readdirSync(IMG_DIR)
        .filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f))
        .map(f => ({ name: f, url: `/img/${f}` }));
    res.json({ ok: true, images: files });
});

// Subir imagen — copia a img/ y opcionalmente a Godot sprites
app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo' });

    const dest = path.join(IMG_DIR, req.file.filename);

    // Copiar de uploads/ a img/
    fs.copyFileSync(req.file.path, dest);

    // Copiar a carpeta de sprites de Godot si está configurada
    let copiedToGodot = false;
    if (GODOT_PATH && fs.existsSync(GODOT_PATH)) {
        const godotDest = path.join(GODOT_PATH, req.file.filename);
        fs.copyFileSync(req.file.path, godotDest);
        copiedToGodot = true;
    }

    // Limpiar uploads/
    fs.unlinkSync(req.file.path);

    res.json({
        ok: true,
        filename: req.file.filename,
        url: `/img/${req.file.filename}`,
        copiedToGodot
    });
});

// Eliminar imagen
app.delete('/api/images/:filename', requireAdmin, (req, res) => {
    const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const imgPath  = path.join(IMG_DIR, filename);
    if (!fs.existsSync(imgPath)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
    fs.unlinkSync(imgPath);
    res.json({ ok: true });
});

// ── Ruta de git push ────────────────────────────────────────────────────────
app.post('/api/publish', requireAdmin, (req, res) => {
    const { message } = req.body;
    const msg = (message || 'admin: actualización de assets').replace(/['"]/g, '');

    try {
        execSync('git add img/ data/', { cwd: GIT_REPO_PATH });
        execSync(`git commit -m "${msg}"`, { cwd: GIT_REPO_PATH });
        execSync('git push origin main', { cwd: GIT_REPO_PATH });
        res.json({ ok: true, message: 'Push exitoso a GitHub Pages' });
    } catch (err) {
        const msg_err = err.message || '';
        if (msg_err.includes('nothing to commit')) {
            res.json({ ok: true, message: 'No hay cambios nuevos para publicar' });
        } else {
            res.status(500).json({ ok: false, error: err.message });
        }
    }
});

// ── CRUD Criaturas ──────────────────────────────────────────────────────────
const CRIATURAS_PATH = path.join(__dirname, 'data', 'criaturas.json');
const OBJETOS_PATH   = path.join(__dirname, 'data', 'objetos.json');

function readJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Listar criaturas
app.get('/api/criaturas', (req, res) => {
    res.json(readJSON(CRIATURAS_PATH));
});

// Crear criatura
app.post('/api/criaturas', requireAdmin, (req, res) => {
    const db = readJSON(CRIATURAS_PATH);
    const nueva = req.body;
    if (!nueva.id || !nueva.nombre) return res.status(400).json({ ok: false, error: 'id y nombre son requeridos' });
    if (db.criaturas.find(c => c.id === nueva.id)) return res.status(409).json({ ok: false, error: 'ID ya existe' });
    db.criaturas.push(nueva);
    writeJSON(CRIATURAS_PATH, db);
    // Exportar a Godot si está configurado
    _exportarGodot();
    res.json({ ok: true, criatura: nueva });
});

// Actualizar criatura
app.put('/api/criaturas/:id', requireAdmin, (req, res) => {
    const db = readJSON(CRIATURAS_PATH);
    const idx = db.criaturas.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Criatura no encontrada' });
    db.criaturas[idx] = { ...db.criaturas[idx], ...req.body, id: req.params.id };
    writeJSON(CRIATURAS_PATH, db);
    _exportarGodot();
    res.json({ ok: true, criatura: db.criaturas[idx] });
});

// Eliminar criatura
app.delete('/api/criaturas/:id', requireAdmin, (req, res) => {
    const db = readJSON(CRIATURAS_PATH);
    const antes = db.criaturas.length;
    db.criaturas = db.criaturas.filter(c => c.id !== req.params.id);
    if (db.criaturas.length === antes) return res.status(404).json({ ok: false, error: 'Criatura no encontrada' });
    writeJSON(CRIATURAS_PATH, db);
    _exportarGodot();
    res.json({ ok: true });
});

// ── CRUD Objetos ────────────────────────────────────────────────────────────

app.get('/api/objetos', (req, res) => {
    res.json(readJSON(OBJETOS_PATH));
});

app.post('/api/objetos', requireAdmin, (req, res) => {
    const db = readJSON(OBJETOS_PATH);
    const nuevo = req.body;
    if (!nuevo.id || !nuevo.nombre) return res.status(400).json({ ok: false, error: 'id y nombre son requeridos' });
    if (db.objetos.find(o => o.id === nuevo.id)) return res.status(409).json({ ok: false, error: 'ID ya existe' });
    db.objetos.push(nuevo);
    writeJSON(OBJETOS_PATH, db);
    _exportarGodot();
    res.json({ ok: true, objeto: nuevo });
});

app.put('/api/objetos/:id', requireAdmin, (req, res) => {
    const db = readJSON(OBJETOS_PATH);
    const idx = db.objetos.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Objeto no encontrado' });
    db.objetos[idx] = { ...db.objetos[idx], ...req.body, id: req.params.id };
    writeJSON(OBJETOS_PATH, db);
    _exportarGodot();
    res.json({ ok: true, objeto: db.objetos[idx] });
});

app.delete('/api/objetos/:id', requireAdmin, (req, res) => {
    const db = readJSON(OBJETOS_PATH);
    const antes = db.objetos.length;
    db.objetos = db.objetos.filter(o => o.id !== req.params.id);
    if (db.objetos.length === antes) return res.status(404).json({ ok: false, error: 'Objeto no encontrado' });
    writeJSON(OBJETOS_PATH, db);
    _exportarGodot();
    res.json({ ok: true });
});

// ── Exportar JSONs a Godot ──────────────────────────────────────────────────
function _exportarGodot() {
    if (!GODOT_PATH) return;
    const godotData = path.join(path.dirname(GODOT_PATH), 'data');
    if (!fs.existsSync(godotData)) {
        try { fs.mkdirSync(godotData, { recursive: true }); } catch(e) { return; }
    }
    try {
        fs.copyFileSync(CRIATURAS_PATH, path.join(godotData, 'criaturas.json'));
        fs.copyFileSync(OBJETOS_PATH,   path.join(godotData, 'objetos.json'));
    } catch(e) { /* silencioso si falla */ }
}

// ── CHAT CON OLLAMA (IA LOCAL) ──────────────────────────────────────────────

// Cargar contexto de la wiki para inyectar en cada conversación
function buildWikiContext() {
    let context = '';
    try {
        // NPCs
        const npcs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'npcs_organigrama.json'), 'utf8'));
        context += '\n## NPCs del Gran Charco:\n';
        npcs.forEach(npc => {
            context += `- ${npc['NOMBRE COMPLETO']}: ${npc['CARGO']}. ${npc['FACCIÓN']}. ${npc['PERSONALIDAD'] || ''}\n`;
        });
        // Criaturas
        const criDB = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'criaturas.json'), 'utf8'));
        context += '\n## Taxones y Criaturas:\n';
        (criDB.criaturas || []).forEach(c => {
            context += `- ${c.nombre} (${c.tipo}): ${c.comportamiento || ''}\n`;
        });
        // Objetos
        const objDB = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'objetos.json'), 'utf8'));
        context += '\n## Objetos:\n';
        (objDB.objetos || []).forEach(o => {
            context += `- ${o.nombre}: ${o.descripcion || ''}\n`;
        });
    } catch(e) { /* silencioso */ }
    return context;
}

// Endpoint de chat — proxy a Ollama con contexto de la wiki
app.post('/api/chat', async (req, res) => {
    const { message, history, model } = req.body;
    if (!message) return res.status(400).json({ ok: false, error: 'message requerido' });

    const ollamaModel = model || 'plaga-narrator';
    const wikiContext = buildWikiContext();

    // Construir mensajes con system + contexto + historial
    const messages = [
        {
            role: 'system',
            content: `Eres el narrador y experto absoluto de "Plaga: La Descarada", un RPG de insectos.
Conoces TODO el lore, NPCs, facciones, taxones y mecánicas del juego.
Respondes en español. Tono: cínico, descarado, inteligente.
Si te preguntan algo del juego, responde con precisión usando los datos que conoces.
Si te preguntan algo creativo (diálogos, lore nuevo), genera contenido consistente con el mundo.

DATOS DEL JUEGO:
${wikiContext}`
        }
    ];

    // Agregar historial previo
    if (history && Array.isArray(history)) {
        history.forEach(h => messages.push(h));
    }

    // Mensaje actual del usuario
    messages.push({ role: 'user', content: message });

    try {
        const http = require('http');
        const ollamaBody = JSON.stringify({
            model: ollamaModel,
            messages: messages,
            stream: false,
            options: { temperature: 0.85, num_predict: 400, num_ctx: 4096 }
        });

        const ollamaRes = await new Promise((resolve, reject) => {
            const req2 = http.request({
                hostname: 'localhost',
                port: 11434,
                path: '/api/chat',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, (resp) => {
                let data = '';
                resp.on('data', chunk => data += chunk);
                resp.on('end', () => resolve(data));
            });
            req2.on('error', reject);
            req2.write(ollamaBody);
            req2.end();
        });

        const parsed = JSON.parse(ollamaRes);
        const reply = parsed.message ? parsed.message.content : (parsed.response || 'Sin respuesta');
        res.json({ ok: true, response: reply, model: ollamaModel });
    } catch(err) {
        res.status(500).json({ ok: false, error: `Ollama no responde: ${err.message}. ¿Está corriendo?` });
    }
});

// Listar modelos de Ollama disponibles
app.get('/api/ollama/models', async (req, res) => {
    try {
        const http = require('http');
        const data = await new Promise((resolve, reject) => {
            http.get('http://localhost:11434/api/tags', (resp) => {
                let d = '';
                resp.on('data', chunk => d += chunk);
                resp.on('end', () => resolve(d));
            }).on('error', reject);
        });
        const parsed = JSON.parse(data);
        res.json({ ok: true, models: parsed.models || [] });
    } catch(err) {
        res.json({ ok: true, models: [] });
    }
});

// ── COMFYUI PROXY (Generación de imágenes) ──────────────────────────────────

// Proxy para generar imagen con ComfyUI
app.post('/api/comfyui/generate', async (req, res) => {
    const { prompt, negative, width, height, steps, cfg, seed, checkpoint } = req.body;
    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt requerido' });

    const clientId = 'plaga-wiki-' + Date.now();
    const actualSeed = seed || Math.floor(Math.random() * 999999999);
    const actualWidth = width || 768;
    const actualHeight = height || 768;
    const actualSteps = steps || 20;
    const actualCfg = cfg || 7;
    const actualCheckpoint = checkpoint || 'dreamshaper_xl.safetensors';

    // Workflow JSON estándar de ComfyUI (txt2img)
    const workflow = {
        "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: actualCheckpoint } },
        "5": { class_type: "EmptyLatentImage", inputs: { width: actualWidth, height: actualHeight, batch_size: 1 } },
        "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["4", 1] } },
        "7": { class_type: "CLIPTextEncode", inputs: { text: negative || "blurry, low quality, deformed, text, watermark", clip: ["4", 1] } },
        "3": { class_type: "KSampler", inputs: { seed: actualSeed, steps: actualSteps, cfg: actualCfg, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
        "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
        "9": { class_type: "SaveImage", inputs: { filename_prefix: "plaga_wiki", images: ["8", 0] } }
    };

    try {
        const http = require('http');
        const body = JSON.stringify({ client_id: clientId, prompt: workflow });

        const result = await new Promise((resolve, reject) => {
            const req2 = http.request({ hostname: 'localhost', port: 8188, path: '/prompt', method: 'POST', headers: { 'Content-Type': 'application/json' } }, resp => {
                let data = '';
                resp.on('data', chunk => data += chunk);
                resp.on('end', () => resolve({ status: resp.statusCode, data }));
            });
            req2.on('error', reject);
            req2.write(body);
            req2.end();
        });

        if (result.status === 200) {
            const parsed = JSON.parse(result.data);
            res.json({ ok: true, prompt_id: parsed.prompt_id, client_id: clientId });
        } else {
            res.status(500).json({ ok: false, error: `ComfyUI respondió ${result.status}: ${result.data}` });
        }
    } catch(err) {
        res.status(500).json({ ok: false, error: `ComfyUI no responde en :8188. ¿Está corriendo? ${err.message}` });
    }
});

// Obtener resultado de generación
app.get('/api/comfyui/history/:promptId', async (req, res) => {
    try {
        const http = require('http');
        const data = await new Promise((resolve, reject) => {
            http.get(`http://localhost:8188/history/${req.params.promptId}`, resp => {
                let d = '';
                resp.on('data', chunk => d += chunk);
                resp.on('end', () => resolve(d));
            }).on('error', reject);
        });
        const parsed = JSON.parse(data);
        const entry = parsed[req.params.promptId];
        if (entry && entry.outputs) {
            // Find saved images
            const images = [];
            Object.values(entry.outputs).forEach(output => {
                if (output.images) {
                    output.images.forEach(img => {
                        images.push({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
                    });
                }
            });
            res.json({ ok: true, done: true, images });
        } else {
            res.json({ ok: true, done: false });
        }
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

// Proxy para ver imagen generada por ComfyUI
app.get('/api/comfyui/view', async (req, res) => {
    const { filename, subfolder, type } = req.query;
    try {
        const http = require('http');
        const url = `http://localhost:8188/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder || '')}&type=${encodeURIComponent(type || 'output')}`;
        http.get(url, proxyRes => {
            res.set('Content-Type', proxyRes.headers['content-type'] || 'image/png');
            proxyRes.pipe(res);
        }).on('error', err => {
            res.status(500).json({ ok: false, error: err.message });
        });
    } catch(err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Guardar imagen generada en la wiki
app.post('/api/comfyui/save', async (req, res) => {
    const { filename, subfolder, type, saveName } = req.body;
    if (!filename || !saveName) return res.status(400).json({ ok: false, error: 'filename y saveName requeridos' });

    try {
        const http = require('http');
        const url = `http://localhost:8188/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder || '')}&type=${encodeURIComponent(type || 'output')}`;

        const imgData = await new Promise((resolve, reject) => {
            http.get(url, resp => {
                const chunks = [];
                resp.on('data', chunk => chunks.push(chunk));
                resp.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        });

        const safeName = saveName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const destPath = path.join(IMG_DIR, safeName);
        fs.writeFileSync(destPath, imgData);

        res.json({ ok: true, saved: `/img/${safeName}`, size: imgData.length });
    } catch(err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Check ComfyUI status
app.get('/api/comfyui/status', async (req, res) => {
    try {
        const http = require('http');
        const data = await new Promise((resolve, reject) => {
            const req2 = http.get('http://localhost:8188/system_stats', resp => {
                let d = '';
                resp.on('data', chunk => d += chunk);
                resp.on('end', () => resolve(d));
            });
            req2.on('error', reject);
            req2.setTimeout(3000, () => { req2.destroy(); reject(new Error('timeout')); });
        });
        const parsed = JSON.parse(data);
        res.json({ ok: true, online: true, stats: parsed });
    } catch(err) {
        res.json({ ok: true, online: false });
    }
});

// List available checkpoints
app.get('/api/comfyui/checkpoints', async (req, res) => {
    try {
        const http = require('http');
        const data = await new Promise((resolve, reject) => {
            http.get('http://localhost:8188/object_info/CheckpointLoaderSimple', resp => {
                let d = '';
                resp.on('data', chunk => d += chunk);
                resp.on('end', () => resolve(d));
            }).on('error', reject);
        });
        const parsed = JSON.parse(data);
        const checkpoints = parsed.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
        res.json({ ok: true, checkpoints });
    } catch(err) {
        res.json({ ok: true, checkpoints: [] });
    }
});

// ── Ruta principal ──────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── Iniciar servidor ────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🦟 PLAGA: La Descarada — Wiki + Admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📖 Wiki:   http://localhost:${PORT}`);
    console.log(`🔧 Admin:  http://localhost:${PORT}/admin.html`);
    console.log(`🌐 Red:    http://${getLocalIP()}:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

function getLocalIP() {
    const os = require('os');
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}
