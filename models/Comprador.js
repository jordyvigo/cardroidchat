// models/Comprador.js
const mongoose = require('mongoose');

const compradorSchema = new mongoose.Schema({
  numero: { type: String, required: true },
  producto: { type: String, required: true },
  placa: { type: String },
  fechaInicio: { type: String, required: true },
  fechaExpiracion: { type: String, required: true }
});

module.exports = mongoose.model('Comprador', compradorSchema, 'compradores');
