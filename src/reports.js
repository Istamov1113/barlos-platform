'use strict';
/* Avtomatik hisobotlar (PDF). Shakllar: BARLOS_hisobot_shakllari.xlsx (F1-F9).
   Mijozga (hisobiga saqlanadi): oylik (F9+F4), chorak (F3+F4+F5+F9+F7), yillik (F3+F5+F7).
   Adminga: NAPP uchun (F1+F2+F8), soliq uchun (F6+F7 jamlanma).
   Hisob-kitob tranzaksiyalar jurnalidan va saqlangan tarixiy narxlardan olinadi. Tarixiy narx topilmasa joriy narx ishlatiladi va hisobotda belgilanadi. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const hist = require('./hist');
const Core = require('../public/core.js');

const DAY = 864e5, TZ = 5 * 3600e3;
const dstr = ms => new Date(ms + TZ).toISOString().slice(0, 10);
const dnum = s => Core.dayNum(s);
const endMs = s => (dnum(s) + 1) * DAY - TZ - 1;      /* kun oxiri (Toshkent) */
const addD = (s, n) => Core.dayStr(dnum(s) + n);
const dmy = s => s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
const dir = () => { const d = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'reports'); fs.mkdirSync(d, { recursive: true }); return d; };

/* ---------- sozlamalar (admin kiritadi; standart qiymatlar xlsx "Kirish" varag'idan) ---------- */
const DEF = {
  co: { name: 'BARLOS', stir: '', license: '', head: '', accountant: '', address: '', phone: '' },
  own: { charter: 0, added: 0, reserve: 0, retained: 0, target: 0, provisions: 0, intangible: 0 },
  rate: { mgmt: 0, custody: 0, success: 10, hurdle: 0, profitTax: 15, divTax: 5, vat: 12, minOwn: 5, limit: 40, days: 365 },
  tax: { vatPayer: 'Tekshiring', vatExempt: 'Tekshiring', direct: 0, general: 0 },
  f8: {}
};
function conf(st) {
  const r = (st && st.rep) || {}, m = (a, b) => Object.assign({}, a, b || {});
  return { co: m(DEF.co, r.co), own: m(DEF.own, r.own), rate: m(DEF.rate, r.rate), tax: m(DEF.tax, r.tax), f8: r.f8 || {} };
}

