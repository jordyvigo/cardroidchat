// helpers/utilities.js - Funciones comunes y de ayuda

/**
 * Retorna una Promise que se resuelve después de ms milisegundos.
 * @param {number} ms - Milisegundos a esperar.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Obtiene la fecha y hora actual para la zona horaria "America/Lima".
 * @returns {Date} - Objeto Date con la fecha y hora actual en Lima.
 */
function getCurrentDateGMTMinus5() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
}

/**
 * Convierte una cadena en formato "DD/MM/YYYY" o "DD/MM/YY" a un objeto Date.
 * @param {string} str - Fecha en formato "DD/MM/YYYY".
 * @returns {Date} - Objeto Date correspondiente.
 * @throws {Error} - Si la cadena es undefined o no tiene el formato correcto.
 */
function parseDateDDMMYYYY(str) {
  if (!str) throw new Error("Fecha indefinida");
  let [d, m, y] = str.split('/');
  // Si el año tiene dos dígitos, se asume que es del siglo XXI.
  if (y && y.length === 2) y = '20' + y;
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
}

/**
 * Formatea un objeto Date a una cadena "DD/MM/YYYY".
 * @param {Date} date - Objeto Date a formatear.
 * @returns {string} - Cadena formateada.
 */
function formatDateDDMMYYYY(date) {
  let d = date.getDate();
  let m = date.getMonth() + 1;
  let y = date.getFullYear();
  // Asegurarse de que día y mes tengan dos dígitos
  d = (d < 10 ? '0' : '') + d;
  m = (m < 10 ? '0' : '') + m;
  return `${d}/${m}/${y}`;
}

/**
 * Calcula el número de días restantes desde hoy hasta una fecha de expiración en formato "DD/MM/YYYY".
 * @param {string} expirationDateStr - Fecha de expiración en formato "DD/MM/YYYY".
 * @returns {number} - Días restantes; si ocurre un error, retorna 0.
 */
function daysRemaining(expirationDateStr) {
  try {
    const expDate = parseDateDDMMYYYY(expirationDateStr);
    const today = getCurrentDateGMTMinus5();
    const diff = expDate - today; // diferencia en milisegundos
    return Math.ceil(diff / (1000 * 3600 * 24));
  } catch (e) {
    console.error("Error calculando días restantes:", e);
    return 0;
  }
}

/**
 * Elimina los acentos de una cadena usando normalización Unicode.
 * @param {string} str - Cadena a procesar.
 * @returns {string} - Cadena sin acentos.
 */
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Devuelve un fragmento HTML con una barra de navegación.
 * Esta función es útil para incluir un menú común en tus vistas.
 * @returns {string} - HTML para la barra de navegación.
 */
function getNavBar() {
  return `
    <nav style="background:#007BFF; padding:10px; text-align:center; margin-bottom:20px;">
      <a style="color:white; margin:0 10px; text-decoration:none;" href="/crm">Dashboard CRM</a>
      <a style="color:white; margin:0 10px; text-decoration:none;" href="/financiamiento/crear">Nuevo Financiamiento</a>
      <a style="color:white; margin:0 10px; text-decoration:none;" href="/financiamiento/buscar">Buscar Financiamiento</a>
      <a style="color:white; margin:0 10px; text-decoration:none;" href="/garantia/crear">Generar Garantía</a>
      <a style="color:white; margin:0 10px; text-decoration:none;" href="/qr">Ver QR</a>
      <a style="color:white; margin:0 10px; text-decoration:none;" href="/whatsapp/restart">Reiniciar WhatsApp</a>
    </nav>
  `;
}

// Exportamos todas las funciones para que puedan ser utilizadas en otros módulos.
module.exports = {
  sleep,
  getCurrentDateGMTMinus5,
  parseDateDDMMYYYY,
  formatDateDDMMYYYY,
  daysRemaining,
  removeAccents,
  getNavBar
};
