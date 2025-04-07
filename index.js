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
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar el body parser para formularios
app.use(express.urlencoded({ extended: true }));

// Números (almacenados sin el símbolo "+")
const adminNumber = "51931367147";
const botNumber = "51999999999";

// ───────────────────────────────────────────────
// FUNCIONES HELPERS
// ───────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentDateGMTMinus5() {
  // Usa la zona horaria de Lima (GMT-5)
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
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
    const today = getCurrentDateGMTMinus5();
    const diff = expDate - today;
    return Math.ceil(diff / (1000 * 3600 * 24));
  } catch (e) {
    console.error("Error calculando días restantes:", e);
    return 0;
  }
}

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ───────────────────────────────────────────────
// REPORTES Y CSV
// ───────────────────────────────────────────────
function getReport(reportType, reportDate = getCurrentDateGMTMinus5()) {
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

// ───────────────────────────────────────────────
// CONEXIÓN A MONGODB
// ───────────────────────────────────────────────
mongoose.connect('mongodb+srv://jordyvigo:Gunbound2024@cardroid.crwia.mongodb.net/ofertaclientes?retryWrites=true&w=majority&appName=Cardroid', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB (ofertaclientes)'))
.catch(err => console.error('Error conectando a MongoDB:', err));

// ───────────────────────────────────────────────
// MODELOS
// ───────────────────────────────────────────────
// Cliente
const clienteSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastInteraction: { type: Date }
});
const Cliente = mongoose.model('Cliente', clienteSchema, 'clientes');

// Interacción
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

// Comprador (Garantías)
const compradorSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  producto: { type: String, required: true },
  placa: { type: String },
  fechaInicio: { type: String, required: true },
  fechaExpiracion: { type: String, required: true }
});
const Comprador = mongoose.model('Comprador', compradorSchema, 'compradores');

// Financiamiento
const financiamientoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  numero: { type: String, required: true },
  dni: { type: String, required: true },
  placa: { type: String, required: true },
  montoTotal: { type: Number, required: true },
  cuotaInicial: { type: Number, default: 350 },
  cuotas: [{
    monto: { type: Number, required: true },
    vencimiento: { type: String, required: true },
    pagada: { type: Boolean, default: false }
  }],
  fechaInicio: { type: String, required: true },
  fechaFin: { type: String }
});
const Financiamiento = mongoose.model('Financiamiento', financiamientoSchema, 'financiamientos');

// Offer
const offerSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true }
});
const Offer = mongoose.model('Offer', offerSchema, 'offers');

