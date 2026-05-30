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
