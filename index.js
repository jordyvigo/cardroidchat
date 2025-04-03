require('dotenv').config();
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvParser = require('csv-parser');
const schedule = require('node-schedule');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar el body parser para formularios
app.use(express.urlencoded({ extended: true }));

// Número de admin (almacenado sin el símbolo "+", por ejemplo "51931367147")
const adminNumber = "51931367147";
// Número del bot (para evitar envíos a sí mismo)
const botNumber = "51999999999"; // Ajusta según corresponda

/* --------------------------------------
   Helper Functions
-------------------------------------- */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseDateDDMMYYYY(str) {
  if (!str) throw new Error("Fecha indefinida");
  let [d, m, y] = str.split('/');
  if (y && y.length === 2) y = '20' + y;
  console.debug(`parseDateDDMMYYYY: d=${d}, m=${m}, y=${y}`);
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
}

function formatDateDDMMYYYY(date) {
  let d = date.getDate();
  let m = date.getMonth() + 1;
  let y = date.getFullYear();
  if (d < 10) d = '0' + d;
  if (m < 10) m = '0' + m;
  return `${d}/${m}/${y}`;
}

function daysRemaining(expirationDateStr) {
  try {
    const expDate = parseDateDDMMYYYY(expirationDateStr);
    const today = new Date();
    const diff = expDate - today;
    return Math.ceil(diff / (1000 * 3600 * 24));
  } catch (e) {
    console.error("Error calculando días restantes:", e);
    return 0;
  }
}

// Función para remover acentos (para normalizar "garantía")
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* --------------------------------------
   CSV + Report
   Se asignan encabezados fijos: Fecha, Tipo, Producto, Monto, Moneda
-------------------------------------- */
function getReport(reportType, reportDate = new Date()) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path.join(__dirname, 'transactions.csv'))
      .pipe(csvParser({ headers: ['Fecha', 'Tipo', 'Producto', 'Monto', 'Moneda'] }))
      .on('data', data => results.push(data))
      .on('end', () => {
        let now = reportDate;
        let startDate;
        if (reportType === 'diario') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (reportType === 'semanal') {
          startDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        } else if (reportType === 'mensual') {
          startDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        }
        console.debug(`getReport: now=${formatDateDDMMYYYY(now)} | startDate=${formatDateDDMMYYYY(startDate)}`);
        const filtered = results.filter(row => {
          if (!row.Fecha) {
            console.warn("Fila sin campo 'Fecha':", row);
            return false;
          }
          try {
            const rowDate = parseDateDDMMYYYY(row.Fecha);
            return rowDate >= startDate && rowDate <= now;
          } catch (e) {
            console.error("Error parseando la fecha del CSV:", row.Fecha, e);
            return false;
          }
        });
        let totalVentas = 0, totalGastos = 0;
        filtered.forEach(row => {
          const amount = parseFloat(row.Monto);
          if (row.Tipo.toLowerCase() === 'venta') totalVentas += amount;
          else if (row.Tipo.toLowerCase() === 'gasto') totalGastos += amount;
        });
        const balance = totalVentas - totalGastos;
        let report = `Reporte ${reportType}:\n`;
        report += `Fecha de reporte: ${formatDateDDMMYYYY(now)}\n`;
        report += `Total transacciones: ${filtered.length}\n`;
        report += `Total Ventas (Ingresos): ${totalVentas} soles\n`;
        report += `Total Gastos (Egresos): ${totalGastos} soles\n`;
        report += `Balance: ${balance} soles\n`;
        resolve(report);
      })
      .on('error', err => reject(err));
  });
}

/* --------------------------------------
   Manejo de Errores Global
-------------------------------------- */
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) =>
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
);

/* --------------------------------------
   CSV Writer para Transacciones
-------------------------------------- */
const csvFilePath = path.join(__dirname, 'transactions.csv');
const csvWriter = createCsvWriter({
  path: csvFilePath,
  header: [
    { id: 'date', title: 'Fecha' },
    { id: 'type', title: 'Tipo' },
    { id: 'description', title: 'Descripción' },
    { id: 'amount', title: 'Monto' },
    { id: 'currency', title: 'Moneda' }
  ],
  append: true
});

