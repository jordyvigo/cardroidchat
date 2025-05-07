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
 * Muestra formulario para crear garantía con estilo responsivo
 */
router.get('/garantia/crear', function(req, res) {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Generar Certificado de Garantía</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background-color: #f8f9fa; }
    .card { border-radius: 12px; }
    input, button { font-size: 1rem; }
  </style>
</head>
<body>
  <div class="container py-4">
    <div class="card mx-auto shadow-sm" style="max-width: 500px;">
      <div class="card-body">
        <h1 class="card-title text-center mb-4">Generar Certificado de Garantía</h1>
        <form method="POST" action="/garantia/crear">
          <div class="mb-3">
            <label for="numeroCelular" class="form-label">Número de contacto</label>
            <input id="numeroCelular" name="numeroCelular" type="tel" class="form-control" placeholder="51912345678" required>
          </div>
          <div class="mb-3">
            <label for="fechaInstalacion" class="form-label">Fecha de instalación</label>
            <input id="fechaInstalacion" name="fechaInstalacion" type="date" class="form-control" required>
          </div>
          <div class="mb-3">
            <label for="placa" class="form-label">Placa (opcional)</label>
            <input id="placa" name="placa" type="text" class="form-control" placeholder="ABC-123">
          </div>
          <div class="mb-3">
            <label for="nombreProducto" class="form-label">Nombre del producto</label>
            <input id="nombreProducto" name="nombreProducto" type="text" class="form-control" required>
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" value="on" id="sendWhatsApp" name="sendWhatsApp" checked>
            <label class="form-check-label" for="sendWhatsApp">
              Enviar certificado por WhatsApp al cliente
            </label>
          </div>
          <button type="submit" class="btn btn-primary w-100">Generar Garantía</button>
        </form>
        <a href="/" class="btn btn-secondary w-100 mt-3">Volver al menú principal</a>
      </div>
    </div>
  </div>
</body>
</html>
  `);
});

/**
 * POST /garantia/crear
 * Genera PDF, guarda comprador y (opcional) envía por WhatsApp
 */
router.post('/garantia/crear', async function(req, res) {
  const { numeroCelular, fechaInstalacion, placa, nombreProducto, sendWhatsApp } = req.body;

  try {
    // Parseo y formato de fechas
    const [d, m, y] = fechaInstalacion.split('-');  // input type=date da YYYY-MM-DD
    const fechaInicio = `${d}/${m}/${y}`;
    const dt = new Date(y, m - 1, d);
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

    // Enviar PDF por WhatsApp si se marcó la casilla
    if (sendWhatsApp === 'on') {
      const chatId = numeroCelular.includes('@c.us') ? numeroCelular : `${numeroCelular}@c.us`;
      const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'CertificadoGarantia.pdf');
      await client.sendMessage(chatId, media, { caption: 'Adjunto: Certificado de Garantía' });
      res.send('Certificado generado, comprador guardado y enviado correctamente.');
    } else {
      res.send('Certificado generado y comprador guardado sin envío de WhatsApp.');
    }
  } catch (err) {
    console.error('Error al crear garantía:', err);
    res.status(500).send('Ocurrió un error generando o guardando la garantía.');
  }
});

module.exports = router;
