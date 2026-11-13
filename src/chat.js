'use strict';
/* BARLOS chat: shaxsiy yozishma, guruh, kanal va kanalga bog'langan muhokama guruhi.
   Xabarlar o'zgartirilmaydi va o'chirilmaydi. Har bir chatning xabarlari SHA-256 zanjiri bilan bog'lanadi:
     hash(n) = SHA-256( hash(n-1) | chat | n | muallif | vaqt | javob | matn )
   va har bir hash serverning yashirin kaliti bilan HMAC imzolanadi. Bu SHIFRLASH EMAS: server xabarlarni o'qiy oladi.
   Zanjir faqat keyin yashirincha o'zgartirilgan / o'chirilgan / tartibi buzilgan xabarlarni aniqlaydi. */
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function secret() {
  let r = db.db.prepare('SELECT v FROM meta WHERE k=?').get('chat_secret');
  if (!r) { const v = crypto.randomBytes(32).toString('hex'); db.db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('chat_secret', v); return v; }
  return r.v;
}
const sig = h => crypto.createHmac('sha256', secret()).update(h).digest('hex').slice(0, 32);
const pad = n => String(n).padStart(7, '0');
const mid = (chat, seq) => chat + ':' + pad(seq);
const body = m => [m.chat, m.seq, m.uid, m.t, m.reply || 0, m.fwd ? m.fwd.chat + '#' + m.fwd.seq : '', m.sys ? 1 : 0, m.text].join('\u001f');
const genesis = c => sha('BARLOS|chat|' + c.id + '|' + c.created + '|' + c.owner);

const selMsgs = db.db.prepare("SELECT json FROM docs WHERE coll='cmsg' AND id>=? AND id<? ORDER BY id");
const selLast = db.db.prepare("SELECT json FROM docs WHERE coll='cmsg' AND id>=? AND id<? ORDER BY id DESC LIMIT ?");
const selAfter = db.db.prepare("SELECT json FROM docs WHERE coll='cmsg' AND id>? AND id<? ORDER BY id LIMIT ?");
const lo = chat => chat + ':', hi = chat => chat + ';';
const all = chat => selMsgs.all(lo(chat), hi(chat)).map(r => JSON.parse(r.json));
const last = (chat, n) => selLast.all(lo(chat), hi(chat), n).map(r => JSON.parse(r.json)).reverse();
const after = (chat, seq, n) => selAfter.all(mid(chat, seq), hi(chat), n).map(r => JSON.parse(r.json));
const getMsg = (chat, seq) => db.get('cmsg', mid(chat, seq));

/* Xabar qo'shish: zanjirga ulanadi. db.tx ichida chaqiring. */
function append(chat, uid, text, o) {
  o = o || {}; text = String(text == null ? '' : text);
  const c = db.get('chat', chat.id || chat); if (!c) throw new Error('Chat topilmadi');
  const seq = (c.n || 0) + 1, t = o.t || Date.now(), prev = c.tip || genesis(c);
  const m = { id: mid(c.id, seq), chat: c.id, seq, uid, t, text, reply: o.reply || 0 };
  if (o.fwd) m.fwd = o.fwd; if (o.sys) m.sys = 1;
  m.prev = prev; m.hash = sha(prev + '|' + body(m)); m.sig = sig(m.hash);
  db.put('cmsg', m, true);
  c.n = seq; c.tip = m.hash; c.lastT = t; if (c.m && c.m[uid]) c.m[uid].read = seq;
  db.put('chat', c, true);
  return m;
}
/* Zanjirni qayta hisoblab tekshirish */
function verify(chatId) {
  const c = db.get('chat', chatId); if (!c) return { ok: false, why: 'Chat topilmadi' };
  const ms = all(chatId); let prev = genesis(c), exp = 0;
  for (const m of ms) {
    exp++;
    if (m.seq !== exp) return { ok: false, n: ms.length, broken: m.seq, why: 'Xabar tartib raqami uzilgan: ' + exp + '-xabar yo‘q' };
    if (m.prev !== prev) return { ok: false, n: ms.length, broken: m.seq, why: m.seq + '-xabar oldingisiga ulanmagan' };
    if (m.hash !== sha(prev + '|' + body(m))) return { ok: false, n: ms.length, broken: m.seq, why: m.seq + '-xabar mazmuni o‘zgartirilgan' };
    if (m.sig !== sig(m.hash)) return { ok: false, n: ms.length, broken: m.seq, why: m.seq + '-xabar imzosi noto‘g‘ri' };
    prev = m.hash;
  }
  if ((c.n || 0) !== ms.length) return { ok: false, n: ms.length, broken: ms.length + 1, why: 'Oxirgi xabar(lar) o‘chirilgan: kutilgan ' + c.n + ', topildi ' + ms.length };
  if ((c.tip || genesis(c)) !== prev) return { ok: false, n: ms.length, why: 'Zanjir uchi mos kelmaydi' };
  return { ok: true, n: ms.length, tip: prev };
}

