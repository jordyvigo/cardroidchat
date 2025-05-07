// config/whatsapp.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
// Importar modelo para publifinanciamiento
const Publifinanciamiento = require('../models/Publifinanciamiento');

// Configuración del cliente
const client = new Client({
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

// Evento QR
client.on('qr', async qrCode => {
  console.debug('QR recibido.');
  try {
    const qrPath = path.join(__dirname, '../whatsapp-qr.png');
    await QRCode.toFile(qrPath, qrCode);
    console.debug('QR generado en "whatsapp-qr.png".');
  } catch (err) {
    console.error('Error generando QR:', err);
  }
});

// Cliente listo
client.on('ready', () => {
  console.debug('WhatsApp Bot listo para recibir mensajes!');
});

// Error autenticación
client.on('auth_failure', msg => console.error('Error de autenticación:', msg));

// Escucha de mensajes: guardar interesados en financiamiento
client.on('message', async msg => {
  try {
    const text = msg.body.trim().toLowerCase();
    // Detectar mensajes que incluyan "deseo" y "financiamiento"
    if (text.includes('deseo') && text.includes('financiamiento')) {
      const phoneRaw = msg.from; // ej: "51987654321@c.us"
      const numero = phoneRaw.replace(/@c\.us$/, '');
      // Evitar duplicados
      const existing = await Publifinanciamiento.findOne({ numero });
      if (!existing) {
        await Publifinanciamiento.create({ numero, mensaje: msg.body, createdAt: new Date() });
        console.log(`Cliente ${numero} agregado a publifinanciamiento.`);
        // Reaccionar con emoji de ojos de dólar
        await msg.react('🤑');
        // Respuesta carismática con énfasis en ventas
        await msg.reply(
          '¡Hola! 🎉 Gracias por tu interés en nuestro financiamiento. ' +
          'En breve te enviaremos más detalles y muy pronto disfrutarás de nuestras ofertas exclusivas. ' +
          '¡Permanece atento a nuestras novedades!'
        );
      } else {
        console.log(`Cliente ${numero} ya registrado en publifinanciamiento.`);
      }
    }
  } catch (error) {
    console.error('Error procesando mensaje para publifinanciamiento:', error);
  }
});

// Inicialización del cliente
client.initialize();

// Función para enviar un mensaje de texto
async function sendWhatsAppMessage(to, message) {
  if (!client.info) throw new Error('El cliente no está listo, espere a que se autentique.');
  const formatted = to.includes('@c.us') ? to : `${to}@c.us`;
  return client.sendMessage(formatted, message);
}

// Función para enviar media con caption
async function sendWhatsAppMedia(to, imageUrl, caption) {
  if (!client.info) throw new Error('El cliente no está listo, espere a que se autentique.');
  const formatted = to.includes('@c.us') ? to : `${to}@c.us`;
  const media = await MessageMedia.fromUrl(imageUrl);
  return client.sendMessage(formatted, media, { caption });
}

module.exports = {
  client,
  sendWhatsAppMessage,
  sendWhatsAppMedia
};
