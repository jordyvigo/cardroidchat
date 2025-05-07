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

    // página 1: encabezado y detalles básicos
    doc.fontSize(20)
       .text('CERTIFICADO DE GARANTÍA', { align: 'center' })
       .moveDown(2);

    doc.fontSize(12)
       .text(`Cliente: ${data.numeroCelular}`)
       .text(`Instalación: ${data.fechaInicio}`)
       .text(`Válida hasta: ${data.fechaExpiracion}`);
    if (data.placa) doc.text(`Placa: ${data.placa}`);
    doc.text(`Producto: ${data.nombreProducto}`)
       .moveDown(2);

    // sección 1: duración
    doc.font('Helvetica-Bold').fontSize(14).text('1. Duración de la Garantía').font('Helvetica').moveDown(0.5);
    doc.fontSize(12)
       .text('Nuestra empresa ofrece una garantía de 12 meses a partir de la fecha de instalación indicada. ' +
             'Este compromiso reafirma nuestra confianza en la calidad de nuestros productos y el respaldo de la marca.', { align: 'justify', indent: 20 })
       .moveDown(1);

    // sección 2: cobertura
    doc.font('Helvetica-Bold').fontSize(14).text('2. Cobertura').font('Helvetica').moveDown(0.5);
    doc.list([
      'Reparación o sustitución de componentes con defectos de fabricación.',
      'Soporte técnico y actualizaciones de software original.',
      'Evaluación gratuita en 3–7 días hábiles.',
      'Revisión de límites de consumo eléctrico y conectividad del equipo.'
    ], { bulletIndent: 20 })
       .moveDown(1);

    // sección 3: exclusiones
    doc.addPage(); // nueva página
    doc.font('Helvetica-Bold').fontSize(14).text('3. Exclusiones').font('Helvetica').moveDown(0.5);
    doc.fontSize(12)
       .text('Para mantener la integridad y confiabilidad de nuestra garantía, no se incluyen daños ocasionados por:', { indent: 20 })
       .list([
         'Manipulaciones o reparaciones no autorizadas.',
         'Impactos físicos severos y exposición a líquidos o químicos.',
         'Instalaciones realizadas fuera de nuestros centros autorizados.',
         'Uso de accesorios o cables no certificados.',
       ], { bulletIndent: 20 })
       .moveDown(1);

    // sección 4: limitaciones de responsabilidad
    doc.font('Helvetica-Bold').fontSize(14).text('4. Limitaciones de Responsabilidad').font('Helvetica').moveDown(0.5);
    doc.fontSize(12)
       .text('Cardroid no será responsable por pérdidas indirectas, lucro cesante o daños emergentes. ' +
             'Nuestra prioridad es garantizar la funcionalidad del producto bajo condiciones normales de uso.',
             { align: 'justify', indent: 20 })
       .moveDown(1);

    // sección 5: recomendaciones
    doc.font('Helvetica-Bold').fontSize(14).text('5. Recomendaciones para el Cliente').font('Helvetica').moveDown(0.5);
    doc.list([
      'Mantener el equipo libre de polvo y humedad.',
      'Usar únicamente accesorios y cables suministrados por Cardroid.',
      'Consultar nuestro servicio técnico autorizado ante cualquier incidencia.',
      'Conservar este certificado y el comprobante de compra.',
    ], { bulletIndent: 20 })
       .moveDown(1);

    // sección 6: políticas adicionales
    doc.font('Helvetica-Bold').fontSize(14).text('6. Políticas Adicionales').font('Helvetica').moveDown(0.5);
    doc.fontSize(12)
       .text('Este certificado es intransferible. Cualquier consulta o solicitud de servicio debe realizarse ' +
             'vía nuestros canales oficiales: correo soporte@cardroid.com o al mismo número de contacto.',
             { align: 'justify', indent: 20 })
       .moveDown(1);

    // pie de página
    const bottom = doc.page.height - 50;
    doc.fontSize(10).text('© 2025 Cardroid. Todos los derechos reservados.', 50, bottom, { align: 'center' });

    doc.end();
  });
}

/**
 * Genera el PDF para el contrato de financiamiento directo con opción a compra.
 * (Sin cambios en esta función)
 */
function generarContratoPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end',  ()    => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // ... contenido existente ...

    doc.end();
  });
}

module.exports = {
  generarGarantiaPDF,
  generarContratoPDF
};
