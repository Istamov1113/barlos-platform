'use strict';
try { require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) { /* .env ixtiyoriy */ }
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./src/db');
const auth = require('./src/auth');
const mail = require('./src/mail');
const sources = require('./src/sources');
const candles = require('./src/candles');
const contract = require('./src/contract');
const reports = require('./src/reports');
const chat = require('./src/chat');
const profile = require('./src/profile');
const hist = require('./src/hist');
const tabular = require('./src/tabular');
const Core = require('./public/core.js');
const Ind = require('./public/indicators.js');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use('/api/history/import', express.json({ limit: '40mb' }));
app.use(express.json({ limit: '300kb' }));
app.use(express.text({ type: ['text/*'], limit: '50kb' }));
app.use('/api', auth.middleware);
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && !req.path.startsWith('/webhook') && !(req.headers['content-type'] || '').includes('application/json')) return res.status(415).json({ error: 'JSON kerak.' });
  next();
});
const wrap = fn => (req, res) => { Promise.resolve().then(() => fn(req, res)).catch(e => { if (e && e.http) return res.status(e.http).json({ error: e.message }); console.error(e); res.status(500).json({ error: 'Server xatosi: ' + (e && e.message) }); }); };
const bad = (m, code) => { const e = new Error(m); e.http = code || 400; return e; };
const A = auth.need('admin'), AO = auth.need('admin', 'operator'), ANY = auth.need();
/* Shartnoma: mijoz joriy versiyani tasdiqlamaguncha yozuv o'zgartiradigan so'rovlar to'xtatiladi */
app.use('/api', (req, res, next) => {
  const u = req.user; if (!u || u.role !== 'client' || req.method === 'GET') return next();
  if (/^\/(consent|logout|me|login|register|verify|forgot|reset)(\/|$)/.test(req.path)) return next();
  if (contract.ok(u.id)) return next();
  res.status(403).json({ error: 'Avval shartnoma bandlarini tasdiqlang.', needConsent: true });
});

/* ---------------- Sozlamalar ---------------- */
function settings() {
  let s = db.get('settings', 'main');
  if (!s) { s = { id: 'main', fx: { USD: 0 }, fxAuto: true, fxT: 0, autoRel: false, nBase: 3, nHold: 5, nSell: 7, priceMin: 5, priceT: 0, pay: [] }; db.put('settings', s); }
  if (!s.v250) { s.v250 = true; s.priceMin = 5; db.put('settings', s); } /* 2.5.0: narx so'rovi har 5 daqiqada (Binance) */
  return s;
}
function loadS() {
  const st = settings(), users = {};
  db.db.prepare('SELECT id,name,email FROM users').all().forEach(u => { users[u.id] = u; });
  const accounts = db.all('accounts').map(a => Object.assign(a, { owner: (users[a.uid] && (users[a.uid].name || users[a.uid].email)) || a.uid }));
  Core.SET.nBase = st.nBase; Core.SET.nHold = st.nHold; Core.SET.nSell = st.nSell; Core.BENCHC.rate = st.benchRate != null ? st.benchRate : 25; Core.BENCHC.pay = st.benchPay || 'none';
  return { fx: st.fx, assets: db.all('assets'), accounts, tx: db.all('tx'), stoch: stochMap() };
}
const now = () => Date.now();

/* ---------------- Stoch RSI (1W): turlarning joriy maqsadi uchun ---------------- */
const STOCH_G = ['kripto', 'xalqaro', 'milliy', 'metall'], MAIN_RE = { kripto: /^BTC/, xalqaro: /^SPY/, milliy: /^UZNF$/, metall: /^XAUT/ };
function stochPar(st) { const p = (st || settings()).stoch || {}; return { rsi: p.rsi || 14, len: p.len || 14, k: p.k || 7, d: p.d || 3 }; }
function mainAsset(g, st) {
  const id = ((st || settings()).mainAsset || {})[g], a = id && db.get('assets', id);
  if (a && !a.archived && a.group === g) return a;
  return db.all('assets').filter(x => x.group === g && !x.archived && MAIN_RE[g].test(String(x.sym).toUpperCase()))[0] || null;
}
function stochMap() { const m = {}; STOCH_G.forEach(g => { const r = db.get('stoch', g); if (r) m[g] = r; }); return m; }
let stochBusy = false;
async function stochRun() {
  if (stochBusy) return stochMap(); stochBusy = true;
  try {
    const st = settings(), P = stochPar(st);
    for (const g of STOCH_G) {
      const a = mainAsset(g, st), prev = db.get('stoch', g) || {};
      if (!a) { db.put('stoch', { id: g, m: null, sym: '', aid: '', t: now(), err: 'Asosiy aktiv topilmadi: Sozlamalarda tanlang.' }); continue; }
      try {
        const r = await candles.get(a, 'W', { ph: (db.get('ph', a.id) || {}).pts, hc: hist.get(a.id) });
        const closes = (r.candles || []).map(c => c.c), v = Core.stochRsi(closes, P);
        if (v.k == null) db.put('stoch', { id: g, m: null, sym: a.sym, aid: a.id, t: now(), bars: v.bars, need: v.need, err: 'Haftalik shamlar yetarli emas: ' + v.bars + ' ta, kamida ' + v.need + ' ta kerak. Tarixni yuklang.' });
        else db.put('stoch', { id: g, m: Math.round(v.k * 100) / 100, dl: Math.round(v.d * 100) / 100, rsi: Math.round(v.rsi * 100) / 100, sym: a.sym, aid: a.id, t: now(), bars: v.bars, err: '' });
      } catch (e) { db.put('stoch', Object.assign({}, prev, { id: g, sym: a.sym, aid: a.id, t: now(), err: 'Hisoblab bo‘lmadi: ' + e.message })); }
    }
  } finally { stochBusy = false; }
  return stochMap();
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'a';
const GK = Core.GKEYS;

/* ---------------- Harakatlar jurnali (o'chirilmaydi) ---------------- */
function AU(req, action, detail, who) {
  const u = req && req.user, ua = auth.parseUA(req && req.headers && req.headers['user-agent']);
  db.put('audit', { id: 'L' + (100000 + db.seq('log')), t: now(), ip: (req && req.ip) || '', dev: ua.dev, os: ua.os, br: ua.br, uid: u ? u.id : '', actor: who || (u ? (u.name || u.email) : '—'), email: u ? u.email : '', role: u ? u.role : '', action, detail: String(detail || '').slice(0, 600) });
}
const ACTIONS = [[/^\/reports\/generate$/, 'Hisobot tayyorladi'], [/^\/consent$/, 'Shartnoma bandlarini tasdiqladi'], [/^\/contract\/admin$/, 'Shartnoma bandlarini o‘zgartirdi'], [/^\/register$/, 'Ro‘yxatdan o‘tdi'], [/^\/login$/, 'Tizimga kirdi'], [/^\/verify$/, 'Emailni tasdiqladi'], [/^\/logout$/, 'Tizimdan chiqdi'], [/^\/reset$/, 'Parolni kod bilan tikladi'], [/^\/me$/, 'Profilni o‘zgartirdi'], [/^\/me\/password$/, 'Parolni o‘zgartirdi'],
  [/^\/sessions\/end$/, 'Seansni tugatdi'], [/^\/users\/[^/]+$/, 'Foydalanuvchini o‘zgartirdi'], [/^\/assets$/, 'Aktivni saqladi'], [/^\/accounts$/, 'Hisob ochdi'], [/^\/accounts\/[^/]+$/, 'Hisob sozlamasini o‘zgartirdi'],
  [/^\/tx$/, 'Tranzaksiya kiritdi'], [/^\/tx\/[^/]+\/void$/, 'Tranzaksiyani bekor qildi'], [/^\/tx\/[^/]+\/edit$/, 'Tranzaksiyani tahrirladi'], [/^\/transfers$/, 'Ichki o‘tkazma bajardi'],
  [/^\/wd$/, 'Yechish so‘rovi yubordi'], [/^\/wd\/[^/]+$/, 'Yechish so‘rovini ko‘rib chiqdi'], [/^\/dep$/, 'Depozit so‘rovi yaratdi'], [/^\/dep\/[^/]+\/(paid|cancel)$/, 'Depozit so‘rovini yangiladi'], [/^\/dep\/[^/]+$/, 'Depozit so‘rovini ko‘rib chiqdi'],
  [/^\/signals$/, 'Qo‘lda signal yubordi'], [/^\/orders\/[^/]+\/send$/, 'Orderni bozorga yubordi'], [/^\/orders\/[^/]+\/cancel$/, 'Orderni bekor qildi'], [/^\/settings$/, 'Sozlamalarni o‘zgartirdi'], [/^\/prices\/refresh$/, 'Narxlarni yangiladi'],
  [/^\/bonds\/accept$/, 'Obligatsiya kuponi/so‘ndirishini yozdi'], [/^\/deposits\/accept$/, 'Omonat foizini yozdi'], [/^\/history\/import$/, 'Tarixiy ma‘lumot yukladi'], [/^\/history\/reset$/, 'Aktiv tarixini tozaladi'], [/^\/history\/sync$/, 'Tarixni havoladan yangiladi'], [/^\/me\/profile$/, 'Profilni yangiladi'], [/^\/me\/avatar$/, 'Profil rasmini o‘zgartirdi'], [/^\/chat\/create$/, 'Chat/kanal yaratdi'], [/^\/chat\/[^/]+\/members$/, 'Chat a’zolarini o‘zgartirdi'], [/^\/deposits\/accept-group$/, 'Omonat foizini barcha mijozlarga yozdi'], [/^\/alerts$/, 'Alert saqladi'], [/^\/alerts\/[^/]+\/(del|toggle)$/, 'Alertni o‘zgartirdi']];
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return next();
  const a = ACTIONS.filter(x => x[0].test(req.path))[0]; if (!a) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    try {
      let d = req.ad;
      if (d == null) { const b = Object.assign({}, req.body || {}); ['password', 'old', 'secret', 'newSecret'].forEach(k => delete b[k]); d = (req.params && req.params.id ? req.params.id + ' ' : '') + (typeof req.body === 'object' ? JSON.stringify(b) : ''); if (d.length < 4) d = ''; }
      AU(req, a[1], d);
    } catch (e) { console.error('jurnal xatosi', e.message); }
  });
  next();
});

/* ---------------- Ro'yxatdan o'tish va kirish ---------------- */
const pubUser = u => { const p = db.get('profile', u.id) || {}; return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, created: u.created, last: u.last, username: p.username || '', bio: p.bio || '', av: p.avT || 0, dm: p.dm || 'all', findable: !!p.findable }; };
function ensureAccount(uid) {
  if (db.all('accounts').some(a => a.uid === uid)) return;
  db.put('accounts', { id: 'A' + db.seq('acc'), uid, kind: 'uni', name: 'Universal hisob', targets: {}, prevQ: 0, archived: false, created: now() });
}

/* ---------------- Shartnoma bandlari ---------------- */
app.get('/api/contract', (req, res) => res.json(contract.pub()));
app.post('/api/consent', ANY, wrap((req, res) => {
  const b = req.body || {}; if (!b.agree) throw bad('Roziligingizni belgilang.');
  if (+b.ver !== contract.doc().ver) throw bad('Shartnoma yangilandi. Sahifani yangilang.');
  contract.record(req.user.id, req, 'login'); res.json({ ok: true });
}));
app.get('/api/contract/admin', A, wrap((req, res) => res.json(contract.adminView())));
app.post('/api/contract/admin', A, wrap((req, res) => { const b = req.body || {}; res.json(Object.assign({ ok: true }, contract.save(b.texts, b.show))); }));
app.get('/api/consents', A, wrap((req, res) => {
  const names = {}; db.db.prepare('SELECT id,name,email FROM users').all().forEach(x => { names[x.id] = x.name || x.email; });
  res.json({ ver: contract.doc().ver, list: db.all('consent').sort((a, b) => b.t - a.t).slice(0, 2000).map(r => Object.assign({}, r, { name: names[r.uid] || r.uid })) });
}));

/* ---------------- Hisobotlar (PDF) ---------------- */
const repPub = r => ({ id: r.id, scope: r.scope, kind: r.kind, ref: r.ref, accId: r.accId, name: r.name, title: r.title, size: r.size, t: r.t, ver: r.ver, hash: r.hash });
const myAccIds = u => db.all('accounts').filter(a => a.uid === u.id).map(a => a.id);
app.get('/api/reports', ANY, wrap((req, res) => { res.json({ list: reports.listFor(req.user, myAccIds(req.user)).map(repPub).slice(0, 1000), conf: req.user.role === 'admin' ? reports.conf(settings()) : undefined }); }));
app.get('/api/reports/:id/pdf', ANY, wrap((req, res) => {
  const rec = db.get('reports', req.params.id); if (!rec) throw bad('Hujjat topilmadi.', 404);
  if (!reports.listFor(req.user, myAccIds(req.user)).some(r => r.id === rec.id)) throw bad('Bu hujjatni ko‘rishga ruxsat yo‘q.', 403);
  const f = reports.fileOf(rec); if (!require('fs').existsSync(f)) throw bad('Fayl serverda topilmadi.', 404);
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', (req.query.dl ? 'attachment' : 'inline') + '; filename="barlos-' + rec.kind + '-' + rec.ref + (rec.accId ? '-' + rec.accId : '') + '.pdf"'); res.setHeader('Cache-Control', 'private, max-age=0');
  require('fs').createReadStream(f).pipe(res);
}));
app.post('/api/reports/generate', A, wrap(async (req, res) => {
  const b = req.body || {}, kind = String(b.kind || ''), ref = String(b.ref || ''), S = loadS(), st = settings();
  if (['oylik', 'chorak', 'yillik', 'napp', 'soliq'].indexOf(kind) < 0) throw bad('Hisobot turi noto‘g‘ri.');
  try { reports.periodOf(kind, ref); } catch (e) { throw bad('Davr noto‘g‘ri. Oylik: 2026-10, chorak: 2026-Q3, yillik: 2026.'); }
  const made = [];
  if (kind === 'napp' || kind === 'soliq') made.push(await reports.generate(S, st, kind, ref, '', { force: true }));
  else { const ids = b.acc ? [String(b.acc)] : S.accounts.filter(a => !a.archived && S.tx.some(t => t.acc === a.id)).map(a => a.id); for (const id of ids) made.push(await reports.generate(S, st, kind, ref, id, { force: true })); }
  res.json({ ok: true, made: made.filter(Boolean).map(repPub) });
}));
let repBusy = false;
async function reportLoop() {
  if (repBusy) return; repBusy = true;
  try {
    const made = await reports.auto(loadS(), settings());
    made.filter(r => r.scope === 'client').forEach(r => db.put('alog', { id: 'G' + (100000 + db.seq('alog')), uid: r.uid, alert: 'rep', aid: '', sym: '', tf: '', t: now(), price: null, name: 'Hisobot', text: 'Yangi hisobot tayyor: ' + r.title + '. Hisobotlar sahifasidan PDF ni oching.', signal: '' }));
    if (made.length) console.log('Hisobotlar tayyorlandi: ' + made.length);
  } catch (e) { console.error('hisobot:', e.message); } finally { repBusy = false; }
}
app.get('/api/config', (req, res) => res.json({ smtp: mail.enabled(), cmc: !!process.env.CMC_API_KEY }));