/* --------------------------------------
   Conexión a MongoDB
-------------------------------------- */
mongoose.connect('mongodb+srv://jordyvigo:Gunbound2024@cardroid.crwia.mongodb.net/ofertaclientes?retryWrites=true&w=majority&appName=Cardroid', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Conectado a MongoDB (ofertaclientes)'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

/* --------------------------------------
   Modelos
-------------------------------------- */
const clienteSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastInteraction: { type: Date }
});
const Cliente = mongoose.model('Cliente', clienteSchema, 'clientes');

const interaccionSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  tipo: { type: String },
  mensaje: { type: String },
  ofertaReferencia: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Interaccion = mongoose.model('Interaccion', interaccionSchema, 'interacciones');

async function registrarInteraccion(numero, tipo, mensaje, ofertaReferencia = null) {
  console.debug(`Registrar interacción: ${numero} | ${tipo} | ${mensaje}`);
  const interaccion = new Interaccion({ numero, tipo, mensaje, ofertaReferencia });
  await interaccion.save();
  console.log(`Interacción registrada para ${numero}: ${tipo}`);
}

const compradorSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  producto: { type: String, required: true },
  placa: { type: String },
  fechaInicio: { type: String, required: true },
  fechaExpiracion: { type: String, required: true }
});
const Comprador = mongoose.model('Comprador', compradorSchema, 'compradores');

const offerSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true }
});
const Offer = mongoose.model('Offer', offerSchema, 'offers');

/* --------------------------------------
   Registrar Transacción en CSV
-------------------------------------- */
async function registrarTransaccionCSV(texto) {
  console.debug('Registrando transacción:', texto);
  const parts = texto.trim().split(' ');
  console.debug('Parts:', parts);
  const type = parts[0].toLowerCase();
  let currency = 'soles';
  let amount;
  let description;
  if (parts[parts.length - 1].toLowerCase() === 'soles') {
    amount = parseFloat(parts[parts.length - 2]);
    description = parts.slice(1, parts.length - 2).join(' ');
  } else {
    amount = parseFloat(parts[parts.length - 1]);
    description = parts.slice(1, parts.length - 1).join(' ');
  }
  console.debug('Parsed transaction:', { type, amount, description });
  if (isNaN(amount)) {
    console.error('Error: monto no válido.');
    return;
  }
  const record = {
    date: formatDateDDMMYYYY(new Date()),
    type,
    description,
    amount,
    currency
  };
  try {
    await csvWriter.writeRecords([record]);
    console.log(`Transacción registrada en CSV: ${type} - ${description} - ${amount} ${currency}`);
  } catch (err) {
    console.error('Error escribiendo CSV:', err);
  }
}

/* --------------------------------------
   Registrar/Actualizar Cliente
   Al agregar garantía se elimina de "clientes" y se mueve a "compradores"
-------------------------------------- */
async function registrarNumero(numeroWhatsApp) {
  const numeroLimpio = numeroWhatsApp.split('@')[0];
  console.debug('Registrar/actualizar cliente:', numeroLimpio);
  let cliente = await Cliente.findOneAndUpdate(
    { numero: numeroLimpio },
    { $set: { lastInteraction: new Date() } },
    { new: true }
  );
  if (!cliente) {
    cliente = new Cliente({ numero: numeroLimpio, lastInteraction: new Date() });
    await cliente.save();
    console.log(`Número ${numeroLimpio} registrado en "clientes".`);
  } else {
    console.log(`Número ${numeroLimpio} actualizado en "clientes".`);
  }
}

