require('dotenv').config();
const { Client, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Función para esperar ms milisegundos
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Manejo global de errores para evitar que el proceso se caiga
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// -------------------------------------------------
// 1. Conectar a MongoDB (base: ofertaclientes)
// -------------------------------------------------
mongoose.connect('mongodb+srv://jordyvigo:Gunbound2024@cardroid.crwia.mongodb.net/ofertaclientes?retryWrites=true&w=majority&appName=Cardroid', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB (ofertaclientes)');
}).catch(err => {
  console.error('Error conectando a MongoDB:', err);
});

// -------------------------------------------------
// 2. Definir esquema y modelo "Cliente" (colección: clientes)
// -------------------------------------------------
const clienteSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const Cliente = mongoose.model('Cliente', clienteSchema, 'clientes');

// -------------------------------------------------
// 3. Función para registrar el número del cliente
// -------------------------------------------------
async function registrarNumero(numeroWhatsApp) {
  const numeroLimpio = numeroWhatsApp.split('@')[0]; // Remueve "@c.us"
  let cliente = await Cliente.findOne({ numero: numeroLimpio });
  if (!cliente) {
    cliente = new Cliente({ numero: numeroLimpio });
    await cliente.save();
    console.log(`Número ${numeroLimpio} registrado en MongoDB (colección clientes).`);
  } else {
    console.log(`El número ${numeroLimpio} ya está registrado.`);
  }
}

// -------------------------------------------------
// 4. Manejo de Sesión: Leer/guardar session.json
// -------------------------------------------------
const SESSION_FILE_PATH = './session.json';
let sessionData = null;
if (fs.existsSync(SESSION_FILE_PATH)) {
  try {
    sessionData = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf8'));
    console.log('Sesión previa encontrada. Se usará para iniciar sin QR.');
  } catch (e) {
    console.error('Error al parsear session.json. Se requerirá escanear el QR nuevamente.', e);
    sessionData = null;
  }
} else {
  console.log('No se encontró sesión previa. Se requerirá escanear el QR la primera vez.');
}

// -------------------------------------------------
// 5. Configuración del Cliente de WhatsApp
// -------------------------------------------------
const client = new Client({
  puppeteer: {
    headless: true,
    // Si usas Google Chrome instalado en el sistema, descomenta la siguiente línea y ajústala:
    // executablePath: '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run'
    ]
  },
  session: sessionData
});

// -------------------------------------------------
// 6. Eventos del Cliente de WhatsApp
// -------------------------------------------------

// (A) Generar el QR en un archivo PNG y guardarlo
client.on('qr', async (qrCode) => {
  console.debug('Se recibió un QR para vincular la sesión.');
  try {
    await QRCode.toFile('whatsapp-qr.png', qrCode);
    console.debug('QR Code generado en "whatsapp-qr.png". Visita /qr para visualizarlo.');
  } catch (err) {
    console.error('Error al generar el QR:', err);
  }
});

// (B) Guardar la sesión al autenticarse
client.on('authenticated', (session) => {
  if (!session) {
    console.error('No se recibió información de sesión, no se guardará.');
    return;
  }
  console.debug('Bot autenticado correctamente. Guardando sesión...');
  try {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session, null, 2));
    console.debug('Sesión guardada exitosamente en session.json');
  } catch (err) {
    console.error('Error al guardar la sesión:', err);
  }
});

client.on('auth_failure', (msg) => {
  console.error('Error de autenticación:', msg);
});

client.on('ready', () => {
  console.debug('WhatsApp Bot listo para recibir mensajes!');
});

// (C) Evento de mensaje entrante: Si el mensaje es "oferta"
client.on('message', async (message) => {
  console.debug('Mensaje entrante:', message.body);

  if (message.body.trim().toLowerCase() === 'oferta') {
    console.debug('Comando "oferta" recibido.');

    // Enviar un saludo inicial
    await message.reply('¡Hola! Gracias por solicitar nuestras ofertas. Aquí tienes nuestras 6 promociones disponibles:');

    // Registrar el número en MongoDB
    registrarNumero(message.from).catch(err => console.error('Error al registrar número:', err));

    // Definir las 6 promociones
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

    // Enviar cada promoción con un delay de 1.5 segundos
    for (const promo of promociones) {
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
// 7. Inicializar el Cliente de WhatsApp
// -------------------------------------------------
client.initialize();

// -------------------------------------------------
// 8. Servidor Express para mantener la app activa
// -------------------------------------------------
app.get('/', (req, res) => {
  res.send('WhatsApp Bot está corriendo en Amazon Linux.');
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
