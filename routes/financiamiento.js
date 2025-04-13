// routes/financiamiento.js - Endpoints para financiamiento
const express = require('express');
const router = express.Router();

const Financiamiento = require('../models/Financiamiento');
const { 
  parseDateDDMMYYYY, 
  formatDateDDMMYYYY, 
  getCurrentDateGMTMinus5, 
  getNavBar, 
  sleep 
} = require('../helpers/utilities');
// Importamos la función para generar el contrato PDF.
// Nota: Si en pdfGenerator el módulo exporta la función directamente, no uses destructuración.
const generarContratoPDF = require('../helpers/pdfGenerator');

// Extraemos el cliente real
const { client } = require('../config/whatsapp');
const { MessageMedia } = require('whatsapp-web.js');

/**
 * GET /financiamiento/crear
 * Renderiza el formulario para registrar financiamiento.
 */
router.get('/financiamiento/crear', (req, res) => {
  const html = `
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
          nav { margin-bottom: 20px; }
      </style>
  </head>
  <body>
      ${getNavBar()}
      <div class="container">
          <h1 style="text-align:center;">Registrar Financiamiento</h1>
          <form method="POST" action="/financiamiento/crear">
              <input type="text" name="nombre" placeholder="Nombre completo" required>
              <input type="text" name="numero" placeholder="Número de WhatsApp (sin '+')" required>
              <input type="text" name="dni" placeholder="DNI" required>
              <input type="text" name="placa" placeholder="Placa del vehículo" required>
              <input type="number" step="0.01" name="montoTotal" placeholder="Monto total a financiar" required>
              <input type="number" step="0.01" name="cuotaInicial" placeholder="Cuota inicial (opcional)">
              <input type="number" name="numCuotas" placeholder="Número de cuotas restantes (opcional)" min="1">
              <button type="submit">Registrar Financiamiento</button>
          </form>
      </div>
  </body>
  </html>
  `;
  res.send(html);
});

/**
 * POST /financiamiento/crear
 * Procesa el registro del financiamiento, genera el contrato PDF y lo envía vía WhatsApp.
 */
