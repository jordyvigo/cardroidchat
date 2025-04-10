// routes/garantia.js - Endpoints para generar certificado de garantía
const express = require('express');
const router = express.Router();
const { generarGarantiaPDF } = require('../helpers/pdfGenerator');
const { MessageMedia } = require('whatsapp-web.js');
const client = require('../config/whatsapp');

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
    const pdfBuffer = await generarGarantiaPDF(garantiaData);
    
    let numberId;
    try {
      numberId = await client.getNumberId(numeroCelular);
    } catch (err) {
      console.error('Error en getNumberId para garantía:', err);
    }
    if (!numberId) {
      numberId = { _serialized: numeroCelular + '@c.us' };
    }
    const pdfMedia = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'CertificadoGarantia.pdf');
    try {
      await client.sendMessage(numberId._serialized, pdfMedia, { caption: 'Adjunto: Certificado de Garantía' });
    } catch (e) {
      console.error('Error enviando certificado de garantía:', e);
      throw e;
    }
    res.send("Certificado de garantía generado y enviado.");
  } catch (err) {
    console.error("Error generando certificado de garantía:", err);
    res.status(500).send("Error generando certificado de garantía");
  }
});

module.exports = router;
