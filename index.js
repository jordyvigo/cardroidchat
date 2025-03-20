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

// ----------------------
// Helper Functions
// ----------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseDateDDMMYYYY(str) {
  let [d, m, y] = str.split('/');
  if (y.length === 2) y = '20' + y;
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
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
  const expDate = parseDateDDMMYYYY(expirationDateStr);
  const today = new Date();
  const diff = expDate - today;
  return Math.ceil(diff / (1000 * 3600 * 24));
}

// ----------------------
// Función para generar reporte a partir del CSV
// ----------------------
function getReport(reportType) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path.join(__dirname, 'transactions.csv'))
      .pipe(csvParser())
      .on('data', data => results.push(data))
      .on('end', () => {
        const now = new Date();
        let startDate;
        if (reportType === 'diario') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (reportType === 'semanal') {
          startDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        } else if (reportType === 'mensual') {
          startDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        }
        const filtered = results.filter(row => {
          const rowDate = new Date(row.Fecha);
          return rowDate >= startDate && rowDate <= now;
        });
        let totalVentas = 0, totalGastos = 0;
        filtered.forEach(row => {
          const amount = parseFloat(row.Monto);
          if (row.Tipo.toLowerCase() === 'venta') totalVentas += amount;
          else if (row.Tipo.toLowerCase() === 'gasto') totalGastos += amount;
        });
        const balance = totalVentas - totalGastos;
        let report = `Reporte ${reportType}:\n`;
        report += `Total transacciones: ${filtered.length}\n`;
        report += `Total Ventas (Ingresos): ${totalVentas} soles\n`;
        report += `Total Gastos (Egresos): ${totalGastos} soles\n`;
        report += `Balance: ${balance} soles\n`;
        resolve(report);
      })
      .on('error', err => reject(err));
  });
}

// ----------------------
// Errores Globales
// ----------------------
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) =>
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
);

// ----------------------
// CSV Writer para Transacciones
// ----------------------
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

// ----------------------
// Conexión a MongoDB
// ----------------------
mongoose.connect('mongodb+srv://jordyvigo:Gunbound2024@cardroid.crwia.mongodb.net/ofertaclientes?retryWrites=true&w=majority&appName=Cardroid', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Conectado a MongoDB (ofertaclientes)'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

// ----------------------
// Modelo Cliente
// ----------------------
const clienteSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastInteraction: { type: Date }
});
const Cliente = mongoose.model('Cliente', clienteSchema, 'clientes');

// ----------------------
// Modelo Interacción
// ----------------------
const interaccionSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  tipo: { type: String },
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

// ----------------------
// Modelo Comprador (Garantías)
// ----------------------
const compradorSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  producto: { type: String, required: true },
  placa: { type: String }, // Opcional, 6 caracteres
  fechaInicio: { type: String, required: true },
  fechaExpiracion: { type: String, required: true }
});
const Comprador = mongoose.model('Comprador', compradorSchema, 'compradores');

// ----------------------
// Modelo Offer (Base de ofertas)
// ----------------------
const offerSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true }
});
const Offer = mongoose.model('Offer', offerSchema, 'offers');

// ----------------------
// Registrar Transacción en CSV
// ----------------------
async function registrarTransaccionCSV(texto) {
  const parts = texto.trim().split(' ');
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
  if (isNaN(amount)) {
    console.error('Error: monto no válido.');
    return;
  }
  const record = {
    date: new Date().toLocaleString(),
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

// ----------------------
// Registrar o actualizar Cliente
// ----------------------
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
    console.log(`Número ${numeroLimpio} registrado.`);
  } else {
    console.log(`Número ${numeroLimpio} actualizado.`);
  }
}

