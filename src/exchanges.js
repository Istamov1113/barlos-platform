'use strict';
/* BARLOS — birja adapterlari (Avto savdo): Binance, Bitget, IBKR.
   Har bir adapter 4 ish qiladi:  ready() · ping() · place(args) · status(order)
   Kalitlar FAQAT .env faylida saqlanadi (bazada emas):
     BINANCE_API_KEY, BINANCE_API_SECRET
     BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE
     IBKR_URL (standart https://localhost:5000/v1/api), IBKR_ACCOUNT (masalan U1234567)
   Kalitga "Spot savdo" (Trade) ruxsati bering, "Withdraw" (yechish) ruxsatini BERMANG. */
const crypto = require('crypto'), https = require('https'), http = require('http');

const env = (...k) => { for (const n of k) if (process.env[n] && process.env[n].trim()) return process.env[n].trim(); return ''; };
const num = v => { v = +v; return isFinite(v) ? v : 0; };
function fail(m) { const e = new Error(m); e.http = 400; return e; }
const hmac = (alg, key, s, enc) => crypto.createHmac(alg, key).update(s).digest(enc);

/* oddiy HTTP(S) so'rov (IBKR lokal shlyuzi o'z-o'zidan imzolangan sertifikat ishlatadi, shuning uchun fetch emas) */
function request(method, url, o) {
  o = o || {};
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(url); } catch (e) { return reject(fail('Manzil noto‘g‘ri: ' + url)); }
    const lib = u.protocol === 'http:' ? http : https;
    const r = lib.request(u, { method, headers: o.headers || {}, rejectUnauthorized: !o.insecure, timeout: o.timeout || 15000 }, res => {
      let d = ''; res.setEncoding('utf8'); res.on('data', c => { d += c; });
      res.on('end', () => { let j = null; try { j = d ? JSON.parse(d) : null; } catch (e) { /* JSON emas */ } resolve({ s: res.statusCode, j, raw: d }); });
    });
    r.on('timeout', () => r.destroy(new Error('Vaqt tugadi'))); r.on('error', e => reject(fail('Tarmoq xatosi (' + u.host + '): ' + (e.code || e.message))));
    if (o.body) r.write(o.body); r.end();
  });
}
const floorTo = (v, step) => { step = num(step); if (!(step > 0)) return v; const k = Math.floor(v / step + 1e-9); return +(k * step).toFixed(12); };
const decs = s => { s = String(s); const i = s.indexOf('.'); if (i < 0) return 0; return s.slice(i + 1).replace(/0+$/, '').length; };
const fmt = (v, d) => String(+(+v).toFixed(Math.max(0, Math.min(12, d))));
const cache = {};

