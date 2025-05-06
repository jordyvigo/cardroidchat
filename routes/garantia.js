// routes/garantia.js - Endpoints para generar certificado de garantía
const express = require('express');
const router = express.Router();

// Middleware para parsear formularios
router.use(express.urlencoded({ extended: true }));

// PDF generator y WhatsApp client
const { generarGarantiaPDF } = require('../helpers/pdfGenerator');
const { MessageMedia } = require('whatsapp-web.js');
const { client } = require('../config/whatsapp');

// Modelo de MongoDB
const Comprador = require('../models/Comprador');

/**
 * GET /garantia/crear
 * Muestra formulario para crear garantía
 */
router.get('/garantia/crear', function(req, res) {
  res.send(`
    <div style="background:#fff; padding:20px; border-radius:8px; max-width:500px; margin:auto; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
      <h1 style="text-align:center;">Generar Certificado de Garantía</h1>
      <form method="POST" action="/garantia/crear">
        <input type="tel" name="numeroCelular" placeholder="Número de contacto (sin '+')" required><br><br>
        <input type="text" name="fechaInstalacion" placeholder="Fecha instalación (DD/MM/YYYY)" required><br><br>
        <input type="text" name="placa" placeholder="Placa (opcional)"><br><br>
        <input type="text" name="nombreProducto" placeholder="Nombre del producto" required><br><br>
        <button type="submit">Generar Garantía</button>
      </form>
    </div>
  `);
});

/**
 * POST /garantia/crear
 * Genera PDF, guarda comprador y envía por WhatsApp
 */
router.post('/garantia/crear', async function(req, res) {
  const { numeroCelular, fechaInstalacion, placa, nombreProducto } = req.body;

  try {
    // Parseo y formato de fechas
    const [d, m, y] = fechaInstalacion.split('/');
    const fechaInicio = `${d}/${m}/${y}`;
    const dt = new Date(`${y}-${m}-${d}`);
    dt.setFullYear(dt.getFullYear() + 1);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = dt.getFullYear();
    const fechaExpiracion = `${dd}/${mm}/${yy}`;

    // Generar PDF
    const pdfBuffer = await generarGarantiaPDF({ numeroCelular, fechaInicio, fechaExpiracion, placa, nombreProducto });

    // Preparar datos para Mongo
    const compradorData = {
      numero: numeroCelular,
      producto: nombreProducto,
      placa: placa || null,
      fechaInicio,
      fechaExpiracion
    };
    console.log('Guardando Comprador:', compradorData);

    // Guardar en MongoDB
    const nuevoComprador = await Comprador.create(compradorData);
    console.log('Comprador guardado:', nuevoComprador);

    // Enviar PDF por WhatsApp
    const chatId = numeroCelular.includes('@c.us') ? numeroCelular : `${numeroCelular}@c.us`;
    const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'CertificadoGarantia.pdf');
    await client.sendMessage(chatId, media, { caption: 'Adjunto: Certificado de Garantía' });

    res.send('Certificado generado, comprador guardado y enviado correctamente.');
  } catch (err) {
    console.error('Error al crear garantía:', err);
    res.status(500).send('Ocurrió un error generando o guardando la garantía.');
  }
});

module.exports = router;
