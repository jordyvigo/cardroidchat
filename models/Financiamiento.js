// models/Financiamiento.js
const mongoose = require('mongoose');

const financiamientoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  numero: { type: String, required: true },
  dni: { type: String, required: true },
  placa: { type: String, required: true },
  montoTotal: { type: Number, required: true },
  cuotaInicial: { type: Number, default: 350 },
  cuotas: [{
    monto: { type: Number, required: true },
    vencimiento: { type: String, required: true },
    pagada: { type: Boolean, default: false }
  }],
  fechaInicio: { type: String, required: true },
  fechaFin: { type: String }
});

module.exports = mongoose.model('Financiamiento', financiamientoSchema, 'financiamientos');
