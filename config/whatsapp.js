// config/whatsapp.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');

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

// Manejo del evento QR
client.on('qr', async (qrCode) => {
  console.debug('QR recibido.');
  try {
    const qrPath = path.join(__dirname, '../whatsapp-qr.png');
    await QRCode.toFile(qrPath, qrCode);
    console.debug('QR generado en "whatsapp-qr.png".');
  } catch (err) {
    console.error('Error generando QR:', err);
  }
});

// Evento cuando el cliente está listo
client.on('ready', () => {
  console.debug('WhatsApp Bot listo para recibir mensajes!');
});

// Captura de errores de autenticación
client.on('auth_failure', msg => console.error('Error de autenticación:', msg));

// Inicialización del cliente
client.initialize();

// Función para enviar un mensaje de texto
async function sendWhatsAppMessage(to, message) {
  // Validamos que el cliente esté listo (client.info se establece cuando el cliente ha iniciado sesión correctamente)
  if (!client.info) {
    throw new Error("El cliente no está listo, espere a que se autentique.");
  }
  // Asegurarse de que el número tenga el sufijo '@c.us'
  const formattedTo = to.includes('@c.us') ? to : `${to}@c.us`;
  return client.sendMessage(formattedTo, message);
}

// Función para enviar una imagen con caption
async function sendWhatsAppMedia(to, imageUrl, caption) {
  if (!client.info) {
    throw new Error("El cliente no está listo, espere a que se autentique.");
  }
  const formattedTo = to.includes('@c.us') ? to : `${to}@c.us`;
  // Descarga el medio desde la URL y luego lo envía
  const media = await MessageMedia.fromUrl(imageUrl);
  return client.sendMessage(formattedTo, media, { caption });
}

// Exportamos el cliente y las funciones para que puedan ser usadas en otros módulos
module.exports = {
  client,
  sendWhatsAppMessage,
  sendWhatsAppMedia
};
