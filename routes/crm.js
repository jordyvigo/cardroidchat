// routes/crm.js - Endpoints del panel CRM y operaciones relacionadas
const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const Interaccion = require('../models/Interaccion');
const fs = require('fs');
const path = require('path');
const { getNavBar } = require('../helpers/utilities');

// Dashboard CRM
router.get('/crm', async (req, res) => {
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
        ${getNavBar()}
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

// Exportar CSV
router.get('/crm/export-transactions', (req, res) => {
  const csvFilePath = path.join(__dirname, '../transactions.csv');
  if (fs.existsSync(csvFilePath)) {
    res.download(csvFilePath, 'transacciones.csv');
  } else {
    res.status(404).send('No se encontró el archivo de transacciones.');
  }
});

module.exports = router;
