// server.js - Punto de entrada principal
require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear el body de los formularios
app.use(express.urlencoded({ extended: true }));

// Conexión a la base de datos
require('./config/database');

// Configurar rutas
app.use('/', require('./routes/crm'));
app.use('/', require('./routes/financiamiento'));
app.use('/', require('./routes/garantia'));
app.use('/', require('./routes/whatsapp'));
app.use('/', require('./routes/sendCustom'));  // Agregamos la ruta para sendCustom

// Iniciar tareas programadas
require('./schedules');

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
