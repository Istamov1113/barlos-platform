'use strict';
/* Shartnoma bandlari: namunaviy matn (contract-default.json) + admin o'zgartirishlari (bazada).
   Mijoz ro'yxatdan o'tganda yoki (avval o'tgan bo'lsa) qayta kirganda "ko'rsatiladigan" bandlarning joriy versiyasini tasdiqlaydi.
   Tasdiqlash yozuvlari (kim, qachon, qaysi versiya, IP) o'chirilmaydi. */
const crypto = require('crypto');
const db = require('./db');
const D = require('./contract-default.json');
const now = () => Date.now();

function doc() {
  let c = db.get('contract', 'main');
  if (!c) { c = { id: 'main', ver: 1, over: {}, show: D.show.slice(), fp: '', t: now() }; c.fp = fingerprint(c); db.put('contract', c); }
  return c;
}
function textOf(c, id, def) { return c.over && c.over[id] != null ? c.over[id] : def; }
function sections(c) { c = c || doc(); return D.sections.map(s => ({ n: s.n, title: s.title, cl: s.cl.map(x => ({ id: x.id, text: textOf(c, x.id, x.text), def: x.text })) })); }
function shownItems(c) {
  c = c || doc(); const out = [];
  sections(c).forEach(s => s.cl.forEach(x => { if (x.id && c.show.indexOf(x.id) >= 0) out.push({ id: x.id, sec: s.title, text: x.text }); }));
  return out;
}
function fingerprint(c) { return crypto.createHash('sha256').update(JSON.stringify(shownItems(c))).digest('hex'); }
/* mijozga ko'rinadigan ko'rinish */
function pub() { const c = doc(); return { ver: c.ver, title: D.title, items: shownItems(c), full: sections(c).map(s => ({ n: s.n, title: s.title, cl: s.cl.map(x => ({ id: x.id, text: x.text })) })) }; }
function ok(uid) { return !!db.get('consent', uid + ':' + doc().ver); }
function record(uid, req, via) {
  const c = doc(), id = uid + ':' + c.ver; if (db.get('consent', id)) return db.get('consent', id);
  const r = { id, uid, ver: c.ver, t: now(), ip: (req && req.ip) || '', ua: String((req && req.headers && req.headers['user-agent']) || '').slice(0, 200), via: via || 'login', ids: shownItems(c).map(x => x.id), hash: c.fp };
  db.put('consent', r); return r;
}
/* admin: matn va "ko'rsatilsin" belgilarini saqlash; ko'rsatiladigan bandlar o'zgarsa versiya oshadi va hamma qayta tasdiqlaydi */
function save(texts, show) {
  const c = doc(), valid = {}; D.sections.forEach(s => s.cl.forEach(x => { if (x.id) valid[x.id] = x.text; }));
  if (texts && typeof texts === 'object') Object.keys(texts).forEach(id => { if (!(id in valid)) return; const t = String(texts[id] == null ? '' : texts[id]).trim().slice(0, 4000); if (t && t !== valid[id]) c.over[id] = t; else delete c.over[id]; });
  if (Array.isArray(show)) c.show = show.filter(id => id in valid).slice(0, 200);
  const fp = fingerprint(c), changed = fp !== c.fp;
  if (changed) { c.ver += 1; c.fp = fp; c.t = now(); }
  db.put('contract', c); return { ver: c.ver, changed };
}
function adminView() {
  const c = doc(), all = db.all('consent'), cur = all.filter(x => x.ver === c.ver);
  return { ver: c.ver, title: D.title, note: D.note, show: c.show.slice(), sections: sections(c), accepted: cur.length, history: all.length };
}
module.exports = { doc, pub, ok, record, save, adminView, sections, shownItems, D };
