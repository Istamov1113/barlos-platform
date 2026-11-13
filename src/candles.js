'use strict';
/* Chart uchun shamlar (OHLCV).
   Manbalar: Binance, zaxirada Bitget (kripto, metall, tokenlashgan aksiyalar), Yahoo Finance / Stooq (xalqaro aksiyalar),
   qolgan hammasi (uzse.uz, veb-sahifa, qo'lda kiritilgan narx) uchun: serverning o'zi har yangilashda yozib borgan narx tarixi. */
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TFS = {
  '1m': { sec: 60, bg: '1min', y: '1m', yr: '7d' }, '5m': { sec: 300, bg: '5min', y: '5m', yr: '60d' }, '15m': { sec: 900, bg: '15min', y: '15m', yr: '60d' },
  '1h': { sec: 3600, bg: '1h', y: '60m', yr: '730d' }, '4h': { sec: 14400, bg: '4h', y: '60m', yr: '730d', agg: 14400 },
  'D': { sec: 86400, bg: '1day', y: '1d', yr: '10y', st: 'd' }, 'W': { sec: 604800, bg: '1week', y: '1wk', yr: '25y', st: 'w' }, 'M': { sec: 2592000, bg: '1M', y: '1mo', yr: '40y', st: 'm' }
};
const net = require('./sources');
const getJson = (url, headers) => net.http(url, { json: true, headers, tries: 2 });
const getFirst = (urls) => net.firstOf(urls, { json: true });
const BG = ['https://api.bitget.com'];
const clean = a => { const m = new Map(); a.forEach(c => { if (c && c.t > 0 && c.o > 0 && c.h > 0 && c.l > 0 && c.c > 0) m.set(c.t, c); }); return [...m.values()].sort((x, y) => x.t - y.t); };

