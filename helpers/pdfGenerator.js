// helpers/pdfGenerator.js
const PDFDocument = require('pdfkit');

function generarGarantiaPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    doc.fontSize(18).text('GARANTÍA GENERAL – RADIO ANDROID CARDROID', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Número de contacto del cliente: ${data.numeroCelular}`, { align: 'left' });
    doc.text(`Fecha de instalación: ${data.fechaInstalacion}`, { align: 'left' });
    if (data.placa) {
      doc.text(`Placa del vehículo: ${data.placa}`, { align: 'left' });
    }
    doc.moveDown();
    doc.text('1. DURACIÓN DE LA GARANTÍA');
    doc.text(`La garantía tiene una vigencia de 1 año calendario desde la fecha de instalación (${data.fechaInstalacion}), y aplica exclusivamente a defectos de fábrica del producto instalado.`);
    doc.moveDown();
    doc.text('2. COBERTURA DE GARANTÍA');
    doc.text('Incluye:');
    doc.list([
      'Fallas internas del sistema causadas por defecto de fabricación.',
      'Problemas del software original (sin modificaciones).',
      'Pantalla sin imagen o sin tacto sin daño físico visible.',
      'El proceso de evaluación técnica tomará entre 3 a 7 días hábiles desde la recepción del equipo.'
    ]);
    doc.moveDown();
    doc.text('3. EXCLUSIONES EXPLÍCITAS DE GARANTÍA');
    doc.text('Esta garantía no aplica en los siguientes casos:');
    doc.list([
      'A. Daños físicos o ambientales:',
      '   - Pantalla rota, rayada, hundida o con manchas.',
      '   - Golpes, fisuras, deformaciones o rastros de presión excesiva.',
      '   - Ingreso de líquidos, humedad, vapor, tierra o corrosión.',
      'B. Limpieza incorrecta:',
      '   - Uso de silicona líquida, abrillantador o alcohol directo sobre la pantalla.',
      '   - Limpieza en carwash con productos grasosos o paños con químicos.',
      '   - Pérdida de sensibilidad táctil por productos abrasivos o trapos contaminados.',
      'C. Problemas derivados del vehículo:',
      '   - Picos de voltaje, cortocircuitos o fallas del sistema eléctrico.',
      '   - Problemas causados por el alternador, batería, adaptadores o instalaciones deficientes.',
      '   - Apagones repentinos o reinicios constantes por mala conexión del borne.',
      'D. Manipulación o modificación no autorizada:',
      '   - Instalación, apertura o reparación por personal ajeno a Cardroid.',
      '   - Instalación de ROMs no oficiales, flasheo, root o software de terceros.',
      '   - Cambios en el sistema operativo o uso de apps que sobrecarguen el equipo.',
      'E. Uso indebido o negligente:',
      '   - Conectar dispositivos no compatibles o de alto consumo por USB.',
      '   - Uso prolongado con el motor apagado.',
      '   - Exceso de calor por falta de ventilación o ubicación inapropiada.'
    ]);
    doc.moveDown();
    doc.text('4. OTROS ASPECTOS NO CUBIERTOS');
    doc.text('Daños o mal funcionamiento de cámaras de retroceso, consolas, marcos, micrófonos, antenas, adaptadores, etc.');
    doc.text('Pérdida de datos, cuentas, configuraciones, apps o contraseñas.');
    doc.text('Problemas de red WiFi, incompatibilidad con apps externas o streaming.');
    doc.text('Dificultad para ver Netflix, Disney+, YouTube, etc., si el sistema fue modificado.');
    doc.moveDown();
    doc.text('5. RECOMENDACIONES PARA PRESERVAR TU GARANTÍA');
    doc.list([
      'No permitas que terceros manipulen la radio.',
      'Limpia solo con paño de microfibra ligeramente humedecido con agua.',
      'Evita el uso de silicona o abrillantador en carwash o en el interior del auto.',
      'Instala solo apps necesarias desde Play Store.',
      'Siempre enciende la radio con el motor encendido para evitar daños eléctricos.'
    ]);
    doc.end();
  });
}

module.exports = { generarGarantiaPDF };
