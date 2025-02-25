require('dotenv').config();
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
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

// Manejo global de errores
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
  createdAt: { type: Date, default: Date.now },
  lastInteraction: { type: Date }
});
const Cliente = mongoose.model('Cliente', clienteSchema, 'clientes');

// -------------------------------------------------
// 3. Función para registrar el número del cliente y actualizar la última interacción
// -------------------------------------------------
async function registrarNumero(numeroWhatsApp) {
  const numeroLimpio = numeroWhatsApp.split('@')[0];
  let cliente = await Cliente.findOneAndUpdate(
    { numero: numeroLimpio },
    { $set: { lastInteraction: new Date() } },
    { new: true }
  );
  if (!cliente) {
    cliente = new Cliente({ numero: numeroLimpio, lastInteraction: new Date() });
    await cliente.save();
    console.log(`Número ${numeroLimpio} registrado en MongoDB (colección clientes).`);
  } else {
    console.log(`El número ${numeroLimpio} ya está registrado. Última interacción actualizada.`);
  }
}

// -------------------------------------------------
// 4. Configuración del Cliente de WhatsApp con LocalAuth para guardar la sesión automáticamente
// -------------------------------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'cardroid-bot' }),
  puppeteer: {
    headless: true,
    // Si usas Google Chrome instalado en el sistema, descomenta la siguiente línea:
    // executablePath: '/usr/bin/google-chrome-stable',
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
// 5. Eventos del Cliente de WhatsApp
// -------------------------------------------------

// (A) Al recibir un QR, generar el archivo PNG para visualizarlo
client.on('qr', async (qrCode) => {
  console.debug('Se recibió un QR para vincular la sesión.');
  try {
    await QRCode.toFile('whatsapp-qr.png', qrCode);
    console.debug('QR Code generado en "whatsapp-qr.png". Visita /qr para visualizarlo.');
  } catch (err) {
    console.error('Error al generar el QR:', err);
  }
});

client.on('ready', () => {
  console.debug('WhatsApp Bot listo para recibir mensajes!');
});

client.on('auth_failure', (msg) => {
  console.error('Error de autenticación:', msg);
});

// -------------------------------------------------
// 6. Gestión de estado para ofertas por usuario
// -------------------------------------------------
const userOfferState = {};

// -------------------------------------------------
// 7. Evento de mensaje entrante
// -------------------------------------------------
client.on('message', async (message) => {
  console.debug('Mensaje entrante:', message.body);
  
  // Condición: Si el mensaje empieza con "oferta" o "ofertas" (ignora mayúsculas y posibles textos adicionales)
  const msgText = message.body.trim().toLowerCase();
  if (msgText.startsWith('oferta')) {
    // Reaccionar con un emoji de dinero (para ofertas)
    try {
      await message.react('🤑');
    } catch (err) {
      console.error('Error al reaccionar al mensaje:', err);
    }
    
    console.debug('Comando "oferta" recibido.');

    // Actualizar la última interacción del cliente
    registrarNumero(message.from).catch(err => console.error('Error al registrar número:', err));

    // Si es la primera solicitud para este usuario
    if (!userOfferState[message.from]) {
      // Enviar saludo y 8 ofertas iniciales
      await message.reply('¡Hola! Gracias por solicitar nuestras ofertas. Aquí tienes nuestras 8 promociones iniciales:');

      // Definir las 16 promociones con sus URLs optimizadas y descripciones
      const promociones = [
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087453/ELEVALUNAS_cjhixl.png',
          descripcion: 'Convierte tu sistema de elevación de lunas manual en uno eléctrico, moderniza tu vehículo ¡YA!'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087454/EXPLORADORAS_floky9.png',
          descripcion: 'Mejora la iluminación de tus caminos con nuestras exploradoras led en dos colores de luz: ámbar y amarillo.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087457/ALARMA_hdlqjr.png',
          descripcion: 'Añádele seguridad a tu vehículo, con nuestra alarma que te alerta de golpes, apertura de puertas y encendido de motor. Precio con instalación.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087457/GPS_qk32bj.png',
          descripcion: 'Hazle seguimiento a tu vehículo en todo momento con nuestro GPS con APP, mira historial diario, recorrido en tiempo real y apaga el motor directamente desde tu celular.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087458/LUZPARRILLA_q0f2mm.png',
          descripcion: 'Mejora la estética frontal de tu vehículo instalándole nuestras luces de parrilla, compatibles con todos los vehículos.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087458/HERTDIECI_awp2kw.png',
          descripcion: 'Dale calidad italiana al audio de tu vehículo con nuestros componentes hertz, aprovecha la oferta exclusiva.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087461/LEDS_dsgvre.png',
          descripcion: 'Mejora la iluminación de tus faros actuales con nuestros leds de alta gama, precio incluye instalación.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/q_auto,f_auto,w_800/v1740087461/LUZCAPOT_gnujh5.png',
          descripcion: 'Haz lucir mejor a tu vehículo con las luces sobre el capot LED. Dale presencia en las calles.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087462/PIONEER_pyhajk.png',
          descripcion: 'Mejora el sonido de tu auto con nuestros parlantes Pioneer en oferta.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087463/MIXTRACK_smuvbl.png',
          descripcion: 'Aprovecha la oferta para mejorar los parlantes en tu vehículo.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087465/SIRENARETRO_isdrjd.png',
          descripcion: 'Añádele seguridad a tu retroceso con la sirena de retro, que avisará a todos que estás retrocediendo.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087466/RADIO_av6qls.png',
          descripcion: 'Añade entretenimiento a tu vehículo con nuestras radios con YouTube, Netflix, TV en vivo y más. Incluye cámara de retroceso e instalación.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087466/TRABAGAS_qla6af.png',
          descripcion: 'Haz que tu vehículo se apague al bajarte, con nuestro trabagas. Precio incluye instalación.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087466/RADIOCONSOLA_wr2ndh.png',
          descripcion: 'Mejora el entretenimiento de tu auto y dale estética a tu tablero, con nuestra radio android con máscara de encaje exacto para tu vehículo.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087466/FAROSFORCE_wicpqc.png',
          descripcion: 'Triplica la potencia de tus luces actuales con nuestros faros force de 7 pulgadas, originales y resistentes al agua.'
        },
        {
          url: 'https://res.cloudinary.com/do1ryjvol/image/upload/v1740087467/MINIFORCE_gm6j8t.png',
          descripcion: 'Mejora la iluminación de tu auto con nuestros faros mini force, compatibles con cualquier vehículo.'
        }
      ];

      // Función para seleccionar aleatoriamente 8 promociones
      function getRandomPromos(promos, count) {
        const shuffled = promos.slice().sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      }
      const firstBatch = getRandomPromos(promociones, 8);
      const remainingBatch = promociones.filter(promo => !firstBatch.includes(promo));

      // Guardamos el estado de este usuario e iniciamos un timeout de seguimiento de 10 minutos (600,000 ms)
      userOfferState[message.from] = {
        requestCount: 1,
        firstOffers: firstBatch,
        remainingOffers: remainingBatch,
        timeout: setTimeout(async () => {
          // Si el usuario no envía otra solicitud en 10 minutos, enviar mensaje de seguimiento
          if (userOfferState[message.from] && userOfferState[message.from].requestCount === 1) {
            await client.sendMessage(message.from, '¿Podrías mencionarme para qué modelo y año de auto deseas los productos?');
          }
        }, 10 * 60 * 1000)
      };

      for (const promo of firstBatch) {
        try {
          console.debug('Procesando promoción:', promo.descripcion);
          const response = await axios.get(promo.url, { responseType: 'arraybuffer' });
          const base64Image = Buffer.from(response.data, 'binary').toString('base64');
          const mimeType = response.headers['content-type'];
          const media = new MessageMedia(mimeType, base64Image, 'promocion.png');
          
          await client.sendMessage(message.from, media, { caption: promo.descripcion });
          console.debug('Oferta enviada:', promo.descripcion);
          await sleep(2000);
        } catch (error) {
          console.error('Error al enviar promoción:', error);
        }
      }
      await message.reply('Si deseas ver más ofertas, escribe "oferta" otra vez.');
    } else if (userOfferState[message.from].requestCount === 1) {
      // Si se envía "oferta" por segunda vez, cancelar el timeout de seguimiento
      if (userOfferState[message.from].timeout) {
        clearTimeout(userOfferState[message.from].timeout);
      }
      // Segunda solicitud: enviar las ofertas restantes
      const remaining = userOfferState[message.from].remainingOffers;
      userOfferState[message.from].requestCount = 2;
      await message.reply('Aquí tienes más ofertas:');
      for (const promo of remaining) {
        try {
          console.debug('Procesando promoción restante:', promo.descripcion);
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
    } else {
      await message.reply('Ya te hemos enviado todas las ofertas disponibles.');
      // Reiniciar el estado para permitir un nuevo ciclo
      delete userOfferState[message.from];
    }
  }
});

// -------------------------------------------------
// 8. Inicializar el Cliente de WhatsApp
// -------------------------------------------------
client.initialize();

// -------------------------------------------------
// 9. Servidor Express para mantener la app activa
// -------------------------------------------------
app.get('/', (req, res) => {
  res.send('WhatsApp Bot está corriendo en Amazon Linux.');
});

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