// ----------------------
// Función para agregar garantía (solo admin)
// Formato: "agregar <producto> <número> [<placa>] [<fecha>] [shh]"
// Si se incluye "shh" al final, no se envía confirmación al cliente.
// Se admite que un cliente tenga múltiples garantías para distintos productos.
async function agregarGarantia(texto) {
  const tokens = texto.trim().split(' ');
  tokens.shift(); // quitar "agregar"
  let silent = false;
  if (tokens[tokens.length - 1].toLowerCase() === 'shh') {
    silent = true;
    tokens.pop();
  }
  if (tokens.length < 2) {
    throw new Error('Formato incorrecto. Ejemplo: agregar radio Android 999888777 [ABC123] [31/03/2023] [shh]');
  }
  let fechaStr = formatDateDDMMYYYY(new Date());
  let plate = null;
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const plateRegex = /^[A-Za-z0-9]{6}$/;
  if (dateRegex.test(tokens[tokens.length - 1])) {
    fechaStr = tokens.pop();
  }
  if (tokens.length >= 2 && plateRegex.test(tokens[tokens.length - 1])) {
    plate = tokens.pop();
  }
  if (tokens.length < 1) {
    throw new Error('No se encontró el número de teléfono.');
  }
  let phone = tokens.pop();
  const product = tokens.join(' ');
  if (!phone.startsWith('+')) {
    phone = '+51' + phone;
  }
  const startDate = parseDateDDMMYYYY(fechaStr);
  const expDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
  const fechaExpiracion = formatDateDDMMYYYY(expDate);
  const newRecord = new Comprador({
    numero: phone,
    producto: product,
    placa: plate,
    fechaInicio: fechaStr,
    fechaExpiracion: fechaExpiracion
  });
  await newRecord.save();
  await Offer.deleteOne({ numero: phone });
  if (!silent) {
    await client.sendMessage(
      phone + '@c.us',
      `Se ha agregado tu garantía de un año para "${product}"${plate ? ' (Placa: ' + plate + ')' : ''}.\nFecha de inicio: ${fechaStr} - Fecha de expiración: ${fechaExpiracion}.\nRecuerda que puedes escribir "garantia" para ver tus garantías vigentes.`
    );
  }
  return `Garantía agregada para ${product} al cliente ${phone}${plate ? ' (Placa: ' + plate + ')' : ''}.`;
}

// ----------------------
// Función para programar mensajes (solo admin)
// Formato: "programar <mensaje> <fecha> <número>"
// ----------------------
async function programarMensaje(texto) {
  const tokens = texto.trim().split(' ');
  tokens.shift(); // quitar "programar"
  if (tokens.length < 3) {
    throw new Error('Formato incorrecto. Ejemplo: programar cita para instalación 31/01/25 932426069');
  }
  const target = tokens.pop();
  const dateToken = tokens.pop();
  const mensajeProgramado = tokens.join(' ');
  const scheduledDate = parseDateDDMMYYYY(dateToken);
  const job = schedule.scheduleJob(scheduledDate, async function() {
    await client.sendMessage(target + '@c.us', `Recordatorio: ${mensajeProgramado}`);
  });
  return `Mensaje programado para ${target} el ${dateToken}: ${mensajeProgramado}`;
}

// ----------------------
// Configuración del WhatsApp Client (LocalAuth)
// ----------------------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'cardroid-bot' }),
  puppeteer: {
    headless: true,
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

// ----------------------
// Eventos de WhatsApp
// ----------------------
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

// ----------------------
// Gestión de estado para ofertas
// ----------------------
const userOfferState = {};

// Función para cargar ofertas desde "offers.json"
function cargarOfertas() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'offers.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error cargando ofertas:', err);
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