/* ---------- foydalanuvchi ko'rinishi ---------- */
const prof = id => db.get('profile', id) || {};
function pubU(id) {
  const u = auth.byId(id), p = prof(id);
  if (!u) return { id, name: id, username: '', staff: '', av: 0 };
  return { id, name: u.name || p.username || u.id, username: p.username || '', staff: u.role === 'admin' ? 'Admin' : u.role === 'operator' ? 'Operator' : '', av: p.avT || 0 };
}
const isStaff = u => u && (u.role === 'admin' || u.role === 'operator');
function resolve(q) {
  q = String(q || '').trim(); if (!q) return null;
  if (/^U\d+$/i.test(q)) return auth.byId(q.toUpperCase()) || null;
  const un = q.replace(/^@/, '').toLowerCase();
  const p = db.all('profile').filter(x => x.username === un)[0]; return p ? auth.byId(p.id) : null;
}
function canDm(from, to) {
  if (!to || to.blocked || to.id === from.id) return false;
  if (isStaff(from) || isStaff(to)) return true;
  return prof(to.id).dm !== 'staff';
}
const dmId = (a, b) => 'D~' + [a, b].sort().join('~');
const mrole = (c, uid) => c.m && c.m[uid] ? c.m[uid].r : null;
const canPost = (c, uid) => { const r = mrole(c, uid); if (!r) return false; return c.type !== 'channel' || r === 'owner' || r === 'admin'; };
const canManage = (c, uid) => { const r = mrole(c, uid); return c.type !== 'dm' && (r === 'owner' || r === 'admin'); };
const code = () => crypto.randomBytes(5).toString('hex');

function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function metaOf(c, uid) {
  const m = c.m && c.m[uid], o = { id: c.id, type: c.type, title: c.title, about: c.about || '', public: !!c.public, role: m ? m.r : null, n: c.n || 0, unread: m ? Math.max(0, (c.n || 0) - (m.read || 0)) : 0, disc: c.disc || '', ch: c.ch || '', tip: c.tip || '', lastT: c.lastT || c.created, cnt: Object.keys(c.m || {}).length, post: canPost(c, uid), manage: canManage(c, uid) };
  if (c.type === 'dm') { const other = Object.keys(c.m).filter(x => x !== uid)[0]; o.other = pubU(other || uid); o.title = o.other.name; }
  if (o.manage) o.code = c.code || '';
  return o;
}
const msgPub = m => ({ seq: m.seq, uid: m.uid, t: m.t, text: m.text, reply: m.reply || 0, fwd: m.fwd || null, sys: m.sys || 0, cc: m.cc || 0, hash: m.hash, prev: m.prev });