/* ---------- davrlar ---------- */
function periodOf(kind, ref) {
  let m;
  if (kind === 'oylik' && (m = /^(\d{4})-(\d{2})$/.exec(ref))) { const y = +m[1], mo = +m[2], from = ref + '-01', to = Core.dayStr(Math.floor(Date.UTC(y, mo, 0) / DAY)); return { from, to, label: mo + '-oy ' + y }; }
  if ((kind === 'chorak' || kind === 'napp' || kind === 'soliq') && (m = /^(\d{4})-Q([1-4])$/.exec(ref))) { const y = +m[1], q = +m[2], from = y + '-' + String(q * 3 - 2).padStart(2, '0') + '-01', to = Core.dayStr(Math.floor(Date.UTC(y, q * 3, 0) / DAY)); return { from, to, label: q + '-chorak ' + y }; }
  if (kind === 'yillik' && (m = /^(\d{4})$/.exec(ref))) return { from: ref + '-01-01', to: ref + '-12-31', label: ref + '-yil' };
  throw new Error('Davr noto‘g‘ri: ' + kind + ' ' + ref);
}
function prevMonth(today) { const y = +today.slice(0, 4), m = +today.slice(5, 7); return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0'); }
function prevQuarter(today) { const y = +today.slice(0, 4), q = Math.floor((+today.slice(5, 7) - 1) / 3) + 1; return q === 1 ? (y - 1) + '-Q4' : y + '-Q' + (q - 1); }
function quarterBefore(ref, n) { let y = +ref.slice(0, 4), q = +ref.slice(6); q -= n; while (q < 1) { q += 4; y--; } return y + '-Q' + q; }

/* ---------- baholash ---------- */
function priceAt(x, day, meta) {
  if (x.group === 'naqd' || x.group === 'omonat' || x.group === 'obligatsiya') return x.price;
  const t = dnum(day) * 86400, c = hist.get(x.id); let best = null;
  for (let i = c.length - 1; i >= 0; i--) if (c[i].t <= t) { best = c[i]; break; }
  if (best && t - best.t <= 10 * 86400) return best.c;
  if (meta) meta.est = (meta.est || 0) + 1;
  return x.price;
}
/* hisob qiymati va tarkibi `day` kuni oxiriga */
function viewAt(S, acc, day, meta) {
  const T = endMs(day), S2 = Object.assign({}, S, { now: T, tx: S.tx.filter(t => t.t <= T), assets: S.assets.map(x => Object.assign({}, x, { price: priceAt(x, day, meta) })) });
  const V = Core.view(S2, acc); V.S2 = S2; V.day = day; return V;
}
const fxU = S => Core.fxOf(S, 'USD');
const toUzs = (S, x, amt, price) => amt * (price != null ? price : (x.price || 1)) * Core.fxOf(S, x.curr);

/* ---------- bitta hisob bo'yicha davr hisobi (F3/F9/F5/F7 uchun) ---------- */
function accountPeriod(S, acc, per, cfg, meta) {
  const open = viewAt(S, acc, addD(per.from, -1), meta), close = viewAt(S, acc, per.to, meta), T0 = endMs(addD(per.from, -1)), T1 = endMs(per.to);
  const am = Core.assetMap(S), inP = S.tx.filter(t => t.acc === acc.id && t.status === 'Bajarildi' && t.t > T0 && t.t <= T1).sort((a, b) => a.t - b.t);
  const flows = [], r = { acc, per, open: open.T, close: close.T, openV: open, closeV: close, flows, dep: 0, wd: 0, div: 0, omInt: 0, coupon: 0, realized: 0, brokerage: 0, buys: 0, sells: 0, n: inP.length, est: 0 };
  inP.forEach(t => {
    const x = am[t.aid]; if (!x) return; const fx = Core.fxOf(S, x.curr);
    if (t.type === 'DEPOZIT') { flows.push({ t: t.t, uzs: t.uzs || 0 }); r.dep += t.uzs || 0; }
    else if (t.type === 'WITHDRAW') { flows.push({ t: t.t, uzs: -(t.uzs || 0) }); r.wd += t.uzs || 0; }
    else if (t.type === 'DIVIDEND') r.div += t.amount * fx * (x.price || 1);
    else if (t.type === 'FOIZ') r.omInt += t.amount * fx * (x.price || 1);
    else if (t.type === 'KUPON') r.coupon += t.amount * fx;
    else if (t.type === 'SELL') {
      const pre = Core.position(Object.assign({}, S, { tx: S.tx.filter(q => q.acc === acc.id && q.status === 'Bajarildi' && q.t < t.t) }), acc.id).avg[x.id];
      if (pre != null) r.realized += (t.price - pre) * t.amount * fx; r.sells += t.amount * t.price * fx;
    } else if (t.type === 'BUY') r.buys += t.amount * t.price * fx;
    if (t.fee) { const inKind = t.feeAsset && t.feeAsset === x.sym; r.brokerage += inKind ? t.fee * (t.price || x.price || 1) * fx : t.fee * (t.feeAsset === 'UZS' ? 1 : fxU(S)); }
  });
  const days = dnum(per.to) - dnum(per.from) + 1, net = r.dep - r.wd, income = r.div + r.omInt + r.coupon;
  r.days = days; r.net = net; r.income = income;
  r.unreal = r.close - r.open - net - income - r.realized + r.brokerage;      /* qayta baholash natijasi: qolgan farq */
  r.gain = r.close - r.open - net;                                          /* kiritish-yechishsiz sof natija */
  let wcap = r.open; flows.forEach(f => { wcap += f.uzs * (T1 - f.t) / Math.max(1, T1 - T0); });
  r.wcap = wcap; r.dietz = wcap > 0 ? r.gain / wcap : 0;
  r.bench = (Core.BENCHC.rate || 0) / 100 * days / cfg.rate.days;
  r.gross = wcap > 0 ? (income + r.realized + r.unreal) / wcap : 0;
  /* xarajatlar (F5) */
  const nav = (r.open + r.close) / 2, y = cfg.rate.days;
  r.nav = nav; r.mgmt = nav * cfg.rate.mgmt / 100 * days / y; r.custody = nav * cfg.rate.custody / 100 * days / y;
  r.succBase = Math.max(0, r.gross - cfg.rate.hurdle / 100 * days / y) * nav; r.succ = r.succBase * cfg.rate.success / 100;
  r.costs = r.mgmt + r.succ + r.custody + r.brokerage; r.costPct = nav > 0 ? r.costs / nav : 0; r.costYear = r.days > 0 ? r.costPct * y / r.days : 0;
  r.dropped = r.open > 0 && (r.open - r.close) / r.open > 0.10;
  return r;
}
function assetLevel(x) { return (x.group === 'kripto' || x.group === 'xalqaro' || x.group === 'milliy' || x.group === 'metall' || x.group === 'naqd') ? 1 : 2; }
function methodOf(x) { return { kripto: 'Birja narxi (Binance/Bitget)', xalqaro: 'Birja narxi', milliy: 'UzSE o‘rtacha narxi', metall: 'Birja narxi', omonat: 'Nominal + hisoblangan foiz', obligatsiya: 'Bozor narxi / nominal', naqd: 'Nominal' }[x.group] || '—'; }
function typeF1(x) { return { milliy: 'Aksiya (listingdagi)', xalqaro: 'Aksiya (listingdagi)', obligatsiya: 'Korporativ obligatsiya', omonat: 'Pul mablag‘i', naqd: 'Pul mablag‘i' }[x.group] || 'Boshqa'; }

/* ---------- PDF yordamchilari ---------- */
let PDFDocument = null;
function pdfkit() { if (!PDFDocument) { try { PDFDocument = require('pdfkit'); } catch (e) { throw new Error('PDF uchun "pdfkit" o‘rnatilmagan: serverda "npm install" ni ishga tushiring.'); } } return PDFDocument; }
const FD = path.join(__dirname, '..', 'assets', 'fonts'), LOGO = path.join(__dirname, '..', 'public', 'logo.jpg');
const GOLD = '#B8902E', INK = '#15120B', MUTED = '#6B6350', LINE = '#D9D2BF', BAND = '#F6F1E3', RED = '#A3281F', GREEN = '#1B7A4B';
const nf = (v, d) => { if (v == null || !isFinite(v)) return '—'; const s = Math.abs(v).toFixed(d == null ? 0 : d), p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return (v < 0 && +s !== 0 ? '−' : '') + p.join('.'); };
const pc = (v, d) => v == null || !isFinite(v) ? '—' : nf(v * 100, d == null ? 2 : d) + '%';
const qx = (x, v) => (x.group === 'omonat' || x.group === 'naqd' || x.group === 'obligatsiya') ? (v == null ? '—' : nf(v, 2).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')) : qf(v);
const qf = v => { if (v == null) return '—'; let s = (+v).toFixed(8); s = s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, ''); const p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join('.'); };

function newDoc(meta) {
  const PD = pdfkit(), doc = new PD({ size: 'A4', margin: 40, bufferPages: true, info: { Title: meta.title, Author: meta.author || 'BARLOS', Subject: meta.subject || '', Creator: 'BARLOS' } });
  doc.registerFont('R', path.join(FD, 'DejaVuSans.ttf')); doc.registerFont('B', path.join(FD, 'DejaVuSans-Bold.ttf')); doc.font('R').fontSize(9).fillColor(INK);
  doc._m = meta; return doc;
}
function header(doc, title, sub) {
  const w = doc.page.width - 80; try { doc.image(LOGO, 40, 34, { width: 34, height: 34 }); } catch (e) { /* logotip ixtiyoriy */ }
  doc.font('B').fontSize(15).fillColor(GOLD).text('BARLOS', 82, 36, { characterSpacing: 2 }); doc.font('R').fontSize(8).fillColor(MUTED).text(doc._m.co && doc._m.co !== 'BARLOS' ? doc._m.co : 'Investitsiya aktivlarining ishonchli boshqaruvchisi', 82, 54);
  doc.moveTo(40, 78).lineTo(40 + w, 78).lineWidth(1.2).strokeColor(GOLD).stroke();
  doc.font('B').fontSize(14).fillColor(INK).text(title, 40, 90, { width: w }); if (sub) doc.font('R').fontSize(9).fillColor(MUTED).text(sub, 40, doc.y + 2, { width: w });
  doc.moveDown(0.8); doc.fillColor(INK);
}
function h2(doc, t) { ensure(doc, 60); doc.moveDown(0.6); doc.font('B').fontSize(11).fillColor(GOLD).text(t, 40); doc.moveTo(40, doc.y + 1).lineTo(doc.page.width - 40, doc.y + 1).lineWidth(0.5).strokeColor(LINE).stroke(); doc.moveDown(0.4); doc.font('R').fontSize(9).fillColor(INK); }
function note(doc, t, col) { ensure(doc, 30); doc.font('R').fontSize(8).fillColor(col || MUTED).text(t, 40, doc.y + 2, { width: doc.page.width - 80 }); doc.fillColor(INK).fontSize(9); doc.moveDown(0.3); }
function ensure(doc, h) { if (doc.y + h > doc.page.height - 56) { doc.addPage(); doc.y = 46; } }
/* jadval: cols=[{h, w (nisbiy), a:'l'|'r'|'c'}], rows=[[...]] yoki {cells, b:true, shade:true, color} */
function table(doc, cols, rows, opt) {
  opt = opt || {}; const W = doc.page.width - 80, tot = cols.reduce((s, c) => s + (c.w || 1), 0), xs = []; let x = 40; const ws = cols.map(c => (c.w || 1) / tot * W); ws.forEach(w => { xs.push(x); x += w; });
  const fs = opt.fs || 8, pad = 3;
  const drawRow = (cells, o) => {
    o = o || {}; doc.font(o.b ? 'B' : 'R').fontSize(fs);
    let h = 0; cells.forEach((c, i) => { const hh = doc.heightOfString(String(c == null ? '' : c), { width: ws[i] - pad * 2 }); if (hh > h) h = hh; }); h += pad * 2;
    if (doc.y + h > doc.page.height - 56) { doc.addPage(); doc.y = 46; if (!o.head) drawRow(cols.map(c => c.h), { head: true, b: true }); doc.font(o.b ? 'B' : 'R').fontSize(fs); }
    const y = doc.y; if (o.head) doc.rect(40, y, W, h).fill(INK); else if (o.shade) doc.rect(40, y, W, h).fill(BAND);
    cells.forEach((c, i) => { doc.fillColor(o.head ? '#FFFFFF' : (o.color || INK)).text(String(c == null ? '' : c), xs[i] + pad, y + pad, { width: ws[i] - pad * 2, align: (cols[i].a === 'r' ? 'right' : cols[i].a === 'c' ? 'center' : 'left') }); });
    doc.y = y + h; if (!o.head) doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).lineWidth(0.3).strokeColor(LINE).stroke(); doc.fillColor(INK);
  };
  drawRow(cols.map(c => c.h), { head: true, b: true });
  rows.forEach(r => { if (Array.isArray(r)) drawRow(r); else drawRow(r.cells, r); });
  doc.font('R').fontSize(9); doc.y += 4;
}
function kv(doc, pairs, w1) { pairs.forEach(p => { ensure(doc, 14); const y = doc.y; doc.font('R').fontSize(9).fillColor(MUTED).text(p[0], 40, y, { width: w1 || 230 }); doc.font('B').fillColor(p[2] || INK).text(String(p[1]), 40 + (w1 || 230), y, { width: doc.page.width - 80 - (w1 || 230) }); doc.y = Math.max(doc.y, y + 12); }); doc.font('R').fillColor(INK); doc.moveDown(0.3); }
function signLine(doc, who) { ensure(doc, 50); doc.moveDown(1.2); const y = doc.y; who.forEach((w, i) => { const x = 40 + i * 250; doc.moveTo(x, y + 14).lineTo(x + 170, y + 14).lineWidth(0.5).strokeColor(MUTED).stroke(); doc.font('R').fontSize(8).fillColor(MUTED).text(w, x, y + 17); }); doc.y = y + 34; doc.fillColor(INK).fontSize(9); }
function finish(doc, cfgNote) {
  return new Promise((resolve, reject) => {
    const chunks = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const rg = doc.bufferedPageRange(), n = rg.count;
    for (let i = 0; i < n; i++) { doc.switchToPage(rg.start + i); doc.page.margins.bottom = 0; doc.font('R').fontSize(7.5).fillColor(MUTED); doc.text('BARLOS avtomatik hisoboti · ' + (doc._m.stamp || '') + (cfgNote ? ' · ' + cfgNote : ''), 40, doc.page.height - 34, { width: doc.page.width - 160, lineBreak: false }); doc.text((i + 1) + ' / ' + n, doc.page.width - 100, doc.page.height - 34, { width: 60, align: 'right', lineBreak: false }); }
    doc.end();
  });
}

