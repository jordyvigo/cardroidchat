require('dotenv').config();
const { Client, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const qr = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Manejo de Sesión en session.json
const SESSION_FILE_PATH = './session.json';
let sessionData = null;

if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
  console.log('Sesión previa encontrada. Se usará para iniciar sin QR.');
} else {
  console.log('No se encontró sesión previa. Se requerirá escanear el QR la primera vez.');
}

// 2. Configurar el cliente de WhatsApp
const client = new Client({
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run'
    ]
    // Render suele traer su propio Chromium, no necesitas "executablePath"
  },
  session: sessionData
});

// 3. Eventos del Cliente
client.on('qr', async (qrCode) => {
  console.log('Se recibió un QR para vincular la sesión.');
  try {
    await qr.toFile('whatsapp-qr.png', qrCode);
    console.log('QR Code generado en "whatsapp-qr.png". Escanéalo con tu teléfono.');
  } catch (err) {
    console.error('Error al generar QR:', err);
  }
});

client.on('authenticated', (session) => {
  console.log('Bot autenticado correctamente. Guardando sesión...');
  try {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
    console.log('Sesión guardada exitosamente.');
  } catch (err) {
    console.error('Error al guardar la sesión:', err);
  }
});

client.on('auth_failure', (msg) => {
  console.error('Error de autenticación:', msg);
});

client.on('ready', () => {
  console.log('WhatsApp Bot listo para recibir mensajes!');
});

client.on('message', async (message) => {
  console.log('Mensaje entrante:', message.body);

  if (message.body.trim().toLowerCase() === 'oferta') {
    console.log('Comando "oferta" recibido.');
    const url = 'https://res.cloudinary.com/do1ryjvol/image/upload/v1739475042/1_serugi.png';
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(response.data, 'binary').toString('base64');
      const mimeType = response.headers['content-type'];
      const media = new MessageMedia(mimeType, base64Image, 'promocion.png');
      await client.sendMessage(message.from, media, { caption: 'Aquí te envío nuestras promociones disponibles' });
      console.log('Oferta enviada correctamente.');
    } catch (error) {
      console.error('Error al enviar imagen de promoción:', error);
    }
  }
});

// 4. Inicializar el Cliente
client.initialize();

// 5. Servidor Express para Render
app.get('/', (req, res) => {
  res.send('WhatsApp Bot está corriendo en Render.');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