/* ================= Binance (Spot) ================= */
const binance = {
  id: 'Binance', need: 'BINANCE_API_KEY, BINANCE_API_SECRET',
  ready() { return !!(env('BINANCE_API_KEY') && env('BINANCE_API_SECRET')); },
  async call(method, path, params, signed) {
    const k = env('BINANCE_API_KEY'), s = env('BINANCE_API_SECRET'), host = env('BINANCE_TRADE_HOST') || 'https://api.binance.com';
    const p = Object.assign({}, params || {}); if (signed) { p.timestamp = Date.now(); p.recvWindow = 10000; }
    let q = Object.keys(p).filter(a => p[a] != null).map(a => a + '=' + encodeURIComponent(p[a])).join('&');
    if (signed) q += '&signature=' + hmac('sha256', s, q, 'hex');
    const r = await request(method, host + path + (q ? '?' + q : ''), { headers: { 'X-MBX-APIKEY': k } });
    if (r.s !== 200) throw fail('Binance: ' + ((r.j && r.j.msg) || ('HTTP ' + r.s)));
    return r.j;
  },
  async filters(sym) {
    const ck = 'bn' + sym; if (cache[ck]) return cache[ck];
    const j = await this.call('GET', '/api/v3/exchangeInfo', { symbol: sym }), si = j && j.symbols && j.symbols[0]; if (!si) throw fail('Binance: ' + sym + ' juftligi topilmadi.');
    const f = {}; (si.filters || []).forEach(x => { f[x.filterType] = x; });
    return (cache[ck] = { step: f.LOT_SIZE ? f.LOT_SIZE.stepSize : '0', minQty: f.LOT_SIZE ? num(f.LOT_SIZE.minQty) : 0, tick: f.PRICE_FILTER ? f.PRICE_FILTER.tickSize : '0', minNotional: num((f.NOTIONAL || f.MIN_NOTIONAL || {}).minNotional) });
  },
  async ping() { await this.call('GET', '/api/v3/account', {}, true); return 'Binance ulangan (hisob o‘qildi).'; },
  async place(a) {
    const f = await this.filters(a.pair), qty = floorTo(a.qty, f.step), price = a.ot === 'MARKET' ? 0 : floorTo(a.price, f.tick);
    if (!(qty > 0) || qty < f.minQty) throw fail('Binance: miqdor juda kichik (minimal ' + f.minQty + ').');
    if (f.minNotional && qty * (price || a.price) < f.minNotional) throw fail('Binance: order summasi minimal ' + f.minNotional + ' dan kam.');
    const p = { symbol: a.pair, side: a.side, type: a.ot === 'MARKET' ? 'MARKET' : 'LIMIT', quantity: fmt(qty, decs(f.step)), newClientOrderId: a.cid, newOrderRespType: 'RESULT' };
    if (a.ot !== 'MARKET') { p.timeInForce = 'GTC'; p.price = fmt(price, decs(f.tick)); }
    const j = await this.call('POST', '/api/v3/order', p, true);
    return { xid: String(j.orderId), qty, price: price || a.price };
  },
  async status(o) {
    const j = await this.call('GET', '/api/v3/order', { symbol: o.xpair, origClientOrderId: o.id }, true), filled = num(j.executedQty), quote = num(j.cummulativeQuoteQty);
    const st = { NEW: 'open', PARTIALLY_FILLED: 'partial', FILLED: 'filled', CANCELED: 'canceled', EXPIRED: 'canceled', EXPIRED_IN_MATCH: 'canceled', REJECTED: 'rejected', PENDING_CANCEL: 'open' }[j.status] || 'open';
    const out = { state: st, filled, avg: filled > 0 ? quote / filled : 0 };
    if (filled > 0 && (st === 'filled' || st === 'canceled')) {
      try { const tr = await this.call('GET', '/api/v3/myTrades', { symbol: o.xpair, orderId: j.orderId }, true), by = {}; (tr || []).forEach(t => { by[t.commissionAsset] = (by[t.commissionAsset] || 0) + num(t.commission); });
        const k = Object.keys(by); if (k.length === 1) { out.fee = by[k[0]]; out.feeAsset = k[0]; } } catch (e) { /* komissiya olinmasa, hisoblangan komissiya ishlatiladi */ }
    }
    return out;
  },
  async cancel(o) { await this.call('DELETE', '/api/v3/order', { symbol: o.xpair, origClientOrderId: o.id }, true); }
};

