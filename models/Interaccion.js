// models/Interaccion.js
const mongoose = require('mongoose');

const interaccionSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  tipo: { type: String },
  mensaje: { type: String },
  ofertaReferencia: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Interaccion', interaccionSchema, 'interacciones');
