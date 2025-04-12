const express = require("express");
const router = express.Router();

// Se utiliza el middleware para extraer datos enviados por formularios (x-www-form-urlencoded)
router.use(express.urlencoded({ extended: true }));

// Importamos nuestras funciones auxiliares desde helpers/utilities.js
const { sleep, getNavBar } = require("../helpers/utilities");

// Importamos las funciones para enviar mensajes definidas en config/whatsapp.js
const { sendWhatsAppMessage, sendWhatsAppMedia } = require("../config/whatsapp");

// Importamos los modelos de MongoDB para obtener las listas de destinatarios
const Cliente = require("../models/Cliente");
const Comprador = require("../models/Comprador");
const Publifinanciamiento = require("../models/Publifinanciamiento");

/**
 * GET /sendCustom
 * Renderiza una página HTML con un formulario para ingresar los datos.
 * Se incluye una barra de navegación común utilizando getNavBar().
 */
router.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Enviar Mensajes Personalizados</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        label { display: block; margin-bottom: 5px; }
        input[type="text"], textarea, select { width: 300px; padding: 8px; margin-bottom: 10px; }
        button { padding: 10px 20px; background-color: #007BFF; color: white; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      ${getNavBar()}
      <h1>Enviar Mensajes Personalizados</h1>
      <form method="POST" action="/sendCustom">
        <label for="message">Mensaje:</label>
        <textarea id="message" name="message" rows="4" cols="50" required></textarea>
        
        <label for="imageUrl">URL de Imagen (opcional):</label>
        <input type="text" id="imageUrl" name="imageUrl" placeholder="https://ejemplo.com/imagen.jpg">
        
        <label for="listType">Tipo de lista:</label>
        <select id="listType" name="listType" onchange="toggleNumbersField(this.value)" required>
          <option value="clientes">Clientes</option>
          <option value="compradores">Compradores</option>
          <option value="publifinanciamiento">Publifinanciamiento</option>
          <option value="personalizado">Personalizado</option>
        </select>
        
        <div id="numbersField" style="display:none;">
          <label for="numbers">Números (separados por comas):</label>
          <input type="text" id="numbers" name="numbers" placeholder="51987654321,51912345678">
        </div>
        
        <button type="submit">Enviar Mensajes</button>
      </form>
      
      <script>
        // Función para mostrar u ocultar el campo para números personalizados
        function toggleNumbersField(value) {
          var numbersDiv = document.getElementById('numbersField');
          numbersDiv.style.display = value === 'personalizado' ? 'block' : 'none';
        }
      </script>
    </body>
    </html>
  `);
});

/**
 * POST /sendCustom
 * Procesa los datos enviados desde el formulario para enviar mensajes.
 * Utiliza la función sleep() para esperar 2 minutos entre cada envío y así evitar saturar al bot.
 */
router.post("/", async (req, res) => {
  try {
    // Se extraen los campos enviados en el formulario
    const { message, imageUrl, listType, numbers } = req.body;

    // Validamos los campos requeridos
    if (!message || !listType) {
      return res.send("Debe ingresar un mensaje y seleccionar un tipo de lista. Regrese e intente nuevamente.");
    }

    let recipients = [];

    // Según el tipo de lista, obtenemos los destinatarios
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
        // Se separan los números ingresados en el campo "numbers"
        const phoneNumbers = numbers.split(",").map(n => n.trim()).filter(n => n.length);
        // Se crea una estructura homogénea para usarlos en el proceso de envío
        recipients = phoneNumbers.map(num => ({ phone: num }));
        break;
      default:
        return res.send("Tipo de lista no válido. Use: clientes, compradores, publifinanciamiento o personalizado.");
    }

    if (!recipients.length) {
      return res.send("No se encontraron destinatarios en la lista seleccionada.");
    }

    const results = [];

    // Se recorre la lista de destinatarios para enviar el mensaje a cada uno
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Para registros de la base de datos, el número puede estar en las propiedades "numero" o "telefono",
      // mientras que para la lista personalizada utilizamos la propiedad "phone"
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

      // Se espera 2 minutos entre cada envío (salvo para el primer destinatario)
      if (i > 0) {
        await sleep(2 * 60 * 1000);  // La función sleep se importó desde helpers/utilities.js
      }

      try {
        let sendResult;
        // Si se proporciona una URL de imagen, se envía la imagen con el mensaje como caption.
        // De lo contrario, se envía solo el mensaje de texto.
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

    // Se genera una respuesta HTML sencilla para mostrar los resultados del envío
    let resultHtml = "<h2>Resultados del Envío</h2><ul>";
    results.forEach(r => {
      resultHtml += `<li>${r.phone}: ${r.success ? "Éxito" : "Error: " + r.error}</li>`;
    });
    resultHtml += "</ul><br><a href='/sendCustom'>Volver</a>";

    res.send(resultHtml);
  } catch (error) {
    console.error("Error en /sendCustom:", error);
    res.send("Ocurrió un error en el servidor.");
  }
});

module.exports = router;
