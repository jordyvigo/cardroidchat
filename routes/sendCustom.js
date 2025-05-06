const express = require("express");
const router = express.Router();

// Para poder obtener datos del formulario (x-www-form-urlencoded)
router.use(express.urlencoded({ extended: true }));

// Funciones de envío definidas en tu configuración de WhatsApp (whatsapp-web.js)
const whatsappConfig = require("../config/whatsapp");
// asumimos que whatsappConfig tiene sendWhatsAppMessage y sendWhatsAppMedia

// Modelos de MongoDB
const Cliente = require("../models/Cliente");
const Comprador = require("../models/Comprador");
const Publifinanciamiento = require("../models/Publifinanciamiento");

/**
 * GET /crm/send-custom
 * Renderiza una página HTML con formulario y lista de destinatarios seleccionables
 */
router.get("/", function(req, res) {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Enviar Mensajes Personalizados</title>
      <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
      >
    </head>
    <body class="bg-light">
      <div class="container py-5">
        <div class="card mx-auto" style="max-width: 800px;">
          <div class="card-body">
            <h3 class="card-title text-center mb-4">Enviar Mensajes Personalizados</h3>
            <form id="sendForm" method="POST" action="/crm/send-custom">

              <div class="mb-3">
                <label for="message" class="form-label">Mensaje:</label>
                <textarea id="message" name="message" class="form-control" rows="4" required></textarea>
              </div>

              <div class="mb-3">
                <label for="imageUrl" class="form-label">URL de Imagen (opcional):</label>
                <input type="url" id="imageUrl" name="imageUrl" class="form-control"
                       placeholder="https://ejemplo.com/imagen.jpg">
              </div>

              <div class="mb-3">
                <label for="listType" class="form-label">Tipo de lista:</label>
                <select id="listType" name="listType" class="form-select" required>
                  <option value="clientes">Clientes</option>
                  <option value="compradores">Compradores</option>
                  <option value="publifinanciamiento">Publifinanciamiento</option>
                </select>
              </div>

              <div id="recipientsList" class="mb-4">
                <!-- Aquí se inyecta la lista de destinatarios con checkboxes -->
              </div>

              <button type="submit" class="btn btn-primary w-100">Enviar Mensajes</button>
            </form>
          </div>
        </div>
      </div>

      <script>
        document.getElementById('listType').addEventListener('change', function() {
          var type = this.value;
          var container = document.getElementById('recipientsList');
          container.innerHTML = '<p>Cargando destinatarios…</p>';

          fetch('/crm/send-custom/list?listType=' + type)
            .then(function(res) { return res.json(); })
            .then(function(list) {
              if (!list.length) {
                container.innerHTML = '<p class="text-warning">No hay destinatarios en esta lista.</p>';
                return;
              }
              var html = '';
              for (var i = 0; i < list.length; i++) {
                var item = list[i];
                html += '<div class="form-check">'
                  + '<input class="form-check-input" type="checkbox" name="recipients" value="' + item.phone + '" id="r_' + item.phone + '" checked>'
                  + '<label class="form-check-label" for="r_' + item.phone + '">' + item.phone + ' - ' + (item.producto || '') + '</label>'
                  + '</div>';
              }
              container.innerHTML = html;
            })
            .catch(function() {
              container.innerHTML = '<p class="text-danger">Error cargando destinatarios.</p>';
            });
        });

        window.addEventListener('DOMContentLoaded', function() {
          document.getElementById('listType').dispatchEvent(new Event('change'));
        });
      </script>
    </body>
    </html>
  `);
});

/**
 * GET /crm/send-custom/list
 * Retorna JSON con la lista de destinatarios según el tipo
 */
router.get('/list', function(req, res) {
  var type = (req.query.listType || '').toLowerCase();
  var query;
  if (type === 'clientes') query = Cliente.find({});
  else if (type === 'compradores') query = Comprador.find({});
  else if (type === 'publifinanciamiento') query = Publifinanciamiento.find({});
  else return res.json([]);

  query.then(function(items) {
    var list = [];
    items.forEach(function(c) {
      var phone = c.numero || c.telefono;
      if (phone) {
        var producto = Array.isArray(c.garantias) && c.garantias.length ? c.garantias[0].producto : '';
        list.push({ phone: phone, producto: producto });
      }
    });
    res.json(list);
  }).catch(function() {
    res.json([]);
  });
});

/**
 * POST /crm/send-custom
 * Recibe los datos y envía mensajes a los destinatarios seleccionados
 */
router.post('/', function(req, res) {
  var message = req.body.message;
  var imageUrl = req.body.imageUrl;
  var recipients = req.body.recipients;
  if (!message || !recipients) {
    return res.send('Debe ingresar un mensaje y seleccionar al menos un destinatario.');
  }

  var phones = Array.isArray(recipients) ? recipients : [recipients];
  var results = [];
  var index = 0;

  function sendNext() {
    if (index >= phones.length) {
      var html = '<h2>Resultados del Envío</h2><ul>';
      results.forEach(function(r) {
        html += '<li>' + r.phone + ': ' + (r.success ? 'Éxito' : 'Error: ' + r.error) + '</li>';
      });
      html += '</ul><br><a href="/crm/send-custom" class="btn btn-link">Volver</a>';
      return res.send(html);
    }
    var phone = phones[index].trim();
    var delay = (index === 0) ? 0 : 2 * 60 * 1000;
    setTimeout(function() {
      var sendPromise;
      if (imageUrl) sendPromise = whatsappConfig.sendWhatsAppMedia(phone, imageUrl, message);
      else sendPromise = whatsappConfig.sendWhatsAppMessage(phone, message);
      sendPromise.then(function() {
        results.push({ phone: phone, success: true });
        index++;
        sendNext();
      }).catch(function(err) {
        results.push({ phone: phone, success: false, error: err.message });
        index++;
        sendNext();
      });
    }, delay);
  }

  sendNext();
});

module.exports = router;