app.post('/api/register', wrap(async (req, res) => {
  const { email, password, name } = req.body || {}, em = String(email || '').trim().toLowerCase();
  if (!auth.validEmail(em)) throw bad('Email noto‘g‘ri.');
  if (!auth.validPw(password)) throw bad('Parol kamida 8 ta belgidan iborat bo‘lsin.');
  if (!String(name || '').trim()) throw bad('Ism-familiyani kiriting.');
  if (auth.limited('reg|' + req.ip)) throw bad('Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.', 429);
  auth.fail('reg|' + req.ip);
  if (auth.find(em)) throw bad('Bu email bilan hisob allaqachon bor. Kirish bo‘limidan foydalaning.');
  if (em === auth.ADMIN_EMAIL && !mail.enabled()) throw bad('Bu email administrator uchun ajratilgan. Uni serverda "npm run setup" buyrug‘i bilan yarating (qo‘llanmaga qarang).', 403);
  if (!(req.body || {}).agree) throw bad('Shartnoma bandlari bilan tanishib, roziligingizni belgilang.');
  if ((req.body || {}).cver != null && +(req.body || {}).cver !== contract.doc().ver) throw bad('Shartnoma yangilandi. Sahifani yangilab, bandlarni qayta o‘qing.');
  const needV = mail.enabled();
  const u = auth.createUser({ email: em, name: String(name).trim().slice(0, 80), password, verified: !needV });
  if (u.role === 'client') { ensureAccount(u.id); contract.record(u.id, req, 'register'); }
  req.user = u; req.ad = em;
  if (needV) { try { await auth.issueCode(u, 'verify'); } catch (e) { throw bad('Tasdiqlash xati yuborilmadi: ' + e.message, 502); } return res.json({ needVerify: true }); }
  auth.setCookie(req, res, auth.newSession(u.id, req));
  res.json({ ok: true });
}));
app.post('/api/verify', wrap((req, res) => {
  const u = auth.find((req.body || {}).email);
  if (!u || !auth.checkCode(u, (req.body || {}).code)) throw bad('Kod noto‘g‘ri yoki muddati tugagan.');
  db.db.prepare('UPDATE users SET verified=1 WHERE id=?').run(u.id); req.user = u; req.ad = u.email;
  auth.setCookie(req, res, auth.newSession(u.id, req)); res.json({ ok: true });
}));
app.post('/api/login', wrap(async (req, res) => {
  const { email, password } = req.body || {}, key = 'login|' + req.ip + '|' + String(email || '').toLowerCase();
  if (auth.limited(key)) throw bad('Juda ko‘p noto‘g‘ri urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring.', 429);
  const u = auth.find(email);
  if (!u || !auth.checkPw(String(password || ''), u.hash)) { auth.fail(key); AU(req, 'Kirish urinishi muvaffaqiyatsiz', 'noto‘g‘ri email yoki parol', String(email || '').slice(0, 80)); throw bad('Email yoki parol noto‘g‘ri.', 401); }
  if (u.blocked) throw bad('Hisob bloklangan. Administrator bilan bog‘laning.', 403);
  if (!u.verified) { try { await auth.issueCode(u, 'verify'); } catch (e) { /* SMTP */ } return res.status(403).json({ error: 'Email tasdiqlanmagan. Pochtangizga kod yuborildi.', needVerify: true }); }
  auth.ok(key); req.user = u; req.ad = u.email; auth.setCookie(req, res, auth.newSession(u.id, req)); res.json({ ok: true });
}));
app.post('/api/logout', wrap((req, res) => { if (req.sid) db.db.prepare('DELETE FROM sessions WHERE id=?').run(req.sid); auth.clearCookie(res); res.json({ ok: true }); }));
app.post('/api/forgot', wrap(async (req, res) => {
  const u = auth.find((req.body || {}).email);
  if (u && mail.enabled() && !auth.limited('fg|' + req.ip)) { auth.fail('fg|' + req.ip); try { await auth.issueCode(u, 'reset'); } catch (e) { console.error(e.message); } }
  res.json({ ok: true, smtp: mail.enabled() });
}));
app.post('/api/reset', wrap((req, res) => {
  const { email, code, password } = req.body || {}, u = auth.find(email);
  if (!auth.validPw(password)) throw bad('Parol kamida 8 ta belgidan iborat bo‘lsin.');
  if (!u || !auth.checkCode(u, code)) throw bad('Kod noto‘g‘ri yoki muddati tugagan.');
  db.db.prepare('UPDATE users SET hash=?, verified=1 WHERE id=?').run(auth.hashPw(password), u.id);
  db.db.prepare('DELETE FROM sessions WHERE uid=?').run(u.id); res.json({ ok: true });
}));

/* ---------------- Holat (state) ---------------- */
function sweepOrders() {
  const t = now();
  db.all('orders').filter(o => o.status === 'Kutilmoqda' && o.exp < t).forEach(o => { o.status = 'Muddati o’tgan'; o.by = 'Tizim'; o.fin = o.exp; db.put('orders', o); });
}
function sessionsOf(uid) { return db.db.prepare('SELECT id,ua,ip,created,last FROM sessions WHERE uid=? ORDER BY last DESC').all(uid).map(s => Object.assign({ id: s.id, ip: s.ip, created: s.created, last: s.last }, auth.parseUA(s.ua))); }
app.get('/api/version', ANY, (req, res) => res.json({ rev: db.rev() }));
app.get('/api/state', ANY, wrap((req, res) => {
  const u = req.user, st = settings(), isStaff = u.role === 'admin' || u.role === 'operator';
  if (u.role === 'client') ensureAccount(u.id);
  if (isStaff) sweepOrders();
  let accounts = db.all('accounts'), tx = db.all('tx'), wd = db.all('wd');
  const names = {}; db.db.prepare('SELECT id,name,email FROM users').all().forEach(x => { names[x.id] = x.name || x.email; });
  accounts.forEach(a => { a.owner = names[a.uid] || a.uid; });
  let dep = db.all('dep');
  if (!isStaff) { accounts = accounts.filter(a => a.uid === u.id); const ids = new Set(accounts.map(a => a.id)); tx = tx.filter(t => ids.has(t.acc) && t.status === 'Bajarildi').map(t => { const c = Object.assign({}, t); delete c.edits; delete c.voidReason; return c; }); wd = wd.filter(w => ids.has(w.acc)); dep = dep.filter(w => ids.has(w.acc)); }
  const sessions = sessionsOf(u.id).map(s => Object.assign(s, { cur: s.id === req.sid }));
  const out = { rev: db.rev(), me: Object.assign(pubUser(u), { sessions, consent: { ok: isStaff || contract.ok(u.id), ver: contract.doc().ver, t: ((db.get('consent', u.id + ':' + contract.doc().ver) || {}).t) || 0 } }), settings: { fx: st.fx, fxT: st.fxT, nBase: st.nBase, nHold: st.nHold, nSell: st.nSell, pay: st.pay || [], benchRate: st.benchRate != null ? st.benchRate : 25, stoch: stochPar(st), mainAsset: Object.fromEntries(STOCH_G.map(g => { const a = mainAsset(g, st); return [g, a ? a.id : '']; })), benchPay: st.benchPay || 'none' },
    stoch: stochMap(),
    assets: db.all('assets').map(a => Object.assign(isStaff ? a : { id: a.id, sym: a.sym, name: a.name, group: a.group, curr: a.curr, price: a.price, rate: a.rate, dpay: a.dpay, dcap: a.dcap, dstart: a.dstart, target: a.target, archived: a.archived, venue: a.venue }, { isin: a.isin || isinOf(a), issuer: a.issuer || '' })),
    accounts, tx, wd, dep };
  if (u.role === 'client' && !out.me.consent.ok) out.contract = contract.pub();
  out.alerts = db.all('alerts').filter(a => a.uid === u.id); out.alog = db.all('alog').filter(a => a.uid === u.id).sort((x, y) => y.t - x.t).slice(0, 20);
  if (isStaff) {
    out.signals = db.all('signals'); out.orders = db.all('orders');
    out.settings.autoRel = st.autoRel; out.settings.priceMin = st.priceMin; out.settings.priceT = st.priceT; out.settings.fxAuto = st.fxAuto;
  }
  if (u.role === 'admin') {
    out.audit = db.all('audit').sort((a, b) => b.t - a.t).slice(0, 5000);
    delete out.settings.secret; out.cfg = { smtp: mail.enabled(), cmc: !!process.env.CMC_API_KEY };
    out.users = db.db.prepare('SELECT * FROM users ORDER BY created').all().map(x => Object.assign(pubUser(x), { verified: !!x.verified, blocked: !!x.blocked, sessions: sessionsOf(x.id) }));
  }
  res.json(out);
}));

/* ---------------- Profil va seanslar ---------------- */
app.post('/api/me', ANY, wrap((req, res) => {
  const { name, phone } = req.body || {};
  db.db.prepare('UPDATE users SET name=?, phone=? WHERE id=?').run(String(name || '').trim().slice(0, 80), String(phone || '').trim().slice(0, 30), req.user.id); db.touch(); res.json({ ok: true });
}));
app.post('/api/me/password', ANY, wrap((req, res) => {
  const { old, password } = req.body || {};
  if (!auth.checkPw(String(old || ''), req.user.hash)) throw bad('Joriy parol noto‘g‘ri.');
  if (!auth.validPw(password)) throw bad('Yangi parol kamida 8 ta belgidan iborat bo‘lsin.');
  db.db.prepare('UPDATE users SET hash=? WHERE id=?').run(auth.hashPw(password), req.user.id);
  db.db.prepare('DELETE FROM sessions WHERE uid=? AND id<>?').run(req.user.id, req.sid); db.touch(); res.json({ ok: true });
}));
app.post('/api/sessions/end', ANY, wrap((req, res) => {
  const { id, others, uid } = req.body || {};
  const target = (uid && req.user.role === 'admin') ? uid : req.user.id;
  if (others) db.db.prepare('DELETE FROM sessions WHERE uid=? AND id<>?').run(target, req.sid);
  else if (id) db.db.prepare('DELETE FROM sessions WHERE id=? AND uid=?').run(String(id), target);
  db.touch(); res.json({ ok: true });
}));
app.post('/api/users/:id', A, wrap((req, res) => {
  const u = auth.byId(req.params.id); if (!u) throw bad('Foydalanuvchi topilmadi.', 404);
  req.ad = u.email + ' ' + JSON.stringify({ role: (req.body || {}).role, blocked: (req.body || {}).blocked, parol: (req.body || {}).password ? 'yangi o‘rnatildi' : undefined });
  const { role, blocked, password } = req.body || {}, isMain = u.email === auth.ADMIN_EMAIL;
  if (role !== undefined) { if (isMain) throw bad('Asosiy administrator rolini o‘zgartirib bo‘lmaydi.'); if (['client', 'operator'].indexOf(role) < 0) throw bad('Rol noto‘g‘ri.'); db.db.prepare('UPDATE users SET role=? WHERE id=?').run(role, u.id); }
  if (blocked !== undefined) { if (isMain) throw bad('Asosiy administratorni bloklab bo‘lmaydi.'); db.db.prepare('UPDATE users SET blocked=? WHERE id=?').run(blocked ? 1 : 0, u.id); if (blocked) db.db.prepare('DELETE FROM sessions WHERE uid=?').run(u.id); }
  if (password !== undefined) { if (!auth.validPw(password)) throw bad('Parol kamida 8 ta belgi.'); db.db.prepare('UPDATE users SET hash=? WHERE id=?').run(auth.hashPw(password), u.id); db.db.prepare('DELETE FROM sessions WHERE uid=?').run(u.id); }
  db.touch(); res.json({ ok: true });
}));

