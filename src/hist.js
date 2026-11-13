'use strict';
/* Kunlik tarixiy shamlar ombori (coll "hc"): Excel/CSV/uzse import + kundalik avtomatik to'ldirish. Hech narsa o'chirilmaydi, faqat sana bo'yicha yangilanadi. */
const db = require('./db');
const TZ_OFF = 5 * 3600; // Toshkent UTC+5
const dayKey = ms => Math.floor((ms / 1000 + TZ_OFF) / 86400) * 86400;
function get(id) { return (db.get('hc', id) || { id, c: [] }).c; }
function upsert(id, candles, prov) {
  const doc = db.get('hc', id) || { id, c: [] }, m = new Map(doc.c.map(x => [x.t, x]));
  let added = 0, changed = 0, del = 0;
  candles.forEach(x => { const o = m.get(x.t); if (!o) added++; else if (o.c !== x.c || o.h !== x.h || o.l !== x.l || o.o !== x.o || o.v !== x.v || !!o.p !== !!prov) changed++; const n = Object.assign({}, x); if (prov) n.p = 1; else delete n.p; m.set(x.t, n); });
  if (!prov && candles.length) { const mx = Math.max.apply(null, candles.map(x => x.t)), have = new Set(candles.map(x => x.t)); m.forEach((v, k) => { if (v.p && k <= mx && !have.has(k)) { m.delete(k); del++; } }); }
  doc.c = [...m.values()].sort((a, b) => a.t - b.t);
  if (added || changed || del || !db.get('hc', id)) { doc.upd = Date.now(); db.put('hc', doc, true); } /* o'zgarish bo'lmasa diskka yozilmaydi (har 5 daqiqalik yangilashda) */
  return { added, changed, total: doc.c.length, first: doc.c[0] && doc.c[0].t, last: doc.c.length ? doc.c[doc.c.length - 1].t : null };
}
/* Joriy narxdan bugungi kunlik shamni yuritib borish (rasmiy Excel kelguncha "vaqtinchalik" belgisi bilan) */
function touch(id, price, ms, wdOnly, key) {
  if (!(price > 0)) return; const t = key || dayKey(ms || Date.now()); if (wdOnly && [0, 6].indexOf(new Date(t * 1000).getUTCDay()) >= 0) return; /* dam olish kunlari sham yaratilmaydi */
  const doc = db.get('hc', id) || { id, c: [] }, last = doc.c[doc.c.length - 1];
  if (last && last.t > t) return;
  if (last && last.t === t) { if (!last.p || (last.c === price && last.h >= price && last.l <= price)) return; last.h = Math.max(last.h, price); last.l = Math.min(last.l, price); last.c = price; }
  else doc.c.push({ t, o: last ? last.c : price, h: Math.max(price, last ? last.c : price), l: Math.min(price, last ? last.c : price), c: price, v: 0, p: 1 });
  doc.upd = Date.now(); db.put('hc', doc, true);
}
function stats() { return db.all('hc').map(d => ({ id: d.id, n: d.c.length, first: d.c[0] && d.c[0].t, last: d.c.length ? d.c[d.c.length - 1].t : null, upd: d.upd })); }
module.exports = { get, upsert, touch, stats, dayKey };
