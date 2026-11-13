'use strict';
/* Administratorni yaratish yoki parolini yangilash:  npm run setup  */
try { require('fs').readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) { }
const readline = require('readline');
const db = require('../src/db');
const auth = require('../src/auth');
function ask(q, hidden) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) { rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); else process.stdout.write('*'); }; }
    rl.question(q, a => { rl.close(); if (hidden) process.stdout.write('\n'); res(a); });
  });
}
(async () => {
  const email = auth.ADMIN_EMAIL;
  console.log('Administrator emaili: ' + email);
  let pw = process.env.ADMIN_PASSWORD;
  if (!pw) { pw = await ask('Yangi parol (kamida 8 belgi): ', true); const p2 = await ask('Parolni takrorlang: ', true); if (pw !== p2) { console.error('Parollar mos kelmadi.'); process.exit(1); } }
  if (!auth.validPw(pw)) { console.error('Parol kamida 8 belgidan iborat bo‘lsin.'); process.exit(1); }
  const u = auth.find(email);
  if (u) { db.db.prepare('UPDATE users SET hash=?, role=?, verified=1, blocked=0 WHERE id=?').run(auth.hashPw(pw), 'admin', u.id); db.db.prepare('DELETE FROM sessions WHERE uid=?').run(u.id); console.log('Administrator paroli yangilandi.'); }
  else { auth.createUser({ email, name: 'Administrator', password: pw, verified: true }); console.log('Administrator yaratildi.'); }
  process.exit(0);
})();
