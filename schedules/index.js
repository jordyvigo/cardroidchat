// schedules/index.js - Tareas programadas (recordatorios)
const schedule = require('node-schedule');
const { getCurrentDateGMTMinus5, formatDateDDMMYYYY } = require('../helpers/utilities');
const Comprador = require('../models/Comprador');
const Financiamiento = require('../models/Financiamiento');
const client = require('../config/whatsapp');

schedule.scheduleJob('0 8 * * *', async function() {
  const today = getCurrentDateGMTMinus5();
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const targetStr = formatDateDDMMYYYY(targetDate);
  console.log(`Recordatorio: Buscando garantías que expiran el ${targetStr}`);
  const expiringGuarantees = await Comprador.find({ fechaExpiracion: targetStr });
  expiringGuarantees.forEach(async guarantee => {
    console.log(`Enviando recordatorio a ${guarantee.numero} para ${guarantee.producto}`);
    await client.sendMessage(
      guarantee.numero + '@c.us',
      `Recordatorio: Tu garantía para ${guarantee.producto}${guarantee.placa ? ' (Placa: ' + guarantee.placa + ')' : ''} expira el ${guarantee.fechaExpiracion}.`
    );
  });
});

schedule.scheduleJob('30 8 * * *', async function() {
  const today = getCurrentDateGMTMinus5();
  const todayStr = formatDateDDMMYYYY(today);
  console.log(`Recordatorio cuotas: Buscando cuotas vencientes para hoy ${todayStr}`);
  const financiamientos = await Financiamiento.find({});
  for (const fin of financiamientos) {
    for (const [index, cuota] of fin.cuotas.entries()) {
      if (!cuota.pagada && cuota.vencimiento === todayStr) {
        const msg = `Recordatorio: Tu cuota ${index + 1} para ${fin.producto} vence hoy (${cuota.vencimiento}). Por favor realiza tu pago.`;
        let numberId;
        try {
          numberId = await client.getNumberId(fin.numero);
          if (!numberId) numberId = { _serialized: fin.numero + '@c.us' };
          await client.sendMessage(numberId._serialized, msg);
          console.log(`Recordatorio enviado a ${fin.numero} para cuota ${index + 1}`);
        } catch (err) {
          console.error(`Error enviando recordatorio para ${fin.numero}:`, err);
        }
      }
    }
  }
});
