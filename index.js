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
    // Descomenta la siguiente línea si deseas usar Chrome instalado en el sistema:
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

// Función para cargar ofertas desde el archivo "offers.json"
function cargarOfertas() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'offers.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error al cargar ofertas:', err);
    return [];
  }
}

// -------------------------------------------------
// 8. Endpoint para enviar ofertas mensuales proactivamente a todos los clientes
// -------------------------------------------------
app.get('/crm/send-initial-offers', async (req, res) => {
  try {
    const clientes = await Cliente.find({});
    const ofertas = cargarOfertas();
    if (ofertas.length === 0) {
      return res.send('No hay ofertas disponibles.');
    }
    
    // Mensaje introductorio mejorado
    const mensajeIntro = "En esta temporada de campaña escolar, entendemos la importancia de maximizar tus ahorros. Por ello, te ofrecemos descuentos exclusivos para que puedas optimizar y mejorar tu vehículo este mes. ¡Descubre nuestras ofertas especiales!";
    
    // Distribuir el envío a lo largo de 8 horas
    const totalClientes = clientes.length;
    const totalTime = 8 * 3600 * 1000; // 8 horas en ms
    const delayBetweenClients = totalClientes > 0 ? totalTime / totalClientes : 0;
    console.log(`Enviando ofertas a ${totalClientes} clientes con un intervalo de ${(delayBetweenClients/1000).toFixed(2)} segundos.`);
    
    // Función para enviar ofertas a un cliente
    async function enviarOfertasCliente(cliente) {
      const numero = `${cliente.numero}@c.us`;
      await client.sendMessage(numero, mensajeIntro);
      
      // Seleccionar aleatoriamente 8 ofertas de la lista
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
      
      // Invitar al cliente a solicitar más ofertas si existen más de 8
      if (ofertas.length > 8) {
        await client.sendMessage(numero, 'Si deseas ver más descuentos, escribe "marzo".');
      }
      
      // Registrar la interacción masiva
      await registrarInteraccion(cliente.numero, 'ofertaMasiva', 'Envío masivo inicial de ofertas de marzo');
    }
    
    // Función recursiva para enviar ofertas a cada cliente con delay
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
// 9. Otros endpoints (CRM Dashboard, etc.)
// -------------------------------------------------
app.get('/', (req, res) => {
  res.send('WhatsApp Bot está corriendo en Amazon Linux.');
});

// Dashboard CRM simple
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
          <button onclick="location.href='/crm/send-offers'">Enviar Oferta a Todos</button>
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

// Endpoint para enviar una oferta general a todos los clientes (opcional)
app.get('/crm/send-offers', async (req, res) => {
  try {
    const clientes = await Cliente.find({});
    for (let cliente of clientes) {
      await client.sendMessage(`${cliente.numero}@c.us`, 'Oferta especial del mes: ¡No te la pierdas!');
      await sleep(500);
    }
    res.send('Oferta enviada a todos los clientes.');
  } catch (err) {
    console.error('Error enviando oferta a todos:', err);
    res.status(500).send('Error enviando oferta a todos los clientes');
  }
});

// -------------------------------------------------
// 10. Endpoint para visualizar el QR
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
// 11. Inicializar el Cliente de WhatsApp
// -------------------------------------------------
client.initialize();

app.listen(PORT, () => {
  console.debug(`Servidor corriendo en el puerto ${PORT}`);
});