/* ---------------- Aktivlar (katalog) ---------------- */
const CURRS = ['UZS', 'USD'];
app.post('/api/assets', A, wrap((req, res) => {
  const b = req.body || {}, cur = b.id ? db.get('assets', b.id) : null;
  if (b.id && !cur) throw bad('Aktiv topilmadi.', 404);
  const sym = String(b.sym || '').trim(); if (!sym) throw bad('Belgi (ticker) kiritilmagan.');
  if (GK.indexOf(b.group) < 0) throw bad('Guruh noto‘g‘ri.');
  if (CURRS.indexOf(b.curr) < 0) throw bad('Valyuta UZS yoki USD bo‘lsin.');
  const price = b.price === '' || b.price == null ? null : +b.price; if (price != null && !(price >= 0)) throw bad('Narx noto‘g‘ri.');
  const tg = b.target === '' || b.target == null ? 0 : +b.target; if (!(tg >= 0 && tg <= 100)) throw bad('Normal ulush 0–100 oralig‘ida bo‘lsin.');
  const a = Object.assign({}, cur || { archived: false, created: now() }, {
    sym, name: String(b.name || sym).trim().slice(0, 120), group: b.group, curr: b.curr, price, rate: b.rate === '' || b.rate == null ? null : +b.rate,
    target: tg, venue: b.venue ? String(b.venue).slice(0, 30) : '', quote: b.quote && db.get('assets', String(b.quote)) ? String(b.quote) : '', tv: b.tv ? String(b.tv).toUpperCase().trim() : '',
    src: b.src && b.src.type && b.src.ref ? { type: String(b.src.type), ref: String(b.src.ref).trim() } : null, priceT: price != null ? (cur && cur.price === price ? cur.priceT : now()) : null
  });
  if (!cur) { let id = slug(sym), n = 1; while (db.get('assets', id)) id = slug(sym) + '-' + (++n); a.id = id; }
  if (cur && cur.group !== a.group && db.all('tx').some(t => t.aid === a.id)) throw bad('Tranzaksiyasi bor aktivning guruhini o‘zgartirib bo‘lmaydi.');
  if (b.archived !== undefined) a.archived = !!b.archived;
  if (b.bond !== undefined) { if (!b.bond) a.bond = null; else if (a.group !== 'obligatsiya') throw bad('Kupon jadvali faqat obligatsiya guruhidagi aktivga qo‘yiladi.'); else a.bond = cleanBond(b.bond); }
  if (b.dpay !== undefined) { if (['none', 'monthly'].indexOf(b.dpay) < 0) throw bad('Foiz to‘lov davriyligi noto‘g‘ri.'); a.dpay = a.group === 'omonat' ? b.dpay : 'none'; }
  if (b.dstart !== undefined) { if (b.dstart && !ISO(b.dstart)) throw bad('Omonat boshlanish sanasi YYYY-OO-KK ko‘rinishida bo‘lsin.'); a.dstart = b.dstart ? String(b.dstart) : ''; }
  if (b.dcap !== undefined) a.dcap = !!b.dcap;
  if (b.isin !== undefined) a.isin = String(b.isin || '').trim().toUpperCase().slice(0, 20);
  if (b.issuer !== undefined) a.issuer = String(b.issuer || '').trim().slice(0, 120);
  if (b.csym !== undefined) a.csym = String(b.csym || '').trim().slice(0, 60);
  if (b.hurl !== undefined) a.hurl = /^https?:\/\//i.test(b.hurl || '') ? String(b.hurl).trim().slice(0, 600) : '';
  if (b.close !== undefined) a.close = /^\d{1,2}:\d{2}(\s+(wd|all))?$/i.test(String(b.close || '').trim()) ? String(b.close).trim() : '';
  db.put('assets', a); if (a.price != null && (!cur || cur.price !== a.price)) recPrice(a.id, a.price); if (!a.archived && a.group !== 'naqd' && (!cur || (cur.src && cur.src.ref) !== (a.src && a.src.ref) || cur.csym !== a.csym)) { const aid = a.id; setTimeout(() => syncAllHist(aid, true).catch(() => { }), 800); } req.ad = a.sym + ' (' + a.group + '), narx: ' + (a.price == null ? '—' : a.price) + (a.archived ? ', arxivda' : ''); res.json({ ok: true, id: a.id });
}));

/* ---------------- Hisoblar ---------------- */
app.post('/api/accounts', A, wrap((req, res) => {
  const { uid, kind } = req.body || {}; const u = auth.byId(uid); if (!u) throw bad('Foydalanuvchi topilmadi.');
  if (['uni', 'isl'].indexOf(kind) < 0) throw bad('Hisob turi noto‘g‘ri.');
  if (db.all('accounts').some(a => a.uid === uid && a.kind === kind && !a.archived)) throw bad('Bu foydalanuvchida shunday hisob allaqachon bor.');
  const a = db.put('accounts', { id: 'A' + db.seq('acc'), uid, kind, name: kind === 'isl' ? 'Islomiy hisob' : 'Universal hisob', targets: {}, prevQ: 0, archived: false, created: now() });
  res.json({ ok: true, id: a.id });
}));
app.post('/api/accounts/:id', A, wrap((req, res) => {
  const a = db.get('accounts', req.params.id); if (!a) throw bad('Hisob topilmadi.', 404);
  const b = req.body || {};
  if (b.targets) { const t = {}; Object.keys(b.targets).forEach(k => { const v = b.targets[k]; if (v === '' || v == null) return; const n = +v; if (!(n >= 0 && n <= 100)) throw bad('Ulush 0–100 oralig‘ida bo‘lsin.'); t[k] = n; }); a.targets = t; }
  if (b.prevQ !== undefined) a.prevQ = +b.prevQ || 0;
  if (b.archived !== undefined) a.archived = !!b.archived;
  db.put('accounts', a); res.json({ ok: true });
}));

/* ---------------- Tranzaksiyalar (faqat qo'shiladi, o'chirilmaydi) ---------------- */
function writeTx(S, input, by, chan, blk, opts) {
  const x = S.assets.filter(a => a.id === input.aid)[0];
  if (!x) throw bad('Aktiv topilmadi.');
  const r = { acc: input.acc, aid: input.aid, type: input.type, t: +input.t || now(), price: input.price, amount: input.amount, fee: input.fee, feeAsset: input.feeAsset, cash: input.cash === false ? false : undefined, to: input.to, toAmount: input.toAmount, xfee: input.type === 'TRANSFER' && +input.xfee > 0 ? +input.xfee : undefined, settle: input.settle || undefined };
  const chk = Core.checkTx(S, r, opts); if (!chk.ok) throw bad(chk.error);
  if ((input.fee === undefined || input.fee === '' || input.fee == null) && (r.type === 'BUY' || r.type === 'SELL') && input.autoFee !== false) { const f = Core.feeOf(x, r.type, r.price, r.amount); r.fee = f.fee; r.feeAsset = f.feeAsset; }
  const rec = Object.assign({}, r, { id: 'T' + (10000 + db.seq('tx')), blk: blk || ('B' + (10000 + db.seq('blk'))), ex: input.ex || Core.venueOf(x), chan, by, status: 'Bajarildi', note: String(input.note || '').slice(0, 300), created: now(), bk: input.bk ? String(input.bk).slice(0, 120) : undefined });
  ['bk', 'cash', 'to', 'toAmount', 'settle', 'xfee'].forEach(k => { if (rec[k] === undefined) delete rec[k]; });
  db.put('tx', rec); S.tx.push(rec); return rec;
}
app.post('/api/tx', AO, wrap((req, res) => {
  const b = req.body || {}, who = req.user.role === 'admin' ? 'Admin' : 'Operator: ' + (req.user.name || req.user.email);
  const rec = db.tx(() => writeTx(loadS(), b, who, 'Operator', null));
  const S0 = loadS(), x0 = S0.assets.filter(a => a.id === rec.aid)[0], ac0 = S0.accounts.filter(a => a.id === rec.acc)[0];
  req.ad = rec.id + ': ' + (ac0 ? ac0.owner : rec.acc) + ' · ' + rec.type + ' ' + (x0 ? x0.sym : rec.aid) + ' ' + rec.amount + ' @ ' + rec.price;
  res.json({ ok: true, id: rec.id });
}));
app.post('/api/tx/:id/void', A, wrap((req, res) => {
  const t = db.get('tx', req.params.id); if (!t) throw bad('Tranzaksiya topilmadi.', 404);
  if (t.status !== 'Bajarildi') throw bad('Bu tranzaksiya allaqachon bekor qilingan.');
  const reason = String((req.body || {}).reason || '').trim(); if (reason.length < 3) throw bad('Bekor qilish sababini yozing.');
  t.status = 'Bekor qilingan'; t.voidBy = req.user.email; t.voidT = now(); t.voidReason = reason.slice(0, 300);
  /* Balans manfiyga tushib qolmasligini tekshirish */
  const S = loadS(); S.tx = S.tx.map(x => x.id === t.id ? t : x);
  const acc = S.accounts.filter(a => a.id === t.acc)[0], V = Core.view(S, acc);
  if (V.items.some(i => i.qty < -1e-9)) throw bad('Bu tranzaksiyani bekor qilsangiz, hisobda manfiy qoldiq paydo bo‘ladi. Avval keyingi tranzaksiyalarni tekshiring.');
  db.put('tx', t); req.ad = t.id + ' sabab: ' + reason; res.json({ ok: true });
}));


/* ---------------- Tranzaksiyani tahrirlash (faqat admin; eski qiymatlar saqlanadi) ---------------- */
app.post('/api/tx/:id/edit', A, wrap((req, res) => {
  const t = db.get('tx', req.params.id); if (!t) throw bad('Tranzaksiya topilmadi.', 404);
  if (t.status !== 'Bajarildi') throw bad('Bekor qilingan tranzaksiyani tahrirlab bo‘lmaydi.');
  const b = req.body || {}, reason = String(b.reason || '').trim(); if (reason.length < 3) throw bad('Tahrirlash sababini yozing.');
  db.tx(() => {
    const S = loadS(), nt = Object.assign({}, t), before = {};
    ['t', 'price', 'amount', 'fee', 'feeAsset', 'ex', 'note', 'cash', 'settle', 'toAmount'].forEach(k => { before[k] = t[k]; });
    if (b.t != null && b.t !== '') nt.t = +b.t;
    ['price', 'amount', 'toAmount'].forEach(k => { if (b[k] !== undefined && b[k] !== '' && b[k] !== null) nt[k] = +b[k]; });
    if (b.fee !== undefined) nt.fee = b.fee === '' || b.fee === null ? 0 : +b.fee;
    ['feeAsset', 'ex', 'note'].forEach(k => { if (b[k] !== undefined) nt[k] = String(b[k]).slice(0, 300); });
    if (b.cash !== undefined) { if (b.cash === false) nt.cash = false; else delete nt.cash; }
    if (b.settle !== undefined) { if (b.settle) nt.settle = String(b.settle); else delete nt.settle; }
    const chk = Core.checkTx(Object.assign({}, S, { tx: S.tx.filter(x => x.id !== t.id) }), nt, {}); if (!chk.ok) throw bad(chk.error);
    const S3 = Object.assign({}, S, { tx: S.tx.map(x => x.id === t.id ? nt : x) }), acc = S3.accounts.filter(a => a.id === t.acc)[0];
    const neg = Core.view(S3, acc).items.filter(i => i.qty < -1e-9)[0];
    if (neg) throw bad('Tahrirdan so‘ng ' + neg.x.sym + ' qoldig‘i manfiy bo‘lib qoladi (' + +neg.qty.toFixed(6) + ').');
    nt.edits = (t.edits || []).concat([{ t: now(), by: req.user.email, reason, before }]); nt.editedBy = req.user.email; nt.editedT = now();
    db.put('tx', nt); req.ad = t.id + ' sabab: ' + reason + '; oldin: ' + JSON.stringify(before);
  });
  res.json({ ok: true });
}));

