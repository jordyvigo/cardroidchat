// config/database.js - Configura la conexión a MongoDB
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB (ofertaclientes)'))
.catch(err => console.error('Error conectando a MongoDB:', err));
