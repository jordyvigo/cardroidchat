// helpers/utilities.js - Funciones comunes y de ayuda

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentDateGMTMinus5() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
}

function parseDateDDMMYYYY(str) {
  if (!str) throw new Error("Fecha indefinida");
  let [d, m, y] = str.split('/');
  if (y && y.length === 2) y = '20' + y;
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
}

function formatDateDDMMYYYY(date) {
  let d = date.getDate();
  let m = date.getMonth() + 1;
  let y = date.getFullYear();
  if (d < 10) d = '0' + d;
  if (m < 10) m = '0' + m;
  return `${d}/${m}/${y}`;
}

function daysRemaining(expirationDateStr) {
  try {
    const expDate = parseDateDDMMYYYY(expirationDateStr);
    const today = getCurrentDateGMTMinus5();
    const diff = expDate - today;
    return Math.ceil(diff / (1000 * 3600 * 24));
  } catch (e) {
    console.error("Error calculando días restantes:", e);
    return 0;
  }
}

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * getNavBar:
 * Devuelve una cadena HTML con una barra de navegación,
 * la cual se puede insertar en vistas o formularios para tener un menú común.
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

// Exportamos todas las funciones para que puedan ser usadas en otros módulos
module.exports = {
  sleep,
  getCurrentDateGMTMinus5,
  parseDateDDMMYYYY,
  formatDateDDMMYYYY,
  daysRemaining,
  removeAccents,
  getNavBar
};
