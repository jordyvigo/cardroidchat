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
// 3. Definir esquema y modelo para Interacciones (colección: interacciones)
// -------------------------------------------------
const interaccionSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  tipo: { type: String }, // Ej: "solicitudOferta", "solicitudInfo"
  mensaje: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Interaccion = mongoose.model('Interaccion', interaccionSchema, 'interacciones');

// Función para registrar interacciones
async function registrarInteraccion(numero, tipo, mensaje) {
  const interaccion = new Interaccion({ numero, tipo, mensaje });
  await interaccion.save();
  console.log(`Interacción registrada: ${numero} - ${tipo}`);
}

// -------------------------------------------------
// 4. Función para registrar el número del cliente y actualizar la última interacción
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
// 5. Configuración del Cliente de WhatsApp usando LocalAuth
// -------------------------------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'cardroid-bot' }),
  puppeteer: {
    headless: true,
    // Si usas Google Chrome instalado, descomenta y ajusta:
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
// 6. Eventos del Cliente de WhatsApp
// -------------------------------------------------

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
// 7. Gestión de estado para ofertas por usuario
// -------------------------------------------------
const userOfferState = {};

// -------------------------------------------------
// 8. Evento de mensaje entrante: procesamiento de ofertas
// -------------------------------------------------
client.on('message', async (message) => {
  console.debug('Mensaje entrante:', message.body);
  const msgText = message.body.trim().toLowerCase();
  
  // Si el mensaje comienza con "oferta" o "ofertas"
  if (msgText.startsWith('oferta')) {
    // Registrar interacción de solicitud de oferta
    registrarInteraccion(message.from.split('@')[0], 'solicitudOferta', message.body).catch(err => console.error(err));
    
    // Reaccionar con un emoji sugerente de oferta (dinero con cara)
    try {
      await message.react('🤑');
    } catch (err) {
      console.error('Error al reaccionar al mensaje:', err);
    }
    
    // Si no existe estado para este usuario, es la primera solicitud.
    if (!userOfferState[message.from]) {
      await message.reply('¡Hola! Gracias por solicitar nuestras ofertas. Aquí tienes nuestras 8 promociones iniciales:');
      registrarNumero(message.from).catch(err => console.error('Error al registrar número:', err));
      
      // Definir las 16 promociones con URLs optimizadas y descripciones
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

      // Seleccionar aleatoriamente 8 promociones para la primera tanda
      function getRandomPromos(promos, count) {
        const shuffled = promos.slice().sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      }
      const firstBatch = getRandomPromos(promociones, 8);
      const remainingBatch = promociones.filter(promo => !firstBatch.includes(promo));

      // Guardar estado para este usuario y establecer timeout de seguimiento (10 minutos)
      userOfferState[message.from] = {
        requestCount: 1,
        firstOffers: firstBatch,
        remainingOffers: remainingBatch,
        timeout: setTimeout(async () => {
          if (userOfferState[message.from] && userOfferState[message.from].requestCount === 1) {
            await client.sendMessage(message.from, '¿Podrías mencionarme para qué modelo y año de auto deseas los productos?');
          }
        }, 10 * 60 * 1000)
      };

      // Enviar las 8 ofertas iniciales
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
      // Segunda solicitud: enviar las ofertas restantes y cancelar timeout
      if (userOfferState[message.from].timeout) {
        clearTimeout(userOfferState[message.from].timeout);
      }
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
// 9. Inicializar el Cliente de WhatsApp
// -------------------------------------------------
client.initialize();

// -------------------------------------------------
// 10. Servidor Express para mantener la app activa y mostrar el CRM
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

// CRM Dashboard
app.get('/crm', async (req, res) => {
  try {
    const totalClientes = await Cliente.countDocuments({});
    const totalOfertasSolicitadas = await Interaccion.countDocuments({ tipo: "solicitudOferta" });
    const totalSolicitudesInfo = await Interaccion.countDocuments({ tipo: "solicitudInfo" });
    const html = `
      <html>
        <head>
          <title>CRM Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .stat { margin-bottom: 10px; }
            button { padding: 10px 20px; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>CRM Dashboard</h1>
          <div class="stat">Número de clientes registrados: ${totalClientes}</div>
          <div class="stat">Solicitudes de oferta: ${totalOfertasSolicitadas}</div>
          <div class="stat">Solicitudes de más información: ${totalSolicitudesInfo}</div>
          <button onclick="location.href='/crm/send-offers'">Enviar Oferta a Todos</button>
        </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send('Error generando el dashboard');
  }
});

// Endpoint para enviar un mensaje de oferta a todos los clientes
app.get('/crm/send-offers', async (req, res) => {
  try {
    const clientes = await Cliente.find({});
    for (let cliente of clientes) {
      await client.sendMessage(`${cliente.numero}@c.us`, 'Oferta especial del mes: ¡No te la pierdas!');
      await sleep(500);
    }
    res.send('Ofertas enviadas a todos los clientes.');
  } catch (err) {
    res.status(500).send('Error enviando ofertas a todos los clientes');
  }
});

app.listen(PORT, () => {
  console.debug(`Servidor corriendo en el puerto ${PORT}`);
});
