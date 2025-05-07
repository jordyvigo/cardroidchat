const express = require("express");
const router = express.Router();

// Para parsear formularios x-www-form-urlencoded
router.use(express.urlencoded({ extended: true }));

// Funciones de envío definidas en tu configuración de WhatsApp (whatsapp-web.js)
const whatsappConfig = require("../config/whatsapp");

// Modelos de MongoDB
const Cliente = require("../models/Cliente");
const Comprador = require("../models/Comprador");
const Publifinanciamiento = require("../models/Publifinanciamiento");

/**
 * GET /crm/send-custom
 * Muestra formulario con selección de lista o número personalizado
 */
router.get("/", function(req, res) {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Enviar Mensajes Personalizados</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-5">
    <div class="card mx-auto" style="max-width:800px;">
      <div class="card-body">
        <h3 class="text-center mb-4">Enviar Mensajes Personalizados</h3>
        <form method="POST" action="/crm/send-custom">

          <div class="mb-3">
            <label for="message" class="form-label">Mensaje:</label>
            <textarea id="message" name="message" class="form-control" rows="4" required></textarea>
          </div>

          <div class="mb-3">
            <label for="imageUrl" class="form-label">URL de Imagen (opcional):</label>
            <input id="imageUrl" name="imageUrl" type="url" class="form-control" placeholder="https://ejemplo.com/imagen.jpg">
          </div>

          <div class="mb-3">
            <label for="listType" class="form-label">Tipo de lista:</label>
            <select id="listType" name="listType" class="form-select" required>
              <option value="clientes">Clientes</option>
              <option value="compradores">Compradores</option>
              <option value="publifinanciamiento">Publifinanciamiento</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          <!-- Aquí se inyecta la lista o campo personalizado -->
          <div id="recipientsContainer" class="mb-4"></div>

          <button type="submit" class="btn btn-primary w-100">Enviar Mensajes</button>
        </form>
      </div>
    </div>
  </div>
  <script>
    (function(){
      const container = document.getElementById('recipientsContainer');
      const listType = document.getElementById('listType');
      function loadRecipients() {
        const type = listType.value;
        container.innerHTML = '';
        if (type === 'personalizado') {
          container.innerHTML =
            '<div class="mb-3">' +
            '<label for="customNumber" class="form-label">Número personalizado:</label>' +
            '<input id="customNumber" name="recipients" type="tel" class="form-control" placeholder="51987654321" required>' +
            '</div>';
          return;
        }
        container.innerHTML = '<p>Cargando destinatarios…</p>';
        fetch('/crm/send-custom/list?listType=' + type)
          .then(res => res.json())
          .then(list => {
            if (!list.length) {
              container.innerHTML = '<p class="text-warning">No hay destinatarios en esta lista.</p>';
              return;
            }
            let html = '';
            list.forEach(item => {
              html +=
                '<div class="form-check">' +
                '<input class="form-check-input" type="checkbox" name="recipients" value="' + item.phone + '" id="r_' + item.phone + '" checked>' +
                '<label class="form-check-label" for="r_' + item.phone + '">' + item.phone + (item.producto ? ' – ' + item.producto : '') + '</label>' +
                '</div>';
            });
            container.innerHTML = html;
          })
          .catch(() => {
            container.innerHTML = '<p class="text-danger">Error cargando destinatarios.</p>';
          });
      }
      listType.addEventListener('change', loadRecipients);
      window.addEventListener('DOMContentLoaded', loadRecipients);
    })();
  </script>
</body>
</html>`);
});

/**
 * GET /crm/send-custom/list
 * Devuelve JSON con { phone, producto } según lista seleccionada
 */
router.get('/list', function(req, res) {
  const type = (req.query.listType || '').toLowerCase();
  let query = null;
  if (type === 'clientes') query = Cliente.find({});
  else if (type === 'compradores') query = Comprador.find({});
  else if (type === 'publifinanciamiento') query = Publifinanciamiento.find({});
  else return res.json([]);

  query.then(items => {
    const list = items
      .map(c => ({
        phone: c.numero || c.telefono,
        producto: Array.isArray(c.garantias) && c.garantias.length ? c.garantias[0].producto : ''
      }))
      .filter(x => x.phone);
    res.json(list);
  }).catch(() => res.json([]));
});

/**
 * POST /crm/send-custom
 * Envía mensajes a los teléfonos seleccionados o personalizado
 */
router.post('/', function(req, res) {
  const message = req.body.message;
  const imageUrl = req.body.imageUrl;
  const recipients = req.body.recipients;
  if (!message || !recipients) {
    return res.send('Debe ingresar un mensaje y al menos un destinatario.');
  }

  const phones = Array.isArray(recipients) ? recipients : [recipients];
  const results = [];
  let idx = 0;
  function sendNext() {
    if (idx >= phones.length) {
      let html = '<h2>Resultados del Envío</h2><ul>';
      results.forEach(r => { html += `<li>${r.phone}: ${r.success ? 'Éxito' : 'Error: ' + r.error}</li>`; });
      html += '</ul><br><a href="/crm/send-custom" class="btn btn-link">Volver</a>';
      return res.send(html);
    }
    const phone = phones[idx].trim();
    const delay = idx === 0 ? 0 : 2 * 60 * 1000;
    setTimeout(() => {
      const promise = imageUrl
        ? whatsappConfig.sendWhatsAppMedia(phone, imageUrl, message)
        : whatsappConfig.sendWhatsAppMessage(phone, message);
      promise
        .then(() => { results.push({ phone, success: true }); idx++; sendNext(); })
        .catch(err => { results.push({ phone, success: false, error: err.message }); idx++; sendNext(); });
    }, delay);
  }
  sendNext();
});

module.exports = router;
