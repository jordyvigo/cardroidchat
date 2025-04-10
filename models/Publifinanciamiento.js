// models/Publifinanciamiento.js
const mongoose = require('mongoose');

const publifinanciamientoSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Publifinanciamiento', publifinanciamientoSchema, 'publifinanciamiento');