// ───────────────────────────────────────────────
// FUNCIÓN PARA GENERAR CONTRATO PDF
// ───────────────────────────────────────────────
async function generarContratoPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Redacción del contrato según el formato solicitado
    doc.fontSize(18).text('CONTRATO DE FINANCIAMIENTO DIRECTO CON OPCIÓN A COMPRA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Con este documento, CRD IMPORT, representado por el Sr. Jordy Vigo, con DNI N.° ____________, en adelante "EL VENDEDOR", y el cliente ${data.nombre_cliente}, identificado con DNI N.° ${data.dni_cliente}, con vehículo de placa ${data.placa_vehiculo}, en adelante "EL CLIENTE", acuerdan lo siguiente:`);
    doc.moveDown();
    doc.text('1. SOBRE EL PRODUCTO');
    doc.text(`EL CLIENTE recibe un equipo multimedia (radio Android) completamente instalado en su vehículo, con opción a compra bajo modalidad de financiamiento directo. El valor total del producto es de S/ ${data.monto_total}.`);
    doc.moveDown();
    doc.text('2. FORMA DE PAGO');
    doc.text('EL CLIENTE se compromete a pagar según el siguiente cronograma:');
    doc.list([
      `Inicial: S/ ${data.cuota_inicial} (abonado el ${data.fecha_inicio})`,
      `Cuota 1: S/ ${data.cuota_1} (vence el ${data.fecha_cuota_1})`,
      `Cuota 2: S/ ${data.cuota_2} (vence el ${data.fecha_cuota_2})`
    ]);
    doc.moveDown();
    doc.text('La propiedad del equipo pasará a EL CLIENTE una vez que haya pagado el 100% del valor acordado.');
    doc.moveDown();
    doc.text('3. SOBRE LA APLICACIÓN DE CONTROL');
    doc.text('Para asegurar el cumplimiento del pago, EL CLIENTE acepta la instalación de una aplicación de control que:');
    doc.list([
      'Funciona en pantalla completa (modo kiosko).',
      'Muestra notificaciones de pago pendiente.',
      'Puede limitar funciones del equipo en caso de mora.',
      'Solo se desactiva definitivamente tras el pago completo.'
    ]);
    doc.moveDown();
    doc.text('4. GARANTÍA');
    doc.text('El producto cuenta con garantía por 12 meses, la cual se activa al completarse el pago total. Durante el periodo de financiamiento, cualquier falla será atendida solo si no está relacionada a mal uso, manipulación o alteración del sistema.');
    doc.moveDown();
    doc.text('5. COMPROMISOS DEL CLIENTE');
    doc.text('Al aceptar este contrato, EL CLIENTE se compromete a:');
    doc.list([
      'No modificar ni desinstalar la aplicación de control.',
      'No formatear, rootear ni flashear la radio.',
      'No vender, empeñar o ceder el equipo hasta cancelar el monto total.',
      'Asumir la responsabilidad por robo, daño o pérdida durante el periodo de pago.'
    ]);
    doc.moveDown();
    doc.text('6. EN CASO DE INCUMPLIMIENTO');
    doc.text('Si EL CLIENTE incumple con los pagos o manipula el sistema, EL VENDEDOR podrá:');
    doc.list([
      'Limitar el uso del equipo hasta regularizar la situación.',
      'Solicitar la devolución del producto sin reembolso de lo ya abonado.',
      'Iniciar acciones legales por los montos pendientes.'
    ]);
    doc.moveDown();
    doc.text('7. SOBRE LA INSTALACIÓN');
    doc.text('La instalación del equipo está incluida y se realiza en tienda, previa cita. El CLIENTE debe acudir con su vehículo para la programación del equipo.');
    doc.moveDown();
    doc.text('8. JURISDICCIÓN');
    doc.text('Ambas partes acuerdan que, en caso de conflicto, se someterán a los tribunales de la ciudad de Trujillo.');
    doc.moveDown();
    doc.text(`Firmado con conformidad el día ${data.fecha_inicio}.`, { align: 'center' });
    doc.moveDown();
    doc.text('___________________________', { align: 'left' });
    doc.text('EL VENDEDOR', { align: 'left' });
    doc.text('Jordy Vigo', { align: 'left' });
    doc.text('CRD IMPORT', { align: 'left' });
    doc.moveDown();
    doc.text('___________________________', { align: 'left' });
    doc.text('EL CLIENTE', { align: 'left' });
    doc.text(`Nombre: ${data.nombre_cliente}`, { align: 'left' });
    doc.text(`DNI: ${data.dni_cliente}`, { align: 'left' });
    doc.text(`Placa: ${data.placa_vehiculo}`, { align: 'left' });
    doc.end();
  });
}

// ───────────────────────────────────────────────
// ENDPOINTS DE LA API Y CRM
// ───────────────────────────────────────────────

