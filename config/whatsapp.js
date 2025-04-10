// config/whatsapp.js - Inicialización del cliente de WhatsApp
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

let client;

function createWhatsAppClient() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'cardroid-bot' }),
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
    }
  });

  client.on('qr', async (qrCode) => {
    console.log('QR recibido, generando archivo QR...');
    try {
      await QRCode.toFile('whatsapp-qr.png', qrCode);
      console.log('QR generado en "whatsapp-qr.png".');
    } catch (err) {
      console.error('Error generando QR:', err);
    }
  });

  client.on('ready', () => {
    console.log('WhatsApp Bot listo para recibir mensajes!');
  });

  client.on('auth_failure', msg => console.error('Error de autenticación:', msg));

  client.initialize();
  return client;
}

client = createWhatsAppClient();
module.exports = client;