/* ---------- mijoz hisobotlari ---------- */
function bridgeRows(r) {
  const rows = [['Davr boshidagi qiymat', nf(r.open)], ['+ Kiritilgan mablag‘lar', nf(r.dep)], ['− Yechib olingan mablag‘lar', nf(-r.wd)], ['+ Dividend daromadi', nf(r.div)], ['+ Foiz daromadi (omonat)', nf(r.omInt)], ['+ Kupon daromadi (obligatsiya)', nf(r.coupon)],
    ['+ Realizatsiya qilingan foyda / (zarar)', nf(r.realized)], ['+ Qayta baholash natijasi (realizatsiya qilinmagan)', nf(r.unreal)], ['− Brokerlik va birja komissiyasi (bitimlarda ushlangan)', nf(-r.brokerage)]];
  rows.push({ cells: ['Davr oxiridagi qiymat', nf(r.close)], b: true, shade: true });
  return rows;
}
function portfolioTable(doc, V, cfg, title) {
  h2(doc, title);
  const items = V.items.filter(i => Math.abs(i.qty) > 1e-12 || i.val > 0.5).sort((a, b) => b.val - a.val), T = V.T || 1, A = Core.assetMap(V.S2);
  const lim = cfg.rate.limit / 100, rows = [];
  items.forEach((i, k) => { const x = i.x, cost = i.avg ? i.qty * i.avg * Core.fxOf(V.S2, x.curr) : null, sh = i.val / T, over = x.group !== 'naqd' && sh > lim;
    rows.push([k + 1, x.sym + (x.name && x.name !== x.sym ? '\n' + x.name : ''), Core.GROUPS[x.group].name, qx(x, i.qty), cost != null ? nf(cost) : '—', nf(i.val), cost != null ? nf(i.val - cost) : '—', pc(sh), assetLevel(x), over ? 'LIMITDAN OSHDI' : '']); });
  rows.push({ cells: ['', 'JAMI', '', '', '', nf(V.T), '', pc(items.reduce((s, i) => s + i.val, 0) / T), '', ''], b: true, shade: true });
  table(doc, [{ h: '№', w: 0.4 }, { h: 'Aktiv', w: 2.2 }, { h: 'Turi', w: 1.4 }, { h: 'Soni', w: 1.3, a: 'r' }, { h: 'Tannarx (so‘m)', w: 1.5, a: 'r' }, { h: 'Baholangan qiymat (so‘m)', w: 1.7, a: 'r' }, { h: 'Qayta baholash', w: 1.4, a: 'r' }, { h: 'Ulush', w: 0.9, a: 'r' }, { h: 'Ierarx.', w: 0.7, a: 'c' }, { h: 'Limit', w: 1.2 }], rows, { fs: 7.5 });
  const lv = { 1: 0, 2: 0, 3: 0 }; items.forEach(i => { lv[assetLevel(i.x)] += i.val; });
  table(doc, [{ h: 'Baholash ierarxiyasi', w: 3 }, { h: 'Qiymat (so‘m)', w: 2, a: 'r' }, { h: 'Ulush', w: 1, a: 'r' }], [1, 2, 3].map(l => [l + (l === 1 ? ' — kotirovka / nominal' : l === 2 ? ' — kuzatiladigan' : ' — kuzatilmaydigan'), nf(lv[l]), pc(lv[l] / T)]));
  note(doc, 'Limit: bitta pozitsiya portfelning ' + cfg.rate.limit + '% idan oshmasligi kerak (pul mablag‘i hisobga olinmaydi). Aktivlar saqlangan tarixiy narxlarda baholandi.');
}
function f3(doc, r, cfg, S) {
  h2(doc, '1. Portfel qiymati harakati (so‘m)'); table(doc, [{ h: 'Ko‘rsatkich', w: 4 }, { h: 'Summa', w: 2, a: 'r' }], bridgeRows(r));
  h2(doc, '2. Daromadlilik (Modified Dietz)');
  kv(doc, [['Sof foyda (kiritish va yechishsiz)', nf(r.gain) + ' so‘m', r.gain >= 0 ? GREEN : RED], ['Vaznli kapital', nf(r.wcap) + ' so‘m'], ['Komissiyagacha daromad (gross)', pc(r.gross)], ['Sof daromad (Modified Dietz)', pc(r.dietz), r.dietz >= 0 ? GREEN : RED],
    ['Bazaviy ko‘rsatkich (omonat, yillik ' + (Core.BENCHC.rate || 0) + '%, davrga mutanosib)', pc(r.bench)], ['Sof daromad − bazaviy', pc(r.dietz - r.bench), r.dietz - r.bench >= 0 ? GREEN : RED]]);
  h2(doc, '3. Mablag‘ harakati (kiritish +, yechish −)');
  if (r.flows.length) table(doc, [{ h: 'Sana', w: 2 }, { h: 'Summa (so‘m)', w: 2, a: 'r' }, { h: 'Vazn', w: 1, a: 'r' }], r.flows.map(f => [dmy(dstr(f.t)), nf(f.uzs), (Math.max(0, (endMs(r.per.to) - f.t) / Math.max(1, endMs(r.per.to) - endMs(addD(r.per.from, -1))))).toFixed(4)])); else note(doc, 'Davr ichida mablag‘ kiritilmagan va yechilmagan.');
  h2(doc, '4. Qo‘shimcha ma’lumot');
  kv(doc, [['Davrda portfel qiymati 10% dan ko‘p pasaydimi?', r.dropped ? 'Ha (mijozga xabar beriladi)' : 'Yo‘q', r.dropped ? RED : INK], ['Davrdagi bitimlar soni', r.n]]);
}
function f5(doc, r, cfg) {
  h2(doc, 'Xarajat va haqlar (F5)');
  kv(doc, [['Davr kunlari', r.days], ['O‘rtacha NAV (boshi va oxiri o‘rtachasi)', nf(r.nav) + ' so‘m']]);
  table(doc, [{ h: 'Xarajat turi', w: 2.2 }, { h: 'Hisoblash asosi', w: 3 }, { h: 'Stavka', w: 1, a: 'r' }, { h: 'Summa (so‘m)', w: 1.6, a: 'r' }], [
    ['Boshqaruv haqi', 'Yillik % × o‘rtacha NAV × kun / ' + cfg.rate.days, cfg.rate.mgmt + '%', nf(r.mgmt)],
    ['Muvaffaqiyat haqi', 'Ulush × (daromad − hurdle ' + cfg.rate.hurdle + '%) × NAV', cfg.rate.success + '%', nf(r.succ)],
    ['Saqlash / depozitariy', 'Yillik % × o‘rtacha NAV × kun / ' + cfg.rate.days, cfg.rate.custody + '%', nf(r.custody)],
    ['Brokerlik va birja komissiyasi', 'Bitimlarda haqiqatda ushlangan', '', nf(r.brokerage)],
    { cells: ['JAMI xarajat', '', '', nf(r.costs)], b: true, shade: true }]);
  kv(doc, [['Jami xarajat / o‘rtacha NAV (davr)', pc(r.costPct, 4)], ['Yillik ekvivalent (jami xarajat koeffitsienti)', pc(r.costYear, 4)]]);
  note(doc, 'Boshqaruv va muvaffaqiyat haqi hisoblangan summa sifatida ko‘rsatilgan; u portfel qiymatidan avtomatik ushlanmaydi. Stavkalar shartnomaning 3-ilovasiga mos kiritiladi.');
}
function f7(doc, r, cfg, S) {
  h2(doc, 'Daromadlar bo‘yicha soliq ma’lumotnomasi (F7)');
  const divTax = r.div * cfg.rate.divTax / 100;
  table(doc, [{ h: 'Daromad turi', w: 3 }, { h: 'Summa (so‘m)', w: 2, a: 'r' }, { h: 'Soliq (taxminiy)', w: 2, a: 'r' }], [
    ['Dividendlar', nf(r.div), nf(divTax) + ' (' + cfg.rate.divTax + '%)'], ['Obligatsiya kuponi', nf(r.coupon), 'Soliq kodeksi bo‘yicha tekshiring'], ['Omonat foizi', nf(r.omInt), 'Soliq solinmaydi'],
    ['Realizatsiya foydasi / (zarari)', nf(r.realized), 'Soliq kodeksi bo‘yicha tekshiring'], { cells: ['Jami daromad', nf(r.div + r.omInt + r.coupon + r.realized), nf(divTax)], b: true, shade: true }]);
  kv(doc, [['Ushlab qolingan soliq (haqiqiy)', nf(0) + ' so‘m'], ['Soliqdan keyingi daromad (taxminiy)', nf(r.div + r.omInt + r.coupon + r.realized - divTax) + ' so‘m']]);
  note(doc, 'Omonat foiziga soliq solinmaydi, shuning uchun hisoblanmadi. Boshqa stavkalar va soliq agenti majburiyati Soliq kodeksiga qarab buxgalter bilan tasdiqlanadi.');
}
function f9(doc, S, acc, per, cfg, meta) {
  h2(doc, 'Oylik harakat (F9)');
  const ms = []; let d = dnum(per.from); const end = dnum(per.to);
  while (d <= end) { const f = Core.dayStr(d), y = +f.slice(0, 4), mo = +f.slice(5, 7), to = Core.dayStr(Math.floor(Date.UTC(y, mo, 0) / DAY)); ms.push(accountPeriod(S, acc, periodOf('oylik', f.slice(0, 7)), cfg, meta)); d = dnum(to) + 1; }
  const cols = [{ h: 'Ko‘rsatkich (so‘m)', w: 3 }].concat(ms.map(m => ({ h: m.per.label, w: 1.6, a: 'r' }))); if (ms.length > 1) cols.push({ h: 'Davr jami', w: 1.6, a: 'r' });
  const L = [['Oy boshidagi qiymat', m => m.open, ms[0].open], ['+ Kiritilgan', m => m.dep], ['− Yechib olingan', m => -m.wd], ['+ Dividend', m => m.div], ['+ Foiz va kupon', m => m.omInt + m.coupon], ['+ Realizatsiya', m => m.realized], ['+ Qayta baholash', m => m.unreal], ['− Komissiya', m => -m.brokerage]];
  const rows = L.map(l => [l[0]].concat(ms.map(m => nf(l[1](m)))).concat(ms.length > 1 ? [nf(l[2] != null ? l[2] : ms.reduce((s, m) => s + l[1](m), 0))] : []));
  rows.push({ cells: ['Oy oxiridagi qiymat'].concat(ms.map(m => nf(m.close))).concat(ms.length > 1 ? [nf(ms[ms.length - 1].close)] : []), b: true, shade: true });
  rows.push(['Sof foyda (kiritish-yechishsiz)'].concat(ms.map(m => nf(m.gain))).concat(ms.length > 1 ? [nf(ms.reduce((s, m) => s + m.gain, 0))] : []));
  rows.push(['Daromadlilik (Dietz)'].concat(ms.map(m => pc(m.dietz))).concat(ms.length > 1 ? [pc(ms.reduce((p, m) => p * (1 + m.dietz), 1) - 1)] : []));
  table(doc, cols, rows);
}
function estNote(doc, meta) { if (meta.est) note(doc, 'Diqqat: ' + meta.est + ' ta narx uchun saqlangan tarixiy narx topilmadi, joriy narx ishlatildi. Dollar kursi hisobot sanasidagi emas, joriy kurs bo‘yicha olingan.', RED); }

