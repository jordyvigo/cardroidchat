// index.js
require('dotenv').config();
const { Client, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------
// 1. Manejo de Sesión: Leer/guardar session.json
// -------------------------------------------------
const SESSION_FILE_PATH = './session.json';
let sessionData = null;

if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
  console.log('Sesión previa encontrada. Se usará para iniciar sin QR.');
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

// (A) Generar el QR en ASCII para vincular la sesión
client.on('qr', (qrCode) => {
  console.log('Se recibió un QR para vincular la sesión.');
  qrcodeTerminal.generate(qrCode, { small: true });
  console.log('Escanea el QR que aparece arriba en la consola con tu teléfono.');
});

// (B) Cuando se autentique, guardar la sesión en session.json
client.on('authenticated', (session) => {
  console.log('Bot autenticado correctamente. Guardando sesión...');
  try {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
    console.log('Sesión guardada exitosamente en session.json');
  } catch (err) {
    console.error('Error al guardar la sesión:', err);
  }
});

// (C) Manejar errores de autenticación
client.on('auth_failure', (msg) => {
  console.error('Error de autenticación:', msg);
});

// (D) Cuando el bot esté listo
client.on('ready', () => {
  console.log('WhatsApp Bot listo para recibir mensajes!');
});

// (E) Evento de mensaje entrante: si el mensaje es "oferta", enviar las promociones
client.on('message', async (message) => {
  console.log('Mensaje entrante:', message.body);
  
  if (message.body.trim().toLowerCase() === 'oferta') {
    console.log('Comando "oferta" recibido.');
    
    // Arreglo con las promociones: URL de imagen y descripción
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
    
    // Iterar sobre cada promoción y enviarla
    for (const promo of promociones) {
      try {
        const response = await axios.get(promo.url, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const mimeType = response.headers['content-type'];
        const media = new MessageMedia(mimeType, base64Image, 'promocion.png');
        
        await client.sendMessage(message.from, media, { caption: promo.descripcion });
        console.log('Oferta enviada con descripción:', promo.descripcion);
      } catch (error) {
        console.error('Error al enviar promoción:', error);
      }
    }
  }
});

// -------------------------------------------------
// 4. Inicializar el Cliente
// -------------------------------------------------
client.initialize();

// -------------------------------------------------
// 5. Servidor Express para mantener la aplicación activa
// -------------------------------------------------
app.get('/', (req, res) => {
  res.send('WhatsApp Bot está corriendo en Render.');
});

// Puedes agregar más endpoints si lo deseas
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
