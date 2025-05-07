// helpers/pdfGenerator.js
const PDFDocument = require('pdfkit');

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
function generarGarantiaPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Página 1: Encabezado y detalles básicos
    doc.font('Helvetica-Bold').fontSize(20)
       .text('CERTIFICADO DE GARANTÍA CARDROID', { align: 'center' })
       .moveDown(1.5);

    doc.font('Helvetica').fontSize(12)
       .text(`Contacto: ${data.numeroCelular}`)
       .text(`Instalación: ${data.fechaInicio}`)
       .text(`Válida hasta: ${data.fechaExpiracion}`);
    if (data.placa) doc.text(`Placa: ${data.placa}`);
    doc.text(`Producto: ${data.nombreProducto}`)
       .moveDown(2);

    // Sección 1: Vigencia y Alcance
    doc.font('Helvetica-Bold').fontSize(14)
       .text('1. VIGENCIA Y ALCANCE', { underline: true })
       .moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text(
         'Esta garantía cubre defectos de fabricación y funcionamiento del producto durante 12 meses ' +
         'a partir de la instalación. Cardroid respalda la calidad de sus equipos y se compromete ' +
         'a brindar soporte técnico y reemplazo de piezas defectuosas.',
         { align: 'justify', indent: 20 }
       )
       .moveDown(1);

    // Sección 2: Cobertura Detallada
    doc.font('Helvetica-Bold').fontSize(14)
       .text('2. COBERTURA DETALLADA', { underline: true })
       .moveDown(0.5);
    doc.font('Helvetica').fontSize(12);
    doc.list(
      [
        'Reemplazo o reparación de componentes con fallos de fábrica.',
        'Actualizaciones oficiales de software sin costo adicional.',
        'Diagnóstico técnico en 3–7 días hábiles.',
        'Asesoría telefónica durante la vigencia de la garantía.'
      ],
      { bulletIndent: 20, textIndent: 5 }
    )
    .moveDown(1);

    // Nueva página para exclusiones
    doc.addPage();

    // Sección 3: Exclusiones y Límites
    doc.font('Helvetica-Bold').fontSize(14)
       .text('3. EXCLUSIONES Y LÍMITES', { underline: true })
       .moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text('La garantía no cubre daños ocasionados por:', { indent: 20 })
       .list(
         [
           'Manipulaciones o reparaciones fuera de centros autorizados.',
           'Impactos, caídas o exposición a líquidos y químicos.',
           'Uso de accesorios no certificados por Cardroid.',
           'Modificaciones de hardware o software no oficiales.',
           'Mal funcionamiento del táctil por uso de silicona u otros productos corrosivos.',
           'Daños derivados de mal estado del alternador, batería u otros elementos eléctricos del vehículo.',
           'Problemas causados por conexión incorrecta al sistema eléctrico del auto.',
           'Desgaste natural por uso prolongado sin mantenimiento adecuado.'
         ],
         { bulletIndent: 20, textIndent: 5 }
       )
    .moveDown(1);

    // Sección 4: Limitaciones de Responsabilidad
    doc.font('Helvetica-Bold').fontSize(14)
       .text('4. LIMITACIONES DE RESPONSABILIDAD', { underline: true })
       .moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text(
         'Cardroid no se responsabiliza por pérdidas indirectas, lucro cesante o datos personales. ' +
         'Nuestro compromiso es asegurar el funcionamiento correcto del producto bajo uso normal.',
         { align: 'justify', indent: 20 }
       )
    .moveDown(1);

    // Sección 5: Buenas Prácticas de Uso
    doc.font('Helvetica-Bold').fontSize(14)
       .text('5. BUENAS PRÁCTICAS', { underline: true })
       .moveDown(0.5);
    doc.list(
      [
        'Mantener el equipo limpio y seco.',
        'Utilizar únicamente cables y accesorios originales.',
        'Consultar el manual de usuario antes de realizar ajustes.',
        'Contactar soporte ante cualquier anomalía.'
      ],
      { bulletIndent: 20, textIndent: 5 }
    )
    .moveDown(1);

    // Sección 6: Contacto y Soporte
    doc.font('Helvetica-Bold').fontSize(14)
       .text('6. CONTACTO Y SOPORTE', { underline: true })
       .moveDown(0.5);
    doc.font('Helvetica').fontSize(12)
       .text(
         'Para soporte o consultas, escriba a soporte@cardroid.com o llame al número de contacto. ' +
         'Nuestro equipo está disponible en horario laboral.',
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
 * @param {object} data - Datos del contrato:
 *   - nombre_cliente
 *   - dni_cliente
 *   - placa_vehiculo
 *   - monto_total
 *   - cuota_inicial
 *   - cuota_1
 *   - fecha_cuota_1
 *   - cuota_2
 *   - fecha_cuota_2
 *   - fecha_inicio
 *   - fecha_fin
 * @returns {Promise<Buffer>} - Buffer del PDF generado.
 */
function generarContratoPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Título del contrato
    doc.font('Helvetica-Bold').fontSize(18)
       .text('CONTRATO DE FINANCIAMIENTO DIRECTO CON OPCIÓN A COMPRA', { align: 'center' })
       .moveDown();

    // Cláusula introductoria
    doc.font('Helvetica').fontSize(12)
       .text(
         `Con este documento, CRD PERÚ, representado por el Sr. Jordy Vigo (EL VENDEDOR), y el cliente ${data.nombre_cliente} (DNI ${data.dni_cliente}) (EL CLIENTE), acuerdan:`,
         { align: 'justify' }
       )
       .moveDown();

    // Sección 1: Sobre el producto
    doc.font('Helvetica-Bold').fontSize(14)
       .text('1. SOBRE EL PRODUCTO')
       .font('Helvetica')
       .moveDown(0.5);
    doc.text(
      `EL CLIENTE recibe un equipo multimedia (radio Android) instalado en su vehículo con placa ${data.placa_vehiculo}. ` +
      `El valor total es S/ ${data.monto_total}.`,
      { align: 'justify' }
    )
    .moveDown(1);

    // Sección 2: Forma de Pago
    doc.font('Helvetica-Bold').fontSize(14)
       .text('2. FORMA DE PAGO')
       .font('Helvetica')
       .moveDown(0.5);
    doc.text('Cronograma de pago:', { underline: true })
       .moveDown(0.5);
    doc.list(
      [
        `Inicial: S/ ${data.cuota_inicial} (abonado el ${data.fecha_inicio})`,
        `Cuota 1: S/ ${data.cuota_1} (vence el ${data.fecha_cuota_1})`,
        `Cuota 2: S/ ${data.cuota_2} (vence el ${data.fecha_cuota_2})`
      ],
      { bulletIndent: 20 }
    )
    .moveDown(1);

    // Sección 3: Aplicación de Control
    doc.font('Helvetica-Bold').fontSize(14)
       .text('3. SOBRE LA APLICACIÓN DE CONTROL')
       .font('Helvetica')
       .moveDown(0.5);
    doc.list(
      [
        'Modo kiosko: pantalla completa sin acceso a otras apps.',
        'Notificaciones de pago y estado de la cuenta.',
        'Restricciones automáticas en caso de mora.',
        'Desactivación tras el pago total.'
      ],
      { bulletIndent: 20 }
    )
    .moveDown(1);

    // Sección 4: Garantía durante financiamiento
    doc.font('Helvetica-Bold').fontSize(14)
       .text('4. GARANTÍA DURANTE EL FINANCIAMIENTO')
       .font('Helvetica')
       .moveDown(0.5);
    doc.text(
      'Durante el financiamiento, la garantía de 12 meses aplica solo a defectos de fábrica. ' +
      'No cubre daños por instalación externa ni uso indebido.',
      { align: 'justify' }
    )
    .moveDown(1);

    // Sección 5: Jurisdicción y firmas
    doc.font('Helvetica-Bold').fontSize(14)
       .text('5. JURISDICCIÓN')
       .font('Helvetica')
       .moveDown(0.5);
    doc.text('Ambas partes se someten a los tribunales de Trujillo.', { align: 'justify' })
       .moveDown(2);

    // Firma
    doc.text(`Firmado el ${data.fecha_inicio}`, { align: 'center' })
       .moveDown(1);
    doc.text('___________________________', { align: 'center' })
       .text('EL VENDEDOR: Jordy Vigo', { align: 'center' })
       .moveDown(1);
    doc.text('___________________________', { align: 'center' })
       .text(`EL CLIENTE: ${data.nombre_cliente}`, { align: 'center' })
       .moveDown(2);

    // Pie de página
    const bottom = doc.page.height - 50;
    doc.font('Helvetica-Oblique').fontSize(10)
       .text('© 2025 CRD PERÚ. Todos los derechos reservados.', 0, bottom, { align: 'center' });

    doc.end();
  });
}

module.exports = {
  generarGarantiaPDF,
  generarContratoPDF
};