/* ================= Bitget (Spot, v2) ================= */
const bitget = {
  id: 'Bitget', need: 'BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE',
  ready() { return !!(env('BITGET_API_KEY') && env('BITGET_API_SECRET') && env('BITGET_API_PASSPHRASE')); },
  async call(method, path, params, body) {
    const ts = String(Date.now()), q = params ? Object.keys(params).map(a => a + '=' + encodeURIComponent(params[a])).join('&') : '', rp = path + (q ? '?' + q : ''), b = body ? JSON.stringify(body) : '';
    const r = await request(method, (env('BITGET_HOST') || 'https://api.bitget.com') + rp, { body: b || undefined, headers: { 'ACCESS-KEY': env('BITGET_API_KEY'), 'ACCESS-SIGN': hmac('sha256', env('BITGET_API_SECRET'), ts + method + rp + b, 'base64'), 'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': env('BITGET_API_PASSPHRASE'), 'Content-Type': 'application/json', locale: 'en-US' } });
    if (r.s !== 200 || !r.j || r.j.code !== '00000') throw fail('Bitget: ' + ((r.j && r.j.msg) || ('HTTP ' + r.s)));
    return r.j.data;
  },
  async prec(sym) {
    const ck = 'bg' + sym; if (cache[ck]) return cache[ck];
    const j = await this.call('GET', '/api/v2/spot/public/symbols', { symbol: sym }), s = j && j[0]; if (!s) throw fail('Bitget: ' + sym + ' juftligi topilmadi.');
    return (cache[ck] = { qd: num(s.quantityPrecision), pd: num(s.pricePrecision), minUsdt: num(s.minTradeUSDT) });
  },
  async ping() { await this.call('GET', '/api/v2/spot/account/assets', {}); return 'Bitget ulangan (hisob o‘qildi).'; },
  async place(a) {
    const p = await this.prec(a.pair), qty = floorTo(a.qty, Math.pow(10, -p.qd)), price = a.ot === 'MARKET' ? 0 : floorTo(a.price, Math.pow(10, -p.pd));
    if (!(qty > 0)) throw fail('Bitget: miqdor juda kichik.');
    if (p.minUsdt && qty * a.price < p.minUsdt) throw fail('Bitget: order summasi minimal ' + p.minUsdt + ' USDT dan kam.');
    const b = { symbol: a.pair, side: a.side.toLowerCase(), orderType: a.ot === 'MARKET' ? 'market' : 'limit', force: 'gtc', size: fmt(a.ot === 'MARKET' && a.side === 'BUY' ? qty * a.price : qty, a.ot === 'MARKET' && a.side === 'BUY' ? 6 : p.qd), clientOid: a.cid };
    if (a.ot !== 'MARKET') b.price = fmt(price, p.pd);
    const j = await this.call('POST', '/api/v2/spot/trade/place-order', null, b);
    return { xid: String(j.orderId), qty, price: price || a.price };
  },
  async status(o) {
    const j = await this.call('GET', '/api/v2/spot/trade/orderInfo', { orderId: o.xid }), d = Array.isArray(j) ? j[0] : j; if (!d) throw fail('Bitget: order topilmadi (' + o.xid + ').');
    const filled = num(d.baseVolume), avg = num(d.priceAvg) || (filled > 0 ? num(d.quoteVolume) / filled : 0);
    const st = { live: 'open', new: 'open', partially_filled: 'partial', filled: 'filled', cancelled: 'canceled', canceled: 'canceled' }[String(d.status).toLowerCase()] || 'open';
    const out = { state: st, filled, avg };
    if (filled > 0 && (st === 'filled' || st === 'canceled')) {
      try { const fl = await this.call('GET', '/api/v2/spot/trade/fills', { orderId: o.xid }), by = {}; (fl || []).forEach(t => { const fd = typeof t.feeDetail === 'string' ? JSON.parse(t.feeDetail || '{}') : (t.feeDetail || {}); const c = fd.feeCoin || t.feeCoin; if (c) by[c] = (by[c] || 0) + Math.abs(num(fd.totalFee != null ? fd.totalFee : t.fee)); });
        const k = Object.keys(by); if (k.length === 1) { out.fee = by[k[0]]; out.feeAsset = k[0]; } } catch (e) { /* komissiya olinmasa, hisoblangan komissiya ishlatiladi */ }
    }
    return out;
  },
  async cancel(o) { await this.call('POST', '/api/v2/spot/trade/cancel-order', null, { symbol: o.xpair, orderId: o.xid }); }
};

/* ================= IBKR (Client Portal Web API, lokal shlyuz) =================
   Shlyuz (Client Portal Gateway) kompyuteringizda ishlab, brauzerda tizimga kirilgan bo'lishi shart. */
