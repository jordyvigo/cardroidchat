// routes/whatsapp.js - Endpoints para operaciones de WhatsApp (como reiniciar la sesión)
const express = require('express');
const router = express.Router();
const client = require('../config/whatsapp');
const fs = require('fs');
const path = require('path');

router.get('/whatsapp/restart', async (req, res) => {
  try {
    console.log('Forzando reinicio de la sesión de WhatsApp...');
    if (client) {
      await client.destroy();
      console.log('Cliente destruido.');
    }
    const sessionPath = path.join(__dirname, '../.wwebjs_auth/cardroid-bot');
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log('Carpeta de sesión eliminada:', sessionPath);
    }
    // Re-inicializamos el cliente
    require('../config/whatsapp');
    res.send("Sesión reiniciada. Revisa /qr para escanear el nuevo código, si no se autogenera.");
  } catch (err) {
    console.error('Error reiniciando la sesión:', err);
    res.status(500).send("Error reiniciando la sesión");
  }
});

router.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, '../whatsapp-qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('El archivo QR no existe o aún no se ha generado.');
  }
});

module.exports = router;
