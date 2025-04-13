// helpers/pdfGenerator.js
const PDFDocument = require('pdfkit');

/**
 * Genera el PDF del certificado de garantía.
 * @param {object} data - Datos para la garantía (incluye: numeroCelular, fechaInstalacion, placa, nombreProducto).
 * @returns {Promise<Buffer>} - Buffer del PDF generado.
 */
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
    if (data.placa) doc.text(`Placa del vehículo: ${data.placa}`, { align: 'left' });
    doc.text(`Producto: ${data.nombreProducto}`, { align: 'left' });
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

/**
 * Genera el PDF para el contrato de financiamiento directo con opción a compra.
 * @param {object} data - Datos del contrato. Se esperan las siguientes propiedades:
 *   - nombre_cliente
 *   - dni_cliente
 *   - placa_vehiculo
 *   - monto_total
 *   - cuota_inicial
 *   - cuota_1
 *   - fecha_cuota_1
 *   - cuota_2 (o 'N/A')
 *   - fecha_cuota_2 (o 'N/A')
 *   - fecha_inicio
 *   - fecha_fin
 * @returns {Promise<Buffer>} - Buffer del PDF generado.
 */
function generarContratoPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Título del contrato
    doc.fontSize(18).text('CONTRATO DE FINANCIAMIENTO DIRECTO CON OPCIÓN A COMPRA', { align: 'center' });
    doc.moveDown();

    // Cláusula introductoria
    doc.fontSize(12).text(`Con este documento, CRD PERÚ, representado por el Sr. Jordy Vigo, con DNI N.° ____________, en adelante "EL VENDEDOR", y el cliente ${data.nombre_cliente}, identificado con DNI N.° ${data.dni_cliente}, con vehículo de placa ${data.placa_vehiculo}, en adelante "EL CLIENTE", acuerdan lo siguiente:`);
    doc.moveDown();

    // Sección 1: Sobre el producto
    doc.text('1. SOBRE EL PRODUCTO');
    doc.text(`EL CLIENTE recibe un equipo multimedia (radio Android) completamente instalado en su vehículo, con opción a compra bajo modalidad de financiamiento directo. El valor total del producto es de S/ ${data.monto_total}.`);
    doc.moveDown();

    // Sección 2: Forma de Pago
    doc.text('2. FORMA DE PAGO');
    doc.text('EL CLIENTE se compromete a pagar según el siguiente cronograma:');
    doc.moveDown();
    doc.list([
      `Inicial: S/ ${data.cuota_inicial} (abonado el ${data.fecha_inicio})`,
      `Cuota 1: S/ ${data.cuota_1} (vence el ${data.fecha_cuota_1})`,
      `Cuota 2: S/ ${data.cuota_2} (vence el ${data.fecha_cuota_2})`
    ]);
    doc.moveDown();
    doc.text('La propiedad del equipo pasará a EL CLIENTE una vez que haya pagado el 100% del valor acordado.');
    doc.moveDown();

    // Sección 3: Sobre la Aplicación de Control
    doc.text('3. SOBRE LA APLICACIÓN DE CONTROL');
    doc.text('Para asegurar el cumplimiento del pago, EL CLIENTE acepta la instalación de una aplicación de control que:');
    doc.list([
      'Funciona en pantalla completa (modo kiosko).',
      'Muestra notificaciones de pago pendiente.',
      'Puede limitar funciones del equipo en caso de mora.',
      'Solo se desactiva definitivamente tras el pago completo.'
    ]);
    doc.moveDown();
    doc.text('La aplicación está diseñada para evitar malentendidos y facilitar la gestión del cronograma.');
    doc.moveDown();

    // Sección 4: Garantía
    doc.text('4. GARANTÍA');
    doc.text('El producto cuenta con garantía por 12 meses, la cual se activa al completarse el pago total. Durante el periodo de financiamiento, cualquier falla será atendida solo si no está relacionada a mal uso, manipulación o alteración del sistema.');
    doc.moveDown();

    // Sección 5: Compromisos del Cliente
    doc.text('5. COMPROMISOS DEL CLIENTE');
    doc.text('Al aceptar este contrato, EL CLIENTE se compromete a:');
    doc.list([
      'No modificar ni desinstalar la aplicación de control.',
      'No formatear, rootear ni flashear la radio.',
      'No vender, empeñar o ceder el equipo hasta cancelar el monto total.',
      'Asumir la responsabilidad por robo, daño o pérdida durante el periodo de pago.'
    ]);
    doc.moveDown();

    // Sección 6: En caso de incumplimiento
    doc.text('6. EN CASO DE INCUMPLIMIENTO');
    doc.text('Si EL CLIENTE incumple con los pagos o manipula el sistema, EL VENDEDOR podrá:');
    doc.list([
      'Limitar el uso del equipo hasta regularizar la situación.',
      'Solicitar la devolución del producto sin reembolso de lo ya abonado.',
      'Iniciar acciones legales por los montos pendientes.'
    ]);
    doc.moveDown();

    // Sección 7: Sobre la Instalación
    doc.text('7. SOBRE LA INSTALACIÓN');
    doc.text('La instalación del equipo está incluida y se realiza en tienda, previa cita. El CLIENTE debe acudir con su vehículo para la programación del equipo.');
    doc.moveDown();

    // Sección 8: Jurisdicción
    doc.text('8. JURISDICCIÓN');
    doc.text('Ambas partes acuerdan que, en caso de conflicto, se someterán a los tribunales de la ciudad de Trujillo.');
    doc.moveDown();

    // Firma
    doc.text(`Firmado con conformidad el día ${data.fecha_inicio}.`, { align: 'center' });
    doc.moveDown();
    doc.text('___________________________', { align: 'center' });
    doc.text('EL VENDEDOR', { align: 'center' });
    doc.text('Jordy Vigo', { align: 'center' });
    doc.text('CRD PERU', { align: 'center' });
    doc.moveDown();
    doc.text('___________________________', { align: 'center' });
    doc.text(`EL CLIENTE`, { align: 'center' });
    doc.text(`Nombre: ${data.nombre_cliente}`, { align: 'center' });
    doc.text(`DNI: ${data.dni_cliente}`, { align: 'center' });
    doc.text(`Placa: ${data.placa_vehiculo}`, { align: 'center' });
    doc.moveDown();

    // Instrucción para aceptación
    doc.fontSize(10).text('El CLIENTE deberá responder "si acepto" al mensaje del certificado para aceptar los términos y condiciones. Esta respuesta quedará registrada en nuestra base de datos.', { align: 'center' });
    
    doc.end();
  });
}

module.exports = { 
  generarGarantiaPDF,
  generarContratoPDF
};