router.post('/financiamiento/crear', async (req, res) => {
  try {
    const { nombre, numero, dni, placa, montoTotal, cuotaInicial, numCuotas } = req.body;
    console.log("Datos recibidos para financiamiento:", req.body);
    
    // Fecha de inicio según la zona horaria "America/Lima"
    const fechaInicio = formatDateDDMMYYYY(getCurrentDateGMTMinus5());
    const cuotaIni = cuotaInicial ? parseFloat(cuotaInicial) : 350;
    const montoTotalNum = parseFloat(montoTotal);
    const montoRestante = montoTotalNum - cuotaIni;
    const numCuo = numCuotas ? parseInt(numCuotas, 10) : 2;
    const cuotaValor = parseFloat((montoRestante / numCuo).toFixed(2));
    
    // Calcular fechas de vencimiento para las cuotas (cada 30 días)
    const dInicio = parseDateDDMMYYYY(fechaInicio);
    const fechasCuotas = [];
    for (let i = 1; i <= numCuo; i++) {
      const fecha = formatDateDDMMYYYY(new Date(dInicio.getTime() + i * 30 * 24 * 3600 * 1000));
      fechasCuotas.push(fecha);
    }
    const cuotas = fechasCuotas.map(fecha => ({ monto: cuotaValor, vencimiento: fecha, pagada: false }));
    const fechaFin = fechasCuotas[fechasCuotas.length - 1];
    
    // Crear y guardar el documento de financiamiento en la BD
    const financiamiento = new Financiamiento({
      nombre,
      numero,  // se espera el número sin '+'
      dni,
      placa,
      montoTotal: montoTotalNum,
      cuotaInicial: cuotaIni,
      cuotas,
      fechaInicio,
      fechaFin
    });
    await financiamiento.save();
    console.log("Financiamiento guardado para el número:", numero);
    
    // Generar el contrato PDF usando la función importar directamente
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
    
    // Formatear el número para enviar mensaje vía WhatsApp
    const chatId = numero.includes('@c.us') ? numero : `${numero}@c.us`;
    const pdfMedia = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'ContratoFinanciamiento.pdf');
    
    try {
      await client.sendMessage(chatId, pdfMedia, { caption: 'Adjunto: Contrato de Financiamiento y cronograma de pagos' });
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

/**
 * GET /financiamiento/buscar
 * Muestra un formulario para buscar financiamiento por número o placa.
 */
router.get('/financiamiento/buscar', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Buscar Financiamiento</title>
      <style>
          body { font-family: Arial, sans-serif; background: #f7f7f7; display: flex; justify-content: center; align-items: center; padding: 20px; }
          .container { background: #fff; padding: 20px; border-radius: 8px; max-width: 600px; margin: auto; }
      </style>
  </head>
  <body>
      ${getNavBar()}
      <div class="container">
          <h1 style="text-align:center;">Buscar Financiamiento</h1>
          <form method="GET" action="/financiamiento/buscar/result">
              <input type="text" name="buscar" placeholder="Ingrese número o placa" required>
              <button type="submit">Buscar</button>
          </form>
      </div>
  </body>
  </html>
  `;
  res.send(html);
});

/**
 * GET /financiamiento/buscar/result
 * Muestra los resultados de la búsqueda y permite marcar cuotas como pagadas.
 */
router.get('/financiamiento/buscar/result', async (req, res) => {
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
          ${getNavBar()}
          <div class="container">
              <h2>Financiamientos encontrados</h2>
              <table>
                  <tr>
                      <th>Número</th>
                      <th>Nombre</th>
                      <th>DNI</th>
                      <th>Placa</th>
                      <th>Monto Total</th>
                      <th>Cuotas</th>
                      <th>Acciones</th>
                  </tr>
    `;
    financiamientos.forEach(fin => {
      let cuotasHTML = `<table style="width:100%; border-collapse:collapse;">
                        <tr>
                          <th>#</th>
                          <th>Monto</th>
                          <th>Vencimiento</th>
                          <th>Pagada</th>
                        </tr>`;
      fin.cuotas.forEach((c, i) => {
        cuotasHTML += `<tr>
                        <td>${i + 1}</td>
                        <td>${c.monto}</td>
                        <td>${c.vencimiento}</td>
                        <td>${c.pagada ? "Sí" : "No"}</td>
                      </tr>`;
      });
      cuotasHTML += `</table>`;
      html += `<tr>
                <td>${fin.numero}</td>
                <td>${fin.nombre}</td>
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
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error("Error en búsqueda:", err);
    res.status(500).send("Error en la búsqueda");
  }
});

/**
 * POST /financiamiento/marcar
 * Marca una cuota como pagada y envía un mensaje vía WhatsApp notificando el estado.
 */
router.post('/financiamiento/marcar', async (req, res) => {
  try {
    const { numero, indice } = req.body;
    if (!numero || indice === undefined) {
      return res.status(400).send("Parámetros incompletos: 'numero' e 'indice' son requeridos.");
    }
    
    const financiamiento = await Financiamiento.findOne({ numero });
    if (!financiamiento) {
      return res.status(404).send("No se encontró financiamiento para ese número.");
    }
    
    const cuotaIndex = parseInt(indice, 10);
    if (isNaN(cuotaIndex) || cuotaIndex < 0 || cuotaIndex >= financiamiento.cuotas.length) {
      return res.status(400).send("Índice de cuota inválido.");
    }
    
    financiamiento.cuotas[cuotaIndex].pagada = true;
    await financiamiento.save();
    
    let mensaje = "¡Gracias por tu pago!\n";
    const cuotasPendientes = financiamiento.cuotas.filter(c => !c.pagada);
    if (cuotasPendientes.length > 0) {
      mensaje += "Cuotas pendientes:\n";
      cuotasPendientes.forEach((c, i) => {
        mensaje += `Cuota ${i + 1}: S/ ${c.monto}, vence el ${c.vencimiento}\n`;
      });
    } else {
      mensaje += "Has completado todos tus pagos. ¡Felicitaciones!";
    }
    
    // Formatea el número para WhatsApp
    const chatId = numero.includes('@c.us') ? numero : `${numero}@c.us`;
    try {
      await client.sendMessage(chatId, mensaje);
      res.send("Cuota marcada como pagada y mensaje enviado.");
    } catch (e) {
      console.error('Error enviando mensaje de marca de cuota:', e);
      throw e;
    }
  } catch (err) {
    console.error("Error marcando cuota como pagada:", err);
    res.status(500).send("Error marcando cuota como pagada");
  }
});

module.exports = router;