/* ---------- marshrutlar ---------- */
function mount(app, h) {
  const { ANY, wrap, bad, AU } = h, J = (req, res, o) => res.json(o);
  const rate = new Map();
  function limit(uid) { const t = Date.now(), a = (rate.get(uid) || []).filter(x => t - x < 10000); if (a.length >= 15) throw bad('Juda tez yozyapsiz. Biroz kuting.', 429); a.push(t); rate.set(uid, a); }
  const need = (req, id) => { const c = db.get('chat', id); if (!c) throw bad('Chat topilmadi.', 404); if (!c.m || !c.m[req.user.id]) throw bad('Siz bu chat a’zosi emassiz.', 403); return c; };
  const lastOf = c => { const l = last(c.id, 1)[0]; return l ? { text: clip(l.text, 80), t: l.t, uid: l.uid, sys: l.sys || 0 } : null; };

  app.get('/api/chat/list', ANY, wrap((req, res) => {
    const u = req.user, mine = [], dir = [];
    db.all('chat').forEach(c => {
      if (c.m && c.m[u.id]) { const o = metaOf(c, u.id); o.last = lastOf(c); mine.push(o); }
      else if (c.public && c.type !== 'dm') dir.push({ id: c.id, type: c.type, title: c.title, about: c.about || '', cnt: Object.keys(c.m || {}).length, n: c.n || 0 });
    });
    mine.sort((a, b) => b.lastT - a.lastT);
    res.json({ chats: mine, dir: dir.sort((a, b) => b.cnt - a.cnt).slice(0, 50), me: pubU(u.id) });
  }));
  app.get('/api/chat/users', ANY, wrap((req, res) => {
    const u = req.user, q = String(req.query.q || '').trim().toLowerCase().replace(/^@/, ''), out = [];
    const rows = db.db.prepare('SELECT id FROM users WHERE blocked=0').all().map(r => r.id).filter(id => id !== u.id);
    rows.forEach(id => {
      const x = auth.byId(id), p = prof(id), pu = pubU(id), staff = isStaff(x);
      if (!q) { if (staff || isStaff(u)) out.push(pu); return; }
      const exact = id.toLowerCase() === q || p.username === q;
      const vis = staff || isStaff(u) || p.findable || exact; if (!vis) return;
      if (exact || (p.username && p.username.indexOf(q) === 0) || (pu.name || '').toLowerCase().indexOf(q) >= 0 && (staff || isStaff(u)) || (isStaff(u) && x.email.toLowerCase().indexOf(q) >= 0)) out.push(pu);
    });
    res.json({ users: out.slice(0, 20) });
  }));
  app.post('/api/chat/dm', ANY, wrap((req, res) => {
    const u = req.user, to = resolve((req.body || {}).to); if (!to) throw bad('Foydalanuvchi topilmadi.', 404);
    if (to.id === u.id) throw bad('O‘zingizga yozib bo‘lmaydi.');
    if (!canDm(u, to)) throw bad('Bu foydalanuvchi faqat xodimlardan xabar qabul qiladi.', 403);
    const id = dmId(u.id, to.id); let c = db.get('chat', id);
    if (!c) { c = { id, type: 'dm', title: '', owner: u.id, created: Date.now(), n: 0, m: { [u.id]: { r: 'member', read: 0 }, [to.id]: { r: 'member', read: 0 } } }; db.put('chat', c, true); }
    res.json({ ok: true, id });
  }));
  app.post('/api/chat/create', ANY, wrap((req, res) => {
    const u = req.user, b = req.body || {}, type = b.type === 'channel' ? 'channel' : 'group', title = String(b.title || '').trim().slice(0, 60);
    if (title.length < 2) throw bad('Nomi kamida 2 ta belgi bo‘lsin.');
    const mk = (ty, ti, extra) => {
      const id = 'C' + (1000 + db.seq('chat')), c = Object.assign({ id, type: ty, title: ti, about: String(b.about || '').trim().slice(0, 300), owner: u.id, created: Date.now(), n: 0, public: !!b.public, code: code(), m: { [u.id]: { r: 'owner', read: 0 } } }, extra || {});
      db.put('chat', c, true); return c;
    };
    const out = db.tx(() => {
      const c = mk(type, title); let g = null;
      if (type === 'channel' && b.disc) { g = mk('group', title + ' · muhokama', { ch: c.id }); c.disc = g.id; db.put('chat', c, true); }
      const add = (Array.isArray(b.members) ? b.members : []).map(resolve).filter(x => x && x.id !== u.id && !x.blocked && (type === 'channel' || canDm(u, x) || isStaff(u) || prof(x.id).findable)).slice(0, 100);
      add.forEach(x => { c.m[x.id] = { r: 'member', read: 0 }; if (g) g.m[x.id] = { r: 'member', read: 0 }; });
      if (add.length) { db.put('chat', c, true); if (g) db.put('chat', g, true); }
      append(c, u.id, (type === 'channel' ? 'Kanal' : 'Guruh') + ' yaratildi: ' + title, { sys: 1 });
      if (g) append(g, u.id, 'Muhokama guruhi yaratildi', { sys: 1 });
      return { id: c.id, disc: g ? g.id : '' };
    });
    req.ad = out.id + ' ' + type + ' ' + title; res.json(Object.assign({ ok: true }, out));
  }));
  app.get('/api/chat/:id', ANY, wrap((req, res) => {
    const c = need(req, req.params.id), a = +req.query.after || 0;
    const ms = a > 0 ? after(c.id, a, 200) : last(c.id, 60), users = {};
    Object.keys(c.m).slice(0, 300).forEach(id => { users[id] = pubU(id); });
    ms.forEach(m => { if (!users[m.uid]) users[m.uid] = pubU(m.uid); });
    res.json({ chat: metaOf(c, req.user.id), members: Object.keys(c.m).map(id => Object.assign({ r: c.m[id].r }, users[id] || pubU(id))), users, msgs: ms.map(msgPub), n: c.n || 0, tip: c.tip || '' });
  }));
  app.post('/api/chat/:id/send', ANY, wrap((req, res) => {
    const u = req.user, c = need(req, req.params.id), b = req.body || {}, text = String(b.text || '').replace(/\r\n/g, '\n').trim();
    if (!text) throw bad('Xabar bo‘sh.'); if (text.length > 4000) throw bad('Xabar 4000 belgidan oshmasin.');
    if (!canPost(c, u.id)) throw bad(c.type === 'channel' ? 'Kanalga faqat adminlar yozadi.' : 'Yozishga ruxsat yo‘q.', 403);
    if (c.type === 'dm') { const o = Object.keys(c.m).filter(x => x !== u.id)[0], ou = auth.byId(o); if (ou && ou.blocked) throw bad('Foydalanuvchi bloklangan.', 403); if (!isStaff(u) && ou && !isStaff(ou) && prof(o).dm === 'staff') throw bad('Bu foydalanuvchi faqat xodimlardan xabar qabul qiladi.', 403); }
    limit(u.id);
    let reply = +b.reply || 0; if (reply && !getMsg(c.id, reply)) reply = 0;
    const m = db.tx(() => {
      const r = append(c, u.id, text, { reply });
      if (c.type === 'channel' && c.disc && db.get('chat', c.disc)) { const g = append(c.disc, u.id, text, { fwd: { chat: c.id, seq: r.seq } }); const cm = db.get('cmsg', r.id); cm.cm = g.seq; db.put('cmsg', cm, true); }
      if (c.type === 'group' && reply) { const rm = getMsg(c.id, reply); if (rm && rm.fwd) { rm.cc = (rm.cc || 0) + 1; db.put('cmsg', rm, true); const co = getMsg(rm.fwd.chat, rm.fwd.seq); if (co) { co.cc = (co.cc || 0) + 1; db.put('cmsg', co, true); } } }
      return r;
    });
    res.json({ ok: true, msg: msgPub(m) });
  }));
  app.post('/api/chat/:id/read', ANY, wrap((req, res) => {
    const c = need(req, req.params.id), s = Math.min(c.n || 0, Math.max(0, +(req.body || {}).seq || 0)), m = c.m[req.user.id];
    if (s > (m.read || 0)) { m.read = s; db.put('chat', c, true); } res.json({ ok: true });
  }));
  app.post('/api/chat/:id/edit', ANY, wrap((req, res) => {
    const c = need(req, req.params.id), b = req.body || {}; if (!canManage(c, req.user.id)) throw bad('Ruxsat yo‘q.', 403);
    if (b.title != null) { const t = String(b.title).trim().slice(0, 60); if (t.length < 2) throw bad('Nomi kamida 2 ta belgi.'); c.title = t; }
    if (b.about != null) c.about = String(b.about).trim().slice(0, 300);
    if (b.public != null) c.public = !!b.public; if (b.newCode) c.code = code();
    db.put('chat', c, true); res.json({ ok: true });
  }));
  app.post('/api/chat/:id/members', ANY, wrap((req, res) => {
    const u = req.user, c = need(req, req.params.id), b = req.body || {}; if (!canManage(c, u.id)) throw bad('Ruxsat yo‘q.', 403);
    const g = c.disc ? db.get('chat', c.disc) : null, names = [];
    db.tx(() => {
      (Array.isArray(b.add) ? b.add : []).slice(0, 50).forEach(q => { const x = resolve(q); if (!x || x.blocked) throw bad('Topilmadi: ' + q, 404); if (!isStaff(u) && !isStaff(x) && !prof(x.id).findable && !/^U\d+$/i.test(String(q).trim()) && prof(x.id).username !== String(q).replace(/^@/, '').toLowerCase()) throw bad('Topilmadi: ' + q, 404); if (!c.m[x.id]) { c.m[x.id] = { r: 'member', read: c.n || 0 }; if (g && !g.m[x.id]) g.m[x.id] = { r: 'member', read: g.n || 0 }; names.push(pubU(x.id).name); } });
      if (b.remove) { const r = mrole(c, b.remove); if (!r) throw bad('A’zo topilmadi.'); if (r === 'owner') throw bad('Egasini chiqarib bo‘lmaydi.'); if (r === 'admin' && mrole(c, u.id) !== 'owner') throw bad('Adminni faqat ega chiqara oladi.', 403); delete c.m[b.remove]; names.push('− ' + pubU(b.remove).name); }
      if (b.setRole) { const sr = b.setRole, r = mrole(c, sr.uid); if (!r || r === 'owner') throw bad('A’zo topilmadi.'); if (mrole(c, u.id) !== 'owner') throw bad('Rolni faqat ega o‘zgartiradi.', 403); c.m[sr.uid].r = sr.r === 'admin' ? 'admin' : 'member'; names.push(pubU(sr.uid).name + ': ' + c.m[sr.uid].r); }
      db.put('chat', c, true); if (g) db.put('chat', g, true);
      if (names.length) append(c, u.id, 'A’zolar: ' + names.join(', '), { sys: 1 });
    });
    res.json({ ok: true });
  }));
  app.post('/api/chat/join', ANY, wrap((req, res) => {
    const u = req.user, b = req.body || {}; let c = null;
    if (b.code) c = db.all('chat').filter(x => x.code && x.code === String(b.code).trim().toLowerCase() && x.type !== 'dm')[0]; else if (b.id) { c = db.get('chat', String(b.id)); if (c && !(c.public && c.type !== 'dm')) c = null; }
    if (!c) throw bad('Chat topilmadi yoki yopiq.', 404);
    if (!c.m[u.id]) db.tx(() => { c.m[u.id] = { r: 'member', read: c.n || 0 }; db.put('chat', c, true); const g = c.disc ? db.get('chat', c.disc) : null; if (g && !g.m[u.id]) { g.m[u.id] = { r: 'member', read: g.n || 0 }; db.put('chat', g, true); } if (c.type === 'group') append(c, u.id, pubU(u.id).name + ' qo‘shildi', { sys: 1 }); });
    res.json({ ok: true, id: c.id });
  }));
  app.post('/api/chat/:id/leave', ANY, wrap((req, res) => {
    const u = req.user, c = need(req, req.params.id); if (c.type === 'dm') throw bad('Shaxsiy yozishmadan chiqib bo‘lmaydi.'); if (mrole(c, u.id) === 'owner') throw bad('Ega chatdan chiqa olmaydi.');
    db.tx(() => { if (c.type === 'group') append(c, u.id, pubU(u.id).name + ' chiqib ketdi', { sys: 1 }); const cc = db.get('chat', c.id); delete cc.m[u.id]; db.put('chat', cc, true); });
    res.json({ ok: true });
  }));
  app.get('/api/chat/:id/verify', ANY, wrap((req, res) => { const c = need(req, req.params.id); res.json(verify(c.id)); }));
}
module.exports = { mount, append, verify, all, last, genesis, sha, sig, body, pubU, resolve, canDm, dmId, mid };
