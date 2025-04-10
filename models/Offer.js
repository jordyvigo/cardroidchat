// models/Offer.js
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Offer', offerSchema, 'offers');
