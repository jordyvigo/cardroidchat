// helpers/pdfGenerator.js - Genera PDFs para contratos y garantías
const PDFDocument = require('pdfkit');

async function generarContratoPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Contrato de financiamiento
    doc.fontSize(18).text('CONTRATO DE FINANCIAMIENTO DIRECTO CON OPCIÓN A COMPRA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Con este documento, CRD IMPORT, representado por el Sr. Jordy Vigo, con DNI N.° ____________, en adelante "EL VENDEDOR", y el cliente ${data.nombre_cliente}, identificado con DNI N.° ${data.dni_cliente}, con vehículo de placa ${data.placa_vehiculo}, en adelante "EL CLIENTE", acuerdan lo siguiente:`);
    doc.moveDown();
    doc.text('1. SOBRE EL PRODUCTO');
    doc.text(`EL CLIENTE recibe un equipo multimedia (radio Android) completamente instalado en su vehículo, con opción a compra bajo modalidad de financiamiento directo. El valor total del producto es de S/ ${data.monto_total}.`);
    doc.moveDown();
    doc.text('2. FORMA DE PAGO');
    doc.text('EL CLIENTE se compromete a pagar según el siguiente cronograma:');
    doc.list([
      `Inicial: S/ ${data.cuota_inicial} (abonado el ${data.fecha_inicio})`,
      `Cuota 1: S/ ${data.cuota_1} (vence el ${data.fecha_cuota_1})`,
      `Cuota 2: S/ ${data.cuota_2} (vence el ${data.fecha_cuota_2})`
    ]);
    doc.moveDown();
    doc.text('La propiedad del equipo pasará a EL CLIENTE una vez que haya pagado el 100% del valor acordado.');
    doc.moveDown();
    doc.text('3. SOBRE LA APLICACIÓN DE CONTROL');
    doc.text('Para asegurar el cumplimiento del pago, EL CLIENTE acepta la instalación de una aplicación de control que:');
    doc.list([
      'Funciona en pantalla completa (modo kiosko).',
      'Muestra notificaciones de pago pendiente.',
      'Puede limitar funciones del equipo en caso de mora.',
      'Solo se desactiva definitivamente tras el pago completo.'
    ]);
    doc.moveDown();
    doc.text('4. GARANTÍA');
    doc.text('El producto cuenta con garantía por 12 meses, la cual se activa al completarse el pago total. Durante el periodo de financiamiento, cualquier falla será atendida solo si no está relacionada a mal uso, manipulación o alteración del sistema.');
    doc.moveDown();
    doc.text('5. COMPROMISOS DEL CLIENTE');
    doc.text('Al aceptar este contrato, EL CLIENTE se compromete a:');
    doc.list([
      'No modificar ni desinstalar la aplicación de control.',
      'No formatear, rootear ni flashear la radio.',
      'No vender, empeñar o ceder el equipo hasta cancelar el monto total.',
      'Asumir la responsabilidad por robo, daño o pérdida durante el periodo de pago.'
    ]);
    doc.moveDown();
    doc.text('6. EN CASO DE INCUMPLIMIENTO');
    doc.text('Si EL CLIENTE incumple con los pagos o manipula el sistema, EL VENDEDOR podrá:');
    doc.list([
      'Limitar el uso del equipo hasta regularizar la situación.',
      'Solicitar la devolución del producto sin reembolso de lo ya abonado.',
      'Iniciar acciones legales por los montos pendientes.'
    ]);
    doc.moveDown();
    doc.text('7. SOBRE LA INSTALACIÓN');
    doc.text('La instalación del equipo está incluida y se realiza en tienda, previa cita. El CLIENTE debe acudir con su vehículo para la programación del equipo.');
    doc.moveDown();
    doc.text('8. JURISDICCIÓN');
    doc.text('Ambas partes acuerdan que, en caso de conflicto, se someterán a los tribunales de la ciudad de Trujillo.');
    doc.moveDown();
    doc.text(`Firmado con conformidad el día ${data.fecha_inicio}.`, { align: 'center' });
    doc.moveDown();
    doc.text('___________________________', { align: 'left' });
    doc.text('EL VENDEDOR', { align: 'left' });
    doc.text('Jordy Vigo', { align: 'left' });
    doc.text('CRD IMPORT', { align: 'left' });
    doc.moveDown();
    doc.text('___________________________', { align: 'left' });
    doc.text('EL CLIENTE', { align: 'left' });
    doc.text(`Nombre: ${data.nombre_cliente}`, { align: 'left' });
    doc.text(`DNI: ${data.dni_cliente}`, { align: 'left' });
    doc.text(`Placa: ${data.placa_vehiculo}`, { align: 'left' });
    doc.end();
  });
}

module.exports = {
  generarContratoPDF,
  generarGarantiaPDF
};
