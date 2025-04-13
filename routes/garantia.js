// routes/garantia.js - Endpoints para generar certificado de garantía
const express = require('express');
const router = express.Router();
const { generarGarantiaPDF } = require('../helpers/pdfGenerator');
const { MessageMedia } = require('whatsapp-web.js');
// Extraemos el cliente real mediante desestructuración
const { client } = require('../config/whatsapp');

router.get('/garantia/crear', (req, res) => {
  const html = `
  <div style="background:#fff; padding:20px; border-radius:8px; max-width:500px; margin:auto; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
    <h1 style="text-align:center;">Generar Certificado de Garantía</h1>
    <form method="POST" action="/garantia/crear">
      <input type="text" name="numeroCelular" placeholder="Número de contacto (sin '+')" required>
      <input type="text" name="fechaInstalacion" placeholder="Fecha de instalación (DD/MM/YYYY)" required>
      <input type="text" name="placa" placeholder="Placa del vehículo (opcional)">
      <button type="submit">Generar Garantía</button>
    </form>
  </div>
  `;
  res.send(html);
});

router.post('/garantia/crear', async (req, res) => {
  try {
    const { numeroCelular, fechaInstalacion, placa } = req.body;
    const garantiaData = { numeroCelular, fechaInstalacion, placa };
    // Se genera el PDF como Buffer
    const pdfBuffer = await generarGarantiaPDF(garantiaData);
    
    // Formatea el número agregándole '@c.us' si no lo incluye
    const chatId = numeroCelular.includes('@c.us') ? numeroCelular : `${numeroCelular}@c.us`;
    
    // Crea un objeto MessageMedia para el PDF
    const pdfMedia = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'CertificadoGarantia.pdf');
    
    // Envío del PDF a través del cliente de WhatsApp
    await client.sendMessage(chatId, pdfMedia, { caption: 'Adjunto: Certificado de Garantía' });
    
    res.send("Certificado de garantía generado y enviado.");
  } catch (err) {
    console.error("Error generando certificado de garantía:", err);
    res.status(500).send("Error generando certificado de garantía");
  }
});

module.exports = router;
