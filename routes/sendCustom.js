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
 * GET /send-custom
 * Renderiza una página HTML con un formulario para ingresar los datos
 */
router.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Enviar Mensajes Personalizados</title>
    </head>
    <body>
      <h1>Enviar Mensajes Personalizados</h1>
      <form method="POST" action="/send-custom">
        <label for="message">Mensaje:</label><br />
        <textarea id="message" name="message" rows="4" cols="50" required></textarea><br /><br />
        
        <label for="imageUrl">URL de Imagen (opcional):</label><br />
        <input type="text" id="imageUrl" name="imageUrl" placeholder="https://ejemplo.com/imagen.jpg"><br /><br />
        
        <label for="listType">Tipo de lista:</label><br />
        <select id="listType" name="listType" onchange="toggleNumbersField(this.value)" required>
          <option value="clientes">Clientes</option>
          <option value="compradores">Compradores</option>
          <option value="publifinanciamiento">Publifinanciamiento</option>
          <option value="personalizado">Personalizado</option>
        </select><br /><br />
        
        <div id="numbersField" style="display:none;">
          <label for="numbers">Números (separados por comas):</label><br />
          <input type="text" id="numbers" name="numbers" placeholder="51987654321,51912345678"><br /><br />
        </div>
        
        <button type="submit">Enviar Mensajes</button>
      </form>
      
      <script>
        function toggleNumbersField(value) {
          var numbersDiv = document.getElementById('numbersField');
          if (value === 'personalizado') {
            numbersDiv.style.display = 'block';
          } else {
            numbersDiv.style.display = 'none';
          }
        }
      </script>
    </body>
    </html>
  `);
});

/**
 * POST /send-custom
 * Recibe los datos del formulario y procede a enviar mensajes.
 *
 * Se esperan los siguientes campos en el formulario:
 *   - message: Texto del mensaje.
 *   - imageUrl: URL de la imagen (opcional).
 *   - listType: "clientes", "compradores", "publifinanciamiento" o "personalizado".
 *   - numbers: Para lista personalizada, una cadena con números separados por comas.
 */
router.post("/", async (req, res) => {
  try {
    const { message, imageUrl, listType, numbers } = req.body;

    if (!message || !listType) {
      return res.send("Debe ingresar un mensaje y seleccionar un tipo de lista. Regrese e intente nuevamente.");
    }

    let recipients = [];

    // Selección de la lista en función del tipo
    switch (listType.toLowerCase()) {
      case "clientes":
        recipients = await Cliente.find({});
        break;
      case "compradores":
        recipients = await Comprador.find({});
        break;
      case "publifinanciamiento":
        recipients = await Publifinanciamiento.find({});
        break;
      case "personalizado":
        if (!numbers) {
          return res.send("Para lista personalizada, debe ingresar al menos un número (separados por comas).");
        }
        // Separar los números ingresados y formar un arreglo de objetos homogéneos
        const phoneNumbers = numbers.split(",").map(n => n.trim()).filter(n => n.length);
        recipients = phoneNumbers.map(num => ({ phone: num }));
        break;
      default:
        return res.send("Tipo de lista no válido. Use: clientes, compradores, publifinanciamiento o personalizado.");
    }

    if (!recipients.length) {
      return res.send("No se encontraron destinatarios en la lista seleccionada.");
    }

    const results = [];

    // Iteramos sobre cada destinatario y esperamos 2 minutos entre cada envío
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Para registros de base de datos, se asume que el número está en "numero" o "telefono"
      let phone = (listType.toLowerCase() === "personalizado")
                    ? recipient.phone
                    : (recipient.numero || recipient.telefono);

      if (!phone) {
        results.push({
          id: recipient._id || phone,
          success: false,
          error: "Número de teléfono no disponible."
        });
        continue;
      }

      // Espera 2 minutos entre cada envío (si no es el primero)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
      }

      try {
        let sendResult;
        // Si se definió una URL de imagen, se envía la imagen con caption
        if (imageUrl) {
          sendResult = await sendWhatsAppMedia(phone, imageUrl, message);
        } else {
          sendResult = await sendWhatsAppMessage(phone, message);
        }

        results.push({
          id: recipient._id || phone,
          phone,
          success: true,
          response: sendResult
        });
      } catch (errorSend) {
        results.push({
          id: recipient._id || phone,
          phone,
          success: false,
          error: errorSend.message
        });
      }
    }

    // Construir una respuesta HTML simple con los resultados
    let resultHtml = "<h2>Resultados del Envío</h2><ul>";
    results.forEach(r => {
      resultHtml += `<li>${r.phone}: ${r.success ? "Éxito" : "Error: " + r.error}</li>`;
    });
    resultHtml += "</ul><br><a href='/send-custom'>Volver</a>";

    res.send(resultHtml);
  } catch (error) {
    console.error("Error en /send-custom:", error);
    res.send("Ocurrió un error en el servidor.");
  }
});

module.exports = router;
