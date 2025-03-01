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
// 2. Modelo "Cliente" (colección: clientes)
// -------------------------------------------------
const clienteSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastInteraction: { type: Date }
});
const Cliente = mongoose.model('Cliente', clienteSchema, 'clientes');

// -------------------------------------------------
// 3. Modelo para Interacciones (colección: interacciones)
// -------------------------------------------------
const interaccionSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  tipo: { type: String }, // Ej: "solicitudOferta", "respuestaOferta", "solicitudInfo", "ofertaMasiva"
  mensaje: { type: String },
  ofertaReferencia: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Interaccion = mongoose.model('Interaccion', interaccionSchema, 'interacciones');

async function registrarInteraccion(numero, tipo, mensaje, ofertaReferencia = null) {
  const interaccion = new Interaccion({ numero, tipo, mensaje, ofertaReferencia });
  await interaccion.save();
  console.log(`Interacción registrada para ${numero}: ${tipo}`);
}

// -------------------------------------------------
// 4. Función para registrar el número del cliente y actualizar última interacción
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
    console.log(`Número ${numeroLimpio} registrado en MongoDB (clientes).`);
  } else {
    console.log(`Número ${numeroLimpio} actualizado (última interacción).`);
  }
}

// -------------------------------------------------
// 5. Configuración del Cliente de WhatsApp usando LocalAuth
// -------------------------------------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'cardroid-bot' }),
  puppeteer: {
    headless: true,
    // Descomenta la siguiente línea si deseas usar Chrome instalado:
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
  console.debug('QR recibido.');
  try {
    await QRCode.toFile('whatsapp-qr.png', qrCode);
    console.debug('QR generado en "whatsapp-qr.png".');
  } catch (err) {
    console.error('Error generando QR:', err);
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

// Función para cargar ofertas desde "offers.json"
function cargarOfertas() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'offers.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error al cargar ofertas:', err);
    return [];
  }
}

// Función para particionar ofertas usando índices
function particionarOfertas(ofertas, count) {
  const indices = Array.from({ length: ofertas.length }, (_, i) => i);
  let selectedIndices = [];
  while (selectedIndices.length < count && indices.length > 0) {
    const randomIndex = Math.floor(Math.random() * indices.length);
    selectedIndices.push(indices[randomIndex]);
    indices.splice(randomIndex, 1);
  }
  const firstBatch = selectedIndices.map(i => ofertas[i]);
  const remainingBatch = ofertas.filter((_, i) => !selectedIndices.includes(i));
  return { firstBatch, remainingBatch };
}

// -------------------------------------------------
// 8. Evento de mensaje entrante: procesamiento de "oferta" y "marzo"
// -------------------------------------------------
client.on('message', async (message) => {
  // Convertir a minúsculas para comparación sin importar mayúsculas/minúsculas
  const msgText = message.body.trim().toLowerCase();
  console.debug('Mensaje entrante:', message.body);

  // Flujo para el mensaje inicial "oferta"
  if (msgText === 'oferta') {
    await registrarInteraccion(message.from.split('@')[0], 'solicitudOferta', message.body);
    try {
      await message.react('🤑');
    } catch (err) {
      console.error('Error al reaccionar:', err);
    }
    registrarNumero(message.from).catch(err => console.error(err));
    
    if (!userOfferState[message.from]) {
      await message.reply('¡Hola! Aquí tienes nuestras 8 promociones iniciales:');
      
      const ofertas = cargarOfertas();
      if (ofertas.length === 0) {
        await message.reply('Actualmente no hay ofertas disponibles.');
        return;
      }
      
      const { firstBatch, remainingBatch } = particionarOfertas(ofertas, 8);
      
      // Establecer timeout de seguimiento de 10 minutos
      userOfferState[message.from] = {
        requestCount: 1,
        firstOffers: firstBatch,
        remainingOffers: remainingBatch,
        timeout: setTimeout(async () => {
          if (userOfferState[message.from] && userOfferState[message.from].remainingOffers.length > 0) {
            await client.sendMessage(message.from, '¿Podrías mencionarme para qué modelo y año de auto deseas los productos?');
            await registrarInteraccion(message.from.split('@')[0], 'solicitudInfo', 'Seguimiento: falta información del modelo y año');
          }
        }, 10 * 60 * 1000)
      };
      
      for (const promo of firstBatch) {
        try {
          const response = await axios.get(promo.url, { responseType: 'arraybuffer' });
          const base64Image = Buffer.from(response.data, 'binary').toString('base64');
          const mimeType = response.headers['content-type'];
          const media = new MessageMedia(mimeType, base64Image, 'oferta.png');
          await client.sendMessage(message.from, media, { caption: promo.descripcion });
          await sleep(2000);
        } catch (error) {
          console.error('Error al enviar oferta:', error);
        }
      }
      await message.reply('Si deseas ver más ofertas, escribe "marzo".');
    }
  }
  // Flujo para el mensaje "marzo"
  else if (msgText === 'marzo') {
    if (userOfferState[message.from] && userOfferState[message.from].remainingOffers && userOfferState[message.from].remainingOffers.length > 0) {
      if (userOfferState[message.from].timeout) {
        clearTimeout(userOfferState[message.from].timeout);
      }
      console.debug("Remaining offers count:", userOfferState[message.from].remainingOffers.length);
      await message.reply('Aquí tienes más ofertas:');
      const offersToSend = userOfferState[message.from].remainingOffers.slice(0, 8);
      for (const promo of offersToSend) {
        try {
          const response = await axios.get(promo.url, { responseType: 'arraybuffer' });
          const base64Image = Buffer.from(response.data, 'binary').toString('base64');
          const mimeType = response.headers['content-type'];
          const media = new MessageMedia(mimeType, base64Image, 'oferta.png');
          await client.sendMessage(message.from, media, { caption: promo.descripcion });
          await sleep(1500);
        } catch (error) {
          console.error('Error al enviar oferta:', error);
        }
      }
      // Remover las ofertas enviadas de la lista restante
      userOfferState[message.from].remainingOffers = userOfferState[message.from].remainingOffers.slice(8);
      if (userOfferState[message.from].remainingOffers.length === 0) {
        await message.reply('Ya te hemos enviado todas las ofertas disponibles.');
        delete userOfferState[message.from];
      }
    } else {
      await message.reply('No hay ofertas adicionales para mostrar.');
    }
  }
});

