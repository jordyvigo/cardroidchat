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

// -------------------------------------------------
// 1. Manejo de Sesión: Leer/guardar session.json
// -------------------------------------------------
const SESSION_FILE_PATH = './session.json';
let sessionData = null;

if (fs.existsSync(SESSION_FILE_PATH)) {
  try {
    sessionData = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf8'));
    console.log('Sesión previa encontrada. Se usará para iniciar sin QR.');
  } catch (e) {
    console.error('Error al parsear session.json. Se requerirá escanear el QR nuevamente.');
    sessionData = null;
  }
} else {
  console.log('No se encontró sesión previa. Se requerirá escanear el QR la primera vez.');
}

// -------------------------------------------------
// 2. Configuración del Cliente de WhatsApp
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
    // En Render normalmente no es necesario especificar executablePath
  },
  session: sessionData
});

// -------------------------------------------------
// 3. Eventos del Cliente de WhatsApp
// -------------------------------------------------

// (A) Cuando se reciba un QR, generar un archivo PNG y guardarlo
client.on('qr', async (qrCode) => {
  console.log('Se recibió un QR para vincular la sesión.');
  try {
    await QRCode.toFile('whatsapp-qr.png', qrCode);
    console.log('QR Code generado en "whatsapp-qr.png". Visita /qr para visualizarlo.');
  } catch (err) {
    console.error('Error al generar el QR:', err);
  }
});

// (B) Cuando se autentique, guardar la sesión en session.json (solo si se recibe el objeto de sesión)
client.on('authenticated', (session) => {
  if (!session) {
    console.error('No se recibió información de sesión, no se guardará.');
    return;
  }
  console.log('Bot autenticado correctamente. Guardando sesión...');
  try {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session, null, 2));
    console.log('Sesión guardada exitosamente en session.json');
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

// (C) Al recibir un mensaje, si es "oferta", enviar las promociones
client.on('message', async (message) => {
  console.log('Mensaje entrante:', message.body);

  if (message.body.trim().toLowerCase() === 'oferta') {
    console.log('Comando "oferta" recibido.');
    
    // Array de promociones con imagen y descripción
    const promociones = [
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1739505408/2_by377e.png',
        descripcion: 'Mejora la seguridad de tu vehiculo con nuestra alarma con bluetooth, puedes activar y desactivar la alarma desde tu celular. Incluye dos llaveros, instalación incluida.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1739505406/1_ipwvpm.png',
        descripcion: 'Evita que se lleven tu vehiculo. Nuestro trabagas apaga tu vehiculo al alejar el sensor, aunque la llave se encuentre dentro del auto. Precio incluye instalacion y garantia.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1739505402/3_y3nwmb.png',
        descripcion: 'Vigila tu auto desde cualquier lugar con nuestro GPS con aplicativo, puedes apagar el vehículo, ver su recorrido diario y ubicación en tiempo real. Precio incluye instalación.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1739505401/6_cq7qsl.png',
        descripcion: 'Mejora el audio de tu vehículo y estremece al resto con la potencia de nuestro amplificador.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1739505396/5_cxtaft.png',
        descripcion: 'Añade entretenimiento a tu vehículo con nuestra pantalla android, puedes ver YouTube, Netflix, TV en vivo y estacionarte con mayor facilidad con la camara de 170° HD. Precio incluye instalación y garantia.'
      },
      {
        url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1739505395/4_rv930u.png',
        descripcion: 'Mejora la calidad de sonido con nuestra oferta irrepetible en parlantes pioneer. Precio incluye instalacion y garantía.'
      }
    ];

    for (const promo of promociones) {
      try {
        const response = await axios.get(promo.url, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const mimeType = response.headers['content-type'];
        const media = new MessageMedia(mimeType, base64Image, 'promocion.png');
        await client.sendMessage(message.from, media, { caption: promo.descripcion });
        console.log('Oferta enviada:', promo.descripcion);
      } catch (error) {
        console.error('Error al enviar promoción:', error);
      }
    }
  }
});

// -------------------------------------------------
// 4. Inicializar el Cliente de WhatsApp
// -------------------------------------------------
client.initialize();

// -------------------------------------------------
// 5. Servidor Express para mantener la app activa en Render
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
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