const BNI = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', 'D': '1d', 'W': '1w', 'M': '1M' };
const bgSym = sym => /USDT$/i.test(sym) ? sym.toUpperCase() : sym.toUpperCase() + 'USDT';
/* Binance (asosiy). Juftlik Binancedan topilmasa (400), 6 soat shu juftlikka qayta so'rov yuborilmaydi va Bitget ishlatiladi */
const noBn = new Map();
async function binance(sym, tf, start, lim) {
  const s = bgSym(sym); if (noBn.get(s) > Date.now()) throw new Error('Binancedan "' + s + '" topilmagan (6 soat qayta so‘ralmaydi)');
  const q = '?symbol=' + encodeURIComponent(s) + '&interval=' + BNI[tf] + '&limit=' + (lim || 1000) + (start != null ? '&startTime=' + start : ''), errs = [];
  for (const h of net.BN()) {
    try {
      const j = await getJson(h + '/api/v3/klines' + q);
      if (!Array.isArray(j) || !j.length) throw new Error('Binance "' + s + '" uchun sham bermadi');
      return clean(j.map(r => ({ t: Math.floor(+r[0] / 1000), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] })));
    } catch (e) { if (e.http === 400) { noBn.set(s, Date.now() + 6 * 3600e3); throw new Error('Binancedan "' + s + '" topilmagan'); } errs.push(e.message); }
  }
  throw new Error('Binance: ' + errs.join(' | '));
}
async function bitgetRaw(sym, tf, lim) {
  const T = TFS[tf], s = bgSym(sym);
  const j = await getFirst(BG.map(h => h + '/api/v2/spot/market/candles?symbol=' + encodeURIComponent(s) + '&granularity=' + T.bg + '&limit=' + (lim || 1000)));
  if (!j || !Array.isArray(j.data) || !j.data.length) throw new Error('Bitget "' + s + '" uchun sham bermadi');
  return clean(j.data.map(r => ({ t: Math.floor(+r[0] / 1000), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] })));
}
/* Shamlar: avval Binance, topilmasa/ishlamasa Bitget */
async function bitget(sym, tf, lim) {
  let err; try { return await binance(sym, tf, undefined, lim); } catch (e) { err = e; }
  try { return await bitgetRaw(sym, tf, lim); } catch (e) { throw new Error(err.message + ' | Bitget: ' + e.message); }
}
/* Kunlik tarixni to'liq olish: Binance (startTime bo'yicha sahifalab), topilmasa Bitget history-candles */
async function bitgetFullDaily(sym) {
  const s = bgSym(sym); let all = [], err;
  try {
    let st = 0;
    for (let i = 0; i < 20; i++) { const rows = await binance(sym, 'D', st); all = all.concat(rows); if (rows.length < 900) break; st = rows[rows.length - 1].t * 1000 + 1; }
    all = clean(all); if (all.length) return all;
  } catch (e) { err = e; all = []; }
  try {
    all = await bitgetRaw(sym, 'D'); let end = all.length ? all[0].t * 1000 : Date.now();
    for (let i = 0; i < 40; i++) {
      const j = await getFirst(BG.map(h => h + '/api/v2/spot/market/history-candles?symbol=' + encodeURIComponent(s) + '&granularity=1day&endTime=' + end + '&limit=200')).catch(() => null);
      const rows = j && Array.isArray(j.data) ? clean(j.data.map(r => ({ t: Math.floor(+r[0] / 1000), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }))) : [];
      if (!rows.length || rows[0].t * 1000 >= end) break; all = rows.concat(all); end = rows[0].t * 1000;
    }
    return clean(all);
  } catch (e) { throw new Error((err ? err.message + ' | ' : '') + 'Bitget: ' + e.message); }
}
function aggregate(cs, step) {
  const out = []; let cur = null;
  cs.forEach(c => {
    const b = Math.floor(c.t / step) * step;
    if (!cur || cur.t !== b) { cur = { t: b, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 }; out.push(cur); }
    else { cur.h = Math.max(cur.h, c.h); cur.l = Math.min(cur.l, c.l); cur.c = c.c; cur.v += c.v || 0; }
  });
  return out;
}
async function yahoo(sym, tf, full) {
  const T = TFS[tf], s = String(sym).toUpperCase().replace(/\./g, '-').replace(/^(.+)-(US)$/, '$1');
  const j = await getFirst(['https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s) + '?interval=' + T.y + '&range=' + (full ? 'max' : T.yr) + '&includePrePost=false', 'https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s) + '?interval=' + T.y + '&range=' + (full ? 'max' : T.yr) + '&includePrePost=false']);
  const r = j && j.chart && j.chart.result && j.chart.result[0]; if (!r || !r.timestamp) throw new Error('Yahoo "' + s + '" uchun sham bermadi');
  const q = r.indicators.quote[0];
  let cs = clean(r.timestamp.map((t, i) => ({ t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] || 0 })));
  if (T.agg) cs = aggregate(cs, T.agg);
  return cs;
}
async function stooq(sym, tf) {
  const T = TFS[tf]; if (!T.st) throw new Error('Stooq faqat kunlik/haftalik/oylik');
  const s = String(sym).toLowerCase().replace(/\./g, '-') + (/\.[a-z]{2}$/i.test(sym) ? '' : '.us');
  const rows = (await net.http('https://stooq.com/q/d/l/?s=' + encodeURIComponent(s) + '&i=' + T.st, { tries: 2 })).trim().split(/\r?\n/).slice(1).map(l => l.split(','));
  const cs = clean(rows.map(c => ({ t: Math.floor(Date.parse(c[0] + 'T00:00:00Z') / 1000), o: +c[1], h: +c[2], l: +c[3], c: +c[4], v: +c[5] || 0 })));
  if (!cs.length) throw new Error('Stooq "' + s + '" uchun ma’lumot bermadi'); return cs;
}
/* Server yozib borgan narx tarixidan sham yasash */
function fromHistory(pts, tf) {
  const step = TFS[tf].sec, out = []; let cur = null;
  (pts || []).forEach(p => {
    const t = Math.floor(p[0] / 1000), b = tf === 'M' ? Math.floor(Date.UTC(new Date(t * 1000).getUTCFullYear(), new Date(t * 1000).getUTCMonth(), 1) / 1000) : Math.floor(t / step) * step, v = p[1];
    if (!(v > 0)) return;
    if (!cur || cur.t !== b) { cur = { t: b, o: v, h: v, l: v, c: v, v: 0 }; out.push(cur); } else { cur.h = Math.max(cur.h, v); cur.l = Math.min(cur.l, v); cur.c = v; }
  });
  return out;
}
/* Kunlik shamlardan hafta/oy shamlari */
function rollup(daily, tf) {
  if (tf === 'D') return daily;
  const key = t => { if (tf === 'W') return Math.floor((t / 86400 + 3) / 7) * 7 * 86400 - 3 * 86400; const d = new Date(t * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000; };
  const out = []; let cur = null;
  daily.forEach(c => { const k = key(c.t); if (!cur || cur.t !== k) { cur = { t: k, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 }; out.push(cur); } else { cur.h = Math.max(cur.h, c.h); cur.l = Math.min(cur.l, c.l); cur.c = c.c; cur.v += c.v || 0; } });
  return out;
}
/* Seans yopilish qoidasi (Toshkent vaqti bilan ko'rsatiladi). Bitget: 00:00 UTC = 05:00; uzse.uz: 16:00; AQSh aksiyalari: 16:00 Nyu-York */
function closeRule(a) {
  const c = String(a.close || '').trim(), m = /^(\d{1,2}):(\d{2})(?:\s+(wd|all))?$/i.exec(c);
  if (m) return { tz: 'Asia/Tashkent', h: +m[1], m: +m[2], wd: (m[3] || 'wd').toLowerCase() === 'wd', custom: true };
  const t = a.src && a.src.type;
  if (t === 'uzse' || t === 'web' || a.group === 'milliy' || a.group === 'obligatsiya') return { tz: 'Asia/Tashkent', h: 16, m: 0, wd: true };
  if (t === 'finviz') return { tz: 'America/New_York', h: 16, m: 0, wd: true };
  return { tz: 'UTC', h: 0, m: 0, wd: false };
}
/* Aktivning savdo kuni (seans qoidasi vaqt zonasi bo'yicha sana) -> UTC yarim tun sekundlari */
function dayKeyFor(a, ms) {
  const r = closeRule(a); try { const d = new Intl.DateTimeFormat('en-CA', { timeZone: r.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms); return Date.parse(d + 'T00:00:00Z') / 1000; } catch (e) { return Math.floor(ms / 86400000) * 86400; }
}
/* Aktiv uchun manba tanlash: "csym" (qo'lda: bitget:BTCUSDT | yahoo:GC=F | stooq:aapl.us | history) -> aktivning narx manbasi -> tarix */
function plan(a) {
  const cs = String(a.csym || '').trim();
  if (cs) { const m = cs.match(/^(bitget|yahoo|stooq|history)\s*:?\s*(.*)$/i); if (m) return [[m[1].toLowerCase(), m[2].trim() || a.sym]]; }
  const t = a.src && a.src.type, ref = a.src && a.src.ref, out = [];
  if (t === 'bitget') out.push(['bitget', ref]);
  else if (t === 'finviz') out.push(['yahoo', ref], ['stooq', ref]);
  else if (t === 'cmc') out.push(['bitget', a.sym]);
  else if (!t && (a.group === 'kripto' || a.group === 'metall')) out.push(['bitget', a.sym]);
  else if (!t && a.group === 'xalqaro') out.push(['yahoo', a.sym.replace(/on$/, '')], ['bitget', a.sym.replace(/on$/, '') + 'ON']);
  return out;
}
const NAMEOF = { bitget: 'Binance/Bitget', yahoo: 'Yahoo Finance', stooq: 'Stooq', history: 'BARLOS narx tarixi' };
const cache = new Map(); const clearCache = () => cache.clear();
/* Provayderdan kunlik shamlar (UTC yarim tun bo'yicha tekislangan). full=true: butun tarix */
const dnorm = cs => { const m = new Map(); cs.forEach(c => { const t = Math.floor(c.t / 86400) * 86400; m.set(t, { t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 }); }); return [...m.values()].sort((x, y) => x.t - y.t); };
async function daily(a, full) {
  const warns = [];
  for (const [kind, sym] of plan(a)) {
    if (kind === 'history') break;
    try {
      const cs = kind === 'bitget' ? (full ? await bitgetFullDaily(sym) : await bitget(sym, 'D', 5)) : kind === 'yahoo' ? await yahoo(sym, 'D', full) : await stooq(sym, 'D');
      if (cs.length) return { candles: dnorm(cs), kind, sym };
    } catch (e) { warns.push(NAMEOF[kind] + ': ' + e.message); }
  }
  const e = new Error(warns.join(' | ') || 'Bu aktiv uchun tashqi shamlar manbasi yo‘q'); e.none = !warns.length; throw e;
}
const dstr = t => new Date(t * 1000).toISOString().slice(0, 10);
async function get(a, tf, store) {
  store = store || {}; const hist = store.ph, hc = store.hc || [];
  if (!TFS[tf]) throw new Error('Vaqt oralig‘i noto‘g‘ri');
  const key = a.id + '|' + tf + '|' + (a.csym || '') + '|' + (a.src ? a.src.type + ':' + a.src.ref : '') + '|' + hc.length, hit = cache.get(key);
  if (hit && Date.now() - hit.t < 20000) return hit.v;
  let v;
  if (['D', 'W', 'M'].indexOf(tf) >= 0) {
    /* Kunlik/haftalik/oylik: faqat serverdagi saqlangan tarix (hc). Provayderga so'rov yo'q: tarix aktiv qo'shilganda bir marta olinadi, keyin kuniga bir marta to'ldiriladi. */
    const dl = hc.map(x => ({ t: x.t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v })).sort((x, y) => x.t - y.t), cs = rollup(dl, tf);
    let warn = null;
    if (dl.length < 30 && plan(a).some(p => p[0] !== 'history') && store.need) store.need();
    if (!dl.length) { warn = 'Tarix hali yuklanmagan. ' + (plan(a).some(p => p[0] !== 'history') ? 'Server uni tashqi manbadan olmoqda (Aktivlar sahifasidan holatini ko‘ring), yoki Excel/CSV yuklang.' : 'Aktivlar sahifasida "Excel yuklash" orqali tarixni yuklang; shamlar server narxni yangilab turgan sayin ham to‘planadi.'); if (store.need) store.need(); }
    const srcName = dl.length ? 'BARLOS tarixi (' + dl.length + ' kun)' : NAMEOF.history;
    v = { candles: cs, source: srcName, synthetic: !dl.length, warn, rule: closeRule(a) };
  } else {
    const warns = []; v = null;
    if (store.cc && store.cc.c && store.cc.c.length && Date.now() - store.cc.t < 120000) v = { candles: store.cc.c, source: 'Saqlangan · ' + tf, synthetic: false, rule: closeRule(a) };
    if (!v) for (const [kind, sym] of plan(a)) {
      if (kind === 'history') break;
      try { const cs = kind === 'bitget' ? await bitget(sym, tf) : await yahoo(sym, tf); v = { candles: cs, source: NAMEOF[kind] + ' · ' + sym.toUpperCase(), synthetic: false, rule: closeRule(a), native: cs }; break; }
      catch (e) { warns.push(NAMEOF[kind] + ': ' + e.message); }
    }
    if (!v && store.cc && store.cc.c && store.cc.c.length) v = { candles: store.cc.c, source: 'Saqlangan (oflayn) · ' + tf, synthetic: false, rule: closeRule(a), warn: 'Oflayn rejim: manba javob bermadi, oxirgi saqlangan ' + tf + ' shamlar (' + new Date(store.cc.t).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) + ') ko‘rsatilmoqda. ' + warns.join(' | ').slice(0, 220) };
    if (!v) {
      const cs = fromHistory(hist, tf);
      v = { candles: cs, source: NAMEOF.history, synthetic: true, rule: closeRule(a), warn: hc.length ? 'Bu manba faqat kunlik ma’lumot beradi. ' + tf + ' shamlari serverning o‘z kuzatuvidan to‘planmoqda; kunlik (D) chartni oching.' : (warns.join(' | ') || 'Bu aktivning manbasi tarixiy shamlarni bermaydi: Aktivlar → Tarixiy ma’lumotlar bo‘limidan Excel/CSV yuklang yoki shamlar server narxni yangilab turgan sayin to‘planadi.') };
    }
  }
  cache.set(key, { t: Date.now(), v }); return v;
}
module.exports = { dayKeyFor, daily, get, TFS, fromHistory, aggregate, plan, rollup, closeRule, clearCache };