async function clientDoc(S, acc, kind, ref, cfg, stamp, owner) {
  const per = periodOf(kind, ref), meta = {}, r = accountPeriod(S, acc, per, cfg, meta), title = { oylik: 'Oylik hisobot', chorak: 'Chorak hisoboti', yillik: 'Yillik hisobot va soliq ma’lumotnomasi' }[kind];
  const doc = newDoc({ title: title + ' · ' + owner + ' · ' + per.label, stamp, co: cfg.co.name });
  header(doc, title + ': ' + per.label, 'Mijoz: ' + owner + ' · Hisob: ' + acc.name + ' (' + acc.id + ') · Shartnoma № IB-' + acc.id + '/' + per.to.slice(0, 4) + ' · Davr: ' + dmy(per.from) + ' – ' + dmy(per.to));
  if (kind === 'oylik') { f3(doc, r, cfg, S); portfolioTable(doc, r.closeV, cfg, 'Portfel tarkibi (davr oxiriga)'); f9(doc, S, acc, per, cfg, meta); }
  else if (kind === 'chorak') { f3(doc, r, cfg, S); portfolioTable(doc, r.closeV, cfg, 'Portfel tarkibi va baholash (F4)'); f5(doc, r, cfg); f9(doc, S, acc, per, cfg, meta); f7(doc, r, cfg, S); }
  else { f3(doc, r, cfg, S); f5(doc, r, cfg); f7(doc, r, cfg, S); portfolioTable(doc, r.closeV, cfg, 'Yil oxiridagi portfel (F4)');
    h2(doc, 'Choraklar kesimida'); const qs = [1, 2, 3, 4].map(q => accountPeriod(S, acc, periodOf('chorak', ref + '-Q' + q), cfg, meta)); table(doc, [{ h: 'Chorak', w: 1 }, { h: 'Boshida', w: 1.6, a: 'r' }, { h: 'Kiritish − yechish', w: 1.6, a: 'r' }, { h: 'Oxirida', w: 1.6, a: 'r' }, { h: 'Sof foyda', w: 1.6, a: 'r' }, { h: 'Daromadlilik', w: 1.1, a: 'r' }], qs.map(q => [q.per.label.slice(0, 8), nf(q.open), nf(q.net), nf(q.close), nf(q.gain), pc(q.dietz)])); }
  estNote(doc, meta);
  note(doc, 'Hisobotni olgan kundan boshlab shartnomadagi muddat ichida e‘tiroz bildirilmasa, hisobot tasdiqlangan hisoblanadi (shartnoma 6.7-band). Bu hisobot avtomatik tayyorlangan, daromad kafolatlanmaydi.');
  signLine(doc, ['Boshqaruvchi: ' + (cfg.co.head || '____________') + '   M.O‘.', 'Sana: ' + dmy(dstr(Date.now()))]);
  return { buf: await finish(doc), r };
}

