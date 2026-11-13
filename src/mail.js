'use strict';
let tr = null;
function init() {
  if (tr !== null) return tr;
  tr = false;
  if (!process.env.SMTP_HOST) return tr;
  try {
    const nm = require('nodemailer');
    tr = nm.createTransport({
      host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '') === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  } catch (e) { console.warn('nodemailer topilmadi, email yuborilmaydi:', e.message); }
  return tr;
}
const enabled = () => !!init();
async function send(to, subject, text) {
  const t = init(); if (!t) throw new Error('SMTP sozlanmagan');
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
}
module.exports = { enabled, send };