// ----------------------
// Evento de mensaje entrante
// ----------------------
client.on('message', async (message) => {
  const msgText = message.body.trim().toLowerCase();
  console.debug('Mensaje recibido:', message.body);
  const sender = message.from.split('@')[0].replace('+', '');
  const adminNumber = "51931367147"; // Número de admin hardcodeado

  // --- Comandos del admin ---
  if (msgText === 'ayuda') {
    if (sender !== adminNumber) {
      await message.reply('No tienes permisos para ver la ayuda.');
      return;
    }
    const helpText = `Comandos disponibles:
    
1. **agregar**: Agrega una garantía.
   Formato: agregar <producto> <número> [<placa>] [<fecha>] [shh]
   Ejemplo: agregar radio Android 999888777 ABC123 01/03/2023
   (Si incluyes "shh" al final, no se envía mensaje al cliente)

2. **garantia**: El cliente puede escribir "garantia" para ver sus garantías vigentes y los días restantes.

3. **programar**: Programa un mensaje.
   Formato: programar <mensaje> <fecha> <número>
   Ejemplo: programar cita para instalación 31/01/25 932426069

4. **gasto / venta**: Registra una transacción.
   Ejemplo: gasto sueldo trabajador 110
            venta radio Android 500 soles

5. **reporte diario / reporte semanal / reporte mensual**: Solicita un reporte de transacciones.

6. **oferta / marzo**: Los usuarios pueden enviar "oferta" para recibir promociones; luego "marzo" para más.

7. **enviar oferta <número>**: El admin envía 8 ofertas a un número específico.
   Ejemplo: enviar oferta 932426069

8. **enviar archivo <número>**: El admin envía un archivo adjunto a un número específico.
   Ejemplo: enviar archivo 932426069

Recuerda que los comandos son sensibles al formato (usa espacios correctamente).`;
    await message.reply(helpText);
    return;
  }

  // Agregar garantía (solo admin)
  if (msgText.startsWith('agregar')) {
    if (sender !== adminNumber) {
      await message.reply('No tienes permisos para agregar garantías.');
      return;
    }
    try {
      const result = await agregarGarantia(message.body);
      await message.reply(result);
    } catch (err) {
      console.error('Error agregando garantía:', err);
      await message.reply('Error: Formato incorrecto. Ejemplo: agregar radio Android 999888777 [ABC123] [31/03/2023] [shh]');
    }
    return;
  }
  // Programar mensaje (solo admin)
  if (msgText.startsWith('programar')) {
    if (sender !== adminNumber) {
      await message.reply('No tienes permisos para programar mensajes.');
      return;
    }
    try {
      const result = await programarMensaje(message.body);
      await message.reply(result);
    } catch (err) {
      console.error('Error programando mensaje:', err);
      await message.reply('Error: Formato incorrecto. Ejemplo: programar cita para instalación 31/01/25 932426069');
    }
    return;
  }
  // Reportes y transacciones (solo admin)
  if (sender === adminNumber) {
    if (msgText === 'reporte diario' || msgText === 'reporte semanal' || msgText === 'reporte mensual') {
      const reportType = msgText.split(' ')[1];
      try {
        const report = await getReport(reportType);
        await message.reply(report);
      } catch (err) {
        console.error('Error generando reporte:', err);
        await message.reply('Error generando el reporte.');
      }
      return;
    }
    if (msgText.startsWith('gasto') || msgText.startsWith('venta')) {
      await registrarTransaccionCSV(message.body);
      await message.reply('Transacción registrada.');
      return;
    }
    if (msgText.startsWith('enviar oferta')) {
      if (sender !== adminNumber) {
        await message.reply('No tienes permisos para enviar ofertas.');
        return;
      }
      const tokens = message.body.trim().split(' ');
      if (tokens.length < 3) {
        await message.reply('Formato incorrecto. Ejemplo: enviar oferta 932426069');
        return;
      }
      let target = tokens[2];
      if (!target.startsWith('+')) {
        target = '+51' + target;
      }
      const ofertas = cargarOfertas();
      if (ofertas.length === 0) {
        await message.reply('No hay ofertas disponibles.');
        return;
      }
      function getRandomPromos(promos, count) {
        const shuffled = promos.slice().sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      }
      const selectedOffers = getRandomPromos(ofertas, 8);
      await client.sendMessage(target + '@c.us', '¡Hola! Aquí tienes nuestras promociones:');
      for (const promo of selectedOffers) {
        try {
          const response = await axios.get(promo.url, { responseType: 'arraybuffer' });
          const base64Image = Buffer.from(response.data, 'binary').toString('base64');
          const mimeType = response.headers['content-type'];
          const media = new MessageMedia(mimeType, base64Image, 'oferta.png');
          await client.sendMessage(target + '@c.us', media, { caption: promo.descripcion });
          await sleep(1500);
        } catch (error) {
          console.error('Error al enviar oferta:', error);
        }
      }
      await message.reply(`Oferta enviada al número ${target}.`);
      return;
    }
    if (msgText.startsWith('enviar archivo')) {
      if (sender !== adminNumber) {
        await message.reply('No tienes permisos para enviar archivos.');
        return;
      }
      const tokens = message.body.trim().split(' ');
      if (tokens.length < 3) {
        await message.reply('Formato incorrecto. Ejemplo: enviar archivo 932426069');
        return;
      }
      let target = tokens[2];
      if (!target.startsWith('+')) {
        target = '+51' + target;
      }
      if (!message.hasMedia) {
        await message.reply('No se encontró ningún archivo adjunto en tu mensaje.');
        return;
      }
      try {
        const media = await message.downloadMedia();
        await client.sendMessage(target + '@c.us', media, { caption: 'Archivo enviado desde el admin.' });
        await message.reply(`Archivo enviado al número ${target}.`);
      } catch (err) {
        console.error('Error al enviar archivo:', err);
        await message.reply('Error enviando el archivo.');
      }
      return;
    }
  }

  // --- Comando para que un cliente consulte sus garantías ---
  if (msgText === 'garantia') {
    const numeroCliente = message.from.split('@')[0];
    const garantias = await Comprador.find({ numero: numeroCliente });
    if (!garantias || garantias.length === 0) {
      await message.reply('No tienes garantías vigentes registradas.');
      return;
    }
    let respuesta = 'Tus garantías vigentes:\n\n';
    garantias.forEach(g => {
      const diasRestantes = daysRemaining(g.fechaExpiracion);
      respuesta += `Producto: ${g.producto}${g.placa ? ' (Placa: ' + g.placa + ')' : ''}\nFecha inicio: ${g.fechaInicio}\nExpira: ${g.fechaExpiracion} (faltan ${diasRestantes} días)\n\n`;
    });
    await message.reply(respuesta);
    return;
  }

  // --- Flujo de ofertas para usuarios generales ---
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
      for (const promo of userOfferState[message.from].firstOffers) {
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
    return;
  } else if (msgText === 'marzo') {
    if (userOfferState[message.from] && userOfferState[message.from].remainingOffers && userOfferState[message.from].remainingOffers.length > 0) {
      if (userOfferState[message.from].timeout) clearTimeout(userOfferState[message.from].timeout);
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

// ----------------------
// Endpoint para enviar ofertas masivas a todos los clientes (proactivo)
// ----------------------
app.get('/crm/send-initial-offers', async (req, res) => {
  try {
    const clientes = await Cliente.find({});
    const ofertas = cargarOfertas();
    if (ofertas.length === 0) return res.send('No hay ofertas disponibles.');
    const mensajeIntro = "En esta temporada de campaña escolar, entendemos la importancia de maximizar tus ahorros. Por ello, te ofrecemos descuentos exclusivos para que puedas optimizar y mejorar tu vehículo este mes. ¡Descubre nuestras ofertas especiales!";
    const totalClientes = clientes.length;
    const totalTime = 4 * 3600 * 1000;
    const delayBetweenClients = totalClientes > 0 ? totalTime / totalClientes : 0;
    console.log(`Enviando ofertas a ${totalClientes} clientes con un intervalo de ${(delayBetweenClients/1000).toFixed(2)} segundos.`);
    async function enviarOfertasCliente(cliente) {
      const numero = `${cliente.numero}@c.us`;
      await client.sendMessage(numero, mensajeIntro);
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
      setTimeout(() => enviarOfertasRecursivo(index + 1), delayBetweenClients);
    }
    enviarOfertasRecursivo(0);
    res.send('Proceso de envío de ofertas iniciales iniciado.');
  } catch (err) {
    console.error('Error en el envío masivo de ofertas:', err);
    res.status(500).send('Error en el envío masivo de ofertas.');
  }
});

// ----------------------
// Dashboard CRM simple
// ----------------------
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
    console.error('Error en el dashboard:', err);
    res.status(500).send('Error generando el dashboard');
  }
});

// ----------------------
// Endpoint para descargar el CSV de transacciones
// ----------------------
app.get('/crm/export-transactions', (req, res) => {
  if (fs.existsSync(csvFilePath)) {
    res.download(csvFilePath, 'transacciones.csv');
  } else {
    res.status(404).send('No se encontró el archivo de transacciones.');
  }
});

// ----------------------
// Endpoint para visualizar el QR
// ----------------------
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'whatsapp-qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('El archivo QR no existe o aún no se ha generado.');
  }
});

// ----------------------
// Programar recordatorio diario de garantías próximas a expirar (a las 08:00 AM)
// ----------------------
schedule.scheduleJob('0 8 * * *', async function() {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const targetStr = formatDateDDMMYYYY(targetDate);
  const expiringGuarantees = await Comprador.find({ fechaExpiracion: targetStr });
  expiringGuarantees.forEach(async guarantee => {
    await client.sendMessage(
      guarantee.numero + '@c.us',
      `Recordatorio: Tu garantía para ${guarantee.producto}${guarantee.placa ? ' (Placa: ' + guarantee.placa + ')' : ''} expira el ${guarantee.fechaExpiracion}.`
    );
  });
});

// ----------------------
// Inicializar el Cliente de WhatsApp
// ----------------------
client.initialize();

app.listen(PORT, () => {
  console.debug(`Servidor corriendo en el puerto ${PORT}`);
});
