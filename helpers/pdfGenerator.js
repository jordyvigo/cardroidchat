// helpers/pdfGenerator.js
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Genera el PDF del certificado de garantía.
 * @param {object} data - Datos para la garantía:
 *   - numeroCelular
 *   - fechaInicio      (DD/MM/YYYY)
 *   - fechaExpiracion  (DD/MM/YYYY)
 *   - placa            (opcional)
 *   - nombreProducto
 * @returns {Promise<Buffer>} - Buffer del PDF generado.
 */
async function generarGarantiaPDF(data) {
  // Generar QR con el número de celular
  const qrDataUrl = await QRCode.toDataURL(data.numeroCelular);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Colocar QR en esquina superior derecha
    const qrSize = 100;
    doc.image(qrDataUrl, doc.page.width - qrSize - 50, 50, { width: qrSize, height: qrSize });

    // Título y detalles básicos
    doc.font('Helvetica-Bold').fontSize(20)
       .text('CERTIFICADO DE GARANTÍA CARDROID', { align: 'center' })
       .moveDown(2);

    doc.font('Helvetica').fontSize(12)
       .text(`Contacto: ${data.numeroCelular}`)
       .text(`Fecha de instalación: ${data.fechaInicio}`)
       .text(`Vigencia hasta: ${data.fechaExpiracion}`);
    if (data.placa) doc.text(`Placa del vehículo: ${data.placa}`);
    doc.text(`Producto: ${data.nombreProducto}`)
       .moveDown(2);

    // Sección 1: Alcance y Cobertura
    doc.font('Helvetica-Bold').fontSize(14).text('1. ALCANCE DE LA GARANTÍA', { underline: true }).moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text(
         'Cardroid garantiza el correcto funcionamiento del equipo bajo condiciones de uso normales. ' +
         'La cobertura abarca defectos de fabricación y malfuncionamientos del hardware y software original durante ' +
         '12 meses a partir de la instalación. ',
         { align: 'justify', indent: 20 }
       )
       .moveDown(1);

    // Sección 2: Cobertura específica
    doc.font('Helvetica-Bold').fontSize(14).text('2. COBERTURA ESPECÍFICA', { underline: true }).moveDown(0.5);
    doc.list(
      [
        'Reemplazo o reparación de componentes defectuosos.',
        'Actualizaciones de software oficiales sin costo.',
        'Diagnóstico y reparación en 3–7 días hábiles.',
        'Soporte telefónico durante la vigencia.'
      ],
      { bulletIndent: 20 }
    )
    .moveDown(1);

    // Nueva página para exclusiones y límites
    doc.addPage();

    // Sección 3: Exclusiones detalladas
    doc.font('Helvetica-Bold').fontSize(14).text('3. EXCLUSIONES', { underline: true }).moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text('No están cubiertos por esta garantía los daños provocados por:', { indent: 20 })
       .list(
         [
           'Manipulaciones o reparaciones fuera de centros autorizados.',
           'Impactos, caídas o exposición a líquidos y productos químicos.',
           'Uso de silicona, solventes u otros elementos corrosivos sobre la pantalla.',
           'Fallas del táctil por aplicación de agentes químicos.',
           'Problemas eléctricos derivados de alternador, batería o conexiones defectuosas del vehículo.',
           'Desgaste natural por uso prolongado sin mantenimiento preventivo.',
           'Instalaciones o modificaciones no autorizadas por Cardroid.',
           'Pérdida de datos o software de terceros instalado por el usuario.'
         ],
         { bulletIndent: 20 }
       )
    .moveDown(1);

    // Sección 4: Responsabilidad limitada
    doc.font('Helvetica-Bold').fontSize(14).text('4. RESPONSABILIDAD LIMITADA', { underline: true }).moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text(
         'Cardroid no se responsabiliza por pérdidas indirectas, lucro cesante, datos personales o ' +
         'daños consecuentes. La garantía cubre exclusivamente el reemplazo o reparación indicada.',
         { align: 'justify', indent: 20 }
       )
    .moveDown(1);

    // Sección 5: Buenas prácticas de uso
    doc.font('Helvetica-Bold').fontSize(14).text('5. BUENAS PRÁCTICAS', { underline: true }).moveDown(0.5);
    doc.list(
      [
        'Mantener el equipo limpio y libre de polvo.',
        'Usar solo cables y accesorios originales.',
        'No exponer a temperaturas extremas ni humedad.',
        'Consultar manual antes de realizar ajustes inusuales.',
        'Programar mantenimiento preventivo si es necesario.'
      ],
      { bulletIndent: 20 }
    )
    .moveDown(1);

    // Sección 6: Contacto y servicio postventa
    doc.font('Helvetica-Bold').fontSize(14).text('6. CONTACTO Y POSTVENTA', { underline: true }).moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text(
         'Para consultas, reparaciones o agendar citas, comuníquese con nuestro soporte ' +
         'a través de soporte@cardroid.com o llame al número de contacto registrado. ' +
         'Nuestro equipo brindará asistencia y le informará sobre futuras promociones.',
         { align: 'justify', indent: 20 }
       )
    .moveDown(2);

    // Pie de página
    const bottom = doc.page.height - 50;
    doc.font('Helvetica-Oblique').fontSize(10)
       .text('© 2025 Cardroid. Todos los derechos reservados.', 0, bottom, { align: 'center' });

    doc.end();
  });
}

/**
 * Genera el PDF para el contrato de financiamiento directo con opción a compra.
 * @param {object} data - Datos del contrato
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
function generarContratoPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Título, cláusulas y secciones...
    // (sin cambios con respecto a la versión anterior)

    doc.end();
  });
}

module.exports = {
  generarGarantiaPDF,
  generarContratoPDF
};