/* ---------- admin hujjatlari ---------- */
function clientAccounts(S) { return S.accounts.filter(a => !a.archived && (S.tx.some(t => t.acc === a.id))); }
async function nappDoc(S, ref, cfg, stamp) {
  const per = periodOf('napp', ref), meta = {}, accs = clientAccounts(S), qs = [0, 1, 2, 3].map(n => quarterBefore(ref, n)), endsA = qs.map(q => periodOf('napp', q).to);
  const doc = newDoc({ title: 'NAPP uchun hisobot · ' + per.label, stamp, co: cfg.co.name });
  header(doc, 'NAPPga hisobot: ' + per.label, cfg.co.name + ' · STIR: ' + (cfg.co.stir || '—') + ' · Litsenziya: ' + (cfg.co.license || '—') + ' · Chorak oxiri: ' + dmy(per.to));
  h2(doc, 'F1. Investitsiya aktivlarining o‘rtacha yillik qiymati');
  const rows = [], tot = [0, 0, 0, 0], byType = {}; let n = 0;
  accs.forEach(a => {
    const views = endsA.map(d => viewAt(S, a, d, meta)), owner = a.owner || a.uid, items = {};
    views.forEach((V, k) => V.items.forEach(i => { if (i.val > 0.5) { const e = items[i.x.id] || (items[i.x.id] = { x: i.x, qty: 0, v: [null, null, null, null] }); e.v[k] = (e.v[k] || 0) + i.val; if (k === 0) e.qty = i.qty; } }));
    Object.keys(items).sort().forEach(id => { const e = items[id], vs = e.v.filter(v => v != null), avg = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 0; n++;
      rows.push([n, owner, 'IB-' + a.id + '/' + per.to.slice(0, 4), typeF1(e.x), e.x.sym, qx(e.x, e.qty), methodOf(e.x), nf(e.v[0]), nf(e.v[1]), nf(e.v[2]), nf(e.v[3]), nf(avg)]);
      e.v.forEach((v, k) => { tot[k] += v || 0; }); byType[typeF1(e.x)] = (byType[typeF1(e.x)] || 0) + (e.v[0] || 0); });
  });
  const cnt = tot.map(v => v > 0 ? 1 : 0).reduce((s, v) => s + v, 0), avgAll = cnt ? tot.reduce((s, v) => s + v, 0) / cnt : 0;
  rows.push({ cells: ['', 'JAMI', '', '', '', '', '', nf(tot[0]), nf(tot[1]), nf(tot[2]), nf(tot[3]), nf(avgAll)], b: true, shade: true });
  table(doc, [{ h: '№', w: 0.4 }, { h: 'Muassis', w: 1.4 }, { h: 'Shartnoma', w: 1.5 }, { h: 'Aktiv turi', w: 1.4 }, { h: 'Nomi', w: 1 }, { h: 'Soni', w: 1.5, a: 'r' }, { h: 'Baholash usuli', w: 1.4 }, { h: 'A1 ' + qs[0], w: 1.3, a: 'r' }, { h: 'A2 ' + qs[1], w: 1.3, a: 'r' }, { h: 'A3 ' + qs[2], w: 1.3, a: 'r' }, { h: 'A4 ' + qs[3], w: 1.3, a: 'r' }, { h: 'O‘rtacha', w: 1.3, a: 'r' }], rows, { fs: 6.5 });
  note(doc, 'Ma’lumot bo‘lmagan chorak hisobga olinmaydi (maxraj kamayadi). Qiymatlar BARLOS jurnali va saqlangan tarixiy narxlardan, so‘mda. Aktiv turlari xaritasi: milliy/xalqaro aksiya → «Aksiya (listingdagi)», obligatsiya → «Korporativ obligatsiya», omonat va naqd → «Pul mablag‘i», qolganlari → «Boshqa». Rasmiy toifani NAPP shakliga qarab tekshiring.');
  const typeRows = Object.keys(byType).map(k => [k, nf(byType[k]), pc(tot[0] ? byType[k] / tot[0] : 0)]); typeRows.push({ cells: ['Jami', nf(tot[0]), pc(tot[0] ? 1 : 0)], b: true, shade: true });
  table(doc, [{ h: 'Aktiv turi (hisobot choragi)', w: 3 }, { h: 'Qiymat (so‘m)', w: 2, a: 'r' }, { h: 'Ulush', w: 1, a: 'r' }], typeRows);
  /* F2 */
  const o = cfg.own, own = (+o.charter || 0) + (+o.added || 0) + (+o.reserve || 0) + (+o.retained || 0) + (+o.target || 0) + (+o.provisions || 0) - (+o.intangible || 0), need = avgAll * cfg.rate.minOwn / 100, diff = own - need;
  h2(doc, 'F2. O‘z mablag‘lari va moslik testi');
  table(doc, [{ h: 'Tarkib', w: 4 }, { h: 'Summa (so‘m)', w: 2, a: 'r' }], [['Ustav kapitali', nf(o.charter)], ['Qo‘shilgan kapital', nf(o.added)], ['Zaxira kapital', nf(o.reserve)], ['Taqsimlanmagan foyda', nf(o.retained)], ['Maqsadli tushumlar', nf(o.target)], ['Kelgusi xarajatlar zaxiralari', nf(o.provisions)], ['− Nomoddiy aktivlar (chegiriladi)', nf(-o.intangible)], { cells: ['O‘z mablag‘lari jami', nf(own)], b: true, shade: true }]);
  kv(doc, [['Boshqaruvdagi aktivlarning o‘rtacha yillik qiymati (F1)', nf(avgAll) + ' so‘m'], ['Talab etilgan ulush', cfg.rate.minOwn + '%'], ['Talab etiladigan o‘z mablag‘lari', nf(need) + ' so‘m'], ['Mavjud o‘z mablag‘lari', nf(own) + ' so‘m'], ['Ortiqcha / (kamomad)', nf(diff) + ' so‘m', diff >= 0 ? GREEN : RED], ['Holat', diff >= 0 ? 'TALAB BAJARILGAN' : 'KAMOMAD: 1 oy ichida muvofiqlashtiring', diff >= 0 ? GREEN : RED]], 260);
  if (!(own > 0)) note(doc, 'O‘z mablag‘lari tarkibi Sozlamalar → Hisobot sozlamalarida kiritilmagan, test natijasiga ishonmang.', RED);
  /* F8 */
  const accRep = S.accounts.length, cl = accs.map(a => accountPeriod(S, a, per, cfg, meta)), drops = cl.filter(r => r.dropped).length;
  const overs = []; accs.forEach(a => { const V = viewAt(S, a, per.to, meta); V.items.forEach(i => { if (i.x.group !== 'naqd' && V.T > 0 && i.val / V.T > cfg.rate.limit / 100) overs.push(i.x.sym); }); });
  const hasClientRep = db.all('reports').some(r => r.scope === 'client' && r.kind === 'chorak' && r.ref === ref);
  const auto = { 1: diff >= 0 && own > 0 ? ['Ha', 'Avtomatik: F2'] : ['Yo‘q', 'Avtomatik: F2'], 2: ['Ha', 'Avtomatik: tarixiy narxlarda baholandi'], 3: ['Ha', 'Har mijoz alohida hisobda'], 6: [hasClientRep ? 'Ha' : 'Qisman', 'Avtomatik: mijoz hisobotlari'], 7: [drops ? 'Ha' : 'N/A', 'Avtomatik: ' + drops + ' ta hisobda 10% dan ko‘p pasayish'], 8: [overs.length ? 'Yo‘q' : 'Ha', overs.length ? 'Limitdan oshgan: ' + overs.join(', ') : 'Avtomatik: konsentratsiya limiti'], 11: ['Ha', 'Avtomatik: PDF F6'] };
  const items = [['O‘z mablag‘lari o‘rtacha yillik aktivlarning kamida ' + cfg.rate.minOwn + '% (F2)', '3729-son Nizom 2-band'], ['Aktivlar chorak oxiriga baholandi, usul hujjatlashtirildi (F1)', '3729-son Nizom 9, 13-19-bandlar'], ['Mijoz aktivlari boshqa aktivlardan alohida hisobda', 'Qimmatli qog‘ozlar bozori to‘g‘risida Qonun'], ['NAPPga chorak hisobot muddatida topshirildi', '2383-son Qoidalar 18-band (30 kun)'], ['Buxgalteriya balansi nusxasi ilova qilindi', '2383-son Qoidalar 18-band'], ['Mijozga davriy hisobot (F3) shartnoma muddatida yuborildi', 'Shartnoma; 3729-son Nizom 10-11-bandlar'], ['Portfel 10% dan ko‘p pasayganda mijoz xabardor qilindi', 'MiFID II Art. 62 amaliyoti'], ['Konsentratsiya va investitsiya cheklovlari bajarildi (F4)', 'Shartnoma / investitsiya siyosati'], ['Manfaatlar to‘qnashuvi va bog‘liq shaxslar bitimlari ko‘rib chiqildi', 'Ichki siyosat'], ['Ustav kapital, rahbariyat va mulkdor ulushi o‘zgarishi NAPP bilan kelishildi', 'NAPP litsenziyalash nizomi'], ['Shartnoma kesimida soliq hisobi yuritildi (F6)', 'Soliq kodeksi'], ['Shikoyatlar reyestri yuritildi va ko‘rib chiqildi', 'Ichki siyosat'], ['Jinoiy daromadlarni legallashtirishga qarshi ichki nazorat', 'AML/CFT qonunchiligi'], ['Yillik auditor xulosasi olindi', 'Moliyaviy hisobot talablari']];
  h2(doc, 'F8. Muvofiqlik va ichki nazorat ro‘yxati');
  const cntS = { 'Ha': 0, 'Yo‘q': 0, 'Qisman': 0, 'N/A': 0, 'To‘ldirilmagan': 0 };
  table(doc, [{ h: '№', w: 0.4 }, { h: 'Nazorat bandi', w: 4 }, { h: 'Asos', w: 2 }, { h: 'Holat', w: 1 }, { h: 'Izoh', w: 2.2 }], items.map((it, i) => { const m = cfg.f8[i + 1] || {}, a = auto[i + 1], st = m.status || (a && a[0]) || 'To‘ldirilmagan', cm = m.note || (a && a[1]) || ''; cntS[st] = (cntS[st] || 0) + 1; return [i + 1, it[0], it[1], st, cm]; }));
  table(doc, [{ h: 'Jamlanma', w: 2 }, { h: 'Soni', w: 1, a: 'r' }], Object.keys(cntS).map(k => [k, cntS[k]]));
  estNote(doc, meta);
  signLine(doc, ['Rahbar: ' + (cfg.co.head || '____________') + '   M.O‘.', 'Bosh buxgalter: ' + (cfg.co.accountant || '____________')]);
  return { buf: await finish(doc), avgAll, own };
}
async function soliqDoc(S, ref, cfg, stamp) {
  const per = periodOf('soliq', ref), meta = {}, accs = clientAccounts(S), doc = newDoc({ title: 'Soliq uchun hisobot · ' + per.label, stamp, co: cfg.co.name });
  header(doc, 'Soliq organiga hisob: ' + per.label, cfg.co.name + ' · STIR: ' + (cfg.co.stir || '—') + ' · Davr: ' + dmy(per.from) + ' – ' + dmy(per.to));
  h2(doc, 'F6. Soliq hisobi: shartnoma kesimida');
  const rs = accs.map(a => accountPeriod(S, a, per, cfg, meta)), rows = []; let sm = 0, ss = 0, sd = 0, sg = 0;
  const share = rs.length ? 1 / rs.length : 0;
  rs.forEach(r => { const inc = r.mgmt + r.succ, direct = r.custody + r.brokerage, gen = (+cfg.tax.general || 0) * share, dir2 = direct + (+cfg.tax.direct || 0) * share, base = inc - dir2 - gen; sm += r.mgmt; ss += r.succ; sd += dir2; sg += gen;
    rows.push(['IB-' + r.acc.id + '/' + per.to.slice(0, 4), r.acc.owner || r.acc.uid, nf(r.mgmt), nf(r.succ), nf(inc), nf(dir2), nf(gen), nf(base), nf(Math.max(0, base) * cfg.rate.profitTax / 100)]); });
  const baseAll = sm + ss - sd - sg, taxAll = Math.max(0, baseAll) * cfg.rate.profitTax / 100;
  rows.push({ cells: ['JAMI', '', nf(sm), nf(ss), nf(sm + ss), nf(sd), nf(sg), nf(baseAll), nf(taxAll)], b: true, shade: true });
  table(doc, [{ h: 'Shartnoma №', w: 1.3 }, { h: 'Muassis', w: 1.5 }, { h: 'Boshqaruv haqi daromadi', w: 1.4, a: 'r' }, { h: 'Muvaffaqiyat haqi daromadi', w: 1.4, a: 'r' }, { h: 'Jami daromad', w: 1.3, a: 'r' }, { h: 'To‘g‘ridan-to‘g‘ri xarajat', w: 1.3, a: 'r' }, { h: 'Umumiy xarajat ulushi', w: 1.2, a: 'r' }, { h: 'Soliq solinadigan foyda', w: 1.4, a: 'r' }, { h: 'Foyda solig‘i ' + cfg.rate.profitTax + '%', w: 1.3, a: 'r' }], rows, { fs: 6.8 });
  note(doc, 'Daromad: boshqaruv va muvaffaqiyat haqi (hisoblangan). To‘g‘ridan-to‘g‘ri xarajat: saqlash va bitimlarda ushlangan komissiya (+ Sozlamalardagi qo‘shimcha summa teng taqsimlanadi). Yig‘ma soliq bazasi, zararni hisobga olish tartibi va imtiyozlar buxgalter bilan tasdiqlanadi. Soliq stavkasi ikkilamchi manbadan olingan, Soliq kodeksining joriy tahriri bo‘yicha tekshiring.');
  const vat = cfg.tax.vatPayer === 'Ha' ? (cfg.tax.vatExempt === 'Yo‘q' ? nf((sm + ss) * cfg.rate.vat / 100) : cfg.tax.vatExempt === 'Ha' ? '0' : 'Tekshiring') : (cfg.tax.vatPayer === 'Tekshiring' ? 'Tekshiring' : '0');
  h2(doc, 'QQS holati'); kv(doc, [['QQS to‘lovchimi?', cfg.tax.vatPayer], ['Boshqaruv haqi QQSdan ozodmi?', cfg.tax.vatExempt], ['Hisoblangan QQS (baza: jami daromad)', vat + (/^\d/.test(vat) ? ' so‘m' : '')]], 270);
  h2(doc, 'Mijoz daromadlari jamlanmasi (F7)');
  const r7 = rs.map(r => [r.acc.owner || r.acc.uid, nf(r.div), nf(r.coupon), nf(r.omInt), nf(r.realized), nf(r.div * cfg.rate.divTax / 100)]), t7 = rs.reduce((a, r) => [a[0] + r.div, a[1] + r.coupon, a[2] + r.omInt, a[3] + r.realized], [0, 0, 0, 0]);
  r7.push({ cells: ['JAMI', nf(t7[0]), nf(t7[1]), nf(t7[2]), nf(t7[3]), nf(t7[0] * cfg.rate.divTax / 100)], b: true, shade: true });
  table(doc, [{ h: 'Mijoz', w: 2 }, { h: 'Dividendlar', w: 1.3, a: 'r' }, { h: 'Kupon', w: 1.2, a: 'r' }, { h: 'Omonat foizi (soliqsiz)', w: 1.4, a: 'r' }, { h: 'Realizatsiya', w: 1.3, a: 'r' }, { h: 'Dividend solig‘i ' + cfg.rate.divTax + '% (taxminiy)', w: 1.5, a: 'r' }], r7);
  h2(doc, 'Soliq va hisobot kalendari (muddatlarni tasdiqlang)');
  table(doc, [{ h: 'Hisobot / soliq', w: 2.2 }, { h: 'Davr', w: 1 }, { h: 'Muddat', w: 2.6 }, { h: 'Asos', w: 2.2 }, { h: 'Holat', w: 1 }], [['Yillik moliyaviy hisobot', 'Yillik', 'Hisobot yilidan keyingi 15-fevralgacha (umumiy qoida)', 'IMV buyrug‘i 08.10.2024 № 181', 'Tekshirish'], ['Choraklik moliyaviy hisobot', 'Chorak', 'Nizomdagi muddat bo‘yicha', 'IMV buyrug‘i 08.10.2024 № 181', 'Tekshirish'], ['Foyda solig‘i hisob-kitobi', 'Soliq kodeksi', 'Soliq kodeksi bo‘yicha', 'Soliq kodeksi', 'Tekshirish'], ['QQS hisoboti (to‘lovchi bo‘lsa)', 'Soliq kodeksi', 'Soliq kodeksi bo‘yicha', 'Soliq kodeksi', 'Tekshirish'], ['Shartnoma kesimida alohida hisob', 'Doimiy', '—', 'Soliq kodeksi (ishonchli boshqaruv)', 'Tasdiqlangan']]);
  estNote(doc, meta);
  signLine(doc, ['Rahbar: ' + (cfg.co.head || '____________') + '   M.O‘.', 'Bosh buxgalter: ' + (cfg.co.accountant || '____________')]);
  return { buf: await finish(doc) };
}

