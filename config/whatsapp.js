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
  if (!client.info) {
    throw new Error("El cliente no está listo, espere a que se autentique.");
  }
  const formattedTo = to.includes('@c.us') ? to : `${to}@c.us`;
  return client.sendMessage(formattedTo, message);
}

// Función para enviar una imagen con caption
async function sendWhatsAppMedia(to, imageUrl, caption) {
  if (!client.info) {
    throw new Error("El cliente no está listo, espere a que se autentique.");
  }
  const formattedTo = to.includes('@c.us') ? to : `${to}@c.us`;
  const media = await MessageMedia.fromUrl(imageUrl);
  return client.sendMessage(formattedTo, media, { caption });
}

// Evento para detectar mensajes y registrar clientes en "publifinanciamiento" si el mensaje contiene ambas palabras "deseo" y "financiamiento"
client.on('message', async (msg) => {
  try {
    // Convertimos el mensaje a minúsculas para una comparación sin distinguir mayúsculas
    const text = msg.body.toLowerCase();
    // Verificamos que el mensaje contenga "deseo" y "financiamiento" en cualquier parte
    if (text.includes('deseo') && text.includes('financiamiento')) {
      // Importar el modelo Publifinanciamiento
      const Publifinanciamiento = require('../models/Publifinanciamiento');
      // msg.from contiene el identificador del contacto, ej.: "51987654321@c.us"
      const phone = msg.from;
      
      // Verifica si el cliente ya existe en la colección publifinanciamiento
      const existingEntry = await Publifinanciamiento.findOne({ numero: phone });
      if (!existingEntry) {
        await Publifinanciamiento.create({ numero: phone, createdAt: new Date() });
        console.log(`Cliente ${phone} agregado a publifinanciamiento.`);
        // Responder al cliente para confirmar la recepción de su interés
        await msg.reply("Gracias por tu interés en nuestro financiamiento. Pronto recibirás más promociones.");
      } else {
        console.log(`Cliente ${phone} ya se encuentra registrado en publifinanciamiento.`);
      }
    }
  } catch (error) {
    console.error("Error procesando mensaje para publifinanciamiento:", error);
  }
});

module.exports = {
  client,
  sendWhatsAppMessage,
  sendWhatsAppMedia
};
