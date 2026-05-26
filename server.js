const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Servir archivos estáticos de la wiki
app.use(express.static(path.join(__dirname)));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🦟 PLAGA: La Mascarada — Wiki`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📖 Wiki disponible en:`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Red:     http://${getLocalIP()}:${PORT}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
