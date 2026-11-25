'use strict';
/* BARLOS — karta orqali onlayn depozit (bank ekvayringi, Humo/Uzcard).
   Mijoz BARLOS saytida summa kiritadi -> bankning to'lov sahifasiga o'tadi -> bank natijani BARLOSga xabar qiladi (callback)
   -> sayt imzoni tekshiradi, summani solishtiradi va mijoz hisobini to'ldiradi.

   DIQQAT: har bir bankning API'si o'ziga xos. Bu fayl — UMUMIY SHABLON (JSON + HMAC-SHA256 imzo). Bank sizga o'z hujjatini
   (API spetsifikatsiya) bergach, FAQAT shu fayldagi `MAP` va 3 ta funksiya (create, parseCallback, status) bankka moslab tugatiladi.
   Qolgan hamma narsa (ariza, 5 bosqich, hisobga tushirish, himoya) tayyor va bankka bog'liq emas.

   .env:
     BANKPAY_NAME=Bank nomi (mijozga ko'rinadi)
     BANKPAY_API=https://...        bankning API manzili
     BANKPAY_MERCHANT=...           savdo nuqtasi (merchant) ID
     BANKPAY_SECRET=...             maxfiy kalit (imzo uchun)
     BANKPAY_MAX=50000000           bitta to'lov uchun yuqori chegara (so'm)
     PUBLIC_URL=https://sizning-domen.uz   (bank mijozni va callbackni shu manzilga qaytaradi) */
const crypto = require('crypto');
const { request } = require('./exchanges');

const env = n => (process.env[n] || '').trim();
const num = v => { v = +v; return isFinite(v) ? v : 0; };
function fail(m) { const e = new Error(m); e.http = 400; return e; }
const sign = (secret, s) => crypto.createHmac('sha256', secret).update(s).digest('hex');
const safeEq = (a, b) => { a = Buffer.from(String(a || '')); b = Buffer.from(String(b || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };

/* bank maydonlari nomlari — bank hujjatiga qarab shu yerda o'zgartiriladi */
const MAP = {
  sigHeader: 'x-signature',                 /* callback imzosi qaysi sarlavhada */
  orderField: 'order_id',                   /* bizning so'rov raqamimiz (D1001) */
  extField: 'id',                           /* bankdagi to'lov raqami */
  statusField: 'status',                    /* holat maydoni */
  amountField: 'amount',                    /* summa: tiyin (1 so'm = 100 tiyin) */
  paid: ['paid', 'success', 'completed'], failed: ['failed', 'declined', 'canceled', 'cancelled', 'expired'], refunded: ['refunded', 'reversed']
};
const stateOf = s => { s = String(s || '').toLowerCase(); return MAP.paid.indexOf(s) >= 0 ? 'paid' : MAP.failed.indexOf(s) >= 0 ? 'failed' : MAP.refunded.indexOf(s) >= 0 ? 'refunded' : 'pending'; };

const generic = {
  mock: false,
  ready() { return !!(env('BANKPAY_API') && env('BANKPAY_MERCHANT') && env('BANKPAY_SECRET')); },
  async call(method, path, body) {
    const raw = body ? JSON.stringify(body) : '';
    const r = await request(method, env('BANKPAY_API').replace(/\/$/, '') + path, { body: raw || undefined, headers: { 'Content-Type': 'application/json', 'X-Merchant': env('BANKPAY_MERCHANT'), 'X-Signature': sign(env('BANKPAY_SECRET'), raw || path) } });
    if (r.s >= 400 || !r.j) throw fail('Bank: ' + ((r.j && (r.j.message || r.j.error)) || ('HTTP ' + r.s)));
    return r.j;
  },
  /* to'lov yaratish -> mijoz yo'naltiriladigan sahifa */
  async create(d, urls) {
    const j = await this.call('POST', '/orders', { merchant: env('BANKPAY_MERCHANT'), order_id: d.id, amount: Math.round(d.amount * 100), currency: '860', description: 'BARLOS depozit ' + d.id, return_url: urls.ret, callback_url: urls.cb });
    if (!j.pay_url) throw fail('Bank to‘lov sahifasi manzilini qaytarmadi.');
    return { xid: String(j.id || ''), payUrl: j.pay_url };
  },
  /* callback: imzoni tekshirish va ma'lumotni o'qish */
  parseCallback(rawBody, headers) {
    if (!safeEq(headers[MAP.sigHeader], sign(env('BANKPAY_SECRET'), rawBody))) throw fail('Imzo noto‘g‘ri.');
    let j; try { j = JSON.parse(rawBody); } catch (e) { throw fail('Callback JSON emas.'); }
    return { orderId: String(j[MAP.orderField] || ''), xid: String(j[MAP.extField] || ''), state: stateOf(j[MAP.statusField]), amount: num(j[MAP.amountField]) / 100 };
  },
  /* bankdan holatni so'rash (callbackni ham shu bilan ikki marta tekshiramiz) */
  async status(d) {
    const j = await this.call('GET', '/orders/' + encodeURIComponent(d.xid || d.id));
    return { state: stateOf(j[MAP.statusField]), amount: num(j[MAP.amountField]) / 100 };
  }
};

/* sinov rejimi (faqat PAY_MOCK=1): bank o'rniga o'zimizning sinov sahifa */
const mockDb = {};
const mock = {
  mock: true, ready() { return true; },
  async create(d, urls) { mockDb[d.id] = { state: 'pending', amount: d.amount }; return { xid: 'MOCK-' + d.id, payUrl: '/pay/mock/' + d.id }; },
  parseCallback(rawBody, headers) {
    if (!safeEq(headers[MAP.sigHeader], sign('mock-secret', rawBody))) throw fail('Imzo noto‘g‘ri.');
    const j = JSON.parse(rawBody); return { orderId: j.order_id, xid: j.id, state: stateOf(j.status), amount: num(j.amount) / 100 };
  },
  async status(d) { const m = mockDb[d.id]; return m ? { state: m.state, amount: m.amount } : { state: 'pending', amount: 0 }; },
  set(id, state, amount) { mockDb[id] = { state, amount: amount != null ? amount : (mockDb[id] || {}).amount }; },
  secret: 'mock-secret', sign
};

const get = () => process.env.PAY_MOCK === '1' ? mock : generic;
const info = () => { const a = get(); return { on: a.ready(), name: env('BANKPAY_NAME') || 'Karta (Humo / Uzcard)', max: num(env('BANKPAY_MAX')) || 50e6, mock: a.mock }; };
const publicUrl = req => (env('PUBLIC_URL') || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');

module.exports = { get, info, publicUrl, MAP, sign };