// -------------------------------------------------
// 9. Endpoint para enviar ofertas mensuales a todos los clientes (proactivo)
// -------------------------------------------------
app.get('/crm/send-initial-offers', async (req, res) => {
  try {
    const clientes = await Cliente.find({});
    const ofertas = cargarOfertas();
    if (ofertas.length === 0) {
      return res.send('No hay ofertas disponibles.');
    }
    
    const mensajeIntro = "En esta temporada de campaña escolar, entendemos la importancia de maximizar tus ahorros. Por ello, te ofrecemos descuentos exclusivos para que puedas optimizar y mejorar tu vehículo este mes. ¡Descubre nuestras ofertas especiales!";
    
    // Distribuir el envío a lo largo de 4 horas
    const totalClientes = clientes.length;
    const totalTime = 4 * 3600 * 1000; // 4 horas en ms
    const delayBetweenClients = totalClientes > 0 ? totalTime / totalClientes : 0;
    console.log(`Enviando ofertas a ${totalClientes} clientes con un intervalo de ${(delayBetweenClients/1000).toFixed(2)} segundos.`);
    
    async function enviarOfertasCliente(cliente) {
      const numero = `${cliente.numero}@c.us`;
      await client.sendMessage(numero, mensajeIntro);
      
      // Seleccionar aleatoriamente 8 ofertas de la lista completa
      function getRandomPromos(promos, count) {
        const shuffled = promos.slice().sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      }
      const selectedOffers = getRandomPromos(ofertas, 8);
      
      for (const oferta of selectedOffers) {
        try {
          const response = await axios.get(oferta.url, { responseType: 'arraybuffer' });
          const base64Image = Buffer.from(response.data, 'binary').toString('base64');
          const mimeType = response.headers['content-type'];
          const media = new MessageMedia(mimeType, base64Image, 'oferta.png');
          await client.sendMessage(numero, media, { caption: oferta.descripcion });
          await sleep(1500);
        } catch (error) {
          console.error(`Error al enviar oferta a ${cliente.numero}:`, error);
        }
      }
      
      if (ofertas.length > 8) {
        await client.sendMessage(numero, 'Si deseas ver más descuentos, escribe "marzo".');
      }
      
      await registrarInteraccion(cliente.numero, 'ofertaMasiva', 'Envío masivo inicial de ofertas de marzo');
    }
    
    async function enviarOfertasRecursivo(index) {
      if (index >= clientes.length) return;
      await enviarOfertasCliente(clientes[index]);
      setTimeout(() => {
        enviarOfertasRecursivo(index + 1);
      }, delayBetweenClients);
    }
    
    enviarOfertasRecursivo(0);
    res.send('Proceso de envío de ofertas iniciales iniciado.');
  } catch (err) {
    console.error('Error en el envío masivo de ofertas iniciales:', err);
    res.status(500).send('Error en el envío masivo de ofertas.');
  }
});

// -------------------------------------------------
// 10. Dashboard CRM simple
// -------------------------------------------------
app.get('/crm', async (req, res) => {
  try {
    const totalClientes = await Cliente.countDocuments({});
    const totalOfertasSolicitadas = await Interaccion.countDocuments({ tipo: "solicitudOferta" });
    const totalRespuestasOferta = await Interaccion.countDocuments({ tipo: "respuestaOferta" });
    const totalSolicitudesInfo = await Interaccion.countDocuments({ tipo: "solicitudInfo" });
    const clientes = await Cliente.find({}).select('numero lastInteraction -_id').lean();
    
    const html = `
      <html>
        <head>
          <title>CRM Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .stat { margin-bottom: 10px; }
            table { border-collapse: collapse; width: 80%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f2f2f2; }
            button { padding: 10px 20px; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>CRM Dashboard</h1>
          <div class="stat">Clientes registrados: ${totalClientes}</div>
          <div class="stat">Solicitudes de oferta: ${totalOfertasSolicitadas}</div>
          <div class="stat">Respuestas a ofertas: ${totalRespuestasOferta}</div>
          <div class="stat">Solicitudes de información: ${totalSolicitudesInfo}</div>
          <button onclick="location.href='/crm/send-initial-offers'">Enviar Oferta a Todos</button>
          <h2>Lista de Clientes</h2>
          <table>
            <tr>
              <th>Número</th>
              <th>Última Interacción</th>
            </tr>
            ${clientes.map(cliente => `<tr><td>${cliente.numero}</td><td>${new Date(cliente.lastInteraction).toLocaleString()}</td></tr>`).join('')}
          </table>
        </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error('Error en el CRM dashboard:', err);
    res.status(500).send('Error generando el dashboard');
  }
});

// -------------------------------------------------
// 11. Endpoint para visualizar el QR
// -------------------------------------------------
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'whatsapp-qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('El archivo QR no existe o aún no se ha generado.');
  }
});

// -------------------------------------------------
// 12. Inicializar el Cliente de WhatsApp
// -------------------------------------------------
client.initialize();

app.listen(PORT, () => {
  console.debug(`Servidor corriendo en el puerto ${PORT}`);
});