/* ---------------- Ichki o'tkazma: masalan NAQD so'm -> Bitget USDT (ko'p hisobdan, ulushga qarab) ---------------- */
function planTransfer(S, b) {
  const am = Core.assetMap(S), from = am[b.from], to = am[b.to];
  if (!from || !to || from.id === to.id) throw bad('Qaysi aktivdan qaysi aktivga o‘tkazishni tanlang.');
  const rate = +b.rate || settings().fx.USD || 0, fxT = c => c === 'UZS' ? 1 : rate;
  if ((from.curr !== 'UZS' || to.curr !== 'UZS') && !(rate > 0)) throw bad('Dollar kursi kiritilmagan.');
  const toPerFrom = ((from.price || 1) * fxT(from.curr)) / ((to.price || 1) * fxT(to.curr));
  const total = +b.total; if (!(total > 0)) throw bad('Summa musbat bo‘lsin.');
  const T = b.unit === 'to' ? total / toPerFrom : total, ids = Array.isArray(b.accs) ? b.accs : [];
  const rows = S.accounts.filter(a => !a.archived && ids.indexOf(a.id) >= 0).map(a => { const it = Core.view(S, a).items.filter(i => i.x.id === from.id)[0]; return { acc: a, bal: it && it.qty > 0 ? it.qty : 0 }; });
  if (!rows.length) throw bad('Hisoblarni tanlang.');
  const sum = rows.reduce((q, r) => q + r.bal, 0), dec = from.curr === 'UZS' && from.group === 'naqd' ? 2 : 8, rd = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  if (T > sum + 1e-9) throw bad('Tanlangan hisoblarda ' + from.sym + ' yetarli emas (jami bor: ' + rd(sum, 2) + ', kerak: ' + rd(T, 2) + ').');
  rows.forEach(r => { r.share = sum > 0 ? r.bal / sum : 0; r.alloc = Math.min(r.bal, rd(T * r.share, dec)); });
  const big = rows.slice().sort((x, y) => y.bal - x.bal)[0], diff = rd(T - rows.reduce((q, r) => q + r.alloc, 0), dec);
  if (Math.abs(diff) > 0 && big.alloc + diff <= big.bal + 1e-9) big.alloc = rd(big.alloc + diff, dec);
  const pct = +b.feePct || 0, fix = +b.feeFix || 0, mode = b.feeMode === 'extra' ? 'extra' : 'incl';
  if (!(pct >= 0 && pct < 100) || !(fix >= 0)) throw bad('Komissiya noto‘g‘ri.');
  rows.forEach(r => {
    r.fee = rd(r.alloc * pct / 100 + fix * r.share, dec); r.xfee = mode === 'extra' ? r.fee : 0;
    const net = mode === 'extra' ? r.alloc : r.alloc - r.fee;
    if (!(net > 0) && r.alloc > 0) throw bad('Komissiya o‘tkazma summasidan oshib ketdi.');
    if (r.alloc + r.xfee > r.bal + 1e-9) throw bad(r.acc.owner + ' hisobida komissiya bilan birga yetarli ' + from.sym + ' yo‘q.');
    r.toAmount = rd(net * toPerFrom, 8);
  });
  return { from, to, rate, toPerFrom, T, sum, mode, rows: rows.filter(r => r.alloc > 0) };
}
const planOut = p => ({ toPerFrom: p.toPerFrom, rate: p.rate, total: p.T, available: p.sum, mode: p.mode, rows: p.rows.map(r => ({ acc: r.acc.id, owner: r.acc.owner, kind: r.acc.kind, bal: r.bal, share: r.share, from: r.alloc, fee: r.fee, xfee: r.xfee, to: r.toAmount })) });
app.post('/api/transfers/preview', A, wrap((req, res) => res.json(planOut(planTransfer(loadS(), req.body || {})))));
app.post('/api/transfers', A, wrap((req, res) => {
  const b = req.body || {}, who = req.user.role === 'admin' ? 'Admin' : 'Operator: ' + (req.user.name || req.user.email); let msg = '';
  db.tx(() => {
    const S = loadS(), p = planTransfer(S, b), blk = 'B' + (10000 + db.seq('blk'));
    if (!p.rows.length) throw bad('O‘tkaziladigan summa nolga teng.');
    p.rows.forEach(r => writeTx(S, { acc: r.acc.id, aid: p.from.id, type: 'TRANSFER', amount: r.alloc, price: p.from.price || 1, to: p.to.id, toAmount: r.toAmount, xfee: r.xfee, fee: r.fee, feeAsset: p.from.sym, ex: Core.venueOf(p.from) + ' → ' + Core.venueOf(p.to), note: String(b.note || '').slice(0, 200) }, who, 'Operator', blk));
    msg = p.from.sym + ' → ' + p.to.sym + ': ' + p.rows.length + ' ta hisobdan jami ' + p.T + ' ' + p.from.sym + ' (' + p.rows.reduce((q, r) => q + r.toAmount, 0).toFixed(4) + ' ' + p.to.sym + '), komissiya ' + +p.rows.reduce((q, r) => q + r.fee, 0).toFixed(4) + ' ' + p.from.sym + ', bitim ' + blk;
  });
  req.ad = msg; res.json({ ok: true, msg });
}));

/* ---------------- Depozit so'rovlari (mijoz to'laydi, admin tasdiqlaydi) ---------------- */
const ST_WAIT = 'To‘lov kutilmoqda', ST_CHECK = 'Tasdiqlash kutilmoqda';
function ownDep(req) {
  const d = db.get('dep', req.params.id); if (!d) throw bad('So‘rov topilmadi.', 404);
  if (d.uid !== req.user.id && req.user.role !== 'admin') throw bad('So‘rov topilmadi.', 404); return d;
}
app.post('/api/dep', ANY, wrap((req, res) => {
  const b = req.body || {}, acc = db.get('accounts', b.acc);
  if (!acc || (acc.uid !== req.user.id && req.user.role !== 'admin')) throw bad('Hisob topilmadi.', 404);
  const amount = +b.amount; if (!(amount >= 1000)) throw bad('Summa kamida 1 000 so‘m bo‘lsin.');
  const pm = (settings().pay || []).filter(x => x.id === b.method)[0]; if (!pm) throw bad('To‘lov usulini tanlang.');
  const d = db.put('dep', { id: 'D' + (1000 + db.seq('dep')), acc: acc.id, uid: acc.uid, amount, method: pm.id, methodName: pm.name, code: 'BRL-' + crypto.randomBytes(3).toString('hex').toUpperCase(), status: ST_WAIT, t: now(), ref: '' });
  req.ad = d.id + ' ' + amount + ' so‘m, ' + pm.name; res.json({ ok: true, id: d.id });
}));
app.post('/api/dep/:id/paid', ANY, wrap((req, res) => {
  const d = ownDep(req); if (d.status !== ST_WAIT) throw bad('So‘rov holati o‘zgargan.');
  d.status = ST_CHECK; d.paidT = now(); d.ref = String((req.body || {}).ref || '').slice(0, 200); db.put('dep', d); req.ad = d.id + ' to‘lov qildim, ref: ' + d.ref; res.json({ ok: true });
}));
app.post('/api/dep/:id/cancel', ANY, wrap((req, res) => {
  const d = ownDep(req); if (d.status !== ST_WAIT && d.status !== ST_CHECK) throw bad('So‘rov allaqachon ko‘rib chiqilgan.');
  d.status = 'Bekor qilingan'; d.fin = now(); d.by = req.user.email; db.put('dep', d); req.ad = d.id; res.json({ ok: true });
}));
app.post('/api/dep/:id', A, wrap((req, res) => {
  const d = db.get('dep', req.params.id); if (!d) throw bad('So‘rov topilmadi.', 404);
  if (d.status !== ST_WAIT && d.status !== ST_CHECK) throw bad('So‘rov allaqachon ko‘rib chiqilgan.');
  const b = req.body || {};
  if (b.status === 'Rad etildi') { d.status = 'Rad etildi'; d.fin = now(); d.by = req.user.email; d.reason = String(b.reason || '').slice(0, 200); db.put('dep', d); req.ad = d.id + ' rad etildi ' + d.reason; return res.json({ ok: true }); }
  if (b.status !== 'Bajarildi') throw bad('Holat noto‘g‘ri.');
  const amount = b.amount !== undefined && b.amount !== '' ? +b.amount : d.amount; if (!(amount > 0)) throw bad('Summa noto‘g‘ri.');
  db.tx(() => {
    const S = loadS(), cash = Core.cashAsset(S); if (!cash) throw bad('Naqd so‘m aktivi (UZS) katalogda yo‘q.');
    const rec = writeTx(S, { acc: d.acc, aid: cash.id, type: 'DEPOZIT', amount, price: 1, ex: 'Bank', note: 'Depozit so‘rovi ' + d.id + ' (' + d.methodName + ', ' + d.code + ')' }, 'Admin', 'Bank o‘tkazma', null);
    d.status = 'Bajarildi'; d.fin = now(); d.by = req.user.email; d.amountOk = amount; d.tx = rec.id; db.put('dep', d);
  });
  req.ad = d.id + ' tasdiqlandi: ' + amount + ' so‘m'; res.json({ ok: true });
}));

/* ---------------- Pul yechish so'rovlari ---------------- */
app.post('/api/wd', ANY, wrap((req, res) => {
  const b = req.body || {}, acc = db.get('accounts', b.acc);
  if (!acc || (acc.uid !== req.user.id && req.user.role !== 'admin')) throw bad('Hisob topilmadi.', 404);
  const amount = +b.amount; if (!(amount > 0)) throw bad('Summa musbat bo‘lsin.');
  if (['darhol', 'kutish', 'bozor'].indexOf(b.mode) < 0) throw bad('Usul noto‘g‘ri.');
  req.ad = 'yechish ' + amount + ' so‘m, usul: ' + b.mode;
  const w = db.put('wd', { id: 'W' + (1000 + db.seq('wd')), acc: acc.id, uid: acc.uid, amount, mode: b.mode, status: 'Kutilmoqda', t: now(), note: String(b.note || '').slice(0, 200) });
  res.json({ ok: true, id: w.id });
}));
app.post('/api/wd/:id', AO, wrap((req, res) => {
  const w = db.get('wd', req.params.id); if (!w) throw bad('So‘rov topilmadi.', 404);
  if (w.status !== 'Kutilmoqda') throw bad('So‘rov allaqachon ko‘rib chiqilgan.');
  const st = (req.body || {}).status;
  req.ad = w.id + ' → ' + st;
  if (st === 'Rad etildi') { w.status = st; w.by = req.user.email; w.fin = now(); db.put('wd', w); return res.json({ ok: true }); }
  if (st !== 'Bajarildi') throw bad('Holat noto‘g‘ri.');
  const who = req.user.role === 'admin' ? 'Admin' : 'Operator: ' + (req.user.name || req.user.email);
  db.tx(() => {
    const S = loadS(), cash = Core.cashAsset(S); if (!cash) throw bad('Naqd so‘m aktivi (UZS) katalogda yo‘q.');
    const rec = writeTx(S, { acc: w.acc, aid: cash.id, type: 'WITHDRAW', amount: w.amount / (Core.fxOf(S, cash.curr) || 1) * 1, price: 1, ex: 'Bank', note: 'Yechish so‘rovi ' + w.id }, who, 'Operator', null);
    w.status = 'Bajarildi'; w.by = who; w.fin = now(); w.tx = rec.id; db.put('wd', w);
  });
  res.json({ ok: true });
}));

/* ---------------- Signal -> order -> bitim ---------------- */
function newSignal(x, side, price, srcName) {
  const s = { id: 'S-' + (1000 + db.seq('sig')), t: now(), aid: x.id, sym: x.sym, pair: x.group === 'kripto' ? x.sym + 'USDT' : (x.src && x.src.type === 'bitget' ? x.src.ref : x.sym), side, price, src: srcName, ord: null };
  return s;
}
function newOrder(S, s, x) {
  const pr = Core.poolRun(S, x, s.side, s.price), st = settings();
  return { id: 'O-' + (2000 + db.seq('ord')), sid: s.id, aid: x.id, sym: x.sym, side: s.side, price: s.price, t: now(), exp: now() + 864e5, rel: st.autoRel ? 'Avtomatik' : 'Operator', pr: Core.snap(pr), status: 'Kutilmoqda', by: null, blk: null, fin: null };
}
function doSend(o, by, auto, fillPrice) {
  return db.tx(() => {
    const S = loadS(), x = S.assets.filter(a => a.id === o.aid)[0], price = fillPrice > 0 ? fillPrice : o.price;
    const pr = Core.poolRun(S, x, o.side, price); o.pr = Core.snap(pr); o.price = price;
    if (pr.state === 'none') { o.status = 'Rad etilgan'; o.by = 'Tizim'; o.fin = now(); db.put('orders', o); return 'rad'; }
    if (pr.state !== 'fill') { db.put('orders', o); return 'wait'; }
    const blk = 'B' + (10000 + db.seq('blk')), t = now();
    Core.orderTx(S, o, pr, by, auto ? 'Avtomat' : 'Operator', blk, t).forEach(r => writeTx(S, r, by, r.chan, blk, { skipBalance: true }));
    o.status = 'Bajarilgan'; o.by = by; o.fin = t; o.blk = blk; db.put('orders', o); return 'ok';
  });
}
function receiveSignal(x, side, price, srcName) {
  const S = loadS(), s = newSignal(x, side, price, srcName), o = newOrder(S, s, x);
  s.ord = o.id; db.put('signals', s);
  if (o.pr.state === 'none') { o.status = 'Rad etilgan'; o.by = 'Tizim'; o.fin = now(); db.put('orders', o); return { s, o, msg: 'Hech bir hisob uchun ruxsat yo‘q, order rad etildi.' }; }
  db.put('orders', o);
  if (settings().autoRel && o.pr.state === 'fill') { const r = doSend(o, 'Tizim', true); return { s, o, msg: r === 'ok' ? 'Avtomatik bajarildi.' : 'Order yaratildi.' }; }
  return { s, o, msg: 'Signal saqlandi, order yaratildi.' };
}
app.post('/api/signals', A, wrap((req, res) => {
  const b = req.body || {}, S = loadS(), x = S.assets.filter(a => a.id === b.aid && !a.archived)[0];
  if (!x || !Core.tradable(x)) throw bad('Aktiv topilmadi yoki narxi yo‘q.');
  const side = String(b.side).toUpperCase(); if (side !== 'BUY' && side !== 'SELL') throw bad('Tomon noto‘g‘ri.');
  const price = +(b.price || x.price); if (!(price > 0)) throw bad('Narx noto‘g‘ri.');
  req.ad = x.sym + ' ' + side + ' @ ' + price; const r = receiveSignal(x, side, price, 'Qo‘lda (admin)'); res.json({ ok: true, msg: r.msg, order: r.o.id });
}));
app.post('/api/orders/:id/send', A, wrap((req, res) => {
  const o = db.get('orders', req.params.id); if (!o || o.status !== 'Kutilmoqda') throw bad('Order topilmadi yoki yakunlangan.', 404);
  req.ad = o.id + ' ' + o.sym + ' ' + o.side; const r = doSend(o, 'Admin', false, +(req.body || {}).price);
  if (r === 'wait') throw bad('Umumiy hajm minimal summadan kam: bozorga yuborib bo‘lmaydi.');
  res.json({ ok: true, result: r });
}));
app.post('/api/orders/:id/cancel', A, wrap((req, res) => {
  const o = db.get('orders', req.params.id); if (!o || o.status !== 'Kutilmoqda') throw bad('Order topilmadi yoki yakunlangan.', 404);
  req.ad = o.id + ' ' + o.sym; o.status = 'Bekor qilingan'; o.by = 'Admin'; o.fin = now(); db.put('orders', o); res.json({ ok: true });
}));