/* --------------------------------------
   Agregar Garantía (solo admin)
   Formato: "agregar <producto> <número> [<placa>] [<fecha>] [shh]"
   Se asume que los números se almacenan como "51xxxxxxxxx" (sin '+')
   Al agregar la garantía se elimina el cliente de "clientes" y se agrega a "compradores"
-------------------------------------- */
async function agregarGarantia(texto, client) {
  console.debug('Comando agregar recibido:', texto);
  const tokens = texto.trim().split(' ');
  console.debug('Tokens parseados:', tokens);
  // Eliminar el primer token ("agregar")
  tokens.shift();
  let silent = false;
  if (tokens[tokens.length - 1] && tokens[tokens.length - 1].toLowerCase() === 'shh') {
    silent = true;
    tokens.pop();
    console.debug('Modo silencioso (shh) activado');
  }
  if (tokens.length < 2) {
    throw new Error('Formato incorrecto. Ejemplo: agregar radio 998877665 [placa] [01/01/2025] [shh]');
  }
  let fechaStr = formatDateDDMMYYYY(new Date());
  let plate = null;
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const plateRegex = /^[A-Za-z0-9]{6}$/;
  if (dateRegex.test(tokens[tokens.length - 1])) {
    fechaStr = tokens.pop();
    console.debug('Fecha detectada:', fechaStr);
  }
  if (tokens.length >= 2 && plateRegex.test(tokens[tokens.length - 1])) {
    plate = tokens.pop();
    console.debug('Placa detectada:', plate);
  }
  if (tokens.length < 1) {
    throw new Error('No se encontró el número de teléfono.');
  }
  let phone = tokens.pop();
  console.debug('Teléfono parseado:', phone);
  const product = tokens.join(' ');
  console.debug('Producto parseado:', product);
  if (!phone.startsWith('51')) {
    phone = '51' + phone;
  }
  console.debug('Número final (sin +):', phone);

  let numberId;
  try {
    numberId = await client.getNumberId(phone);
    console.debug('getNumberId en agregarGarantia:', numberId);
  } catch (err) {
    console.error('Error en getNumberId al agregar garantía:', err);
  }

  const startDate = parseDateDDMMYYYY(fechaStr);
  const expDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
  const fechaExpiracion = formatDateDDMMYYYY(expDate);

  // Guardar en "compradores"
  const newRecord = new Comprador({
    numero: phone,
    producto: product,
    placa: plate,
    fechaInicio: fechaStr,
    fechaExpiracion: fechaExpiracion
  });
  await newRecord.save();
  console.log('Garantía guardada en "compradores"');

  // Mover el cliente: eliminar de "clientes" y "offers"
  await Cliente.deleteOne({ numero: phone });
  await Offer.deleteOne({ numero: phone });
  console.log('Cliente eliminado de "clientes" y "offers"');

  if (!silent) {
    if (phone === botNumber) {
      console.debug('No se envía mensaje de confirmación porque el número destino es el del bot.');
    } else {
      if (!numberId) {
        console.warn('getNumberId devolvió null; usando fallback:', phone + '@c.us');
        numberId = { _serialized: phone + '@c.us' };
      }
      const msg = `Se ha agregado tu garantía de un año para "${product}"${plate ? ' (Placa: ' + plate + ')' : ''}.\nFecha de inicio: ${fechaStr}\nFecha de expiración: ${fechaExpiracion}\nEscribe "garantía" para ver tus garantías vigentes.`;
      console.debug('Enviando mensaje de confirmación a:', numberId._serialized);
      try {
        await client.sendMessage(numberId._serialized, msg);
      } catch (e) {
        console.error('Error enviando mensaje de confirmación:', e);
      }
    }
  } else {
    console.debug('Garantía agregada en modo silencioso (shh), no se envía mensaje.');
  }
  return `Garantía agregada para ${product} al cliente ${phone}${plate ? ' (Placa: ' + plate + ')' : ''}.`;
}

/* --------------------------------------
   Programar Mensaje (solo admin)
   Formato: "programar <mensaje> <fecha> <número>"
-------------------------------------- */
async function programarMensaje(texto) {
  console.debug('Comando programar recibido:', texto);
  const tokens = texto.trim().split(' ');
  tokens.shift();
  if (tokens.length < 3) {
    throw new Error('Formato incorrecto. Ejemplo: programar cita para instalación 31/01/25 932426069');
  }
  const target = tokens.pop();
  const dateToken = tokens.pop();
  const mensajeProgramado = tokens.join(' ');
  console.debug('Mensaje programado:', mensajeProgramado);
  console.debug('Fecha detectada:', dateToken);
  console.debug('Número destino:', target);
  const scheduledDate = parseDateDDMMYYYY(dateToken);
  schedule.scheduleJob(scheduledDate, async function() {
    await client.sendMessage(target + '@c.us', `Recordatorio: ${mensajeProgramado}`);
  });
  return `Mensaje programado para ${target} el ${dateToken}: ${mensajeProgramado}`;
}