const ibkr = {
  id: 'IBKR', need: 'IBKR_ACCOUNT (va kerak bo‘lsa IBKR_URL)',
  ready() { return !!env('IBKR_ACCOUNT'); },
  base() { return (env('IBKR_URL') || 'https://localhost:5000/v1/api').replace(/\/$/, ''); },
  async call(method, path, body) {
    const base = this.base(), insecure = env('IBKR_INSECURE') === '1' || /\/\/(localhost|127\.0\.0\.1)/.test(base);
    const r = await request(method, base + path, { insecure, body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json', 'User-Agent': 'barlos' } });
    if (r.s === 401) throw fail('IBKR: shlyuzda tizimga kirilmagan (https://localhost:5000 da kiring).');
    if (r.s >= 400) throw fail('IBKR: ' + ((r.j && (r.j.error || r.j.message)) || ('HTTP ' + r.s)));
    return r.j;
  },
  async ping() { const j = await this.call('GET', '/iserver/auth/status'); if (!(j && j.authenticated)) throw fail('IBKR: shlyuz ulangan, lekin tizimga kirilmagan.'); await this.call('GET', '/iserver/accounts'); return 'IBKR ulangan (shlyuz sessiyasi faol).'; },
  async conid(sym) {
    try { const m = JSON.parse(env('IBKR_CONIDS') || '{}'); if (m[sym]) return +m[sym]; } catch (e) { /* noto'g'ri JSON */ }
    const ck = 'ib' + sym; if (cache[ck]) return cache[ck];
    await this.call('GET', '/iserver/accounts');
    const j = await this.call('GET', '/iserver/secdef/search?symbol=' + encodeURIComponent(sym) + '&name=false&secType=STK'), r = (j || []).filter(x => (x.sections || []).some(s => s.secType === 'STK'))[0] || (j || [])[0];
    if (!r || !r.conid) throw fail('IBKR: ' + sym + ' topilmadi (IBKR_CONIDS ga qo‘lda yozing).');
    return (cache[ck] = +r.conid);
  },
  async place(a) {
    const conid = await this.conid(a.sym), acct = env('IBKR_ACCOUNT');
    const ord = { acctId: acct, conid, cOID: a.cid, orderType: a.ot === 'MARKET' ? 'MKT' : 'LMT', side: a.side, quantity: a.qty, tif: 'GTC', outsideRTH: false }; if (a.ot !== 'MARKET') ord.price = +(+a.price).toFixed(4);
    let j = await this.call('POST', '/iserver/account/' + acct + '/orders', { orders: [ord] });
    for (let i = 0; i < 4 && Array.isArray(j) && j[0] && j[0].id && !j[0].order_id; i++) j = await this.call('POST', '/iserver/reply/' + j[0].id, { confirmed: true });
    const r = Array.isArray(j) ? j[0] : j; if (!r || !r.order_id) throw fail('IBKR: order qabul qilinmadi: ' + JSON.stringify(j).slice(0, 160));
    return { xid: String(r.order_id), qty: a.qty, price: a.price, xconid: conid };
  },
  async status(o) {
    const j = await this.call('GET', '/iserver/account/orders?force=true'), l = (j && j.orders) || [];
    const d = l.filter(x => String(x.orderId) === String(o.xid) || x.order_ref === o.id)[0]; if (!d) throw fail('IBKR: order ro‘yxatda topilmadi (' + o.xid + ').');
    const filled = num(d.filledQuantity), s = String(d.status || '').toLowerCase();
    const st = s === 'filled' ? 'filled' : /cancel/.test(s) ? 'canceled' : /inactive|reject/.test(s) ? 'rejected' : filled > 0 ? 'partial' : 'open';
    return { state: st, filled, avg: num(d.avgPrice) };
  },
  async cancel(o) { await this.call('DELETE', '/iserver/account/' + env('IBKR_ACCOUNT') + '/order/' + o.xid); }
};

/* ================= Sinov birjasi (faqat testlar uchun: EXCH_MOCK=1) =================
   1-tekshiruvda 50% bajariladi (qisman), 2-tekshiruvda to'liq. */
const mockState = {};
const mock = {
  id: 'Mock', need: '',
  ready() { return true; }, async ping() { return 'Sinov birjasi'; },
  async place(a) { const id = 'MOCK-' + a.cid; mockState[id] = { n: 0, qty: a.qty, price: a.price }; return { xid: id, qty: a.qty, price: a.price }; },
  async status(o) { const m = mockState[o.xid] || (mockState[o.xid] = { n: 0, qty: o.xqty, price: o.xprice }); m.n++; return m.n === 1 ? { state: 'partial', filled: m.qty / 2, avg: m.price } : { state: 'filled', filled: m.qty, avg: m.price * 1.001, fee: 0.5, feeAsset: 'USDT' }; },
  async cancel() { }
};

const ADAPTERS = { Binance: binance, Bitget: bitget, IBKR: ibkr };
const get = id => id === 'Mock' ? (process.env.EXCH_MOCK === '1' ? mock : null) : ADAPTERS[id] || null;
const info = () => Object.keys(ADAPTERS).concat(process.env.EXCH_MOCK === '1' ? ['Mock'] : []).map(k => { const a = get(k); return { id: k, api: true, ready: a.ready(), need: a.need }; });

module.exports = { get, info, request };