/* ---------------- Sozlamalar, narxlar, import ---------------- */
app.post('/api/settings', A, wrap((req, res) => {
  const s = settings(), b = req.body || {};
  if (b.fx && b.fx.USD !== undefined) { const v = +b.fx.USD; if (!(v > 0)) throw bad('Dollar kursi musbat bo‘lsin.'); s.fx = { USD: v }; s.fxT = now(); }
  ['autoRel', 'fxAuto'].forEach(k => { if (b[k] !== undefined) s[k] = !!b[k]; });
  ['nBase', 'nHold', 'nSell'].forEach(k => { if (b[k] !== undefined) { const v = Math.round(+b[k]); if (!(v >= 1 && v <= 50)) throw bad('N 1–50 oralig‘ida bo‘lsin.'); s[k] = v; } });
  if (b.benchRate !== undefined) { const v = +b.benchRate; if (!(v >= 0 && v <= 200)) throw bad('Taqqoslash stavkasi 0–200% oralig‘ida bo‘lsin.'); s.benchRate = v; }
  if (b.benchPay !== undefined) { if (['none', 'monthly', 'quarterly', 'yearly'].indexOf(b.benchPay) < 0) throw bad('Taqqoslash davriyligi noto‘g‘ri.'); s.benchPay = b.benchPay; }
  [['bondHurdle', 0, 200], ['bondBuy', 0, 50], ['bondSell', 0, 50]].forEach(([k, lo, hi]) => { if (b[k] !== undefined) { const v = +b[k]; if (!(v >= lo && v <= hi)) throw bad('Obligatsiya sozlamasi ' + lo + '–' + hi + ' oralig‘ida bo‘lsin.'); s[k] = v; } });
  if (b.stoch !== undefined) { const o = {}; [['rsi', 2, 100], ['len', 2, 100], ['k', 1, 50], ['d', 1, 50]].forEach(([k, lo, hi]) => { const v = Math.round(+(b.stoch || {})[k]); if (!(v >= lo && v <= hi)) throw bad('Stoch RSI ' + k.toUpperCase() + ' ' + lo + '–' + hi + ' oralig‘ida bo‘lsin.'); o[k] = v; }); s.stoch = o; s.stochChg = true; }
  if (b.mainAsset !== undefined) { const o = {}; STOCH_G.forEach(g => { const id = String((b.mainAsset || {})[g] || ''); if (id) { const a = db.get('assets', id); if (!a || a.group !== g) throw bad('Asosiy aktiv shu turdan bo‘lsin: ' + g + '.'); o[g] = id; } }); s.mainAsset = o; s.stochChg = true; }
  if (b.rep !== undefined) {
    const r = b.rep || {}, num = (v, lo, hi, nm) => { v = +v; if (!(v >= lo && v <= hi)) throw bad(nm + ' ' + lo + '–' + hi + ' oralig‘ida bo‘lsin.'); return v; }, str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
    const o = { co: {}, own: {}, rate: {}, tax: {}, f8: {} }; ['name', 'stir', 'license', 'head', 'accountant', 'address', 'phone'].forEach(k => { o.co[k] = str((r.co || {})[k], 160); });
    ['charter', 'added', 'reserve', 'retained', 'target', 'provisions', 'intangible'].forEach(k => { o.own[k] = num((r.own || {})[k] || 0, 0, 1e15, 'O‘z mablag‘lari'); });
    [['mgmt', 0, 100], ['custody', 0, 100], ['success', 0, 100], ['hurdle', 0, 200], ['profitTax', 0, 100], ['divTax', 0, 100], ['vat', 0, 100], ['minOwn', 0, 100], ['limit', 1, 100]].forEach(([k, lo, hi]) => { o.rate[k] = num((r.rate || {})[k], lo, hi, 'Stavka ' + k); }); o.rate.days = (+((r.rate || {}).days) === 360) ? 360 : 365;
    o.tax.vatPayer = ['Ha', 'Yo‘q', 'Tekshiring'].indexOf((r.tax || {}).vatPayer) >= 0 ? r.tax.vatPayer : 'Tekshiring'; o.tax.vatExempt = ['Ha', 'Yo‘q', 'Tekshiring'].indexOf((r.tax || {}).vatExempt) >= 0 ? r.tax.vatExempt : 'Tekshiring';
    o.tax.direct = num((r.tax || {}).direct || 0, 0, 1e15, 'Xarajat'); o.tax.general = num((r.tax || {}).general || 0, 0, 1e15, 'Xarajat');
    Object.keys(r.f8 || {}).slice(0, 20).forEach(k => { const m = r.f8[k] || {}; if (['Ha', 'Yo‘q', 'Qisman', 'N/A'].indexOf(m.status) >= 0 || m.note) o.f8[String(+k)] = { status: ['Ha', 'Yo‘q', 'Qisman', 'N/A'].indexOf(m.status) >= 0 ? m.status : '', note: str(m.note, 200) }; });
    s.rep = o;
  }
  if (b.priceMin !== undefined) { const v = +b.priceMin; if (!(v >= 1 && v <= 1440)) throw bad('Interval 1–1440 daqiqa.'); s.priceMin = v; scheduleRefresh(); }
  if (b.pay !== undefined) {
    if (!Array.isArray(b.pay)) throw bad('To‘lov usullari ro‘yxati noto‘g‘ri.');
    const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
    s.pay = b.pay.slice(0, 10).map((p, i) => ({ id: str(p.id, 24) || ('P' + (i + 1) + crypto.randomBytes(2).toString('hex')), name: str(p.name, 60), holder: str(p.holder, 80), number: str(p.number, 60), url: /^https?:\/\//i.test(p.url || '') ? str(p.url, 400) : '', note: str(p.note, 300) })).filter(p => p.name);
  }
  if (b.uzseHist !== undefined) s.uzseHist = /^https?:\/\//i.test(b.uzseHist || '') ? String(b.uzseHist).trim().slice(0, 600) : '';
  const chg = !!s.stochChg; delete s.stochChg; db.put('settings', s); if (chg) stochRun().catch(e => console.error('stoch:', e.message));
  res.json({ ok: true });
}));
app.post('/api/stoch/refresh', A, wrap(async (req, res) => { res.json({ stoch: await stochRun() }); }));

/* Narx tarixi: har yangilanishda nuqta yozib boriladi (uzse.uz, veb-sahifa va qo'lda kiritilgan aktivlar chartining asosi) */
function recPrice(id, price) {
  if (!(price > 0)) return;
  const h = db.get('ph', id) || { id, pts: [] }, last = h.pts[h.pts.length - 1];
  /* narx snapshotlari faqat kun ichidagi (intraday) shamlar uchun; kunlik tarix alohida saqlanadi (hc), shuning uchun qisqa saqlanadi */
  if (!(last && now() - last[0] < 600000 && last[1] === price)) { h.pts.push([now(), price]); if (h.pts.length > 6000) h.pts = h.pts.slice(-4000); db.put('ph', h, true); }
  const a = db.get('assets', id); if (a) hist.touch(id, price, now(), candles.closeRule(a).wd, candles.dayKeyFor(a, now()));
}
let refreshing = false;
async function refreshPrices() {
  if (refreshing) return { skipped: true }; refreshing = true;
  try {
    const st = settings(), report = { fx: null, assets: {} };
    if (st.fxAuto) { try { const r = await sources.cbuUsd(); st.fx = { USD: r }; st.fxT = now(); report.fx = r; } catch (e) { report.fx = 'xato: ' + e.message; } }
    const assets = db.all('assets').filter(a => !a.archived && a.src);
    const res = await sources.refreshAll(assets);
    db.tx(() => {
      assets.forEach(a => {
        const r = res[a.id]; if (!r) return; const cur = db.get('assets', a.id);
        if (r.error) { cur.srcErr = r.error; cur.srcErrT = now(); report.assets[a.sym] = r.error; }
        else { cur.price = r.price; cur.priceT = now(); cur.srcErr = null; cur.priceFrom = null; report.assets[a.sym] = r.price; recPrice(cur.id, r.price); }
        db.put('assets', cur);
      });
      st.priceT = now(); db.put('settings', st);
    });
    return report;
  } finally { refreshing = false; }
}
app.post('/api/prices/refresh', A, wrap(async (req, res) => res.json(Object.assign({ ok: true }, await refreshPrices()))));
app.get('/api/lookup', A, wrap(async (req, res) => {
  const type = String(req.query.src || ''), q = String(req.query.q || '').trim(); if (!q) throw bad('Qidiruv so‘zini kiriting.');
  try { res.json({ results: await sources.lookup(type, q) }); } catch (e) { throw bad(sources.NAMES[type] + ': ' + e.message, 502); }
}));
let lastSrc = null;
app.get('/api/sources/test', A, wrap(async (req, res) => { if (req.query.cached) return res.json({ results: lastSrc && lastSrc.results, t: lastSrc && lastSrc.t }); lastSrc = { t: now(), results: await sources.selfTest() }; res.json(lastSrc); }));
let timer = null;
function scheduleRefresh() { clearInterval(timer); timer = setInterval(() => refreshPrices().catch(e => console.error('narx yangilash:', e.message)), Math.max(1, settings().priceMin) * 60e3); }

/* ---------------- Alertlar: server o'zi tekshiradi (brauzer yopiq bo'lsa ham). Signal -> Avto savdo ---------------- */
const REF_OK = { price: 1, value: 1, ema: 1, sma: 1, bb: 1, rsi: 1, macd: 1, stochrsi: 1, algobb: 1 }, OPS = ['crossover', 'crossunder', 'gt', 'lt', 'ge', 'le', 'true'], SRCS = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'];
function cleanRef(r) {
  if (!r || !REF_OK[r.k]) throw bad('Alert sharti noto‘g‘ri.'); const o = { k: r.k };
  if (r.k === 'value') { if (!fin(+r.v) || r.v === '' || r.v === null) throw bad('Qiymat noto‘g‘ri.'); o.v = +r.v; return o; }
  if (r.k === 'price') { o.f = ['open', 'high', 'low', 'close'].indexOf(r.f) >= 0 ? r.f : 'close'; return o; }
  o.p = {}; Object.keys(r.p || {}).slice(0, 10).forEach(k => { const v = r.p[k]; if (k === 'src') { if (SRCS.indexOf(v) >= 0) o.p.src = v; } else if (fin(+v) && +v > 0) o.p[String(k).slice(0, 8)] = Math.min(1000, +v); });
  if (r.line) o.line = String(r.line).slice(0, 10); return o;
}
const ruleOf = a => candles.closeRule(a);
function sideOf(al) { if (al.act === 'BUY' || al.act === 'SELL') return al.act; if (al.act === 'auto' && al.cond.a.k === 'algobb') return al.cond.a.line === 'sell' ? 'SELL' : al.cond.a.line === 'buy' ? 'BUY' : ''; return ''; }
function condText(c) {
  const nm = r => r.k === 'price' ? 'Narx (' + (r.f || 'close') + ')' : r.k === 'value' ? String(r.v) : r.k.toUpperCase() + (r.p ? '(' + Object.keys(r.p).filter(k => k !== 'src').map(k => r.p[k]).join(',') + ')' : '') + (r.line ? '.' + r.line : '');
  return nm(c.a) + ({ crossover: ' ustidan kesib o‘tdi ', crossunder: ' ostidan kesib o‘tdi ', gt: ' > ', lt: ' < ', ge: ' ≥ ', le: ' ≤ ', true: ' sodir bo‘ldi' }[c.op] || ' ') + (c.op === 'true' ? '' : nm(c.b));
}
app.get('/api/alerts', ANY, wrap((req, res) => res.json({ alerts: db.all('alerts').filter(a => a.uid === req.user.id), log: db.all('alog').filter(a => a.uid === req.user.id).sort((x, y) => y.t - x.t).slice(0, 60) })));
app.post('/api/alerts', ANY, wrap((req, res) => {
  const b = req.body || {}, u = req.user, as = db.get('assets', String(b.aid || '')); if (!as || as.archived || as.group === 'naqd') throw bad('Aktiv topilmadi.', 404);
  if (!candles.TFS[b.tf]) throw bad('Vaqt oralig‘i noto‘g‘ri.'); if (OPS.indexOf((b.cond || {}).op) < 0) throw bad('Operator noto‘g‘ri.');
  const cond = { a: cleanRef(b.cond.a), op: b.cond.op, b: b.cond.op === 'true' ? undefined : cleanRef(b.cond.b) };
  let act = ['none', 'BUY', 'SELL', 'auto'].indexOf(b.act) >= 0 ? b.act : 'none'; if (u.role !== 'admin') act = 'none';
  const cur = b.id ? db.get('alerts', b.id) : null; if (b.id && (!cur || cur.uid !== u.id)) throw bad('Alert topilmadi.', 404);
  if (!cur && db.all('alerts').filter(a => a.uid === u.id).length >= 60) throw bad('Alertlar soni chegarasi (60).');
  const al = Object.assign({}, cur || { id: 'AL' + (1000 + db.seq('alert')), uid: u.id, created: now(), count: 0 }, { aid: as.id, tf: b.tf, name: String(b.name || (as.sym + ' ' + b.tf)).trim().slice(0, 80), cond, on: b.on === 'live' ? 'live' : 'close', act, once: !!b.once, email: !!b.email, msg: String(b.msg || '').slice(0, 200), active: b.active !== false });
  if (!cur) al.last = null; db.put('alerts', al); req.ad = al.id + ' ' + as.sym + ' ' + al.tf + ': ' + condText(cond); res.json({ ok: true, id: al.id });
}));
['del', 'toggle'].forEach(k => app.post('/api/alerts/:id/' + k, ANY, wrap((req, res) => {
  const al = db.get('alerts', req.params.id); if (!al || al.uid !== req.user.id) throw bad('Alert topilmadi.', 404);
  if (k === 'del') db.db.prepare('DELETE FROM docs WHERE coll=? AND id=?').run('alerts', al.id); else { al.active = !al.active; if (al.active) al.last = null; db.put('alerts', al); }
  db.touch(); req.ad = al.id + ' ' + al.name; res.json({ ok: true });
})));
function fireAlert(al, as, bar, price) {
  const owner = db.db.prepare('SELECT id,email,name,role FROM users WHERE id=?').get(al.uid) || {}, side = owner.role === 'admin' ? sideOf(al) : '', txt = (al.msg ? al.msg + ' · ' : '') + as.sym + ' ' + al.tf + ': ' + condText(al.cond) + ' @ ' + price;
  al.last = { bar, t: now() }; al.count = (al.count || 0) + 1; if (al.once) al.active = false; db.put('alerts', al);
  let sig = '';
  if (side) { try { const r = receiveSignal(as, side, price, 'Alert: ' + al.name); sig = side + ' → ' + (r && r.msg || 'signal yuborildi'); } catch (e) { sig = 'signal yuborilmadi: ' + e.message; } }
  db.put('alog', { id: 'G' + (100000 + db.seq('alog')), uid: al.uid, alert: al.id, aid: as.id, sym: as.sym, tf: al.tf, t: now(), price, name: al.name, text: txt, signal: sig });
  AU(null, 'Alert ishga tushdi', al.id + ' ' + txt + (sig ? ' | ' + sig : ''), owner.name || owner.email || 'Tizim');
  if (al.email && owner.email && mail.enabled()) mail.send(owner.email, 'BARLOS alert: ' + as.sym, txt + (sig ? '\n' + sig : '')).catch(e => console.error('alert email:', e.message));
}
let alerting = false;
async function checkAlerts() {
  if (alerting) return; alerting = true;
  try {
    const groups = {}; db.all('alerts').filter(a => a.active).forEach(a => { (groups[a.aid + '|' + a.tf] = groups[a.aid + '|' + a.tf] || []).push(a); });
    for (const k of Object.keys(groups)) {
      const [aid, tf] = k.split('|'), as = db.get('assets', aid); if (!as || as.archived) continue; let r;
      try { r = await candles.get(as, tf, { ph: (db.get('ph', aid) || {}).pts, hc: hist.get(aid) }); } catch (e) { continue; }
      const cs = r.candles.map(c => ({ t: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v })), n = cs.length; if (n < 3) continue;
      const rule = r.rule || ruleOf(as), closed = Ind.barClosed(cs[n - 1], tf, rule, now());
      for (const al of groups[k]) {
        try {
          const i = al.on === 'live' ? n - 1 : (closed ? n - 1 : n - 2); if (i < 2) continue; if (al.last && al.last.bar >= cs[i].t) continue;
          if (Ind.evalCond(al.cond, cs, i)) fireAlert(al, as, cs[i].t, cs[i].close);
          else if (!al.last || al.last.bar < cs[i].t) { /* shart bajarilmadi: keyingi shamni kutadi */ }
        } catch (e) { console.error('alert xatosi', al.id, e.message); }
      }
    }
  } finally { alerting = false; }
}

/* ---------------- Chart: shamlar va har bir foydalanuvchining saqlangan sozlamalari ---------------- */
app.get('/api/candles', ANY, wrap(async (req, res) => {
  const a = db.get('assets', String(req.query.aid || '')); if (!a || a.archived || a.group === 'naqd') throw bad('Bu aktivning charti yo‘q.', 404);
  const tf = String(req.query.tf || 'D'); if (!candles.TFS[tf]) throw bad('Vaqt oralig‘i noto‘g‘ri.');
  const hc = hist.get(a.id), r = await candles.get(a, tf, { ph: (db.get('ph', a.id) || {}).pts, hc, cc: db.get('cc', a.id + '|' + tf), need: () => { const c = db.get('assets', a.id); if (c && !(c.bfNext > now()) && hasProv(c) && !bfRun[a.id]) { bfRun[a.id] = 1; syncAllHist(a.id, false).catch(() => { }).then(() => { delete bfRun[a.id]; }); } } });
  if (r.prov && hc.length < 30) { try { const today = Math.floor(Date.now() / 86400000) * 86400; hist.upsert(a.id, r.prov.filter(c => c.t < today), false); hist.upsert(a.id, r.prov.filter(c => c.t >= today), true); } catch (e) { /* e'tibor bermaymiz */ } }
  if (r.native && r.native.length) { const o = db.get('cc', a.id + '|' + tf); if (!o || now() - o.t > 60e3) db.put('cc', { id: a.id + '|' + tf, c: r.native.slice(-1500), t: now() }, true); }
  res.json({ aid: a.id, sym: a.sym, name: a.name, curr: a.curr, price: a.price, tf, candles: r.candles, source: r.source, synthetic: r.synthetic, warn: r.warn || null, rule: r.rule || candles.closeRule(a) });
}));
const IND_OK = { ema: 1, sma: 1, bb: 1, rsi: 1, macd: 1, stochrsi: 1, vol: 1, algobb: 1, custom: 1 }, DR_OK = { trend: 2, ray: 2, hline: 1, vline: 1, rect: 2, fib: 2, text: 1 };
const fin = v => typeof v === 'number' && isFinite(v);
const hexOr = (v, d) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d, nrm = (v, lo, hi, d) => fin(+v) && v !== '' && v !== null ? Math.max(lo, Math.min(hi, +v)) : d, bo = (v, d) => typeof v === 'boolean' ? v : d, oneOf = (v, l, d) => l.indexOf(v) >= 0 ? v : d;
function cleanCS(c) {
  c = c && typeof c === 'object' ? c : {}; const sc = c.sc || {}, st = c.st || {};
  return {
    type: oneOf(c.type, ['candles', 'hollow', 'heikin', 'line', 'area'], 'candles'), body: bo(c.body, true), bord: bo(c.bord, true), wick: bo(c.wick, true),
    cu: hexOr(c.cu, '#26a69a'), cd: hexOr(c.cd, '#ef5350'), bu: hexOr(c.bu, '#26a69a'), bd: hexOr(c.bd, '#ef5350'), wu: hexOr(c.wu, '#26a69a'), wd: hexOr(c.wd, '#ef5350'),
    prec: c.prec === 'auto' || (fin(+c.prec) && +c.prec >= 0 && +c.prec <= 10) ? String(c.prec) : 'auto', tz: oneOf(c.tz, ['local', 'tash', 'utc', 'msk', 'dxb', 'bj'], 'local'),
    st: { title: bo(st.title, true), ohlc: bo(st.ohlc, true), chg: bo(st.chg, true), sess: bo(st.sess, true), ind: bo(st.ind, true), vals: bo(st.vals, true) },
    sc: { mode: oneOf(sc.mode, ['normal', 'log', 'pct', 'idx'], 'normal'), auto: bo(sc.auto, true), inv: bo(sc.inv, false), last: bo(sc.last, true), lline: bo(sc.lline, true), prev: bo(sc.prev, false), cd: bo(sc.cd, true), top: nrm(sc.top, 0, 45, 8), bot: nrm(sc.bot, 0, 45, 8) },
    gv: bo(c.gv, true), gh: bo(c.gh, true), cm: oneOf(c.cm, ['normal', 'magnet'], 'normal'), cl: oneOf(+c.cl, [0, 1, 2, 3], 0), cc: hexOr(c.cc, ''), bg: hexOr(c.bg, ''), tx: hexOr(c.tx, ''), gc: hexOr(c.gc, ''), wm: bo(c.wm, false)
  };
}
function cleanDraw(d) {
  const o = { id: String(d.id || '').slice(0, 20), k: d.k, pts: d.pts.map(p => ({ t: p.t, p: p.p })), c: hexOr(d.c, '#2962ff') };
  if (d.k === 'text') o.tx = String(d.tx || '').slice(0, 200);
  if (fin(d.w)) o.w = nrm(d.w, 0.5, 8); if (fin(d.ls) && d.ls >= 0 && d.ls <= 2) o.ls = d.ls; if (fin(d.fa)) o.fa = nrm(d.fa, 0, 100); if (fin(d.fs)) o.fs = nrm(d.fs, 8, 60);
  ['fill', 'extL', 'extR', 'info', 'lab', 'lock', 'hid', 'showP', 'rev', 'bd', 'bg'].forEach(k => { if (typeof d[k] === 'boolean') o[k] = d[k]; });
  if (Array.isArray(d.h)) o.h = d.h.filter(t => candles.TFS[t]).slice(0, 8);
  if (d.k === 'fib' && Array.isArray(d.lv)) o.lv = d.lv.slice(0, 24).filter(q => q && fin(+q.v)).map(q => ({ v: nrm(q.v, -10, 20, 0), on: q.on !== false, c: hexOr(q.c, undefined) }));
  return o;
}
app.get('/api/chart', ANY, wrap((req, res) => {
  const u = req.user.id, aid = String(req.query.aid || '');
  res.json({ pref: db.get('chart', u + ':pref') || null, draw: (aid && (db.get('chart', u + ':' + aid) || {}).draw) || [] });
}));
app.post('/api/chart', ANY, wrap((req, res) => {
  const u = req.user, b = req.body || {};
  if (b.pref) {
    const p = b.pref, hex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v), ind = (Array.isArray(p.ind) ? p.ind : []).slice(0, 40).filter(i => i && IND_OK[i.k] && ((i.k !== 'algobb' && i.k !== 'custom') || u.role === 'admin')).map(i => {
      const o = { id: String(i.id || '').slice(0, 20), k: i.k, on: i.on !== false, p: {} };
      Object.keys(i.p || {}).slice(0, 14).forEach(k => { const v = i.p[k], kk = String(k).slice(0, 12); if (fin(v)) o.p[kk] = Math.max(0, Math.min(5000, v)); else if (hex(v)) o.p[kk] = v; else if (typeof v === 'boolean') o.p[kk] = v; else if (k === 'src' && ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'].indexOf(v) >= 0) o.p.src = v; else if (k === 'code' && i.k === 'custom' && typeof v === 'string') o.p.code = v.slice(0, 6000); });
      if (i.s && typeof i.s === 'object') { o.s = {}; Object.keys(i.s).slice(0, 16).forEach(k => { const q = i.s[k] || {}, r = {}; if (hex(q.c)) r.c = q.c; if (fin(q.w)) r.w = Math.max(0.5, Math.min(5, q.w)); if (fin(q.ls) && q.ls >= 0 && q.ls <= 2) r.ls = q.ls; if (typeof q.v === 'boolean') r.v = q.v; o.s[String(k).slice(0, 10)] = r; }); }
      if (Array.isArray(i.h)) o.h = i.h.filter(t => candles.TFS[t]).slice(0, 8);
      return o;
    });
    db.put('chart', { id: u.id + ':pref', ind, tf: candles.TFS[p.tf] ? p.tf : 'D', theme: p.theme === 'light' ? 'light' : 'dark', log: !!p.log, magnet: !!p.magnet, aid: String(p.aid || '').slice(0, 60), cs: cleanCS(p.cs) }, true);
  }
  if (b.aid && Array.isArray(b.draw)) {
    if (!db.get('assets', String(b.aid))) throw bad('Aktiv topilmadi.', 404);
    const draw = b.draw.slice(0, 300).filter(d => d && DR_OK[d.k] && Array.isArray(d.pts) && d.pts.length === DR_OK[d.k] && d.pts.every(p => p && fin(p.t) && fin(p.p))).map(cleanDraw);
    db.put('chart', { id: u.id + ':' + b.aid, draw }, true);
  }
  res.json({ ok: true });
}));

/* ---------------- Tarixiy kunlik ma'lumotlar: fayldan import va uzse.uz (yoki boshqa) havoladan doimiy yangilash ---------------- */
const isinOf = a => { const r = String((a.src && a.src.ref) || ''), m = /UZ[A-Z0-9]{10}/i.exec(r); return m ? m[0].toUpperCase() : ''; };
const med = a => { const x = a.filter(v => v > 0).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : 0; };
function importBuf(aid, buf, name, force) {
  const cs = tabular.toCandles(tabular.readAny(buf, name)); if (!cs.length) throw new Error('Fayldan birorta sham o‘qilmadi (sana va "Yopilish narxi" ustunlari kerak).');
  /* Himoya: fayl narxlari aktivning mavjud tarixidan bir necha barobar farq qilsa (boshqa aktiv fayli), yuklanmaydi */
  const have = hist.get(aid).filter(x => !x.p); if (!force && have.length >= 10) { const m1 = med(have.map(x => x.c)), m2 = med(cs.map(x => x.c)); if (m1 && m2 && (m2 / m1 > 5 || m1 / m2 > 5)) throw new Error('Fayl narxlari (~' + m2 + ') bu aktivning mavjud tarixidan (~' + m1 + ') juda farq qiladi, ehtimol boshqa aktiv fayli. Yuklanmadi.'); }
  const r = hist.upsert(aid, cs, false); candles.clearCache(); return r;
}
const dmy = d => String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear();
const bfRun = {};
const typOf = a => a.group === 'obligatsiya' ? 'BND' : 'STK';
/* Havola shabloni: {isin} {sym} {from} {to} {from_iso} {to_iso} {type} (STK|BND) {type_lc}; shablonda STK yoki BND yozilgan bo'lsa, u aktiv turiga qarab avtomatik almashtiriladi */
function fillTpl(tpl, a, from, to) {
  const iso = d => d.toISOString().slice(0, 10), T = typOf(a);
  return tpl.replace(/\{type\}/gi, T).replace(/\{type_lc\}/gi, T.toLowerCase())
    .replace(/(^|[\/=_&?.-])(stk|bnd)(?=$|[\/&?=_.-])/gi, (m, p, t) => p + (t === t.toUpperCase() ? T : T.toLowerCase()))
    .replace(/\{isin\}/gi, isinOf(a) || encodeURIComponent((a.src && a.src.ref) || a.sym)).replace(/\{sym\}/gi, encodeURIComponent(a.sym)).replace(/\{from_iso\}/gi, iso(from)).replace(/\{to_iso\}/gi, iso(to)).replace(/\{from\}/gi, dmy(from)).replace(/\{to\}/gi, dmy(to));
}
function histUrl(a) {
  const tpl = a.hurl || (a.src && a.src.type === 'uzse' ? settings().uzseHist : ''); if (!tpl) return null;
  const cs = hist.get(a.id).filter(x => !x.p), last = cs.length ? new Date((cs[cs.length - 1].t - 5 * 86400) * 1000) : new Date(Date.UTC(2015, 0, 1));
  return fillTpl(tpl, a, last, new Date());
}
/* Yangilash jadvali:
   - Excel/havola tarixi (uzse.uz va "Tarix havolasi" bor aktivlar): har HIST_HOURS (standart 2) soatda faqat yangi kunlar so'raladi.
   - Binance/Bitget (kripto, metall, tokenlashgan aksiyalar): narx va oxirgi kunlik shamlar har CRYPTO_SYNC_MIN (standart 5) daqiqada; to'liq tarix faqat aktiv qo'shilganda bir marta.
   Xatoda: 429 bo'lsa 1 soat, boshqa xatoda kripto 10 daqiqa, havola tarixi keyingi 2 soatlik navbat. */
const SIX_H = 6 * 3600e3;
const tkDay = ms => Math.floor((ms / 1000 + 5 * 3600) / 86400);
const HIST_MS = () => Math.max(0.25, +process.env.HIST_HOURS || 2) * 3600e3, CRYPTO_MS = () => Math.max(1, +process.env.CRYPTO_SYNC_MIN || 5) * 60e3;
function histDue(a, force) {
  if (force) return true; if (a.hsyncNext && a.hsyncNext > now()) return false;
  const n = hist.get(a.id).filter(x => !x.p).length; if (!a.hsyncT) return n < 10; /* hech urinilmagan: faqat tarix bo'sh bo'lsa */
  return now() - a.hsyncT >= HIST_MS() - 60e3;
}
function provDue(a, force) {
  if (force) return true; if (a.bfNext && a.bfNext > now()) return false;
  if (!a.bfFull) return true; const first = (candles.plan(a)[0] || [])[0];
  return !a.bfT || now() - a.bfT >= (first === 'bitget' ? CRYPTO_MS() - 20e3 : 20 * 3600e3);
}
async function syncHist(a) {
  const url = histUrl(a); if (!url) return { skipped: 'havola yo‘q' };
  let r; try { r = await sources.httpBuf(url, { headers: { referer: 'https://uzse.uz/', accept: '*/*', 'accept-language': 'ru,uz;q=0.8,en;q=0.5' }, timeout: 40000, tries: 3 }); }
  catch (e) { if (/429/.test(e.message)) a.hsyncNext = now() + 30 * 60e3; throw e; }
  let out; try { out = importBuf(a.id, r.buf, url); }
  catch (e) { const t = r.buf.slice(0, 160).toString('utf8').replace(/\s+/g, ' ').replace(/[^\x20-\x7E\u0400-\u04FF]/g, '?'); throw new Error(e.message + ' [javob: ' + (r.type || '?').slice(0, 40) + ', ' + r.buf.length + ' bayt' + (/html|text|json|xml/i.test(r.type) ? ', boshi: "' + t + '"' : '') + ']'); }
  a = db.get('assets', a.id); a.hsyncT = now(); a.hsyncErr = null; a.hsyncNext = 0; db.put('assets', a, true); return out;
}
/* Tashqi manba (Bitget/Yahoo/Stooq) dan kunlik tarixni to'liq yuklash va doimiy yozib borish (hc) */
const hasProv = a => candles.plan(a).some(p => p[0] !== 'history');
async function syncProv(a, force) {
  if (!hasProv(a)) return { skipped: 'tashqi manba yo‘q' };
  const full = force || !a.bfFull || hist.get(a.id).filter(x => !x.p).length < 30;
  const r = await candles.daily(a, full), today = Math.floor(Date.now() / 86400000) * 86400, done = r.candles.filter(c => c.t < today), cur = r.candles.filter(c => c.t >= today);
  let out = { total: hist.get(a.id).length }; if (done.length) out = hist.upsert(a.id, done, false); if (cur.length) out = hist.upsert(a.id, cur, true);
  candles.clearCache(); const c2 = db.get('assets', a.id); c2.bfT = now(); c2.bfErr = null; c2.bfNext = 0; if (full && r.candles.length >= 30) c2.bfFull = true; db.put('assets', c2, true); seedPrice(c2.id);
  return Object.assign({ from: r.kind }, out);
}
/* Narx hech qachon olinmagan bo'lsa, oxirgi ma'lum shamning yopilish narxi ko'rsatiladi (oflayn rejim) */
function seedPrice(id) {
  const a = db.get('assets', id); if (!a || a.price != null) return; const cs = hist.get(id); if (!cs.length) return;
  const l = cs[cs.length - 1]; a.price = l.c; a.priceT = l.t * 1000; a.priceFrom = 'tarix'; db.put('assets', a, true);
}
async function syncAllHist(onlyId, force) {
  const res = {}, list = db.all('assets').filter(x => !x.archived && x.group !== 'naqd' && (!onlyId || x.id === onlyId));
  for (const a0 of list) {
    const a = db.get('assets', a0.id), name = a.sym;
    try {
      if (histUrl(a)) { if (histDue(a, force)) res[name] = await syncHist(a); else res[name] = { skipped: 'kerak emas' }; }
    } catch (e) { res[name] = { error: e.message }; const c = db.get('assets', a.id); c.hsyncErr = e.message; c.hsyncT = now(); c.hsyncNext = now() + (/429/.test(e.message) ? 3600e3 : HIST_MS()); db.put('assets', c, true); }
    try { if (hasProv(a)) { if (provDue(a, force)) res[name] = Object.assign(res[name] || {}, await syncProv(a, force)); } }
    catch (e) { res[name] = Object.assign(res[name] || {}, { error: e.message }); const c = db.get('assets', a.id); c.bfErr = e.message; c.bfT = now(); c.bfNext = now() + (/429/.test(e.message) ? 3600e3 : ((candles.plan(a)[0] || [])[0] === 'bitget' ? 10 * 60e3 : SIX_H)); db.put('assets', c, true); }
    seedPrice(a.id);
  }
  return res;
}
app.post('/api/history/import', A, wrap((req, res) => {
  const b = req.body || {}, files = Array.isArray(b.files) ? b.files.slice(0, 40) : [], assets = db.all('assets').filter(a => !a.archived && a.group !== 'naqd'), out = [];
  files.forEach(f => {
    const name = String(f.name || 'fayl'), rep = { name };
    try {
      /* Aktivni avval fayl nomidagi ISIN/tiker aniqlaydi (xato aktivga aralashib ketmasligi uchun); tanlangan aktiv faqat nom noaniq bo'lganda ishlatiladi */
      let a = null; const m = /UZ[A-Z0-9]{10}/i.exec(name);
      if (b.aid && b.strict) { a = assets.filter(x => x.id === b.aid)[0]; if (!a) throw new Error('Aktiv topilmadi.'); const o = m && assets.filter(x => isinOf(x) === m[0].toUpperCase())[0]; if (o && o.id !== a.id) throw new Error('Fayl nomidagi ISIN (' + m[0].toUpperCase() + ') ' + o.sym + ' aktiviga tegishli, ' + a.sym + ' ga emas. Yuklanmadi.'); }
      else if (m) { a = assets.filter(x => isinOf(x) === m[0].toUpperCase())[0]; if (!a) throw new Error('Bu ISIN (' + m[0].toUpperCase() + ') hech bir aktivning "Manba kodi"da topilmadi. Aktivni tahrirlab ISIN ni kiriting.'); }
      if (!a) a = assets.filter(x => new RegExp('(^|[^A-Z0-9])' + x.sym.toUpperCase().replace(/[^A-Z0-9]/g, '') + '([^A-Z0-9]|$)').test(name.toUpperCase()))[0];
      if (!a && b.aid) a = assets.filter(x => x.id === b.aid)[0];
      if (!a) throw new Error('Qaysi aktivga tegishli ekani aniqlanmadi (fayl nomida ISIN yoki tiker bo‘lsin, yoki chartda aktivni tanlab yuklang).');
      const r = importBuf(a.id, Buffer.from(String(f.data || ''), 'base64'), name, !!b.force); Object.assign(rep, { sym: a.sym }, r);
    } catch (e) { rep.error = e.message; }
    out.push(rep);
  });
  req.ad = out.map(x => x.name + ': ' + (x.error ? 'xato' : x.sym + ' +' + x.added + '/~' + x.changed)).join('; ').slice(0, 500);
  res.json({ ok: true, files: out });
}));
app.get('/api/history/status', A, wrap((req, res) => {
  const st = {}; hist.stats().forEach(x => { st[x.id] = x; });
  res.json({ uzseHist: settings().uzseHist || '', assets: db.all('assets').filter(a => !a.archived && a.group !== 'naqd').map(a => Object.assign({ id: a.id, sym: a.sym, name: a.name, isin: isinOf(a), hurl: !!histUrl(a), prov: hasProv(a), hsyncT: a.hsyncT || null, hsyncErr: a.hsyncErr || null, bfT: a.bfT || null, bfErr: a.bfErr || null, bfFull: !!a.bfFull }, st[a.id] || { n: 0 })) });
}));
app.post('/api/history/sync', A, wrap(async (req, res) => { const r = await syncAllHist((req.body || {}).aid, true); req.ad = JSON.stringify(r).slice(0, 400); res.json({ ok: true, result: r }); }));
app.post('/api/history/reset', A, wrap((req, res) => {
  const b = req.body || {}, list = b.all ? db.all('assets').filter(x => !x.archived && x.group !== 'naqd') : [db.get('assets', String(b.aid || ''))].filter(Boolean); if (!list.length) throw bad('Aktiv topilmadi.', 404);
  const bk = autoBackup(true); let removed = 0;
  list.forEach(a => { const doc = db.get('hc', a.id); if (!doc) return; const n = doc.c.length; doc.c = doc.c.filter(x => x.p); doc.upd = Date.now(); db.put('hc', doc, true); removed += n - doc.c.length; });
  candles.clearCache(); req.ad = list.map(a => a.sym).join(',').slice(0, 200) + ': ' + removed + ' ta rasmiy sham tozalandi (zaxira: ' + bk + ')'; res.json({ ok: true, removed, backup: bk });
}));
app.get('/api/history/export', A, wrap((req, res) => {
  const a = db.get('assets', String(req.query.aid || '')); if (!a) throw bad('Aktiv topilmadi.', 404);
  const rows = hist.get(a.id).map(c => [new Date(c.t * 1000).toISOString().slice(0, 10), c.o, c.h, c.l, c.c, c.v].join(','));
  res.setHeader('content-type', 'text/csv; charset=utf-8'); res.setHeader('content-disposition', 'attachment; filename="' + a.sym + '-kunlik.csv"'); res.send('Date,Open,High,Low,Close,Volume\n' + rows.join('\n'));
}));

/* ---------------- Zaxira nusxa: avtomatik (data/backups) va admin yuklab olishi ---------------- */
const fs = require('fs');
const BK = path.join(db.dir, 'backups');
function autoBackup(force) {
  try {
    fs.mkdirSync(BK, { recursive: true });
    const files = fs.readdirSync(BK).filter(f => /^barlos-.*\.db$/.test(f)).sort();
    const last = files.length ? fs.statSync(path.join(BK, files[files.length - 1])).mtimeMs : 0;
    if (!force && Date.now() - last < 6 * 3600e3) return null;
    const d = new Date(), p2 = n => String(n).padStart(2, '0');
    const name = 'barlos-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + '.db';
    db.backup(path.join(BK, name));
    files.concat([name]).slice(0, -30).forEach(f => { try { fs.unlinkSync(path.join(BK, f)); } catch (e) { /* e'tibor bermaymiz */ } });
    return name;
  } catch (e) { console.error('zaxira xatosi:', e.message); return null; }
}
app.get('/api/backup', A, wrap((req, res) => {
  fs.mkdirSync(BK, { recursive: true });
  const tmp = path.join(BK, 'download-' + crypto.randomBytes(4).toString('hex') + '.tmp');
  db.backup(tmp); AU(req, 'Zaxira nusxani yuklab oldi', '');
  const d = new Date(), p2 = n => String(n).padStart(2, '0');
  res.download(tmp, 'barlos-zaxira-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.db', () => { try { fs.unlinkSync(tmp); } catch (e) { /* */ } });
}));

/* ---------------- Statik fayllar ---------------- */
app.get('/healthz', (req, res) => res.send('ok'));
/* ---------------- Omonat foizi: to'lov sanalari bo'yicha FOIZ yozuvlari ---------------- */
app.get('/api/deposits', AO, wrap((req, res) => {
  const S = loadS(), t = now();
  const items = S.assets.filter(x => x.group === 'omonat' && !x.archived && +x.rate > 0).map(x => ({ aid: x.id, sym: x.sym, rate: x.rate, dpay: x.dpay || 'none', dcap: x.dcap !== false,
    dstart: x.dstart || '', accounts: S.accounts.filter(a => !a.archived).map(a => { const d = Core.depState(S, a.id, x, t); return d ? { acc: a.id, name: Core.accLabel(a), total: d.total, paid: d.paid, unpaid: d.unpaid, days: d.days, first: d.first } : null; }).filter(Boolean) }));
  res.json({ today: tkDate(), items, due: Core.depDue(S, t, { ahead: 30, back: 400 }) });
}));
function depWho(req) { return req.user.role === 'admin' ? 'Admin' : 'Operator: ' + (req.user.name || req.user.email); }
function depWrite(S, it, who, blk) {
  const amt = Math.round(it.amt * 1e8) / 1e8, inp = { acc: it.acc, aid: it.aid, type: it.kind, amount: amt, price: 1, t: Date.parse(it.date + 'T07:00:00Z'), bk: it.key, note: 'Omonat foizi ' + it.date + ' (omonatga qo‘shildi)' };
  return writeTx(S, inp, who, 'Tizim (omonat)', blk || null);
}
app.post('/api/deposits/accept', AO, wrap((req, res) => {
  const key = String((req.body || {}).key || ''), S = loadS(), all = Core.depDue(S, now(), { ahead: 0, back: 400 }), it = all.filter(x => x.key === key)[0];
  if (!it) throw bad('Bu to‘lov topilmadi yoki sanasi hali kelmagan.', 404);
  if (it.done) throw bad('Bu foiz allaqachon yozilgan.');
  if (all.some(x => x.acc === it.acc && x.aid === it.aid && !x.done && x.date < it.date)) throw bad('Avval oldingi sanadagi foizni yozing.');
  if (!(it.amt > 0)) throw bad('Yoziladigan foiz summasi yo‘q.');
  const x = S.assets.filter(a => a.id === it.aid)[0];
  const rec = db.tx(() => depWrite(S, it, depWho(req))); req.ad = rec.id + ': ' + x.sym + ' ' + it.kind + ' ' + it.date + ' ' + it.amt; res.json({ ok: true, id: rec.id, amount: Math.round(it.amt * 1e8) / 1e8 });
}));
/* Umumiy signal: bitta omonat va sana bo'yicha barcha mijozlarga taqsimlangan foizni bir yo'la yozish */
app.post('/api/deposits/accept-group', AO, wrap((req, res) => {
  const b = req.body || {}, aid = String(b.aid || ''), date = String(b.date || ''), S = loadS(), all = Core.depDue(S, now(), { ahead: 0, back: 400 });
  const grp = all.filter(x => x.aid === aid && x.date === date);
  if (!grp.length) throw bad('Bu to‘lov topilmadi yoki sanasi hali kelmagan.', 404);
  if (all.some(x => x.aid === aid && !x.done && x.date < date)) throw bad('Avval oldingi sanadagi umumiy signalni tasdiqlang.');
  const todo = grp.filter(x => !x.done && x.amt > 0); if (!todo.length) throw bad('Bu signal allaqachon to‘liq tasdiqlangan.');
  const who = depWho(req), x = S.assets.filter(a => a.id === aid)[0];
  const ids = db.tx(() => { const blk = 'B' + (10000 + db.seq('blk')); return todo.map(it => depWrite(S, it, who, blk).id); });
  req.ad = x.sym + ' ' + date + ': ' + ids.length + ' ta mijoz, jami ' + todo.reduce((s, i) => s + i.amt, 0); res.json({ ok: true, ids });
}));

/* ---------------- Obligatsiya: kupon jadvali, yig'ilgan foiz, YTM signali, kupon yozuvlari ---------------- */
const ISO = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && isFinite(Core.dayNum(String(v)));
function cleanBond(b) {
  b = b || {}; const nominal = +b.nominal; if (!(nominal > 0)) throw bad('Obligatsiya nominali musbat bo‘lsin.');
  const rate = +b.rate; if (!(rate >= 0 && rate <= 200)) throw bad('Kupon stavkasi 0–200% oralig‘ida bo‘lsin.');
  const freq = Math.round(+b.freq || 4); if ([1, 2, 3, 4, 6, 12].indexOf(freq) < 0) throw bad('Kupon davriyligi yiliga 1, 2, 3, 4, 6 yoki 12 marta bo‘lsin.');
  const o = { nominal, rate, freq };
  ['first', 'maturity', 'issue'].forEach(k => { if (b[k]) { if (!ISO(b[k])) throw bad('Sana YYYY-OO-KK ko‘rinishida bo‘lsin (' + k + ').'); o[k] = String(b[k]); } });
  if (b.redeem !== undefined && b.redeem !== '' && b.redeem !== null) { const r = +b.redeem; if (!(r > 0 && r <= 200)) throw bad('So‘ndirish narxi nominalning 0–200% oralig‘ida bo‘lsin.'); o.redeem = r; }
  if (Array.isArray(b.coupons) && b.coupons.length) o.coupons = b.coupons.slice(0, 400).map(c => { if (!ISO(c && c.d)) throw bad('Kupon sanasi noto‘g‘ri.'); const x = { d: String(c.d) }; if (+c.amt > 0) x.amt = +c.amt; return x; });
  if (!o.coupons && !o.first && !o.maturity) throw bad('Birinchi kupon sanasi yoki so‘ndirish sanasi kerak.');
  if (b.sig !== undefined) o.sig = !!b.sig; if (b.dirty !== undefined) o.dirty = !!b.dirty; if (b.hurdle !== undefined && b.hurdle !== '' && b.hurdle !== null) { const h = +b.hurdle; if (!(h >= 0 && h <= 200)) throw bad('Maqsadli daromad 0–200% bo‘lsin.'); o.hurdle = h; }
  return o;
}
const bondOpt = (x, st) => ({ hurdle: x.bond.hurdle != null ? x.bond.hurdle : (st.bondHurdle != null ? st.bondHurdle : 25), buy: st.bondBuy != null ? st.bondBuy : 1, sell: st.bondSell != null ? st.bondSell : 3, dirty: !!x.bond.dirty });
const tkDate = (ms) => Core.dayStr(Core.dayNum((ms || now()) + 5 * 3600e3));
function bondInfo() {
  const S = loadS(), st = settings(), t = tkDate();
  const bonds = S.assets.filter(x => x.group === 'obligatsiya' && !x.archived && x.bond).map(x => {
    const sc = Core.bondSched(x.bond), ac = Core.bondAccrued(x.bond, t), sg = x.price > 0 ? Core.bondSignal(x.bond, x.price, t, bondOpt(x, st)) : null;
    return { aid: x.id, sym: x.sym, name: x.name, price: x.price, bond: x.bond, sched: sc, accrued: ac, signal: sg, bsig: x.bsig || null };
  });
  return { today: t, hurdle: st.bondHurdle != null ? st.bondHurdle : 25, buy: st.bondBuy != null ? st.bondBuy : 1, sell: st.bondSell != null ? st.bondSell : 3, bonds, due: Core.bondDue(S, now(), { ahead: 30, back: 400 }) };
}
app.get('/api/bonds', AO, wrap((req, res) => res.json(bondInfo())));
app.post('/api/bonds/accept', AO, wrap((req, res) => {
  const key = String((req.body || {}).key || ''), S = loadS(), it = Core.bondDue(S, now(), { ahead: 0, back: 400 }).filter(x => x.key === key)[0];
  if (!it) throw bad('Bu kupon/so‘ndirish topilmadi yoki sanasi hali kelmagan.', 404);
  if (it.done) throw bad('Bu kupon allaqachon yozilgan.');
  const x = S.assets.filter(a => a.id === it.aid)[0], t = Date.parse(it.date + 'T07:00:00Z'), who = req.user.role === 'admin' ? 'Admin' : 'Operator: ' + (req.user.name || req.user.email);
  const inp = it.kind === 'KUPON' ? { acc: it.acc, aid: it.aid, type: 'KUPON', amount: it.amt, price: 1, t, bk: key, note: 'Kupon ' + it.date + ': ' + it.qty + ' dona × ' + it.per } : { acc: it.acc, aid: it.aid, type: 'SELL', amount: it.qty, price: it.per, t, bk: key, autoFee: false, fee: 0, feeAsset: '', note: 'So‘ndirish ' + it.date };
  const rec = db.tx(() => writeTx(S, inp, who, 'Tizim (obligatsiya)', null)); req.ad = rec.id + ': ' + x.sym + ' ' + it.kind + ' ' + it.date + ' ' + it.amt; res.json({ ok: true, id: rec.id });
}));
/* Kunlik tsikl: (1) YTM signali (aktivda bond.sig yoqilgan bo'lsa), (2) kupon/so'ndirish eslatmalari adminlar jurnaliga */
function bondLoop() {
  const st = settings(), t = tkDate(), admins = db.db.prepare("SELECT id, email FROM users WHERE role='admin'").all(), S = loadS();
  S.assets.filter(x => x.group === 'obligatsiya' && !x.archived && x.bond && x.bond.sig && x.price > 0).forEach(x => {
    if (x.bsig && x.bsig.d === t) return; const sg = Core.bondSignal(x.bond, x.price, t, bondOpt(x, st)); if (!sg.side) return;
    let msg = ''; try { const r = receiveSignal(x, sg.side, x.price, 'Obligatsiya: ' + sg.why); msg = r && r.msg; } catch (e) { msg = 'signal yuborilmadi: ' + e.message; }
    const a = db.get('assets', x.id); a.bsig = { d: t, side: sg.side, ytm: sg.ytm }; db.put('assets', a, true); AU(null, 'Obligatsiya signali', x.sym + ' ' + sg.side + ' · ' + sg.why + ' | ' + msg, 'Tizim');
  });
  Core.depDue(S, now(), { ahead: 3, back: 30 }).filter(i => !i.done).forEach(i => {
    const nid = i.key + '|' + i.status; if (db.get('bnote', nid)) return; db.put('bnote', { id: nid, t: now() }, true);
    const txt = i.sym + ' omonat foizi ' + i.date + ' (' + i.accName + '): ' + i.amt + ' so‘m · ' + (i.status === 'yaqin' ? i.days + ' kundan keyin' : i.status === 'bugun' ? 'bugun' : 'yozilmagan, tasdiqlang');
    if (mail.enabled()) admins.forEach(ad => ad.email && mail.send(ad.email, 'BARLOS: omonat foizi to‘lovi', txt + '\nTasdiqlash: Avto savdo → Omonat foizi.').catch(e => console.error('omonat email:', e.message)));
    admins.forEach(ad => db.put('alog', { id: 'G' + (100000 + db.seq('alog')), uid: ad.id, alert: 'dep', aid: i.aid, sym: i.sym, tf: '', t: now(), price: null, name: 'Omonat', text: txt, signal: '' }));
  });
  Core.bondDue(S, now(), { ahead: 3, back: 30 }).filter(i => !i.done).forEach(i => {
    const nid = i.key + '|' + i.status; if (db.get('bnote', nid)) return; db.put('bnote', { id: nid, t: now() }, true);
    const txt = i.sym + ' ' + (i.kind === 'KUPON' ? 'kupon' : 'so‘ndirish') + ' ' + i.date + ' (' + i.accName + '): ' + i.qty + ' dona, ' + Math.round(i.amt) + ' ' + ((S.assets.filter(a => a.id === i.aid)[0] || {}).curr || '') + ' · ' + (i.status === 'yaqin' ? i.days + ' kundan keyin' : i.status === 'bugun' ? 'bugun' : 'yozilmagan, tasdiqlang');
    admins.forEach(ad => db.put('alog', { id: 'G' + (100000 + db.seq('alog')), uid: ad.id, alert: 'bond', aid: i.aid, sym: i.sym, tf: '', t: now(), price: null, name: 'Obligatsiya', text: txt, signal: '' }));
  });
}


chat.mount(app, { ANY, wrap, bad, AU });
profile.mount(app, { ANY, wrap, bad, AU });
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '5m' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi.' }));


/* ---------------- Ishga tushirish ---------------- */
function bootAdmin() {
  const em = auth.ADMIN_EMAIL, pw = process.env.ADMIN_PASSWORD;
  if (pw && !auth.find(em)) { if (!auth.validPw(pw)) { console.warn('ADMIN_PASSWORD kamida 8 belgi bo‘lsin.'); return; } auth.createUser({ email: em, name: 'Administrator', password: pw, verified: true }); console.log('Administrator yaratildi:', em); }
  if (!auth.find(em)) console.log('\n!! Administrator hali yaratilmagan. Quyidagini ishga tushiring:  npm run setup\n');
}
const PORT = +(process.env.PORT || 3000);
if (require.main === module) {
  settings(); bootAdmin(); scheduleRefresh(); autoBackup(); setInterval(autoBackup, 3600e3); setTimeout(() => reportLoop(), 60000); setInterval(() => reportLoop(), 3600e3); setTimeout(() => stochRun().catch(e => console.error('stoch:', e.message)), 40000); setInterval(() => stochRun().catch(e => console.error('stoch:', e.message)), 3600e3); setTimeout(() => { try { bondLoop(); } catch (e) { console.error('obligatsiya:', e.message); } }, 25000); setInterval(() => { try { bondLoop(); } catch (e) { console.error('obligatsiya:', e.message); } }, 3600e3); setInterval(() => checkAlerts().catch(e => console.error('alertlar:', e.message)), 60e3);
  /* uzse.uz kunlik yangilash: har 30 daqiqada (havola sozlangan bo'lsa); seans 16:00 dan keyin ham ishlaydi */
  setInterval(() => syncAllHist().catch(e => console.error('tarix yangilash:', e.message)), 5 * 60e3); setTimeout(() => { db.all('assets').forEach(x => seedPrice(x.id)); syncAllHist().catch(() => { }); }, 15000);
  app.listen(PORT, () => {
    console.log('BARLOS ishga tushdi: http://localhost:' + PORT);
    refreshPrices().catch(() => { });
  });
}
module.exports = { app, settings, loadS, reportLoop, stochRun, stochMap, refreshPrices, checkAlerts, fillTpl, syncProv, syncAllHist, provDue, histDue, bondLoop, bondInfo };