/* ---------- saqlash va jadval ---------- */
function exists(scope, kind, ref, accId) { return db.all('reports').some(r => r.scope === scope && r.kind === kind && r.ref === ref && (accId ? r.accId === accId : true)); }
function store(meta, buf) {
  const prev = db.all('reports').filter(r => r.scope === meta.scope && r.kind === meta.kind && r.ref === meta.ref && (r.accId || '') === (meta.accId || '')), id = 'R' + (100000 + db.seq('rep')), file = id + '.pdf';
  fs.writeFileSync(path.join(dir(), file), buf);
  const rec = Object.assign({}, meta, { id, file, size: buf.length, t: Date.now(), ver: prev.length + 1, hash: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) });
  db.put('reports', rec); return rec;
}
/* kind: oylik|chorak|yillik (mijoz, accId kerak) yoki napp|soliq (admin) */
async function generate(S, st, kind, ref, accId, opt) {
  opt = opt || {}; const cfg = conf(st), stamp = dmy(dstr(Date.now())) + ' ' + new Date(Date.now() + TZ).toISOString().slice(11, 16);
  Core.BENCHC.rate = st.benchRate != null ? st.benchRate : 25; Core.BENCHC.pay = st.benchPay || 'none';
  if (kind === 'napp' || kind === 'soliq') {
    if (!opt.force && exists('admin', kind, ref)) return null;
    const per = periodOf(kind, ref), out = kind === 'napp' ? await nappDoc(S, ref, cfg, stamp) : await soliqDoc(S, ref, cfg, stamp);
    return store({ scope: 'admin', kind, ref, accId: '', uid: '', name: '', title: (kind === 'napp' ? 'NAPPga hisobot' : 'Soliq organiga hisob') + ' · ' + per.label }, out.buf);
  }
  const acc = S.accounts.filter(a => a.id === accId)[0]; if (!acc) throw new Error('Hisob topilmadi.');
  if (!opt.force && exists('client', kind, ref, accId)) return null;
  const per = periodOf(kind, ref), owner = acc.owner || acc.uid, out = await clientDoc(S, acc, kind, ref, cfg, stamp, owner);
  return store({ scope: 'client', kind, ref, accId, uid: acc.uid, name: owner, title: { oylik: 'Oylik hisobot', chorak: 'Chorak hisoboti', yillik: 'Yillik hisobot va soliq ma’lumotnomasi' }[kind] + ' · ' + per.label }, out.buf);
}
/* hisob shu davrda mavjud bo'lganmi (davr oxirigacha tranzaksiya bor) */
const hadActivity = (S, accId, to) => S.tx.some(t => t.acc === accId && t.status === 'Bajarildi' && t.t <= endMs(to));
/* Avtomatik tsikl: o'tgan oy / chorak / yil tugagach bir marta tayyorlaydi (qayta tayyorlamaydi) */
async function auto(S, st, now) {
  const today = dstr(now || Date.now()), made = [], accs = S.accounts.filter(a => !a.archived);
  const pm = prevMonth(today), pq = prevQuarter(today), py = String(+today.slice(0, 4) - 1);
  for (const a of accs) {
    if (!a.uid) continue;
    if (hadActivity(S, a.id, periodOf('oylik', pm).to)) { const r = await generate(S, st, 'oylik', pm, a.id); if (r) made.push(r); }
    if (hadActivity(S, a.id, periodOf('chorak', pq).to)) { const r = await generate(S, st, 'chorak', pq, a.id); if (r) made.push(r); }
    if (hadActivity(S, a.id, periodOf('yillik', py).to)) { const r = await generate(S, st, 'yillik', py, a.id); if (r) made.push(r); }
  }
  if (accs.some(a => hadActivity(S, a.id, periodOf('napp', pq).to))) { for (const k of ['napp', 'soliq']) { const r = await generate(S, st, k, pq, '', {}); if (r) made.push(r); } }
  return made;
}
function listFor(user, accIds) {
  const all = db.all('reports').sort((a, b) => b.t - a.t);
  if (user.role === 'admin') return all;
  if (user.role === 'operator') return all.filter(r => r.scope === 'client');
  return all.filter(r => r.scope === 'client' && accIds.indexOf(r.accId) >= 0);
}
function fileOf(rec) { return path.join(dir(), rec.file); }
module.exports = { generate, auto, listFor, fileOf, periodOf, prevMonth, prevQuarter, conf, DEF, accountPeriod, viewAt, nf };
