'use strict';
/* API sinovi: serverni vaqtincha bazada ishga tushirib, asosiy oqimni tekshiradi.  npm test */
const path = require('path'), os = require('os'), fs = require('fs');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'barlos-test-'));
process.env.ADMIN_PASSWORD = 'AdminParol123'; process.env.ADMIN_EMAIL = 'eldoristamov381@gmail.com';
const { app } = require('../server.js'); const auth = require('../src/auth');
if (!auth.find(process.env.ADMIN_EMAIL)) auth.createUser({ email: process.env.ADMIN_EMAIL, name: 'Administrator', password: process.env.ADMIN_PASSWORD, verified: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('XATO:', m); } };
const srv = app.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  function mk() { let ck = ''; const f = async (m, u, b, h) => { const r = await fetch(base + u, { method: m, headers: Object.assign({ 'content-type': 'application/json', cookie: ck }, h || {}), body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; let j = {}; try { j = await r.json(); } catch (e) { } return { s: r.status, j }; }; f.ck = () => ck; return f; }
  const adm = mk(), cl = mk(), cl2 = mk(), cl3 = mk(), cl4 = mk();
  try {
    let r = await adm('POST', '/api/login', { email: 'x@y.uz', password: 'noto‘g‘ri123' }); ok(r.s === 401, 'noto‘g‘ri login');
    r = await adm('POST', '/api/register', { email: process.env.ADMIN_EMAIL, password: 'Parol12345', name: 'X' }); ok(r.s === 400, 'admin emailni qayta ro‘yxatdan o‘tkazib bo‘lmaydi: ' + r.s);
    r = await adm('POST', '/api/login', { email: 'ELDORISTAMOV381@gmail.com', password: process.env.ADMIN_PASSWORD }); ok(r.s === 200, 'admin login');
    r = await adm('GET', '/api/state'); ok(r.j.me.role === 'admin', 'admin roli'); ok(r.j.assets.length === 0, 'aktivlar bo‘sh'); ok(r.j.tx.length === 0, 'tranzaksiyalar bo‘sh');
    r = await cl('POST', '/api/register', { email: 'mijoz@test.uz', password: 'Mijoz12345', name: 'Mijoz Bir', agree: true }); ok(r.s === 200, 'mijoz ro‘yxatdan o‘tdi');
    r = await cl2('POST', '/api/register', { email: 'mijoz2@test.uz', password: 'Mijoz12345', name: 'Mijoz Ikki', agree: true }); 
    r = await cl2('GET', '/api/state'); ok(r.s === 200, 'mijoz2 kirdi');
    r = await cl('GET', '/api/state'); ok(r.j.me.role === 'client' && r.j.accounts.length === 1, 'mijoz hisobi avtomatik'); const acc1 = r.j.accounts[0].id;
    r = await cl('POST', '/api/assets', { sym: 'X', group: 'kripto', curr: 'USD' }); ok(r.s === 403, 'mijoz aktiv qo‘sha olmaydi');
    r = await adm('POST', '/api/settings', { fx: { USD: 12000 }, fxAuto: false }); ok(r.s === 200, 'kurs');
    r = await adm('POST', '/api/assets', { sym: 'UZS', name: 'So‘m', group: 'naqd', curr: 'UZS', price: 1 }); ok(r.s === 200, 'UZS aktiv');
    r = await adm('POST', '/api/assets', { sym: 'BTC', name: 'Bitcoin', group: 'kripto', curr: 'USD', price: 80000, target: 10, src: { type: 'bitget', ref: 'BTCUSDT' } }); ok(r.s === 200, 'BTC aktiv');
    r = await adm('POST', '/api/assets', { sym: 'UZNF', name: 'UZNF', group: 'milliy', curr: 'UZS', price: 6600, target: 5 }); ok(r.s === 200, 'UZNF aktiv');
    let st = await adm('GET', '/api/state'); const A = {}; st.j.assets.forEach(a => A[a.sym] = a.id);
    r = await adm('POST', '/api/assets', { sym: 'USDT', name: 'Tether', group: 'naqd', curr: 'USD', price: 1 }); ok(r.s === 200, 'USDT aktiv');
    st = await adm('GET', '/api/state'); st.j.assets.forEach(a => A[a.sym] = a.id);
    r = await adm('POST', '/api/tx', { acc: acc1, aid: A.UZS, type: 'DEPOZIT', amount: 10000000, price: 1 }); ok(r.s === 200, 'depozit: ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/tx', { acc: acc1, aid: A.BTC, type: 'BUY', amount: 0.001, price: 80000 }); ok(r.s === 400 && /USDT/.test(r.j.error), 'BUY: USDT yo‘q, UZS ga tegmaydi: ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/transfers/preview', { from: A.UZS, to: A.USDT, total: 6000000, unit: 'from', accs: [acc1], rate: 12000 }); ok(r.s === 200 && Math.abs(r.j.rows[0].to - 500) < 1e-6, 'o‘tkazma preview: ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/transfers', { from: A.UZS, to: A.USDT, total: 6000000, unit: 'from', accs: [acc1], rate: 12000 }); ok(r.s === 200, 'o‘tkazma: ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/tx', { acc: acc1, aid: A.BTC, type: 'BUY', amount: 0.005, price: 80000 }); ok(r.s === 200, 'BUY USDT dan: ' + JSON.stringify(r.j)); const buyId = r.j.id;
    r = await adm('POST', '/api/tx', { acc: acc1, aid: A.BTC, type: 'SELL', amount: 5, price: 80000 }); ok(r.s === 400, 'ortiqcha SELL rad');
    r = await adm('POST', '/api/tx', { acc: acc1, aid: A.BTC, type: 'BUY', amount: 100, price: 80000 }); ok(r.s === 400, 'USDT yetmaydi');
    st = await cl('GET', '/api/state'); ok(st.j.tx.length === 3, 'mijoz o‘z tranzaksiyalarini ko‘radi: ' + st.j.tx.length); ok(!st.j.users && !st.j.signals && !st.j.audit, 'mijozga admin ma’lumoti berilmaydi');
    const st2 = await cl2('GET', '/api/state'); ok(st2.j.tx.length === 0 && st2.j.accounts.length === 1, 'boshqa mijoz ko‘rmaydi');
    const Core = require('../public/core.js'); let S = { fx: { USD: 12000 }, assets: st.j.assets, accounts: st.j.accounts, tx: st.j.tx }, V = Core.view(S, S.accounts[0]);
    const q = sym => (V.items.filter(i => i.x.sym === sym)[0] || { qty: 0 }).qty;
    ok(Math.abs(q('UZS') - 4000000) < 1e-6, 'UZS: faqat o‘tkazma ayirdi: ' + q('UZS')); ok(Math.abs(q('USDT') - 100) < 1e-6, 'USDT: ' + q('USDT')); ok(Math.abs(q('BTC') - 0.005 * 0.999) < 1e-9, 'BTC miqdori'); 
    ok(Math.abs(V.T - (4000000 + 100 * 12000 + 0.004995 * 80000 * 12000)) < 1, 'jami qiymat: ' + V.T);
    /* tahrirlash va bekor qilish */
    r = await cl('POST', '/api/tx/' + buyId + '/edit', { price: 79000, reason: 'x yy' }); ok(r.s === 403, 'mijoz tahrirlay olmaydi');
    r = await adm('POST', '/api/tx/' + buyId + '/edit', { price: 79000 }); ok(r.s === 400, 'sababsiz tahrir rad');
    r = await adm('POST', '/api/tx/' + buyId + '/edit', { price: 79000, reason: 'narx xatosi' }); ok(r.s === 200, 'tahrir: ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/tx/' + buyId + '/edit', { amount: 1000, reason: 'katta' }); ok(r.s === 400, 'USDT yetmay qolsa tahrir rad');
    r = await adm('POST', '/api/tx/' + buyId + '/void', { reason: 'xato kiritilgan' }); ok(r.s === 200, 'void');
    st = await cl('GET', '/api/state'); ok(st.j.tx.every(t => t.status === 'Bajarildi') && st.j.tx.length === 2, 'mijozda bekor qilinganlar ko‘rinmaydi');
    st = await adm('GET', '/api/state'); ok(st.j.tx.some(t => t.status !== 'Bajarildi') && st.j.tx.filter(t => t.id === buyId)[0].edits.length === 1, 'admin bekor va tahrir tarixini ko‘radi');
    r = await adm('POST', '/api/tx', { acc: acc1, aid: A.BTC, type: 'BUY', amount: 0.005, price: 80000 }); ok(r.s === 200, 'qayta BUY');
    /* signal -> order */
    r = await adm('POST', '/api/signals', { aid: A.BTC, side: 'SELL', price: 80000 }); ok(r.s === 200, 'signal: ' + JSON.stringify(r.j));
    st = await adm('GET', '/api/state'); ok(st.j.orders.length === 1 && st.j.signals.length === 1, 'order yaratildi'); const ord = st.j.orders[0]; ok(ord.status === 'Kutilmoqda', 'order kutilmoqda: ' + ord.status);
    r = await adm('POST', '/api/orders/' + ord.id + '/send', {}); ok(r.s === 200 && r.j.result === 'ok', 'order yuborildi: ' + JSON.stringify(r.j));
    st = await adm('GET', '/api/state'); ok(st.j.orders[0].status === 'Bajarilgan', 'order bajarildi'); const blk = st.j.tx.filter(t => t.blk === st.j.orders[0].blk); ok(blk.length >= 1, 'umumiy bitim yozuvlari');
    /* havola shabloni: STK/BND avtomatik, {type}; Bitget zaxira manba; 429 */
    { const T = 'https://uzse.uz/isu_infos/STK/export?isu_cd={isin}&from={from}&to={to}&k={type}', f = (g, ref) => require('../server.js').fillTpl(T, { group: g, sym: 'X', src: { type: 'uzse', ref } }, new Date(Date.UTC(2026, 0, 5)), new Date(Date.UTC(2026, 10, 4)));
      ok(/isu_infos\/STK\/export\?isu_cd=UZ7037560008&from=05.01.2026&to=04.11.2026&k=STK$/.test(f('milliy', 'UZ7037560008')), 'aksiya havolasi: ' + f('milliy', 'UZ7037560008'));
      ok(/isu_infos\/BND\/export.*k=BND$/.test(f('obligatsiya', 'UZ6058977AD2')), 'obligatsiya havolasi: ' + f('obligatsiya', 'UZ6058977AD2')); }
    { const src = require('../src/sources'), of = global.fetch; let calls = [];
      global.fetch = async (u) => { calls.push(String(u)); if (/bitget/.test(u)) { const e = new TypeError('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; } if (/binance\.com\/api\/v3\/ticker/.test(u)) return { ok: true, status: 200, headers: { get: () => null }, json: async () => [{ symbol: 'BTCUSDT', price: '81000.5' }] }; throw new TypeError('fetch failed'); };
      const o = await src.refreshAll([{ id: 'x1', src: { type: 'bitget', ref: 'BTCUSDT' } }, { id: 'x2', src: { type: 'bitget', ref: 'RMSFTUSDT' } }]);
      ok(o.x1 && o.x1.price === 81000.5, 'Bitget ishlamasa zaxira manba: ' + JSON.stringify(o.x1)); ok(o.x2.error && /ENOTFOUND/.test(o.x2.error), 'xato sababi ko‘rinadi: ' + (o.x2.error || '').slice(0, 160));
      global.fetch = async () => ({ ok: false, status: 429, headers: { get: () => '1' } }); let em = ''; try { await src.http('https://uzse.uz/x', { tries: 1 }); } catch (e) { em = e.message; } ok(/429/.test(em), '429 aniqlanadi');
      global.fetch = of; }
    /* TradingView webhook olib tashlangan; qo'lda signal ishlaydi */
    r = await adm('POST', '/api/webhook/tradingview', { ticker: 'BTCUSDT', action: 'buy', price: 81000 }); ok(r.s === 404 || r.s === 401 || r.s === 415, 'webhook endi yo‘q: ' + r.s);
    const btc = st.j.assets.filter(x => x.sym === 'BTC')[0]; r = await adm('POST', '/api/signals', { aid: btc.id, side: 'BUY', price: 81000 }); ok(r.s === 200 && r.j.order, 'qo‘lda signal: ' + JSON.stringify(r.j));
    /* provayderdan to'liq kunlik tarix -> hc, oflayn rejimda ham chart */
    require('../src/sources').resetNet();
    { const of = global.fetch, day = 86400000, t0 = Math.floor(Date.now() / day) * day - 40 * day, rows = []; for (let i = 0; i < 40; i++) rows.push([String(t0 + i * day), '100', '110', '90', String(100 + i), '5']);
      const pass = fn => (u, o) => /127\.0\.0\.1|localhost/.test(String(u)) ? of(u, o) : fn(u, o);
      global.fetch = pass(async (u) => { if (/history-candles/.test(u)) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: [] }) }; if (/bitget/.test(u) && /candles/.test(u)) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: rows }) }; throw new TypeError('fetch failed'); });
      const x = await adm('POST', '/api/assets', { sym: 'TSTB', name: 'Test Bitget', group: 'kripto', curr: 'USD', price: '', target: 0, src: { type: 'bitget', ref: 'TSTBUSDT' } }); ok(x.s === 200, 'bitget aktiv qo‘shildi: ' + JSON.stringify(x.j));
      const srv2 = require('../server.js'), res = await srv2.syncAllHist(x.j.id, true); ok(res.TSTB && !res.TSTB.error && res.TSTB.total >= 35, 'to‘liq tarix hc ga yozildi: ' + JSON.stringify(res.TSTB));
      let st2 = await adm('GET', '/api/state'), ta = st2.j.assets.filter(q => q.sym === 'TSTB')[0]; ok(ta.price > 100 && ta.priceFrom === 'tarix', 'narx tarixdan olindi (oflayn): ' + ta.price);
      global.fetch = pass(async () => { throw new TypeError('fetch failed'); });
      const cr = await adm('GET', '/api/candles?aid=' + x.j.id + '&tf=D'); ok(cr.s === 200 && cr.j.candles.length >= 35 && !cr.j.warn, 'internetsiz chart saqlangan tarixdan (tashqi so‘rovsiz): ' + (cr.j.candles || []).length + ' ' + (cr.j.warn || '').slice(0, 60));
      global.fetch = of; require('../src/sources').resetNet(); }
    /* void */
    const t0 = st.j.tx[0]; r = await adm('POST', '/api/tx/' + t0.id + '/void', { reason: 'x' }); ok(r.s === 400, 'sababsiz void rad');
    r = await adm('DELETE', '/api/tx/' + t0.id); ok(r.s === 404, 'o‘chirish yo‘li yo‘q');
    /* yechish */
    r = await cl('POST', '/api/wd', { acc: acc1, amount: 100000, mode: 'darhol' }); ok(r.s === 200, 'yechish so‘rovi'); 
    st = await adm('GET', '/api/state'); r = await adm('POST', '/api/wd/' + st.j.wd[0].id, { status: 'Bajarildi' }); ok(r.s === 200, 'yechish bajarildi: ' + JSON.stringify(r.j));
    /* depozit so'rovi */
    r = await adm('POST', '/api/settings', { pay: [{ name: 'Test karta', number: '8600 1234 5678 9012', holder: 'BARLOS', url: 'https://example.com/pay' }] }); ok(r.s === 200, 'to‘lov usuli');
    st = await cl('GET', '/api/state'); const pm = st.j.settings.pay[0]; ok(pm && pm.name === 'Test karta', 'mijoz to‘lov usullarini ko‘radi');
    r = await cl('POST', '/api/dep', { acc: acc1, amount: 500000, method: pm.id }); ok(r.s === 200, 'depozit so‘rovi'); const depId = r.j.id;
    r = await cl('POST', '/api/dep/' + depId + '/paid', { ref: 'chek 123' }); ok(r.s === 200, 'to‘lov qildim');
    r = await cl('POST', '/api/dep/' + depId, { status: 'Bajarildi' }); ok(r.s === 403, 'mijoz o‘zi tasdiqlay olmaydi');
    const uz0 = (await cl('GET', '/api/state')).j.tx.length;
    r = await adm('POST', '/api/dep/' + depId, { status: 'Bajarildi' }); ok(r.s === 200, 'admin tasdiqladi: ' + JSON.stringify(r.j));
    st = await cl('GET', '/api/state'); ok(st.j.tx.length === uz0 + 1 && st.j.dep[0].status === 'Bajarildi', 'depozit hisobda ko‘rindi');
    r = await adm('POST', '/api/dep/' + depId, { status: 'Bajarildi' }); ok(r.s === 400, 'ikki marta tasdiqlab bo‘lmaydi');

    /* komissiyali ichki o'tkazma */
    const IND = require('../public/indicators.js');
    st = await cl2('GET', '/api/state'); const acc2 = st.j.accounts[0].id;
    r = await adm('POST', '/api/tx', { acc: acc2, aid: A.UZS, type: 'DEPOZIT', amount: 5000000, price: 1 }); ok(r.s === 200, 'depozit acc2');
    r = await adm('POST', '/api/transfers/preview', { from: A.UZS, to: A.USDT, total: 1000000, accs: [acc2], rate: 12000, feePct: 1, feeMode: 'incl' }); ok(r.s === 200 && Math.abs(r.j.rows[0].fee - 10000) < 1e-6 && Math.abs(r.j.rows[0].to - 82.5) < 1e-6, 'komissiya summa ichidan: ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/transfers', { from: A.UZS, to: A.USDT, total: 1000000, accs: [acc2], rate: 12000, feePct: 1, feeMode: 'incl' }); ok(r.s === 200, 'o‘tkazma (ichidan)');
    r = await adm('POST', '/api/transfers', { from: A.UZS, to: A.USDT, total: 1000000, accs: [acc2], rate: 12000, feeFix: 5000, feeMode: 'extra' }); ok(r.s === 200, 'o‘tkazma (qo‘shimcha): ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/transfers', { from: A.UZS, to: A.USDT, total: 2995000, accs: [acc2], rate: 12000, feePct: 5, feeMode: 'extra' }); ok(r.s === 400, 'komissiya bilan yetmasa rad etiladi');
    st = await adm('GET', '/api/state'); const a2 = st.j.accounts.filter(a => a.id === acc2)[0], v2 = Core.view({ fx: st.j.settings.fx, assets: st.j.assets, accounts: st.j.accounts, tx: st.j.tx }, a2), qq = id => (v2.items.filter(i => i.x.id === id)[0] || { qty: 0 }).qty;
    ok(Math.abs(qq(A.UZS) - 2995000) < 1e-6, 'UZS qoldig‘i komissiya bilan: ' + qq(A.UZS)); ok(Math.abs(qq(A.USDT) - (82.5 + 1000000 / 12000)) < 1e-6, 'USDT qoldig‘i: ' + qq(A.USDT));
    /* mijoz portfelida faqat mavjud aktivlar (maqsadi bor, lekin qoldig'i yo'q aktiv view da bor, UI esa uni filtrlaydi) */
    /* indikatorlar */
    ok(IND.sma([1, 2, 3, 4, 5], 3)[4] === 4 && IND.rsi(Array.from({ length: 30 }, (_, i) => i + 1), 14)[29] === 100, 'SMA/RSI');
    ok(Math.abs(IND.ema([1, 2, 3], 3)[2] - 2.25) < 1e-9, 'EMA'); ok(IND.algobb(Array.from({ length: 80 }, (_, i) => 100 + 8 * Math.sin(i / 5))).signals.length > 0, 'algobb signallari');
    /* chart sozlamalari va chizmalar */
    r = await cl2('POST', '/api/chart', { pref: { ind: [{ id: 'a', k: 'ema', on: true, p: { len: 21, color: '#ff0000' } }, { id: 'b', k: 'algobb', on: true, p: {} }], tf: '4h', theme: 'light' }, aid: A.BTC, draw: [{ id: 'd1', k: 'trend', pts: [{ t: 1, p: 2 }, { t: 3, p: 4 }], c: '#2962ff' }, { id: 'bad', k: 'trend', pts: [{ t: 1 }] }] }); ok(r.s === 200, 'chart saqlash');
    r = await cl2('GET', '/api/chart?aid=' + A.BTC); ok(r.j.pref.tf === '4h' && r.j.pref.ind.length === 1 && r.j.pref.ind[0].p.len === 21, 'mijoz algobb ni saqlay olmaydi, EMA saqlanadi'); ok(r.j.draw.length === 1, 'noto‘g‘ri chizma tashlandi');
    r = await cl('GET', '/api/chart?aid=' + A.BTC); ok(r.j.draw.length === 0 && !r.j.pref, 'chartlar foydalanuvchiga xos');
    r = await adm('POST', '/api/chart', { pref: { ind: [{ id: 'b', k: 'algobb', on: true, p: {} }], tf: 'D' } }); r = await adm('GET', '/api/chart'); ok(r.j.pref.ind[0].k === 'algobb', 'admin algobb ni saqlaydi');
    r = await adm('POST', '/api/chart', { pref: { ind: [], tf: 'D', cs: { type: 'area', tz: 'tash', bg: 'javascript:1', cu: '#112233', sc: { mode: 'pct', top: 999, prev: true }, wm: true, evil: 1 } } }); r = await adm('GET', '/api/chart'); const pcs = r.j.pref.cs;
    ok(pcs.type === 'area' && pcs.tz === 'tash' && pcs.bg === '' && pcs.cu === '#112233' && pcs.sc.mode === 'pct' && pcs.sc.top === 45 && pcs.sc.prev === true && pcs.wm === true && pcs.evil === undefined, 'chart sozlamalari tozalanib saqlanadi: ' + JSON.stringify(pcs).slice(0, 200));
    r = await adm('POST', '/api/chart', { aid: A.BTC, draw: [{ id: 'f1', k: 'fib', pts: [{ t: 1, p: 2 }, { t: 3, p: 4 }], c: '#2962ff', w: 99, ls: 2, fa: 40, lock: true, extR: true, lv: [{ v: 0.5, on: true, c: '#ff0000' }, { v: 'x' }], zzz: 1 }] });
    r = await adm('GET', '/api/chart?aid=' + A.BTC); const fd = r.j.draw[0]; ok(fd && fd.w === 8 && fd.ls === 2 && fd.lock === true && fd.extR === true && fd.lv.length === 1 && fd.zzz === undefined, 'chizma xossalari saqlanadi: ' + JSON.stringify(fd));
    r = await cl2('GET', '/api/candles?aid=' + A.UZNF + '&tf=D'); { const wd = new Date(Date.now() + 5 * 3600e3).getUTCDay(); ok(r.s === 200 && (wd === 0 || wd === 6 ? r.j.candles.length === 0 : r.j.candles.length >= 1), 'uzse aktiv uchun narx tarixidan sham (dam olish kunida yo‘q): ' + JSON.stringify(r.j).slice(0, 120)); }
    r = await cl2('GET', '/api/candles?aid=' + A.UZS + '&tf=D'); ok(r.s === 404, 'naqd aktivning charti yo‘q');
    r = await cl2('GET', '/api/backup'); ok(r.s === 403, 'zaxirani faqat admin yuklaydi'); r = await adm('GET', '/api/backup'); ok(r.s === 200, 'admin zaxira yuklaydi');

    /* uzse tarixi (Excel), alertlar, signal */
    const srvm = require('../server.js');
    r = await adm('POST', '/api/assets', { id: A.UZNF, sym: 'UZNF', name: 'UZNF', group: 'milliy', curr: 'UZS', price: 6730, target: 5, src: { type: 'uzse', ref: 'UZ7058980010' } }); ok(r.s === 200, 'UZNF uzse manbasi bilan');
    const xb = fs.readFileSync(path.join(__dirname, 'fixtures', 'conclusions_UZ7058980010.xlsx')).toString('base64');
    r = await adm('POST', '/api/history/import', { files: [{ name: 'b546d0e9-conclusions_UZ7058980010_01.01.2026-04.11.2026.xlsx', data: xb }] }); ok(r.s === 200 && r.j.files[0].sym === 'UZNF' && r.j.files[0].added === 120, 'Excel import ISIN bo‘yicha: ' + JSON.stringify(r.j).slice(0, 200));
    r = await adm('POST', '/api/history/import', { files: [{ name: 'b546d0e9-conclusions_UZ7058980010_01.01.2026-04.11.2026.xlsx', data: xb }] }); ok(r.j.files[0].added === 0 && r.j.files[0].total >= 120 && r.j.files[0].total <= 121, 'qayta import dublikat yaratmaydi');
    /* xato aktiv tanlangan bo'lsa ham ISIN ustun; boshqa narx shkalasi rad etiladi; tozalash */
    const other = (await adm('GET', '/api/history/status')).j.assets.filter(x => x.sym !== 'UZNF')[0];
    if (other) { r = await adm('POST', '/api/history/import', { aid: other.id, files: [{ name: 'conclusions_UZ7058980010_x.xlsx', data: xb }] }); ok(r.j.files[0].sym === 'UZNF', 'ISIN tanlangan aktivdan ustun: ' + r.j.files[0].sym); }
    const uz = (await adm('GET', '/api/history/status')).j.assets.filter(x => x.sym === 'UZNF')[0];
    r = await adm('POST', '/api/history/reset', { aid: uz.id }); ok(r.s === 200 && r.j.removed >= 100, 'tarix tozalandi: ' + JSON.stringify(r.j));
    r = await adm('POST', '/api/history/import', { files: [{ name: 'conclusions_UZ7058980010_x.xlsx', data: xb }] }); ok(r.j.files[0].added >= 100, 'tozalangach qayta yuklandi');
    r = await cl('POST', '/api/history/import', { files: [] }); ok(r.s === 403, 'mijoz tarix yuklay olmaydi');
    r = await cl2('GET', '/api/candles?aid=' + A.UZNF + '&tf=D'); ok(r.j.candles.length >= 120 && r.j.candles.filter(c => c.t === 1793318400)[0].c === 6.73 && r.j.rule.h === 16 && r.j.rule.tz === 'Asia/Tashkent', 'uzse kunlik shamlar va 16:00 qoidasi');
    r = await cl2('GET', '/api/candles?aid=' + A.UZNF + '&tf=W'); ok(r.j.candles.length > 15 && r.j.candles.length < 30, 'haftalik: ' + r.j.candles.length); r = await cl2('GET', '/api/candles?aid=' + A.UZNF + '&tf=M'); ok(r.j.candles.length >= 5 && r.j.candles.length <= 7, 'oylik: ' + r.j.candles.length);
    r = await cl2('GET', '/api/candles?aid=' + A.BTC + '&tf=D'); ok(r.s === 200 && r.j.rule.tz === 'UTC', 'bitget 00:00 UTC qoidasi');
    const sig0 = (await adm('GET', '/api/state')).j.signals.length;
    r = await adm('POST', '/api/alerts', { aid: A.UZNF, tf: 'D', name: 'UZNF narx', cond: { a: { k: 'price', f: 'close' }, op: 'gt', b: { k: 'value', v: 6 } }, on: 'live', act: 'BUY' }); ok(r.s === 200, 'alert yaratish: ' + JSON.stringify(r.j)); const alId = r.j.id;
    r = await cl2('POST', '/api/alerts', { aid: A.UZNF, tf: 'D', cond: { a: { k: 'rsi', p: { len: 14 } }, op: 'crossover', b: { k: 'value', v: 70 } }, act: 'BUY' }); ok(r.s === 200, 'mijoz alert yaratadi'); 
    r = await adm('POST', '/api/alerts', { aid: A.UZNF, tf: 'D', cond: { a: { k: 'price' }, op: 'weird', b: { k: 'value', v: 1 } } }); ok(r.s === 400, 'noto‘g‘ri operator rad etiladi');
    await srvm.checkAlerts();
    st = await adm('GET', '/api/state'); ok(st.j.alog.length === 1 && /UZNF/.test(st.j.alog[0].text), 'alert ishga tushdi'); ok(st.j.signals.length === sig0 + 1, 'alert Avto savdoga signal yubordi');
    await srvm.checkAlerts(); st = await adm('GET', '/api/state'); ok(st.j.alog.length === 1, 'bir shamda ikki marta ishlamaydi');
    r = await cl2('GET', '/api/alerts'); ok(r.j.alerts.length === 1 && r.j.alerts[0].act === 'none', 'mijoz alerti signal yubormaydi (faqat xabar)'); st = await cl2('GET', '/api/state'); ok(st.j.alog.every(x => x.alert === r.j.alerts[0].id), 'alert jurnali foydalanuvchiga xos');
    r = await adm('POST', '/api/alerts/' + alId + '/del', {}); ok(r.s === 200, 'alert o‘chirildi');
    const cs = (await cl2('GET', '/api/candles?aid=' + A.UZNF + '&tf=D')).j.candles.map(c => ({ t: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v }));
    ok(IND.evalCond({ a: { k: 'price' }, op: 'gt', b: { k: 'value', v: 6.7 } }, cs, cs.length - 1) === true && IND.evalCond({ a: { k: 'price' }, op: 'lt', b: { k: 'value', v: 6.7 } }, cs, cs.length - 1) === false, 'shart hisoblash');
    /* jurnal */
    st = await adm('GET', '/api/state'); const L = st.j.audit; ok(L.length > 15, 'jurnal yozilgan: ' + L.length);
    ok(L.every(x => x.id && x.t && x.action && 'ip' in x && x.dev && x.actor), 'jurnal maydonlari to‘liq');
    ok(L.some(x => x.action === 'Tranzaksiyani tahrirladi' && /narx xatosi/.test(x.detail)), 'tahrir jurnalda'); ok(L.some(x => /muvaffaqiyatsiz/.test(x.action)), 'xato kirish jurnalda'); ok(L.some(x => x.action === 'Ichki o‘tkazma bajardi'), 'o‘tkazma jurnalda');
    ok(!JSON.stringify(L).includes('Mijoz12345') && !JSON.stringify(L).includes('AdminParol123'), 'jurnalda parol yo‘q');
    /* sessiyalar */
    st = await cl('GET', '/api/state'); ok(st.j.me.sessions.length === 1 && st.j.me.sessions[0].cur, 'faol seans');
    r = await adm('POST', '/api/users/' + (await adm('GET', '/api/state')).j.users.filter(u => u.email === 'mijoz@test.uz')[0].id, { role: 'operator' }); ok(r.s === 200, 'rol');
    r = await adm('POST', '/api/users/' + (await adm('GET', '/api/state')).j.users.filter(u => u.role === 'admin')[0].id, { blocked: true }); ok(r.s === 400, 'adminni bloklab bo‘lmaydi');
    { /* Google Apps Script o'tkazgichi (soxta fetch bilan) */
      const SRC = require('../src/sources'), of = global.fetch; let calls = [], mode = 'ok';
      global.fetch = async (u, o) => { u = String(u); if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost')) return of(u, o); if (/zz1|zz2|uzse\.uz\/x/.test(decodeURIComponent(u))) calls.push(u);
        if (u.startsWith('https://script.google.com/')) {
          if (mode === 'down') { const e = new TypeError('fetch failed'); e.cause = { code: 'ENETUNREACH' }; throw e; }
          const body = mode === 'ok' ? '{"code":"00000","data":[{"symbol":"BTCUSDT","lastPr":"67000"}]}' : mode === '429' ? 'RELAYERR 429 too many' : mode === '403' ? 'RELAYERR 403 kalit notogri' : '<!DOCTYPE html><html>login</html>';
          return new Response(body, { status: 200 }); }
        return new Response('{"direct":true}', { status: 200 }); };
      try {
        process.env.RELAY_URL = 'https://script.google.com/macros/s/AKfyc_TEST/exec'; process.env.RELAY_KEY = 'k e/y'; SRC.resetNet();
        let j = await SRC.http('https://api.bitget.com/api/v2/spot/market/tickers?symbol=BTCUSDT&zz1=1', { json: true });
        ok(calls.length === 1 && calls[0].startsWith(process.env.RELAY_URL + '?key=k%20e%2Fy&url=' + encodeURIComponent('https://api.bitget.com/api/v2/spot/market/tickers')) && j && j.code === '00000', 'o‘tkazgich orqali so‘rov: ' + calls[0]);
        calls = []; await SRC.http('https://uzse.uz/x').catch(() => 0); ok(calls.length === 1 && !calls[0].startsWith('https://script.google.com/'), 'uzse.uz o‘tkazgichga yuborilmaydi');
        mode = '403'; SRC.resetNet(); calls = []; let err = await SRC.http('https://api.bitget.com/a?zz2=1').catch(e => e); ok(err && err.http === 403 && /RELAY_KEY/.test(err.message) && calls.length === 1, 'noto‘g‘ri kalit tushunarli xato: ' + (err && err.message));
        mode = '429'; SRC.resetNet(); err = await SRC.http('https://api.bitget.com/a?zz2=1').catch(e => e); ok(err && err.http === 429, 'RELAYERR 429 → http=429');
        mode = 'html'; SRC.resetNet(); err = await SRC.http('https://api.bitget.com/a?zz2=1').catch(e => e); ok(err && /Anyone/.test(err.message), 'HTML javob aniqlanadi: ' + (err && err.message));
        mode = 'down'; SRC.resetNet(); calls = []; j = await SRC.http('https://api.bitget.com/a?zz2=1', { json: true }).catch(e => e); ok(j && j.direct === true && calls.length === 2 && !calls[1].startsWith('https://script.google.com/'), 'o‘tkazgich ishlamasa bevosita yo‘lga qaytadi: ' + calls.join(' | '));
        ok(SRC.relayCfg() && SRC.relayCfg().key === 'k e/y', 'relayCfg');
      } finally { global.fetch = of; delete process.env.RELAY_URL; delete process.env.RELAY_KEY; SRC.resetNet(); }
      ok(!SRC.relayCfg(), 'o‘tkazgich sozlanmasa o‘chiq');
    }
    { /* Binance asosiy manba (data-api.binance.vision), Bitget zaxira; 5 daqiqa / 2 soat jadvali */
      const SRC = require('../src/sources'), CAN = require('../src/candles'), of = global.fetch, calls = [];
      const js = o => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => o, text: async () => JSON.stringify(o), arrayBuffer: async () => new ArrayBuffer(0) });
      const day = 86400000, t0 = Math.floor(Date.now() / day) * day - 60 * day, kl = []; for (let i = 0; i < 60; i++) kl.push([t0 + i * day, '10', '12', '9', String(10 + i), '7']);
      global.fetch = async (u, o) => { u = String(u); if (/127\.0\.0\.1|localhost/.test(u)) return of(u, o); calls.push(u);
        if (/data-api\.binance\.vision\/api\/v3\/ticker\/price/.test(u)) return js([{ symbol: 'BTCUSDT', price: '81000.5' }, { symbol: 'ETHUSDT', price: '3100' }]);
        if (/data-api\.binance\.vision\/api\/v3\/klines/.test(u)) { if (/symbol=ZZZUSDT/.test(u)) return { ok: false, status: 400, headers: { get: () => null }, text: async () => '{"code":-1121}' }; return js(kl); }
        if (/bitget\.com\/api\/v2\/spot\/market\/tickers/.test(u)) return js({ data: [{ symbol: 'NVDAONUSDT', lastPr: '180.25' }] });
        if (/bitget\.com\/api\/v2\/spot\/market\/candles/.test(u)) return js({ data: kl.map(r => [String(r[0]), r[1], r[2], r[3], r[4], r[5]]) });
        throw new TypeError('fetch failed'); };
      try {
        SRC.resetNet(); let o = await SRC.refreshAll([{ id: 'b1', src: { type: 'bitget', ref: 'BTCUSDT' } }, { id: 'b2', src: { type: 'bitget', ref: 'ETH' } }]);
        ok(o.b1.price === 81000.5 && o.b2.price === 3100 && o.b1.via === 'Binance', 'narx Binancedan: ' + JSON.stringify(o)); ok(calls.length === 1 && /data-api\.binance\.vision/.test(calls[0]), 'bitta umumiy Binance so‘rovi, Bitgetga murojaat yo‘q: ' + calls.length);
        SRC.resetNet(); calls.length = 0; o = await SRC.refreshAll([{ id: 'b3', src: { type: 'bitget', ref: 'NVDAON' } }, { id: 'b4', src: { type: 'bitget', ref: 'QQQQUSDT' } }]);
        ok(o.b3.price === 180.25 && o.b3.via === 'Bitget', 'Binancedan topilmagan juftlik Bitgetdan: ' + JSON.stringify(o.b3)); ok(o.b4.error && /topilmadi/.test(o.b4.error), 'ikkalasida ham yo‘q: ' + JSON.stringify(o.b4));
        SRC.resetNet(); calls.length = 0; let d = await CAN.daily({ id: 'q', sym: 'BTC', src: { type: 'bitget', ref: 'BTCUSDT' } }, false);
        ok(d.candles.length >= 55 && /limit=5/.test(calls[0]) && /data-api\.binance\.vision\/api\/v3\/klines/.test(calls[0]), 'kunlik yangilash Binancedan (limit=5): ' + calls[0]);
        calls.length = 0; d = await CAN.daily({ id: 'q', sym: 'BTC', src: { type: 'bitget', ref: 'BTCUSDT' } }, true);
        ok(d.candles.length >= 55 && /startTime=0/.test(calls[0]) && calls.length === 1, 'to‘liq tarix Binancedan startTime bilan: ' + calls.join(' | '));
        SRC.resetNet(); calls.length = 0; d = await CAN.daily({ id: 'z', sym: 'ZZZ', src: { type: 'bitget', ref: 'ZZZUSDT' } }, false);
        ok(d.candles.length >= 55 && calls.some(c => /bitget\.com.*candles/.test(c)), 'Binancedan topilmasa Bitget shamlari'); calls.length = 0;
        await CAN.daily({ id: 'z', sym: 'ZZZ', src: { type: 'bitget', ref: 'ZZZUSDT' } }, false); ok(!calls.some(c => /binance/.test(c)), 'topilmagan juftlik 6 soat qayta so‘ralmaydi');
      } finally { global.fetch = of; SRC.resetNet(); }
      const sv = require('../server.js'), nowT = Date.now(), cry = { id: 'c', sym: 'BTC', src: { type: 'bitget', ref: 'BTCUSDT' }, bfFull: true };
      ok(sv.provDue(Object.assign({}, cry, { bfT: nowT - 6 * 60e3 })) === true && sv.provDue(Object.assign({}, cry, { bfT: nowT - 60e3 })) === false, 'Binance sinxronizatsiyasi har 5 daqiqada');
      ok(sv.provDue(Object.assign({}, cry, { bfT: nowT - 6 * 60e3, bfNext: nowT + 600e3 })) === false, 'xatodan keyingi kutish saqlanadi');
      const hu = { id: 'h', sym: 'H', hurl: 'https://x/{isin}', hsyncT: nowT - 3 * 3600e3 }; ok(sv.histDue(hu) === true && sv.histDue(Object.assign({}, hu, { hsyncT: nowT - 3600e3 })) === false, 'Excel/havola tarixi har 2 soatda');
    }
    { /* Omonat foizi: tushgan kundan keyingi kundan, qaytarilgan kun hisoblanmaydi, kunlik S*R/365, qisman yechish */
      const Cr = require('../public/core.js'), near = (a, b) => Math.abs(a - b) < 0.01;
      let a = Cr.accrue([{ d: '2026-01-01', type: 'DEPOZIT', amt: 10e6 }, { d: '2026-01-31', type: 'WITHDRAW', amt: 10e6 }], { rate: 0.22, to: '2026-02-10' }); ok(a.days === 29 && near(a.total, 10e6 * 0.22 / 365 * 29) && a.balance === 0, 'omonat: 1-yanvar kiritilib 31-yanvar qaytarilsa 29 kun: ' + a.days + ' ' + a.total);
      a = Cr.accrue([{ d: '2026-01-01', type: 'DEPOZIT', amt: 10e6 }, { d: '2026-01-11', type: 'WITHDRAW', amt: 4e6 }], { rate: 0.22, to: '2026-01-30' }); ok(near(a.total, 10e6 * 0.22 / 365 * 9 + 6e6 * 0.22 / 365 * 20), 'omonat: qisman yechishdan keyin haqiqiy qoldiqdan: ' + a.total);
      a = Cr.accrue([{ d: '2026-01-01', type: 'DEPOZIT', amt: 10e6 }], { rate: 0.22, to: '2026-01-01' }); ok(a.total === 0, 'omonat: tushgan kuni foiz yo‘q');
      a = Cr.accrue([{ d: '2026-01-01', type: 'DEPOZIT', amt: 10e6 }, { d: '2026-01-01', type: 'DEPOZIT', amt: 5e6 }], { rate: 0.22, to: '2026-01-02' }); ok(near(a.rows[1].fk, 15e6 * 0.22 / 365), 'omonat: bir kunda ikki depozit ertasi kuni yig‘indidan');
      a = Cr.accrue([{ d: '2026-01-31', type: 'DEPOZIT', amt: 10e6 }], { rate: 0.22, to: '2026-04-30', pay: 'monthly', cap: true }); ok(a.pays.length === 3 && a.pays[0].d === '2026-02-28' && a.pays[1].d === '2026-03-31' && a.paid > 0 && a.balance > 10e6, 'omonat: oylik to‘lov sanalari (oyning oxirgi kuniga moslanadi) va foiz qo‘shilishi');
      a = Cr.accrue([{ d: '2026-01-31', type: 'DEPOZIT', amt: 10e6 }], { rate: 0.22, to: '2026-04-30', pay: 'monthly', cap: false }); ok(near(a.total, 10e6 * 0.22 / 365 * 89) && a.balance === 10e6, 'omonat: foiz qo‘shilmasa oddiy foiz: ' + a.total);
      a = Cr.accrue([{ d: '2026-01-01', type: 'DEPOZIT', amt: 1e6 }, { d: '2026-01-05', type: 'WITHDRAW', amt: 2e6 }], { rate: 0.22, to: '2026-01-10' }); ok(a.errors.length === 1, 'omonat: qoldiqdan ortiq yechish xato sifatida belgilanadi');
    }
    { /* Obligatsiya: kupon jadvali, yig'ilgan foiz, YTM/signal, kutilayotgan kuponlar */
      const Cb = require('../public/core.js'), nr = (a, b, e) => Math.abs(a - b) < (e || 0.01);
      const bd = { nominal: 1000000, rate: 24, freq: 4, first: '2026-12-10', maturity: '2027-12-10', issue: '2026-09-10' };
      const sc = Cb.bondSched(bd); ok(sc.length === 5 && sc[0].d === '2026-12-10' && sc[1].d === '2027-03-10' && sc[4].red === 1000000 && sc[0].cpn === 60000, 'obligatsiya kupon jadvali: ' + sc.map(x => x.d).join(','));
      let ac = Cb.bondAccrued(bd, '2026-11-08'); ok(ac.days === 59 && ac.period === 91 && nr(ac.accrued, 60000 * 59 / 91), 'yig‘ilgan kupon foizi: ' + ac.accrued);
      ok(Cb.bondAccrued(bd, '2026-12-10').accrued === 0, 'kupon kuni yig‘ilgan foiz 0 dan boshlanadi'); ok(Cb.bondAccrued(bd, '2028-01-01').accrued === 0, 'so‘ndirilgandan keyin 0');
      ok(nr(Cb.bondYtm(bd, 1000000, '2026-11-08') * 100, 26.21, 0.05), 'YTM nominalda ~26.2%: ' + Cb.bondYtm(bd, 1000000, '2026-11-08')); ok(Cb.bondSignal(bd, 950000, '2026-11-08').side === 'BUY' && Cb.bondSignal(bd, 1050000, '2026-11-08').side === 'SELL' && Cb.bondSignal(bd, 1000000, '2026-11-08', { hurdle: 26 }).side === null, 'obligatsiya signali: arzon BUY, qimmat SELL, atrofida yo‘q');
      ok(nr(Cb.bondYtm(bd, 1038901.1, '2026-11-08', { dirty: true }) * 100, 26.21, 0.05), 'dirty narx bilan YTM bir xil');
      const SB = { fx: { USD: 12000 }, assets: [{ id: 'b1', sym: 'BND1', group: 'obligatsiya', curr: 'UZS', price: 1e6, bond: bd, archived: false }, { id: 'c', sym: 'UZS', group: 'naqd', curr: 'UZS', price: 1 }], accounts: [{ id: 'a1', owner: 'T' }],
        tx: [{ id: 't1', acc: 'a1', aid: 'c', type: 'DEPOZIT', amount: 1e8, price: 1, t: Date.parse('2026-09-01T07:00:00Z'), status: 'Bajarildi' }, { id: 't2', acc: 'a1', aid: 'b1', type: 'BUY', amount: 10, price: 1e6, t: Date.parse('2026-10-01T07:00:00Z'), status: 'Bajarildi' }] };
      const t10 = Date.parse('2026-12-10T08:00:00Z'); let du = Cb.bondDue(SB, t10).filter(x => x.date === '2026-12-10');
      ok(du.length === 1 && du[0].kind === 'KUPON' && du[0].amt === 600000 && du[0].status === 'bugun' && du[0].qty === 10, 'kupon kuni taklif: ' + JSON.stringify(du));
      du = Cb.bondDue(SB, Date.parse('2026-12-05T08:00:00Z')).filter(x => x.date === '2026-12-10'); ok(du.length === 1 && du[0].status === 'yaqin' && du[0].days === 5, 'yaqinlashayotgan kupon');
      SB.tx.push({ id: 't3', acc: 'a1', aid: 'b1', type: 'KUPON', amount: 600000, bk: 'b1|a1|2026-12-10|KUPON', t: t10, status: 'Bajarildi' }); du = Cb.bondDue(SB, t10 + 864e5).filter(x => x.date === '2026-12-10'); ok(du[0].done === true && du[0].status === 'yozilgan', 'yozilgan kupon takrorlanmaydi');
      const SB2 = JSON.parse(JSON.stringify(SB)); SB2.tx = SB2.tx.slice(0, 1).concat([{ id: 't9', acc: 'a1', aid: 'b1', type: 'BUY', amount: 5, price: 1e6, t: Date.parse('2026-12-20T07:00:00Z'), status: 'Bajarildi' }]); ok(Cb.bondDue(SB2, t10).filter(x => x.date === '2026-12-10').length === 0, 'kupon sanasidan keyin sotib olingan donaga kupon yo‘q');
      const dm = Cb.bondDue(SB, Date.parse('2027-12-10T08:00:00Z')).filter(x => x.date === '2027-12-10'); ok(dm.length === 2 && dm.some(x => x.kind === 'SONDIRISH' && x.amt === 10e6), 'so‘ndirish hodisasi (nominal × dona)');
    }
    { /* Obligatsiya serveri: kupon jadvali, eslatma, kuponni yozish, YTM signali */
      const Cs = require('../public/core.js'), srvB = require('../server.js'), td = ms => Cs.dayStr(Cs.dayNum(Date.now() + 5 * 3600e3 + ms));
      r = await adm('POST', '/api/assets', { sym: 'BND9', name: 'Test obligatsiya', group: 'obligatsiya', curr: 'UZS', price: 100000, target: 0, bond: { nominal: 100000, rate: 24, freq: 4, first: td(-864e5), maturity: td(365 * 864e5), sig: false } }); ok(r.s === 200, 'obligatsiya kupon jadvali bilan saqlandi: ' + JSON.stringify(r.j));
      r = await adm('POST', '/api/assets', { sym: 'BADB', group: 'obligatsiya', curr: 'UZS', price: 1, bond: { nominal: -5, rate: 24, freq: 4, first: td(0) } }); ok(r.s === 400, 'noto‘g‘ri nominal rad etiladi');
      r = await adm('POST', '/api/assets', { sym: 'BADC', group: 'kripto', curr: 'USD', price: 1, bond: { nominal: 100, rate: 10, freq: 4, first: td(0) } }); ok(r.s === 400, 'kupon jadvali faqat obligatsiyaga');
      st = await adm('GET', '/api/state'); const bid = st.j.assets.filter(a => a.sym === 'BND9')[0].id;
      r = await adm('POST', '/api/tx', { acc: acc1, aid: bid, type: 'BUY', amount: 2, price: 100000, cash: false, t: Date.now() - 5 * 864e5 }); ok(r.s === 200, 'obligatsiya sotib olindi: ' + JSON.stringify(r.j));
      r = await cl2('GET', '/api/bonds'); ok(r.s === 403, 'mijoz obligatsiya boshqaruviga kira olmaydi: ' + r.s);
      r = await adm('GET', '/api/bonds'); const bi = r.j.bonds.filter(b => b.sym === 'BND9')[0], cu = r.j.due.filter(d => d.aid === bid && d.kind === 'KUPON' && d.date === td(-864e5))[0];
      ok(bi && bi.sched.length >= 4 && bi.accrued.days >= 0 && bi.signal && bi.signal.ytm > 20, 'GET /api/bonds: jadval, yig‘ilgan foiz, YTM'); ok(cu && cu.status === 'yozilmagan' && cu.amt === 12000 && cu.qty === 2, 'kechagi kupon taklif qilindi: ' + JSON.stringify(cu));
      srvB.bondLoop(); st = await adm('GET', '/api/state'); ok(st.j.alog.some(a => a.name === 'Obligatsiya' && /BND9/.test(a.text)), 'kupon eslatmasi jurnalga tushdi'); const nl = st.j.alog.length; srvB.bondLoop(); st = await adm('GET', '/api/state'); ok(st.j.alog.length === nl, 'eslatma takrorlanmaydi');
      r = await adm('POST', '/api/bonds/accept', { key: cu.key }); ok(r.s === 200, 'kupon yozildi: ' + JSON.stringify(r.j));
      st = await adm('GET', '/api/state'); const kt = st.j.tx.filter(t => t.bk === cu.key)[0]; ok(kt && kt.type === 'KUPON' && kt.amount === 12000 && kt.status === 'Bajarildi', 'kupon tranzaksiyasi bk bilan');
      r = await adm('POST', '/api/bonds/accept', { key: cu.key }); ok(r.s === 400, 'kupon ikki marta yozilmaydi');
      r = await adm('GET', '/api/bonds'); ok(r.j.due.filter(d => d.key === cu.key)[0].done === true, 'yozilgan kupon done');
      const sig0 = (await adm('GET', '/api/state')).j.signals.length;
      r = await adm('POST', '/api/assets', { id: bid, sym: 'BND9', name: 'Test obligatsiya', group: 'obligatsiya', curr: 'UZS', price: 100000, target: 0, bond: { nominal: 100000, rate: 24, freq: 4, first: td(-864e5), maturity: td(365 * 864e5), sig: true, hurdle: 20 } }); ok(r.s === 200, 'signal yoqildi');
      srvB.bondLoop(); st = await adm('GET', '/api/state'); ok(st.j.signals.length === sig0 + 1 && /Obligatsiya/.test(st.j.signals[st.j.signals.length - 1].src || JSON.stringify(st.j.signals[st.j.signals.length - 1])), 'YTM signali Avto savdoga tushdi'); srvB.bondLoop(); st = await adm('GET', '/api/state'); ok(st.j.signals.length === sig0 + 1, 'bir kunda bir marta signal');
    }
    { /* Omonat foizi BARLOS hisobida: qiymatga qo'shiladi, FOIZ taklifi, tartib bilan yozish; taqqoslash kunlik hisob */
      const Cd = require('../public/core.js'), near = (a, b, e) => Math.abs(a - b) < (e || 0.5);
      r = await adm('POST', '/api/assets', { sym: 'OMN9', name: 'Test omonat', group: 'omonat', curr: 'UZS', price: 1, rate: 22, dpay: 'monthly', target: 0 }); ok(r.s === 200, 'omonat aktivi stavka va davriylik bilan: ' + JSON.stringify(r.j));
      st = await adm('GET', '/api/state'); const oid = st.j.assets.filter(a => a.sym === 'OMN9')[0].id; ok(st.j.assets.filter(a => a.sym === 'OMN9')[0].dpay === 'monthly', 'dpay saqlandi');
      const d0 = Date.now() - 70 * 864e5; r = await adm('POST', '/api/tx', { acc: acc1, aid: oid, type: 'DEPOZIT', amount: 20000000, price: 1, cash: false, t: d0 }); ok(r.s === 200, 'omonatga depozit: ' + JSON.stringify(r.j));
      st = await adm('GET', '/api/state'); const SS = { fx: st.j.settings.fx, assets: st.j.assets, accounts: st.j.accounts, tx: st.j.tx }, acA = SS.accounts.filter(a => a.id === acc1)[0], Vv = Cd.view(SS, acA), it = Vv.items.filter(i => i.x.id === oid)[0];
      const days = Cd.dayNum(Date.now() + 5 * 3600e3) - Cd.dayNum(d0 + 5 * 3600e3); ok(it && near(it.acr, 20000000 * 0.22 / 365 * days, 1) && near(it.val, 20000000 + it.acr, 1), 'yig‘ilgan foiz portfel qiymatiga kiradi: ' + (it && it.acr));
      r = await adm('GET', '/api/deposits'); const dd = r.j.due.filter(x => x.aid === oid && !x.done); ok(dd.length >= 2 && dd[0].kind === 'FOIZ' && dd[0].status === 'yozilmagan' && dd[0].amt > 0, 'foiz to‘lovlari taklif qilindi: ' + JSON.stringify(dd.slice(0, 2)));
      r = await adm('POST', '/api/deposits/accept', { key: dd[1].key }); ok(r.s === 400 && /oldingi/.test(r.j.error), 'oldingi to‘lovsiz keyingisini yozib bo‘lmaydi');
      r = await adm('POST', '/api/deposits/accept', { key: dd[0].key }); ok(r.s === 200 && r.j.amount > 0, 'birinchi foiz yozildi: ' + JSON.stringify(r.j));
      const first = r.j.amount; r = await adm('POST', '/api/deposits/accept', { key: dd[0].key }); ok(r.s === 400, 'bir foiz ikki marta yozilmaydi');
      r = await adm('GET', '/api/deposits'); const d2 = r.j.due.filter(x => x.aid === oid && !x.done)[0]; r = await adm('POST', '/api/deposits/accept', { key: d2.key }); ok(r.s === 200, 'ikkinchi foiz yozildi');
      st = await adm('GET', '/api/state'); const S2 = { fx: st.j.settings.fx, assets: st.j.assets, accounts: st.j.accounts, tx: st.j.tx }, ds = Cd.depState(S2, acc1, S2.assets.filter(a => a.id === oid)[0]), q2 = Cd.position(S2, acc1).q[oid];
      ok(near(q2, 20000000 + first + (r.j.amount || 0), 1) && ds.unpaid >= 0 && ds.unpaid < 20000000 * 0.22 / 365 * 31, 'foiz qo‘shilgach qoldiq oshdi, to‘lanmagan qism kichik: ' + q2 + ' / ' + ds.unpaid);
      /* Taqqoslash (portfel koeffitsienti): depozit va yechishlar kunlik hisoblanadi */
      const t0 = Date.parse('2026-01-01T07:00:00Z'), t1 = Date.parse('2026-01-11T07:00:00Z'), tn = Date.parse('2026-01-31T07:00:00Z'); Cd.BENCHC.rate = 25; Cd.BENCHC.pay = 'none';
      ok(near(Cd.bench({ flows: [{ t: t0, uzs: 10e6 }, { t: t1, uzs: -4e6 }] }, tn), 6e6 + (10e6 * 0.25 / 365 * 9 + 6e6 * 0.25 / 365 * 21), 1), 'taqqoslash: depozit va yechishlar bilan kunlik hisob: ' + Cd.bench({ flows: [{ t: t0, uzs: 10e6 }, { t: t1, uzs: -4e6 }] }, tn));
      ok(near(Cd.bench({ flows: [{ t: t0, uzs: 10e6 }, { t: t0 + 864e5, uzs: -10e6 }] }, tn), 0, 1) || Cd.bench({ flows: [{ t: t0, uzs: 10e6 }, { t: t0 + 864e5, uzs: -10e6 }] }, tn) >= 0, 'taqqoslash: to‘liq yechishdan keyin manfiy emas');

      { /* Boshlanish sanasi: to'lov har oy shu kunning ertasi; foiz o'sha kungacha hisoblanadi; 8 xonagacha yaxlitlanadi */
        const ds0 = Cd.dayStr(Cd.dayNum(Date.now() + 5 * 3600e3) - 75), n0 = Cd.dayNum(ds0), ann1 = Cd.addMonths(n0, 1, +ds0.slice(8)), t8 = n0 * 864e5 + 3 * 3600e3;
        r = await adm('POST', '/api/assets', { sym: 'OMN8', name: 'Test omonat 2', group: 'omonat', curr: 'UZS', price: 1, rate: 21.5, dpay: 'monthly', dstart: ds0, target: 0 }); ok(r.s === 200, 'dstart bilan omonat aktivi: ' + JSON.stringify(r.j));
        st = await adm('GET', '/api/state'); const o8 = st.j.assets.filter(a => a.sym === 'OMN8')[0]; ok(o8 && o8.dstart === ds0, 'dstart saqlandi');
        r = await adm('POST', '/api/tx', { acc: acc1, aid: o8.id, type: 'DEPOZIT', amount: 12345678, price: 1, cash: false, t: t8 }); ok(r.s === 200, 'OMN8 depoziti');
        r = await adm('GET', '/api/deposits'); const q8 = r.j.due.filter(x => x.aid === o8.id).sort((a, b) => a.date < b.date ? -1 : 1);
        ok(q8.length >= 2 && q8[0].date === Cd.dayStr(ann1 + 1), 'to‘lov sanasi = boshlanish kunining ertasi: ' + (q8[0] && q8[0].date));
        ok(q8[0].upto === Cd.dayStr(ann1), 'foiz to‘lov kunining oldingi kunigacha hisoblangan: ' + (q8[0] && q8[0].upto));
        const nd = ann1 - n0; ok(near(q8[0].amt, Math.round(12345678 * 0.215 / 365 * 1e8) / 1e8 * nd, 1e-3), 'foiz summasi S×R/365×N: ' + q8[0].amt + ' (' + nd + ' kun)');
        ok(Math.abs(q8[0].amt * 1e8 - Math.round(q8[0].amt * 1e8)) < 1e-3, 'summa 8 xonagacha yaxlitlangan');
        r = await adm('POST', '/api/deposits/accept', { key: q8[0].key }); ok(r.s === 200, 'signal tasdiqlandi → tranzaksiya');
        st = await adm('GET', '/api/state'); const fx8 = st.j.tx.filter(x => x.aid === o8.id && x.type === 'FOIZ'); ok(fx8.length === 1 && !('tax' in fx8[0]) , 'FOIZ tranzaksiyasi yozildi, soliqsiz');
      }
    }

    { /* Joriy maqsad: Stoch RSI formulasi va foizli guruhlarga qolgan ulush */
      const Cs = require('../public/core.js'), nr = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
      ok(nr(Cs.typeTarget(20, 100), 20 - 20 / 3) && nr(Cs.typeTarget(20, 0), 20 + 20 / 3) && nr(Cs.typeTarget(20, 50), 20), 'd = F − (F/3)·SIGN(s)·|s|^1.316: chekka qiymatlar');
      ok(nr(Cs.typeTarget(30, 75), 30 - 10 * Math.pow(0.5, 1.316)), 'd formulasi M=75 da');
      const wk = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
      ok(nr(Cs.stochRsi(wk, { rsi: 14, len: 1, k: 1, d: 1 }).rsi, 70.464, 0.01), 'RSI(14) Wilder namunasi bilan mos (70.46)');
      ok(Cs.stochRsi(wk, {}).k === null, 'shamlar yetarli bo‘lmasa Stoch RSI null');
      const it = (id, g, t, v) => ({ x: { id, group: g }, target: t, val: v, qty: 1 });
      const Vx = { T: 100, items: [it('a', 'kripto', 20, 20), it('b', 'milliy', 10, 10), it('c', 'omonat', 30, 30), it('d', 'naqd', 20, 20), it('e', 'obligatsiya', 20, 20)] };
      const An = Cs.analyze({ stoch: { kripto: { m: 100 }, milliy: { m: 0 } } }, Vx), dk = 20 - 20 / 3, dm = 10 + 10 / 3, left = 100 - dk - dm;
      ok(nr(An.groups.kripto.d, dk) && nr(An.groups.milliy.d, dm), 'turlarning joriy maqsadi Stoch bo‘yicha');
      ok(nr(An.groups.omonat.d, left * 30 / 70) && nr(An.groups.naqd.d, left * 20 / 70) && nr(An.groups.obligatsiya.d, left * 20 / 70), 'foizli guruh = (100 − foizsiz d) × normal ÷ foizli normallar yig‘indisi');
      ok(nr(An.sumD, 100), 'joriy maqsadlar yig‘indisi 100%: ' + An.sumD);
      const An2 = Cs.analyze({}, Vx); ok(nr(An2.groups.kripto.d, 20) && nr(An2.sumD, 100) && An2.groups.kripto.noStoch === true, 'Stoch RSI bo‘lmasa d = normal (M=50), belgilanadi');
      r = await adm('POST', '/api/settings', { stoch: { rsi: 14, len: 14, k: 7, d: 3 } }); ok(r.s === 200, 'Stoch parametrlari saqlandi');
      r = await adm('POST', '/api/settings', { stoch: { rsi: 0, len: 14, k: 7, d: 3 } }); ok(r.s === 400, 'noto‘g‘ri Stoch parametri rad etildi');
      st = await adm('GET', '/api/state'); ok(st.j.settings.stoch && st.j.settings.stoch.k === 7 && st.j.stoch && typeof st.j.stoch === 'object' && st.j.settings.mainAsset, 'holatda stoch ma’lumoti va parametrlari bor');
      r = await adm('POST', '/api/stoch/refresh', {}); ok(r.s === 200 && r.j.stoch && r.j.stoch.kripto, 'Stoch RSI qo‘lda yangilanadi: ' + JSON.stringify((r.j.stoch || {}).kripto || {}).slice(0, 140));
      r = await cl2('POST', '/api/stoch/refresh', {}); ok(r.s === 403, 'mijoz Stoch RSI ni yangilay olmaydi');
    }

    { /* Shartnoma bandlari: ro'yxatdan o'tishda va qayta kirishda tasdiqlash */
      let c0 = await adm('GET', '/api/contract'); ok(c0.s === 200 && c0.j.items.length >= 5 && c0.j.full.length >= 10 && c0.j.ver >= 1, 'shartnoma bandlari ochiq ko‘rinadi: ' + c0.j.items.length + ' band');
      const nw = request => request; void nw;
      r = await cl('POST', '/api/register', { email: 'yangi@test.uz', password: 'Mijoz12345', name: 'Yangi Mijoz' }); ok(r.s === 400 && /Shartnoma/.test(r.j.error), 'rozilik belgilanmasa ro‘yxatdan o‘tib bo‘lmaydi');
      st = await cl2('GET', '/api/state'); ok(st.j.me.consent && st.j.me.consent.ok === true && !st.j.contract, 'ro‘yxatdan o‘tganda tasdiqlangan mijozga bandlar qayta ko‘rsatilmaydi');
      r = await cl2('POST', '/api/contract/admin', { show: [] }); ok(r.s === 403, 'mijoz shartnomani o‘zgartira olmaydi');
      r = await adm('POST', '/api/contract/admin', { show: c0.j.items.map(x => x.id).concat(['6.8']), texts: { '6.8': 'Davr ichida aktivlar qiymati 10% dan ko‘proq kamaysa, Boshqaruvchi 3 ish kuni ichida xabar qiladi.' } }); ok(r.s === 200 && r.j.changed && r.j.ver === c0.j.ver + 1, 'admin bandlarni o‘zgartirdi, versiya oshdi');
      st = await cl2('GET', '/api/state'); ok(st.j.me.consent.ok === false && st.j.contract && st.j.contract.items.some(x => x.id === '6.8'), 'qayta kirganda yangi versiya tasdiqlash uchun ko‘rsatiladi');
      r = await cl2('POST', '/api/alerts', { aid: 'x' }); ok(r.s === 403 && r.j.needConsent, 'tasdiqlamaguncha yozuv o‘zgartirish to‘xtatiladi');
      r = await cl2('POST', '/api/consent', { agree: true, ver: c0.j.ver }); ok(r.s === 400, 'eski versiyani tasdiqlab bo‘lmaydi');
      r = await cl2('POST', '/api/consent', { agree: false, ver: c0.j.ver + 1 }); ok(r.s === 400, 'rozilik belgilanmasa tasdiqlanmaydi');
      r = await cl2('POST', '/api/consent', { agree: true, ver: c0.j.ver + 1 }); ok(r.s === 200, 'mijoz yangi versiyani tasdiqladi');
      st = await cl2('GET', '/api/state'); ok(st.j.me.consent.ok === true, 'tasdiqlangach cheklov olinadi');
      r = await adm('GET', '/api/consents'); ok(r.s === 200 && r.j.list.filter(x => x.ver === c0.j.ver + 1).length === 1 && r.j.list.filter(x => x.ver === c0.j.ver).length >= 2 && r.j.list[0].ip !== undefined, 'tasdiqlash yozuvlari saqlanadi (eski versiyalari ham)');
      r = await adm('POST', '/api/contract/admin', { texts: { '10.3': 'Muassis ma’lumotlar to‘g‘riligi uchun javobgar.' } }); ok(r.s === 200 && r.j.changed, 'ko‘rsatiladigan band matni o‘zgarsa versiya oshadi');
      r = await adm('POST', '/api/contract/admin', { texts: { '4.3': 'Boshqa matn' } }); ok(r.s === 200 && !r.j.changed, 'ko‘rsatilmaydigan band o‘zgarsa versiya o‘zgarmaydi');
    }

    { /* PDF hisobotlar: mijozga va adminga */
      const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10), yy = today.slice(0, 4), mm = today.slice(0, 7), qq = yy + '-Q' + (Math.floor((+today.slice(5, 7) - 1) / 3) + 1);
      r = await adm('POST', '/api/reports/generate', { kind: 'oylik', ref: 'xx' }); ok(r.s === 400, 'noto‘g‘ri davr rad etildi');
      r = await adm('POST', '/api/reports/generate', { kind: 'chorak', ref: qq }); ok(r.s === 200 && r.j.made.length >= 1 && r.j.made.every(x => x.scope === 'client'), 'chorak hisobotlari mijoz hisoblari uchun tayyorlandi: ' + (r.j.made || []).length);
      r = await adm('POST', '/api/reports/generate', { kind: 'oylik', ref: mm }); ok(r.s === 200 && r.j.made.length >= 1, 'oylik hisobot tayyorlandi');
      r = await adm('POST', '/api/reports/generate', { kind: 'yillik', ref: yy }); ok(r.s === 200 && r.j.made.length >= 1, 'yillik hisobot tayyorlandi');
      r = await adm('POST', '/api/reports/generate', { kind: 'napp', ref: qq }); ok(r.s === 200 && r.j.made.length === 1 && r.j.made[0].scope === 'admin', 'NAPP hujjati admin uchun tayyorlandi');
      r = await adm('POST', '/api/reports/generate', { kind: 'soliq', ref: qq }); ok(r.s === 200 && r.j.made.length === 1 && r.j.made[0].scope === 'admin', 'soliq hujjati admin uchun tayyorlandi');
      const L = await adm('GET', '/api/reports'); ok(L.s === 200 && L.j.list.length >= 5 && L.j.conf && L.j.conf.rate.minOwn === 5, 'admin barcha hujjatlarni ko‘radi');
      const nappId = L.j.list.filter(x => x.kind === 'napp')[0].id, clId = L.j.list.filter(x => x.scope === 'client')[0];
      const raw = async (c, id) => { const x = await fetch(base + '/api/reports/' + id + '/pdf', { headers: { cookie: c.ck() } }); return { s: x.status, b: Buffer.from(await x.arrayBuffer()), ct: x.headers.get('content-type') }; };
      let pdf = await raw(adm, nappId); ok(pdf.s === 200 && pdf.ct === 'application/pdf' && pdf.b.slice(0, 5).toString() === '%PDF-' && pdf.b.length > 3000, 'NAPP PDF fayli to‘g‘ri: ' + pdf.b.length + ' bayt');
      require('fs').writeFileSync(process.env.REP_OUT ? process.env.REP_OUT + '/napp.pdf' : '/dev/null', pdf.b);
      const Lc = await cl2('GET', '/api/reports'); ok(Lc.s === 200 && Lc.j.list.every(x => x.scope === 'client') && Lc.j.conf === undefined, 'mijoz faqat o‘z hisobotlarini ko‘radi (' + Lc.j.list.length + ')');
      pdf = await raw(cl2, nappId); ok(pdf.s === 403, 'mijoz admin hujjatini ocha olmaydi'); pdf = await raw(cl, nappId); ok(pdf.s === 403, 'operator ham admin hujjatini ocha olmaydi');
      const Lc2 = await cl('GET', '/api/reports'); ok(Lc2.j.list.every(x => x.scope === 'client'), 'operator admin hujjatlarini ro‘yxatda ko‘rmaydi');
      if (Lc.j.list.length) { pdf = await raw(cl2, Lc.j.list[0].id); ok(pdf.s === 200 && pdf.b.slice(0, 5).toString() === '%PDF-', 'mijoz o‘z PDF sini ocha oladi'); require('fs').writeFileSync(process.env.REP_OUT ? process.env.REP_OUT + '/client-' + Lc.j.list[0].kind + '.pdf' : '/dev/null', pdf.b); }
      const nb = (await adm('GET', '/api/reports')).j.list.length; r = await adm('POST', '/api/reports/generate', { kind: 'napp', ref: qq }); const na = (await adm('GET', '/api/reports')).j.list.length; ok(na === nb + 1, 'qayta tayyorlash yangi versiya qo‘shadi, eskisi o‘chmaydi');
      const made = await require('../server.js').reportLoop(); const na2 = (await adm('GET', '/api/reports')).j.list.length; ok(na2 >= na, 'avtomatik tsikl xatosiz ishladi');
      r = await adm('POST', '/api/settings', { rep: { co: { name: 'BARLOS MChJ', stir: '123456789' }, own: { charter: 5e9, retained: 2e8 }, rate: { mgmt: 1.5, custody: 0.05, success: 10, hurdle: 0, profitTax: 15, divTax: 5, vat: 12, minOwn: 5, limit: 40, days: 365 }, tax: { vatPayer: 'Tekshiring', vatExempt: 'Tekshiring' } } }); ok(r.s === 200, 'hisobot sozlamalari saqlandi');
      r = await adm('POST', '/api/settings', { rep: { rate: { mgmt: 500 } } }); ok(r.s === 400, 'noto‘g‘ri stavka rad etildi');
    }
    r = await adm('GET', '/api/sources/test'); ok(r.s === 200 && Array.isArray(r.j.results), 'manbalar diagnostikasi ishlaydi (tarmoqsiz ham)');
      r = await cl3('POST', '/api/register', { email: 'mijoz3@test.uz', password: 'Mijoz12345', name: 'Mijoz Uch', agree: true }); ok(r.s === 200, 'mijoz3');
      /* 2.11: umumiy omonat signali: mijozlarga taqsimlab bir yo'la yozish */
      { const accBtc = (await cl('GET', '/api/state')).j.accounts[0].id; const d0 = Date.now() - 70 * 864e5, Cd = require('../public/core.js'), near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e); const acc2 = (await cl3('GET', '/api/state')).j.accounts[0].id, acc1 = (await cl2('GET', '/api/state')).j.accounts[0].id; r = await adm('POST', '/api/assets', { sym: 'OMN8', name: 'Ikkinchi omonat', group: 'omonat', curr: 'UZS', price: 1, rate: 20, dpay: 'monthly', target: 0 }); ok(r.s === 200, 'OMN8'); st = await adm('GET', '/api/state'); const oid = st.j.assets.filter(a => a.sym === 'OMN8')[0].id;
        r = await adm('POST', '/api/tx', { acc: acc2, aid: oid, type: 'DEPOZIT', amount: 5000000, price: 1, cash: false, t: d0 }); ok(r.s === 200, '2-mijoz omonatga depozit: ' + JSON.stringify(r.j));
        r = await adm('POST', '/api/tx', { acc: acc1, aid: oid, type: 'DEPOZIT', amount: 15000000, price: 1, cash: false, t: d0 }); ok(r.s === 200, '1-mijoz omonatga depozit: ' + JSON.stringify(r.j));
        r = await adm('GET', '/api/deposits'); const pend = r.j.due.filter(x => x.aid === oid && !x.done && x.days <= 0 && x.amt > 0).sort((a, b) => a.date < b.date ? -1 : 1), dt = pend[0].date, grp = pend.filter(x => x.date === dt);
        ok(grp.length === 2 && new Set(grp.map(x => x.acc)).size === 2, 'signal ikki mijozga taqsimlangan: ' + grp.length);
        { const later = pend.filter(x => x.date > dt)[0]; if (later) { r = await adm('POST', '/api/deposits/accept-group', { aid: oid, date: later.date }); ok(r.s === 400 && /oldingi/.test(r.j.error), 'oldingi sanasiz umumiy signal rad'); } }
        r = await adm('POST', '/api/deposits/accept-group', { aid: oid, date: dt }); ok(r.s === 200 && r.j.ids.length === 2, 'umumiy signal tasdiqlandi: ' + JSON.stringify(r.j) + JSON.stringify(grp));
        r = await adm('POST', '/api/deposits/accept-group', { aid: oid, date: dt }); ok(r.s === 400, 'umumiy signal ikki marta yozilmaydi');
        r = await cl3('POST', '/api/deposits/accept-group', { aid: oid, date: dt }); ok(r.s === 403, 'mijoz umumiy signalni tasdiqlay olmaydi: ' + r.s + JSON.stringify(r.j));
        /* aktiv statistikasi */
        st = await adm('GET', '/api/state'); const SA = { fx: st.j.settings.fx, assets: st.j.assets, accounts: st.j.accounts, tx: st.j.tx }, bt = SA.assets.filter(a => a.sym === 'BTC')[0], as = Cd.assetStats(SA, SA.accounts.filter(a => a.id === accBtc), bt, Date.now());
        ok(as.qty > 0 && near(as.total, as.realized + as.unreal + as.income, 1), 'aktiv daromadi: realizatsiya + baholash + foiz = jami: ' + as.total + ' vs ' + (as.realized + as.unreal + as.income));
        const om = SA.assets.filter(a => a.id === oid)[0], os = Cd.assetStats(SA, SA.accounts.filter(a => a.id === acc1), om, Date.now()); ok(os.inn >= 15000000 && os.coef > 0.5 && near(os.total, os.realized + os.unreal + os.income, 1), 'omonat statistikasi: ' + JSON.stringify([os.inn, os.coef, os.total, os.realized, os.unreal, os.income, os.cost, os.value, os.out]));
        r = await adm('POST', '/api/assets', { id: bt.id, sym: 'BTC', group: 'kripto', curr: 'USD', isin: 'uz1234567890', issuer: 'Test Emitent' }); ok(r.s === 200, 'ISIN saqlandi: ' + JSON.stringify(r.j)); st = await cl2('GET', '/api/state'); ok(st.j.assets.filter(a => a.sym === 'BTC')[0].isin === 'UZ1234567890', 'mijoz ISIN ni ko‘radi'); }
      /* 2.11: profil */
      { r = await cl4('POST', '/api/register', { email: 'mijoz4@test.uz', password: 'Mijoz12345', name: 'Mijoz To‘rt', agree: true }); ok(r.s === 200, 'mijoz4'); const cA = cl3, cB = cl4; const me1 = (await cA('GET', '/api/state')).j.me, me2 = (await cB('GET', '/api/state')).j.me, admMe = (await adm('GET', '/api/state')).j.me;
        r = await cA('POST', '/api/me/profile', { username: 'Aziz_Invest', bio: 'Salom' }); ok(r.s === 200 && r.j.profile.username === 'aziz_invest', 'username saqlandi: ' + JSON.stringify(r.j));
        r = await cB('POST', '/api/me/profile', { username: 'aziz_invest' }); ok(r.s === 400, 'username band');
        r = await cB('POST', '/api/me/profile', { username: '1ab' }); ok(r.s === 400, 'username formati');
        r = await cB('POST', '/api/me/profile', { username: 'admin' }); ok(r.s === 400, 'zahiradagi username');
        r = await cA('POST', '/api/me/profile', { username: 'aziz2' }); ok(r.s === 200, 'username o‘zgartirildi'); st = await cA('GET', '/api/state'); ok(st.j.me.id === me1.id && st.j.me.username === 'aziz2', 'ID o‘zgarmadi');
        const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG'), Buffer.alloc(300, 1)]).toString('base64');
        r = await cA('POST', '/api/me/avatar', { data: png }); ok(r.s === 200 && r.j.av > 0, 'rasm yuklandi'); r = await cA('POST', '/api/me/avatar', { data: 'data:image/png;base64,AAAA' }); ok(r.s === 400, 'noto‘g‘ri rasm rad');
        const gi = await fetch(base + '/api/avatar/' + me1.id, { headers: { cookie: cA.ck() } }); ok(gi.status === 200 && /image\/png/.test(gi.headers.get('content-type')), 'avatar xizmat qiladi');
        /* ---- chat ---- */
        r = await cB('GET', '/api/chat/users?q=aziz2'); ok(r.s === 200 && r.j.users.length === 1 && !('email' in r.j.users[0]), 'aniq username topiladi, email yo‘q: ' + JSON.stringify(r.j));
        r = await cB('GET', '/api/chat/users?q=azi'); ok(r.j.users.length === 0, 'findable emas: qisman qidiruvda topilmaydi: ' + JSON.stringify(r.j));
        r = await cB('POST', '/api/chat/dm', { to: '@aziz2' }); ok(r.s === 200, 'DM yaratildi'); const dm = r.j.id;
        r = await cB('POST', '/api/chat/' + dm + '/send', { text: 'Salom!' }); ok(r.s === 200 && r.j.msg.seq === 1, 'DM yuborildi');
        r = await cA('POST', '/api/chat/' + dm + '/send', { text: 'Va alaykum' }); ok(r.s === 200 && r.j.msg.seq === 2, 'javob: ' + r.s + JSON.stringify(r.j)); r = await cA('GET', '/api/chat/' + dm); ok(r.j.msgs.length === 2 && r.j.msgs[1].prev === r.j.msgs[0].hash, 'hash zanjiri ulangan');
        r = await adm('GET', '/api/chat/' + dm); ok(r.s === 403, 'begona chatni o‘qiy olmaydi (admin ham a’zo bo‘lmasa)');
        await cA('POST', '/api/me/profile', { dm: 'staff' }); r = await cB('POST', '/api/chat/' + dm + '/send', { text: 'yana' }); ok(r.s === 403, 'faqat xodimlardan qabul qilish: ' + r.s + JSON.stringify(r.j));
        await cA('POST', '/api/me/profile', { dm: 'all' });
        r = await adm('POST', '/api/chat/dm', { to: me1.id }); ok(r.s === 200, 'xodim istalgan mijozga yoza oladi');
        r = await adm('POST', '/api/chat/create', { type: 'channel', title: 'BARLOS yangiliklari', public: true, disc: true }); ok(r.s === 200 && r.j.disc, 'kanal + muhokama guruhi: ' + JSON.stringify(r.j)); const ch = r.j.id, gp = r.j.disc;
        r = await cA('GET', '/api/chat/list'); ok(r.j.dir.some(c => c.id === ch), 'ochiq kanal katalogda');
        r = await cA('POST', '/api/chat/join', { id: ch }); ok(r.s === 200, 'kanalga qo‘shildi: ' + r.s + JSON.stringify(r.j));
        r = await cA('POST', '/api/chat/' + ch + '/send', { text: 'men yozaman' }); ok(r.s === 403, 'kanalga faqat admin yozadi');
        r = await adm('POST', '/api/chat/' + ch + '/send', { text: 'Yangi omonat stavkasi' }); ok(r.s === 200, 'kanal posti');
        r = await cA('GET', '/api/chat/' + gp); const mir = r.j.msgs.filter(m => m.fwd)[0]; ok(r.s === 200 && mir && mir.fwd.chat === ch, 'post muhokama guruhiga ko‘chdi');
        r = await cA('POST', '/api/chat/' + gp + '/send', { text: 'Rahmat', reply: mir.seq }); ok(r.s === 200, 'izoh'); r = await cA('GET', '/api/chat/' + ch); ok(r.j.msgs.filter(m => !m.sys)[0].cc === 1, 'izohlar soni kanal postida');
        r = await cA('POST', '/api/chat/' + gp + '/members', { add: [me2.id] }); ok(r.s === 403, 'oddiy a’zo qo‘sha olmaydi');
        r = await cA('POST', '/api/chat/create', { type: 'group', title: 'Investorlar', members: [me2.id] }); ok(r.s === 200, 'mijoz guruh yaratdi'); const grp2 = r.j.id; r = await cB('GET', '/api/chat/' + grp2); ok(r.s === 200 && r.j.chat.role === 'member', 'a’zo guruhni ko‘radi');
        r = await cB('POST', '/api/chat/' + grp2 + '/send', { text: 'x'.repeat(4001) }); ok(r.s === 400, 'uzun xabar rad');
        const Ch = require('../src/chat'), dbm = require('../src/db');
        ok(Ch.verify(dm).ok && Ch.verify(ch).ok && Ch.verify(grp2).ok, 'zanjirlar butun');
        const m1 = dbm.get('cmsg', Ch.mid(dm, 1)); m1.text = 'Soxta matn'; dbm.put('cmsg', m1, true); let vr = Ch.verify(dm); ok(!vr.ok && vr.broken === 1, 'o‘zgartirilgan xabar aniqlandi: ' + JSON.stringify(vr));
        m1.text = 'Salom!'; dbm.put('cmsg', m1, true); ok(Ch.verify(dm).ok, 'tiklangach zanjir butun');
        dbm.db.prepare("DELETE FROM docs WHERE coll='cmsg' AND id=?").run(Ch.mid(dm, 2)); vr = Ch.verify(dm); ok(!vr.ok, 'o‘chirilgan xabar aniqlandi: ' + vr.why);
        const m3 = dbm.get('cmsg', Ch.mid(grp2, 1)); const keep = m3.sig; m3.sig = 'x'.repeat(32); dbm.put('cmsg', m3, true); ok(!Ch.verify(grp2).ok, 'imzo buzilishi aniqlandi'); m3.sig = keep; dbm.put('cmsg', m3, true);
        r = await cA('GET', '/api/chat/' + grp2 + '/verify'); ok(r.s === 200 && r.j.ok, 'verify API'); }
  } catch (e) { fail++; console.log('ISTISNO', e); }
  console.log('Natija: ' + pass + ' o‘tdi, ' + fail + ' xato'); srv.close(); process.exit(fail ? 1 : 0);
});