// Financiamiento: Formulario responsivo para crear financiamiento
app.get('/financiamiento/crear', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registrar Financiamiento</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f7f7f7; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
      .container { background: #fff; padding: 20px; border-radius: 8px; width: 90%; max-width: 500px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
      h1 { text-align: center; }
      input, button { width: 100%; padding: 10px; margin: 5px 0; border-radius: 4px; border: 1px solid #ccc; }
      button { background-color: #007BFF; color: #fff; border: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Registrar Financiamiento</h1>
      <form method="POST" action="/financiamiento/crear">
        <input type="text" name="nombre" placeholder="Nombre completo" required>
        <input type="text" name="numero" placeholder="Número de WhatsApp (sin '+')" required>
        <input type="text" name="dni" placeholder="DNI" required>
        <input type="text" name="placa" placeholder="Placa del vehículo" required>
        <input type="number" name="montoTotal" placeholder="Monto total a financiar" required>
        <input type="number" name="cuotaInicial" placeholder="Cuota inicial (opcional)" step="0.01">
        <input type="number" name="numCuotas" placeholder="Número de cuotas restantes (opcional)" min="1">
        <button type="submit">Registrar Financiamiento</button>
      </form>
    </div>
  </body>
  </html>
  `);
});

// Financiamiento: Registro y envío del contrato PDF
app.post('/financiamiento/crear', async (req, res) => {
  try {
    const { nombre, numero, dni, placa, montoTotal, cuotaInicial, numCuotas } = req.body;
    console.debug("Datos recibidos para financiamiento:", req.body);
    
    const fechaInicio = formatDateDDMMYYYY(getCurrentDateGMTMinus5());
    const cuotaIni = cuotaInicial ? parseFloat(cuotaInicial) : 350;
    const montoTotalNum = parseFloat(montoTotal);
    const montoRestante = montoTotalNum - cuotaIni;
    const numCuo = numCuotas ? parseInt(numCuotas, 10) : 2;
    const cuotaValor = parseFloat((montoRestante / numCuo).toFixed(2));
    
    const dInicio = parseDateDDMMYYYY(fechaInicio);
    const fechasCuotas = [];
    for (let i = 1; i <= numCuo; i++) {
      const fecha = formatDateDDMMYYYY(new Date(dInicio.getTime() + i * 30 * 24 * 3600 * 1000));
      fechasCuotas.push(fecha);
    }
    const cuotas = fechasCuotas.map(fecha => ({ monto: cuotaValor, vencimiento: fecha, pagada: false }));
    const fechaFin = fechasCuotas[fechasCuotas.length - 1];
    
    const financiamiento = new Financiamiento({
      nombre,
      numero,
      dni,
      placa,
      montoTotal: montoTotalNum,
      cuotaInicial: cuotaIni,
      cuotas,
      fechaInicio,
      fechaFin
    });
    await financiamiento.save();
    console.log("Financiamiento guardado en 'financiamientos' para el número:", numero);
    
    const pdfBuffer = await generarContratoPDF({
      nombre_cliente: nombre,
      dni_cliente: dni,
      placa_vehiculo: placa,
      monto_total: montoTotalNum,
      cuota_inicial: cuotaIni,
      cuota_1: cuotaValor,
      fecha_cuota_1: fechasCuotas[0],
      cuota_2: numCuo >= 2 ? cuotaValor : 'N/A',
      fecha_cuota_2: numCuo >= 2 ? fechasCuotas[1] : 'N/A',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    });
    
    let numberId;
    try {
      numberId = await client.getNumberId(numero);
      console.debug('getNumberId en financiamiento:', numberId);
    } catch (err) {
      console.error('Error en getNumberId al enviar contrato:', err);
    }
    if (!numberId) {
      numberId = { _serialized: numero + '@c.us' };
      console.warn('Usando fallback para número:', numberId._serialized);
    }
    const pdfMedia = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'ContratoFinanciamiento.pdf');
    try {
      await client.sendMessage(numberId._serialized, pdfMedia, { caption: 'Adjunto: Contrato de Financiamiento y cronograma de pagos' });
    } catch (e) {
      console.error('Error enviando contrato:', e);
      throw e;
    }
    res.send("Financiamiento registrado y contrato enviado.");
  } catch (err) {
    console.error("Error registrando financiamiento:", err);
    res.status(500).send("Error registrando financiamiento");
  }
});

// Financiamiento: Buscar y marcar cuotas (formulario de búsqueda)
app.get('/financiamiento/buscar', async (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Buscar Financiamiento</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f7f7f7; display: flex; justify-content: center; align-items: center; padding: 20px; }
      .container { background: #fff; padding: 20px; border-radius: 8px; max-width: 600px; margin: auto; }
      h1 { text-align: center; }
      input, button { width: 100%; padding: 10px; margin: 5px 0; border-radius: 4px; border: 1px solid #ccc; }
      button { background-color: #28a745; color: #fff; border: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Buscar Financiamiento</h1>
      <form method="GET" action="/financiamiento/buscar/result">
        <input type="text" name="buscar" placeholder="Ingrese número o placa" required>
        <button type="submit">Buscar</button>
      </form>
    </div>
  </body>
  </html>
  `);
});

app.get('/financiamiento/buscar/result', async (req, res) => {
  try {
    const { buscar } = req.query;
    let financiamientos = await Financiamiento.find({
      $or: [
        { numero: new RegExp('^' + buscar) },
        { placa: new RegExp('^' + buscar, 'i') }
      ]
    });
    if (!financiamientos || financiamientos.length === 0) {
      return res.send("No se encontró financiamiento para el criterio dado.");
    }
    let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Resultado de Búsqueda</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f7f7f7; padding: 20px; }
        .container { background: #fff; padding: 20px; border-radius: 8px; max-width: 600px; margin: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #f2f2f2; }
        button { padding: 10px 15px; background: #007BFF; color: #fff; border: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Financiamientos encontrados</h2>
        <table>
          <tr>
            <th>Nombre</th>
            <th>Número</th>
            <th>DNI</th>
            <th>Placa</th>
            <th>Monto Total</th>
            <th>Cuotas</th>
            <th>Acciones</th>
          </tr>`;
    financiamientos.forEach(fin => {
      let cuotasHTML = "<table style='width:100%'><tr><th>#</th><th>Monto</th><th>Vencimiento</th><th>Pagada</th></tr>";
      fin.cuotas.forEach((c, i) => {
        cuotasHTML += `<tr>
          <td>${i + 1}</td>
          <td>${c.monto}</td>
          <td>${c.vencimiento}</td>
          <td>${c.pagada ? "Sí" : "No"}</td>
        </tr>`;
      });
      cuotasHTML += "</table>";
      html += `<tr>
        <td>${fin.nombre}</td>
        <td>${fin.numero}</td>
        <td>${fin.dni}</td>
        <td>${fin.placa}</td>
        <td>${fin.montoTotal}</td>
        <td>${cuotasHTML}</td>
        <td>
          <form method="POST" action="/financiamiento/marcar" style="margin:0;">
            <input type="hidden" name="numero" value="${fin.numero}">
            <input type="number" name="indice" placeholder="Índice cuota" min="0" max="${fin.cuotas.length - 1}" required>
            <button type="submit">Marcar Pagada</button>
          </form>
        </td>
      </tr>`;
    });
    html += `
        </table>
      </div>
    </body>
    </html>`;
    res.send(html);
  } catch (err) {
    console.error("Error en búsqueda:", err);
    res.status(500).send("Error en la búsqueda");
  }
});

// Transacción: Registrar gasto/venta
app.post('/transaccion/crear', async (req, res) => {
  try {
    const { texto } = req.body;
    await registrarTransaccionCSV(texto);
    res.send("Transacción registrada.");
  } catch (err) {
    console.error("Error registrando transacción:", err);
    res.status(500).send("Error registrando transacción");
  }
});

// ───────────────────────────────────────────────
// ENDPOINT PARA ENVÍO MASIVO DE OFERTAS (CRM)
// ───────────────────────────────────────────────
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

// ───────────────────────────────────────────────
// ENDPOINT PARA MENSAJES PERSONALIZADOS (CRM)
// ───────────────────────────────────────────────
app.get('/crm/send-custom', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enviar Mensaje Personalizado</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f7f7f7; display: flex; justify-content: center; align-items: center; padding: 20px; }
      .container { background: #fff; padding: 20px; border-radius: 8px; width: 100%; max-width: 500px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
      h1 { text-align: center; }
      input, textarea, button, select { width: 100%; padding: 10px; margin: 5px 0; border-radius: 4px; border: 1px solid #ccc; }
      button { background-color: #007BFF; color: #fff; border: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Enviar Mensaje Personalizado</h1>
      <form method="POST" action="/crm/send-custom">
        <label for="collection">Selecciona la lista:</label>
        <select name="collection" id="collection">
          <option value="clientes">Clientes</option>
          <option value="compradores">Compradores</option>
          <option value="especifico">Específico</option>
        </select>
        <div id="numeroField" style="display:none;">
          <label for="numero">Número (sin '51'):</label>
          <input type="text" id="numero" name="numero">
        </div>
        <label for="message">Mensaje a enviar:</label>
        <textarea name="message" id="message" rows="4"></textarea>
        <label for="imageUrl">URL de imagen (opcional):</label>
        <input type="text" id="imageUrl" name="imageUrl">
        <label for="imageCaption">Descripción de imagen (opcional):</label>
        <input type="text" id="imageCaption" name="imageCaption">
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
    </div>
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

// ───────────────────────────────────────────────
// ENDPOINT PARA EXPORTAR CSV
// ───────────────────────────────────────────────
app.get('/crm/export-transactions', (req, res) => {
  if (fs.existsSync(csvFilePath)) {
    res.download(csvFilePath, 'transacciones.csv');
  } else {
    res.status(404).send('No se encontró el archivo de transacciones.');
  }
});

// ───────────────────────────────────────────────
// ENDPOINT PARA VISUALIZAR EL QR
// ───────────────────────────────────────────────
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'whatsapp-qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send('El archivo QR no existe o aún no se ha generado.');
  }
});

// ───────────────────────────────────────────────
// DASHBOARD CRM RESPONSIVO
// ───────────────────────────────────────────────
app.get('/crm', async (req, res) => {
  try {
    const totalClientes = await Cliente.countDocuments({});
    const totalOfertasSolicitadas = await Interaccion.countDocuments({ tipo: "solicitudOferta" });
    const totalRespuestasOferta = await Interaccion.countDocuments({ tipo: "respuestaOferta" });
    const totalSolicitudesInfo = await Interaccion.countDocuments({ tipo: "solicitudInfo" });
    const clientes = await Cliente.find({}).select('numero lastInteraction -_id').lean();
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CRM Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f7f7f7; }
        .container { max-width: 1000px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; }
        .stat { margin-bottom: 10px; font-size: 18px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f2f2f2; }
        button { padding: 10px 20px; font-size: 16px; margin: 5px; background: #007BFF; color: #fff; border: none; border-radius: 4px; }
        @media (max-width: 600px) { .stat, table, button { font-size: 14px; } }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>CRM Dashboard</h1>
        <div class="stat">Clientes registrados: ${totalClientes}</div>
        <div class="stat">Solicitudes de oferta: ${totalOfertasSolicitadas}</div>
        <div class="stat">Respuestas a ofertas: ${totalRespuestasOferta}</div>
        <div class="stat">Solicitudes de información: ${totalSolicitudesInfo}</div>
        <div>
          <button onclick="location.href='/crm/send-initial-offers'">Enviar Oferta a Todos</button>
          <button onclick="location.href='/crm/send-custom'">Enviar Mensaje Personalizado</button>
          <button onclick="location.href='/crm/export-transactions'">Exportar Transacciones</button>
        </div>
        <h2>Lista de Clientes</h2>
        <table>
          <tr>
            <th>Número</th>
            <th>Última Interacción</th>
          </tr>
          ${clientes.map(cliente => `<tr><td>${cliente.numero}</td><td>${new Date(cliente.lastInteraction).toLocaleString()}</td></tr>`).join('')}
        </table>
      </div>
    </body>
    </html>
    `;
    res.send(html);
  } catch (err) {
    console.error('Error en el dashboard:', err);
    res.status(500).send('Error generando el dashboard');
  }
});

// ───────────────────────────────────────────────
// RECORDATORIOS
// ───────────────────────────────────────────────
// Recordatorio diario de garantías (08:00 AM GMT-5)
schedule.scheduleJob('0 8 * * *', async function() {
  const today = getCurrentDateGMTMinus5();
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

// Recordatorio de cuotas vencientes (08:30 AM GMT-5)
schedule.scheduleJob('30 8 * * *', async function() {
  const today = getCurrentDateGMTMinus5();
  const todayStr = formatDateDDMMYYYY(today);
  console.debug(`Recordatorio cuotas: Buscando cuotas vencientes para hoy ${todayStr}`);
  const financiamientos = await Financiamiento.find({});
  for (const fin of financiamientos) {
    for (const [index, cuota] of fin.cuotas.entries()) {
      if (!cuota.pagada && cuota.vencimiento === todayStr) {
        const msg = `Recordatorio: Tu cuota ${index + 1} para ${fin.placa} vence hoy (${cuota.vencimiento}). Por favor realiza tu pago.`;
        let numberId;
        try {
          numberId = await client.getNumberId(fin.numero);
          if (!numberId) numberId = { _serialized: fin.numero + '@c.us' };
          await client.sendMessage(numberId._serialized, msg);
          console.log(`Recordatorio enviado a ${fin.numero} para cuota ${index + 1}`);
        } catch (err) {
          console.error(`Error enviando recordatorio para ${fin.numero}:`, err);
        }
      }
    }
  }
});

// ───────────────────────────────────────────────
// ENDPOINT PARA REINICIAR LA SESIÓN DE WHATSAPP
// ───────────────────────────────────────────────
// Este endpoint destruye la sesión actual y fuerza a que se genere un nuevo QR
app.get('/reset-session', async (req, res) => {
  try {
    console.log("Reiniciando sesión de WhatsApp...");
    await client.destroy(); // Destruye la sesión actual
    // Opcional: elimina la carpeta de sesión (si es necesario)
    const sessionPath = path.join(__dirname, '.wwebjs_auth', 'cardroid-bot');
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log("Carpeta de sesión eliminada:", sessionPath);
    }
    client.initialize();
    res.send("Sesión reiniciada. Escanee el nuevo QR cuando aparezca.");
  } catch (err) {
    console.error("Error reiniciando sesión:", err);
    res.status(500).send("Error reiniciando la sesión");
  }
});

// ───────────────────────────────────────────────
// CONFIGURACIÓN DE WHATSAPP WEB (LocalAuth)
// ───────────────────────────────────────────────
// Se utiliza LocalAuth para guardar la sesión en .wwebjs_auth/cardroid-bot
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

// ───────────────────────────────────────────────
// LÓGICA DE OFERTAS
// ───────────────────────────────────────────────
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

// ───────────────────────────────────────────────
// INICIA EL SERVIDOR EXPRESS
// ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.debug(`Servidor corriendo en el puerto ${PORT}`);
});
