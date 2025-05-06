const express = require("express");
const router = express.Router();

// Para poder obtener datos del formulario (x-www-form-urlencoded)
router.use(express.urlencoded({ extended: true }));

// Funciones de envío definidas en tu configuración de WhatsApp (whatsapp-web.js)
const { sendWhatsAppMessage, sendWhatsAppMedia } = require("../config/whatsapp");

// Modelos de MongoDB
const Cliente = require("../models/Cliente");
const Comprador = require("../models/Comprador");
const Publifinanciamiento = require("../models/Publifinanciamiento");

/**
 * GET /crm/send-custom
 * Renderiza una página HTML con formulario y lista de destinatarios seleccionables
 */
router.get("/", (req, res) => {
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
        integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU6HIeS6Ix+Z0W1yY4qvN9TK_hpcT6mB4yy0O"
        crossorigin="anonymous"
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
        // Cuando cambie el tipo de lista, cargamos destinatarios
        document.getElementById('listType').addEventListener('change', async function() {
          const type = this.value;
          const container = document.getElementById('recipientsList');
          container.innerHTML = '<p>Cargando destinatarios&hellip;</p>';

          try {
            const res = await fetch(`/crm/send-custom/list?listType=${type}`);
            const list = await res.json();
            if (!list.length) {
              container.innerHTML = '<p class="text-warning">No hay destinatarios en esta lista.</p>';
              return;
            }

            // Generar checkboxes con todos marcados por defecto
            const html = list.map(item => `
              <div class="form-check">
                <input class="form-check-input" type="checkbox"
                       name="recipients" value="${item.phone}" id="r_${item.phone}" checked>
                <label class="form-check-label" for="r_${item.phone}">
                  ${item.phone} - ${item.producto || ''}
                </label>
              </div>
            `).join('');
            container.innerHTML = html;
          } catch (err) {
            container.innerHTML = '<p class="text-danger">Error cargando destinatarios.</p>';
          }
        });

        // Al cargar la página, disparar cambio para la primera lista
        window.addEventListener('DOMContentLoaded', () => {
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
router.get('/list', async (req, res) => {
  const type = (req.query.listType || '').toLowerCase();
  let items = [];
  switch(type) {
    case 'clientes':
      items = await Cliente.find({});
      break;
    case 'compradores':
      items = await Comprador.find({});
      break;
    case 'publifinanciamiento':
      items = await Publifinanciamiento.find({});
      break;
    default:
      return res.json([]);
  }
  // Mapear al formato { phone, producto }
  const list = items.map(c => ({
    phone: c.numero || c.telefono,
    producto: Array.isArray(c.garantias) && c.garantias.length ? c.garantias[0].producto : ''
  })).filter(x => x.phone);
  res.json(list);
});

/**
 * POST /crm/send-custom
 * Recibe los datos y envía mensajes a los destinatarios seleccionados
 */
router.post("/", async (req, res) => {
  try {
    const { message, imageUrl, recipients } = req.body;
    if (!message || !recipients) {
      return res.send("Debe ingresar un mensaje y seleccionar al menos un destinatario.");
    }

    // Asegurar array
    const phones = Array.isArray(recipients) ? recipients : [recipients];
    const results = [];

    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i].trim();
      // Delay 2 minutos para seguridad anti-baneo
      if (i > 0) await new Promise(r => setTimeout(r, 2 * 60 * 1000));
      try {
        if (imageUrl) {
          await sendWhatsAppMedia(phone, imageUrl, message);
        } else {
          await sendWhatsAppMessage(phone, message);
        }
        results.push({ phone, success: true });
      } catch (err) {
        results.push({ phone, success: false, error: err.message });
      }
    }

    // Mostrar resultados simples
    let html = '<h2>Resultados del Envío</h2><ul>';
    results.forEach(r => {
      html += `<li>${r.phone}: ${r.success ? 'Éxito' : 'Error: ' + r.error}</li>`;
    });
    html += '</ul><br><a href="/crm/send-custom" class="btn btn-link">Volver</a>';
    res.send(html);

  } catch (error) {
    console.error(error);
    res.send("Ocurrió un error en el servidor.");
  }
});

module.exports = router;
