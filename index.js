// index.js
require('dotenv').config();
const { Client, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Función para esperar ms milisegundos
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Manejo global de errores
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// -------------------------------------------------
// Configuración del Cliente de WhatsApp (sin sesión)
// -------------------------------------------------
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
  }
});

// -------------------------------------------------
// Eventos del Cliente de WhatsApp
// -------------------------------------------------

// (A) Cuando se reciba un QR, generar el archivo PNG y mostrarlo
client.on('qr', async (qrCode) => {
  console.debug('Se recibió un QR para vincular la sesión.');
  try {
    await QRCode.toFile('whatsapp-qr.png', qrCode);
    console.debug('QR Code generado en "whatsapp-qr.png". Visita /qr para visualizarlo.');
  } catch (err) {
    console.error('Error al generar el QR:', err);
  }
});

// (B) Eventos de autenticación y conexión
client.on('authenticated', (session) => {
  console.debug('Bot autenticado correctamente (sin guardar sesión).');
});
client.on('auth_failure', (msg) => {
  console.error('Error de autenticación:', msg);
});
client.on('ready', () => {
  console.debug('WhatsApp Bot listo para recibir mensajes!');
});

// (C) Evento de mensaje entrante: Si el mensaje es "oferta", enviar promociones
client.on('message', async (message) => {
  console.debug('Mensaje entrante:', message.body);

  if (message.body.trim().toLowerCase() === 'oferta') {
    console.debug('Comando "oferta" recibido.');
    
    const promociones = [
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1739505408/2_by377e.png',
        descripcion: 'Mejora la seguridad de tu vehículo con nuestra alarma con bluetooth. Actívala desde tu celular. Incluye dos llaveros e instalación.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1739505406/1_ipwvpm.png',
        descripcion: 'Evita que se lleven tu vehículo. Nuestro trabagas apaga tu vehículo al alejar el sensor, aunque la llave se encuentre dentro. Instalación y garantía incluidas.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1739505402/3_y3nwmb.png',
        descripcion: 'Vigila tu auto desde cualquier lugar con nuestro GPS con aplicativo. Apaga el vehículo, visualiza recorridos diarios y más. Instalación incluida.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1739505401/6_cq7qsl.png',
        descripcion: 'Potencia el audio de tu vehículo con nuestro amplificador, para un sonido que impacta.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1739505396/5_cxtaft.png',
        descripcion: 'Añade entretenimiento a tu vehículo con nuestra pantalla Android: YouTube, Netflix, TV en vivo y cámara HD de 170°. Instalación y garantía incluidas.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1739505395/4_rv930u.png',
        descripcion: 'Disfruta de un sonido inigualable con nuestros parlantes Pioneer. Instalación y garantía incluidas.'
      }
    ];

    // Función para seleccionar aleatoriamente 3 promociones
    function getRandomPromos(promos, count) {
      const shuffled = promos.slice().sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    }
    
    const promocionesSeleccionadas = getRandomPromos(promociones, 4);
    console.debug('Promociones seleccionadas:', promocionesSeleccionadas);

    // Enviar cada promoción con un delay de 1.5 segundos
    for (const promo of promocionesSeleccionadas) {
      try {
        console.debug('Procesando promoción:', promo.descripcion);
        const response = await axios.get(promo.url, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const mimeType = response.headers['content-type'];
        const media = new MessageMedia(mimeType, base64Image, 'promocion.png');
        
        await client.sendMessage(message.from, media, { caption: promo.descripcion });
        console.debug('Oferta enviada:', promo.descripcion);
        await sleep(1500);
      } catch (error) {
        console.error('Error al enviar promoción:', error);
      }
    }
  }
});

// -------------------------------------------------
// Inicializar el Cliente de WhatsApp
// -------------------------------------------------
client.initialize();

// -------------------------------------------------
// Servidor Express para mantener la app activa en Render
// -------------------------------------------------
app.get('/', (req, res) => {
  res.send('WhatsApp Bot está corriendo en Render.');
});

// Endpoint para visualizar el QR (archivo PNG)
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'whatsapp-qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('El archivo QR no existe o aún no se ha generado.');
  }
});

app.listen(PORT, () => {
  console.debug(`Servidor corriendo en el puerto ${PORT}`);
});