/* --------------------------------------
   Configuración de WhatsApp Web (LocalAuth)
-------------------------------------- */
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

/* --------------------------------------
   Eventos de WhatsApp
-------------------------------------- */
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

client.on('auth_failure', msg => console.error('Error de autenticación:', msg));

/* --------------------------------------
   Lógica de Ofertas
-------------------------------------- */
const userOfferState = {};

function cargarOfertas() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'offers.json'), 'utf8');
    console.debug('Ofertas cargadas:', data);
    return JSON.parse(data);
  } catch (err) {
    console.error('Error cargando ofertas:', err);
    return [];
  }
}

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

/* --------------------------------------
   Nuevo Endpoint: Enviar Mensaje Personalizado (CRM)
   Permite elegir la lista ("clientes", "compradores" o "especifico"), ingresar un número (si es específico),
   un mensaje, y opcionalmente una URL de imagen con descripción.
-------------------------------------- */
app.get('/crm/send-custom', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Enviar Mensaje Personalizado</title>
      </head>
      <body>
        <h1>Enviar Mensaje Personalizado</h1>
        <form method="POST" action="/crm/send-custom">
          <label for="collection">Selecciona la lista:</label>
          <select name="collection" id="collection">
            <option value="clientes">Clientes</option>
            <option value="compradores">Compradores</option>
            <option value="especifico">Específico</option>
          </select><br><br>
          <div id="numeroField" style="display:none;">
            <label for="numero">Número (sin '51'):</label>
            <input type="text" id="numero" name="numero" /><br><br>
          </div>
          <label for="message">Mensaje a enviar:</label><br>
          <textarea name="message" id="message" rows="4" cols="50"></textarea><br><br>
          <label for="imageUrl">URL de imagen (opcional):</label><br>
          <input type="text" id="imageUrl" name="imageUrl" /><br><br>
          <label for="imageCaption">Descripción de imagen (opcional):</label><br>
          <input type="text" id="imageCaption" name="imageCaption" /><br><br>
          <button type="submit">Enviar Mensaje</button>
        </form>
        <script>
          const collectionSelect = document.getElementById('collection');
          const numeroField = document.getElementById('numeroField');
          collectionSelect.addEventListener('change', () => {
            if(collectionSelect.value === 'especifico'){
              numeroField.style.display = 'block';
            } else {
              numeroField.style.display = 'none';
            }
          });
        </script>
      </body>
    </html>
  `);
});

app.post('/crm/send-custom', async (req, res) => {
  const { collection, message: customMessage, numero, imageUrl, imageCaption } = req.body;
  let targets = [];
  try {
    if (collection === 'especifico') {
      if (!numero) return res.send("Debes ingresar un número para enviar el mensaje específico.");
      let target = numero.trim();
      if (!target.startsWith('51')) {
        target = '51' + target;
      }
      targets.push(target + '@c.us');
    } else if (collection === 'clientes') {
      const docs = await Cliente.find({});
      targets = docs.map(doc => doc.numero + '@c.us');
    } else if (collection === 'compradores') {
      const docs = await Comprador.find({});
      targets = docs.map(doc => doc.numero + '@c.us');
    } else {
      return res.send("Colección inválida");
    }
    console.debug("Destinatarios:", targets);
    for (const t of targets) {
      if (imageUrl && imageUrl.trim() !== "") {
        try {
          const response = await axios.get(imageUrl.trim(), { responseType: 'arraybuffer' });
          const base64Image = Buffer.from(response.data, 'binary').toString('base64');
          const mimeType = response.headers['content-type'];
          const media = new MessageMedia(mimeType, base64Image, 'imagen.png');
          console.debug("Enviando imagen a:", t);
          await client.sendMessage(t, media, { caption: imageCaption || "" });
          await sleep(1000);
        } catch (e) {
          console.error("Error enviando imagen a", t, e);
        }
      }
      console.debug("Enviando mensaje de texto a:", t);
      await client.sendMessage(t, customMessage);
      await sleep(1000);
    }
    res.send(`Mensaje personalizado enviado a ${targets.length} destinatarios.`);
  } catch (e) {
    console.error(e);
    res.send("Error al enviar mensajes: " + e);
  }
});

/* --------------------------------------
   Endpoint para envío masivo de ofertas
   Se ajusta el lapso total a 2 horas para evitar flag spam.
-------------------------------------- */
app.get('/crm/send-initial-offers', async (req, res) => {
  try {
    const clientes = await Cliente.find({});
    const ofertas = cargarOfertas();
    if (ofertas.length === 0) return res.send('No hay ofertas disponibles.');
    const mensajeIntro = "En esta temporada de campaña escolar, entendemos la importancia de maximizar tus ahorros. Por ello, te ofrecemos descuentos exclusivos para que puedas optimizar y mejorar tu vehículo este mes. ¡Descubre nuestras ofertas especiales!";
    const totalClientes = clientes.length;
    const totalTime = 2 * 3600 * 1000; // 2 horas en milisegundos
    const delayBetweenClients = totalClientes > 0 ? totalTime / totalClientes : 0;
    console.log(`Enviando ofertas a ${totalClientes} clientes con un intervalo de ${(delayBetweenClients/1000).toFixed(2)} segundos.`);
    async function enviarOfertasCliente(cliente) {
      const numero = `${cliente.numero}@c.us`;
      console.log(`Enviando mensaje introductorio a ${cliente.numero}`);
      await client.sendMessage(numero, mensajeIntro);
      function getRandomPromos(promos, count) {
        const shuffled = promos.slice().sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      }
      const selectedOffers = getRandomPromos(ofertas, 8);
      for (const oferta of selectedOffers) {
        try {
          console.log(`Enviando oferta a ${cliente.numero}: ${oferta.descripcion}`);
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
      setTimeout(() => enviarOfertasRecursivo(index + 1), delayBetweenClients);
    }
    enviarOfertasRecursivo(0);
    res.send('Proceso de envío de ofertas iniciales iniciado.');
  } catch (err) {
    console.error('Error en el envío masivo de ofertas:', err);
    res.status(500).send('Error en el envío masivo de ofertas.');
  }
});

/* --------------------------------------
   Dashboard CRM simple (incluye enlace al envío personalizado)
-------------------------------------- */
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
          <button onclick="location.href='/crm/send-custom'">Enviar Mensaje Personalizado</button>
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
    console.error('Error en el dashboard:', err);
    res.status(500).send('Error generando el dashboard');
  }
});

/* --------------------------------------
   Endpoint para descargar el CSV de transacciones
-------------------------------------- */
app.get('/crm/export-transactions', (req, res) => {
  if (fs.existsSync(csvFilePath)) {
    res.download(csvFilePath, 'transacciones.csv');
  } else {
    res.status(404).send('No se encontró el archivo de transacciones.');
  }
});

/* --------------------------------------
   Endpoint para visualizar el QR
-------------------------------------- */
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'whatsapp-qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('El archivo QR no existe o aún no se ha generado.');
  }
});

/* --------------------------------------
   Recordatorio diario de garantías (08:00 AM)
-------------------------------------- */
schedule.scheduleJob('0 8 * * *', async function() {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const targetStr = formatDateDDMMYYYY(targetDate);
  console.debug(`Recordatorio: Buscando garantías que expiran el ${targetStr}`);
  const expiringGuarantees = await Comprador.find({ fechaExpiracion: targetStr });
  expiringGuarantees.forEach(async guarantee => {
    console.debug(`Enviando recordatorio a ${guarantee.numero} para ${guarantee.producto}`);
    await client.sendMessage(
      guarantee.numero + '@c.us',
      `Recordatorio: Tu garantía para ${guarantee.producto}${guarantee.placa ? ' (Placa: ' + guarantee.placa + ')' : ''} expira el ${guarantee.fechaExpiracion}.`
    );
  });
});

/* --------------------------------------
   Inicializar WhatsApp
-------------------------------------- */
client.initialize();

app.listen(PORT, () => {
  console.debug(`Servidor corriendo en el puerto ${PORT}`);
});
