// routes/garantia.js - Endpoints para generar certificado de garantía
const express = require('express');
const router = express.Router();
const { generarGarantiaPDF } = require('../helpers/pdfGenerator');
const { MessageMedia } = require('whatsapp-web.js');
// Extraemos el cliente real mediante desestructuración
const { client } = require('../config/whatsapp');
// Importa el modelo Comprador para guardar los clientes en la colección "compradores"
const Comprador = require('../models/Comprador');

router.get('/garantia/crear', (req, res) => {
  const html = `
  <div style="background:#fff; padding:20px; border-radius:8px; max-width:500px; margin:auto; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
    <h1 style="text-align:center;">Generar Certificado de Garantía</h1>
    <form method="POST" action="/garantia/crear">
      <input type="text" name="numeroCelular" placeholder="Número de contacto (sin '+')" required>
      <input type="text" name="fechaInstalacion" placeholder="Fecha de instalación (DD/MM/YYYY)" required>
      <input type="text" name="placa" placeholder="Placa del vehículo (opcional)">
      <input type="text" name="nombreProducto" placeholder="Nombre del producto" required>
      <button type="submit">Generar Garantía</button>
    </form>
  </div>
  `;
  res.send(html);
});

router.post('/garantia/crear', async (req, res) => {
  try {
    const { numeroCelular, fechaInstalacion, placa, nombreProducto } = req.body;
    const garantiaData = { numeroCelular, fechaInstalacion, placa, nombreProducto };
    
    // Generar el PDF del certificado de garantía
    const pdfBuffer = await generarGarantiaPDF(garantiaData);
    
    // Guardar el comprador en la colección "compradores"
    const compradorData = {
      numero: numeroCelular,
      fechaInstalacion,
      placa,
      nombreProducto
    };
    try {
      await Comprador.create(compradorData);
      console.log("Comprador guardado en la colección compradores:", compradorData);
    } catch (err) {
      console.error("Error guardando comprador:", err);
    }
    
    // Formatear el número para enviar el mensaje vía WhatsApp
    const chatId = numeroCelular.includes('@c.us') ? numeroCelular : `${numeroCelular}@c.us`;
    const pdfMedia = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'CertificadoGarantia.pdf');
    
    await client.sendMessage(chatId, pdfMedia, { caption: 'Adjunto: Certificado de Garantía' });
    
    res.send("Certificado de garantía generado, enviado y comprador guardado.");
  } catch (err) {
    console.error("Error generando certificado de garantía:", err);
    res.status(500).send("Error generando certificado de garantía");
  }
});

module.exports = router;
