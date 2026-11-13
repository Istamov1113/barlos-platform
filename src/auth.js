'use strict';
const crypto = require('crypto');
const db = require('./db');
const mail = require('./mail');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'eldoristamov381@gmail.com').trim().toLowerCase();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rid = (n = 16) => crypto.randomBytes(n).toString('hex');

function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return salt.toString('hex') + ':' + h.toString('hex');
}
function checkPw(pw, stored) {
  const [s, h] = String(stored).split(':'); if (!s || !h) return false;
  const x = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const find = email => db.db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
const byId = id => db.db.prepare('SELECT * FROM users WHERE id=?').get(id);
function validEmail(e) { return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e); }
function validPw(p) { return typeof p === 'string' && p.length >= 8 && p.length <= 200; }

function createUser({ email, name, password, role, verified, phone }) {
  email = String(email).trim().toLowerCase();
  const id = 'U' + (1000 + db.seq('user'));
  const r = (email === ADMIN_EMAIL) ? 'admin' : (role || 'client');
  db.db.prepare('INSERT INTO users(id,email,name,phone,hash,role,verified,created) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, email, name || '', phone || '', hashPw(password), r, verified ? 1 : 0, Date.now());
  return byId(id);
}

/* Sessiya */
function parseUA(ua) {
  ua = String(ua || '');
  const os = /Windows NT 10|Windows NT 11/.test(ua) ? 'Windows' : /Android ([\d.]+)/.test(ua) ? 'Android ' + RegExp.$1 : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Noma’lum';
  const br = /Edg\/([\d]+)/.test(ua) ? 'Edge ' + RegExp.$1 : /OPR\/([\d]+)/.test(ua) ? 'Opera ' + RegExp.$1 : /Chrome\/([\d]+)/.test(ua) ? 'Chrome ' + RegExp.$1 : /Firefox\/([\d]+)/.test(ua) ? 'Firefox ' + RegExp.$1 : /Safari\//.test(ua) ? 'Safari' : 'Brauzer';
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android qurilma' : /Mac/.test(ua) ? 'Mac kompyuter' : /Windows/.test(ua) ? 'Windows kompyuter' : 'Qurilma';
  return { dev, os, br };
}
function newSession(uid, req) {
  const tok = rid(32), now = Date.now();
  db.db.prepare('INSERT INTO sessions(id,uid,ua,ip,created,last) VALUES(?,?,?,?,?,?)').run(sha(tok), uid, String(req.headers['user-agent'] || '').slice(0, 300), req.ip, now, now);
  db.db.prepare('UPDATE users SET last=? WHERE id=?').run(now, uid);
  return tok;
}
function cookies(req) {
  const o = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return o;
}
function setCookie(req, res, tok) {
  const secure = process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && (req.secure || req.headers['x-forwarded-proto'] === 'https'));
  res.setHeader('Set-Cookie', 'sid=' + tok + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + 30 * 86400 + (secure ? '; Secure' : ''));
}
function clearCookie(res) { res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'); }

function middleware(req, res, next) {
  const tok = cookies(req).sid; req.user = null; req.sid = null;
  if (tok) {
    const h = sha(tok), s = db.db.prepare('SELECT * FROM sessions WHERE id=?').get(h);
    if (s && Date.now() - s.last < 30 * 86400e3) {
      const u = byId(s.uid);
      if (u && !u.blocked) {
        req.user = u; req.sid = h;
        if (Date.now() - s.last > 60e3) db.db.prepare('UPDATE sessions SET last=?, ip=? WHERE id=?').run(Date.now(), req.ip, h);
      }
    }
  }
  next();
}
const need = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Kirish talab qilinadi.' });
  if (roles.length && roles.indexOf(req.user.role) < 0) return res.status(403).json({ error: 'Ruxsat yo’q.' });
  next();
};

/* Urinishlarni cheklash */
const fails = new Map();
function limited(key) { const f = fails.get(key); return f && f.n >= 8 && Date.now() - f.t < 15 * 60e3; }
function fail(key) { const f = fails.get(key) || { n: 0, t: 0 }; if (Date.now() - f.t > 15 * 60e3) f.n = 0; f.n++; f.t = Date.now(); fails.set(key, f); }
function ok(key) { fails.delete(key); }

/* Email tasdiqlash / tiklash kodi */
async function issueCode(u, purpose) {
  const code = String(crypto.randomInt(100000, 1000000));
  db.db.prepare('UPDATE users SET code=?, code_exp=?, code_try=0 WHERE id=?').run(sha(u.id + code), Date.now() + 15 * 60e3, u.id);
  await mail.send(u.email, 'BARLOS: tasdiqlash kodi', (purpose === 'reset' ? 'Parolni tiklash kodi: ' : 'Ro‘yxatdan o‘tishni tasdiqlash kodi: ') + code + '\nKod 15 daqiqa amal qiladi. Agar siz so‘ramagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring.');
}
function checkCode(u, code) {
  if (!u || !u.code || Date.now() > u.code_exp || u.code_try >= 5) return false;
  db.db.prepare('UPDATE users SET code_try=code_try+1 WHERE id=?').run(u.id);
  const a = Buffer.from(sha(u.id + String(code).trim())), b = Buffer.from(u.code);
  const good = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (good) db.db.prepare('UPDATE users SET code=NULL, code_exp=NULL WHERE id=?').run(u.id);
  return good;
}
module.exports = { ADMIN_EMAIL, hashPw, checkPw, find, byId, validEmail, validPw, createUser, parseUA, newSession, setCookie, clearCookie, middleware, need, limited, fail, ok, issueCode, checkCode, sha, rid };
