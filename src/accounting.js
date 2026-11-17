'use strict';
/* BARLOS buxgalteriyasi (2.12.0): qo'sh yozuvli hisob, balans (1-shakl) va moliyaviy natija (2-shakl).
   Hamma narsa saytdagi ma'lumotdan AVTOMATIK hosil bo'ladi:
   - daromad: mijoz hisoblaridagi boshqaruv va muvaffaqiyat haqi (src/reports.js dagi accountPeriod),
   - ish haqi: xodimlar reestridan, soliqlar stavkalar bo'yicha,
   - xarajat: shartnomalar va to'lovlar reestridan,
   - Rahbar ulushi (standart 5%): alohida 5110-R hisobraqami orqali,
   - ustav kapitali va qo'lda kiritilgan yozuvlar.
   Jurnal hech qachon qo'lda tahrirlanmaydi: har safar ma'lumotlardan qayta quriladi (yozuvlar faqat bekor qilinadi). */
const db = require('./db');
const Core = require('../public/core.js');
const reports = require('./reports');

const TZ = 5 * 3600e3;
const pad = n => String(n).padStart(2, '0');
const rd = x => Math.round(x);
const dstr = ms => new Date(ms + TZ).toISOString().slice(0, 10);
const todayStr = () => dstr(Date.now());
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const eom = (y, m) => y + '-' + pad(m) + '-' + pad(lastDay(y, m));
const ymOf = d => d.slice(0, 7);
const minD = (a, b) => (a < b ? a : b);
const maxD = (a, b) => (a > b ? a : b);
function addMonth(y, m, n) { const t = y * 12 + (m - 1) + n; return [Math.floor(t / 12), (t % 12) + 1]; }

/* ---------- Hisobvaraqlar rejasi (xo'jalik yurituvchi subyektlar, UzNIF hisoboti bilan bir xil kodlar) ---------- */
const PLAN = [
  ['0110', 'Asosiy vositalar – boshlang‘ich qiymati', 'Aktiv', 'D', '010'], ['0210', 'Asosiy vositalar eskirishi', 'Aktiv', 'K', '011'],
  ['0410', 'Nomoddiy aktivlar', 'Aktiv', 'D', '020'], ['0510', 'Nomoddiy aktivlar amortizatsiyasi', 'Aktiv', 'K', '021'],
  ['0610', 'Qimmatli qog‘ozlar (uzoq muddatli investitsiya)', 'Aktiv', 'D', '040'],
  ['4010', 'Xaridorlar va buyurtmachilar qarzi (boshqaruv haqi)', 'Aktiv', 'D', '220'], ['4300', 'Yetkazib beruvchilarga berilgan avanslar', 'Aktiv', 'D', '260'],
  ['4610', 'Ta’sischilarning ustav kapitaliga badal qarzi', 'Aktiv', 'D', '290'], ['4800', 'Boshqa debitorlik qarzlari', 'Aktiv', 'D', '310'],
  ['5010', 'Kassa', 'Aktiv', 'D', '330'], ['5110', 'Hisob-kitob schyoti (asosiy)', 'Aktiv', 'D', '340'], ['5110-R', 'Rahbar ulushi uchun MAXSUS hisobraqam', 'Aktiv', 'D', '340'],
  ['5810', 'Qisqa muddatli investitsiyalar', 'Aktiv', 'D', '370'],
  ['6010', 'Yetkazib beruvchi va pudratchilarga qarz', 'Passiv', 'K', '610'], ['6410', 'Byudjetga to‘lovlar bo‘yicha qarz (JShDS, foyda solig‘i)', 'Passiv', 'K', '680'],
  ['6520', 'Maqsadli jamg‘armalarga qarz (ijtimoiy to‘lov, INPS)', 'Passiv', 'K', '700'], ['6610', 'Ta’sischilarga qarz (dividend)', 'Passiv', 'K', '710'],
  ['6710', 'Mehnat haqi bo‘yicha qarz', 'Passiv', 'K', '720'], ['6710-R', 'Rahbar ulushi bo‘yicha qarz', 'Passiv', 'K', '720'], ['6990', 'Boshqa majburiyatlar', 'Passiv', 'K', '760'],
  ['8310', 'Ustav kapitali', 'Passiv', 'K', '410'], ['8410', 'Qo‘shilgan kapital', 'Passiv', 'K', '420'], ['8510', 'Zaxira kapitali', 'Passiv', 'K', '430'], ['8710', 'Taqsimlanmagan foyda (zarar)', 'Passiv', 'K', '450'],
  ['9030', 'Ish va xizmatlar sotishdan daromad (boshqaruv va muvaffaqiyat haqi)', 'Daromad', 'K', ''], ['9310', 'Asosiy faoliyatdan boshqa daromadlar', 'Daromad', 'K', ''],
  ['9410', 'Dividend ko‘rinishidagi daromadlar', 'Daromad', 'K', ''], ['9420', 'Foiz ko‘rinishidagi daromadlar', 'Daromad', 'K', ''],
  ['9220', 'Ma’muriy xarajatlar (maosh, ijara, shartnomalar)', 'Xarajat', 'D', ''], ['9220-R', 'Ma’muriy xarajatlar – Rahbar ulushi', 'Xarajat', 'D', ''],
  ['9230', 'Boshqa operatsion xarajatlar', 'Xarajat', 'D', ''], ['9510', 'Foiz ko‘rinishidagi xarajatlar', 'Xarajat', 'D', ''],
  ['9810', 'Foyda solig‘i xarajati', 'Xarajat', 'D', ''], ['9910', 'Yakuniy moliyaviy natija', 'Natija', 'K', '']
].map(r => ({ code: r[0], name: r[1], type: r[2], side: r[3], line: r[4] }));
const PM = {}; PLAN.forEach(a => { PM[a.code] = a; });

/* ---------- Balans (1-shakl) tuzilishi: [tur, qator kodi, nomi, formula]  tur: h sarlavha, l hisobvaraqlardan, f formula, z qo'lda 0 ---------- */
const H = 'h', LF = 'l', FM = 'f', Z = 'z';
const BAL = [
  [H, '', 'AKTIV'], [H, '', 'I. Uzoq muddatli aktivlar'], [LF, '010', 'Asosiy vositalar: boshlang‘ich qiymati'], [LF, '011', 'Eskirish summasi'], [FM, '012', 'Asosiy vositalar qoldiq qiymati', '{010}-{011}'],
  [LF, '020', 'Nomoddiy aktivlar: boshlang‘ich qiymati'], [LF, '021', 'Amortizatsiya summasi'], [FM, '022', 'Nomoddiy aktivlar qoldiq qiymati', '{020}-{021}'],
  [FM, '030', 'Uzoq muddatli investitsiyalar, jami', '{040}+{050}+{060}+{070}+{080}'], [LF, '040', 'Qimmatli qog‘ozlar'], [LF, '050', 'Sho‘ba jamiyatlarga investitsiyalar'], [LF, '060', 'Tobe jamiyatlarga investitsiyalar'],
  [LF, '070', 'Xorijiy kapitalli korxonaga investitsiyalar'], [LF, '080', 'Boshqa uzoq muddatli investitsiyalar'], [LF, '090', 'O‘rnatiladigan uskunalar'], [LF, '100', 'Kapital qo‘yilmalar'],
  [LF, '110', 'Uzoq muddatli debitorlik qarzlari'], [LF, '120', 'Uzoq muddatli kechiktirilgan xarajatlar'], [FM, '130', 'I bo‘lim bo‘yicha jami', '{012}+{022}+{030}+{090}+{100}+{110}+{120}'],
  [H, '', 'II. Joriy aktivlar'], [FM, '140', 'Tovar-moddiy zaxiralar, jami', '{150}+{160}+{170}+{180}'], [LF, '150', 'Ishlab chiqarish zaxiralari'], [LF, '160', 'Tugallanmagan ishlab chiqarish'], [LF, '170', 'Tayyor mahsulot'], [LF, '180', 'Tovarlar'],
  [LF, '190', 'Kelgusi davr xarajatlari'], [LF, '200', 'Kechiktirilgan xarajatlar'], [FM, '210', 'Debitorlar, jami', '{220}+{240}+{250}+{260}+{270}+{280}+{290}+{300}+{310}'], [Z, '211', 'shundan: muddati o‘tgan'],
  [LF, '220', 'Xaridorlar va buyurtmachilar qarzi'], [LF, '230', 'Alohida bo‘linmalar qarzi'], [LF, '240', 'Sho‘ba va tobe jamiyatlar qarzi'], [LF, '250', 'Xodimlarga berilgan avanslar'],
  [LF, '260', 'Yetkazib beruvchilarga berilgan avanslar'], [LF, '270', 'Byudjetga soliq avans to‘lovlari'], [LF, '280', 'Maqsadli jamg‘armalarga avans to‘lovlari'], [LF, '290', 'Ta’sischilarning ustav kapitaliga badal qarzi'],
  [LF, '300', 'Xodimlarning boshqa operatsiyalar bo‘yicha qarzi'], [LF, '310', 'Boshqa debitorlik qarzlari'], [FM, '320', 'Pul mablag‘lari, jami', '{330}+{340}+{350}+{360}'],
  [LF, '330', 'Kassadagi pul'], [LF, '340', 'Hisob-kitob schyotlaridagi pul (shu jumladan Rahbar maxsus schyoti 5110-R)'], [LF, '350', 'Chet el valyutasidagi pul'], [LF, '360', 'Boshqa pul mablag‘lari'],
  [LF, '370', 'Qisqa muddatli investitsiyalar'], [LF, '380', 'Boshqa joriy aktivlar'], [FM, '390', 'II bo‘lim bo‘yicha jami', '{140}+{190}+{200}+{210}+{320}+{370}+{380}'], [FM, '400', 'AKTIV bo‘yicha jami', '{130}+{390}'],
  [H, '', 'PASSIV'], [H, '', 'I. Xususiy mablag‘lar manbalari'], [LF, '410', 'Ustav kapitali'], [LF, '420', 'Qo‘shilgan kapital'], [LF, '430', 'Zaxira kapitali'], [LF, '440', 'Sotib olingan xususiy aksiyalar'],
  [LF, '450', 'Taqsimlanmagan foyda (qoplanmagan zarar)'], [LF, '460', 'Maqsadli tushumlar'], [LF, '470', 'Kelgusi xarajat va to‘lovlar zaxiralari'], [FM, '480', 'I bo‘lim bo‘yicha jami', '{410}+{420}+{430}-{440}+{450}+{460}+{470}'],
  [H, '', 'II. Majburiyatlar'], [FM, '490', 'Uzoq muddatli majburiyatlar, jami', '{500}+{520}+{530}+{540}+{550}+{560}+{570}+{580}+{590}'], [FM, '491', 'shu jumladan: uzoq muddatli kreditorlik qarzi', '{500}+{520}+{540}+{560}+{590}'],
  [LF, '500', 'Yetkazib beruvchilarga uzoq muddatli qarz'], [LF, '510', 'Alohida bo‘linmalarga uzoq muddatli qarz'], [LF, '520', 'Sho‘ba va tobe jamiyatlarga uzoq muddatli qarz'], [LF, '530', 'Uzoq muddatli kechiktirilgan daromadlar'],
  [LF, '540', 'Uzoq muddatli kechiktirilgan soliq majburiyatlari'], [LF, '550', 'Boshqa uzoq muddatli kechiktirilgan majburiyatlar'], [LF, '560', 'Xaridorlardan olingan avanslar'], [LF, '570', 'Uzoq muddatli bank kreditlari'],
  [LF, '580', 'Uzoq muddatli qarzlar'], [LF, '590', 'Boshqa uzoq muddatli kreditorlik qarzlari'],
  [FM, '600', 'Joriy majburiyatlar, jami', '{610}+{630}+{640}+{650}+{660}+{670}+{680}+{690}+{700}+{710}+{720}+{730}+{740}+{750}+{760}'],
  [FM, '601', 'shu jumladan: joriy kreditorlik qarzi', '{610}+{630}+{650}+{670}+{680}+{690}+{700}+{710}+{720}+{760}'], [Z, '602', 'shundan: muddati o‘tgan'],
  [LF, '610', 'Yetkazib beruvchi va pudratchilarga qarz'], [LF, '620', 'Alohida bo‘linmalarga qarz'], [LF, '630', 'Sho‘ba va tobe jamiyatlarga qarz'], [LF, '640', 'Kechiktirilgan daromadlar'], [LF, '650', 'Kechiktirilgan soliq majburiyatlari'],
  [LF, '660', 'Boshqa kechiktirilgan majburiyatlar'], [LF, '670', 'Olingan avanslar'], [LF, '680', 'Byudjetga to‘lovlar bo‘yicha qarz'], [LF, '690', 'Sug‘urta bo‘yicha qarz'],
  [LF, '700', 'Maqsadli jamg‘armalarga to‘lovlar bo‘yicha qarz'], [LF, '710', 'Ta’sischilarga qarz'], [LF, '720', 'Mehnat haqi bo‘yicha qarz (shu jumladan Rahbar ulushi)'], [LF, '730', 'Qisqa muddatli bank kreditlari'],
  [LF, '740', 'Qisqa muddatli qarzlar'], [LF, '750', 'Uzoq muddatli majburiyatlarning joriy qismi'], [LF, '760', 'Boshqa kreditorlik qarzlari'], [FM, '770', 'II bo‘lim bo‘yicha jami', '{490}+{600}'], [FM, '780', 'PASSIV bo‘yicha jami', '{480}+{770}']
];
function evalTpl(tpl, v) { let s = 0; (tpl.match(/[+-]?\{\d+\}/g) || []).forEach(t => { const neg = t[0] === '-', code = t.replace(/[^0-9]/g, ''); s += (neg ? -1 : 1) * (v[code] || 0); }); return s; }
function balanceLines(saldoOf) {
  const v = {};
  BAL.forEach(r => { if (r[0] === LF) v[r[1]] = 0; });
  PLAN.forEach(a => { if (a.line) v[a.line] = (v[a.line] || 0) + saldoOf(a.code); });
  BAL.forEach(r => { if (r[0] === FM) v[r[1]] = evalTpl(r[3], v); if (r[0] === Z) v[r[1]] = 0; });
  return v;
}

/* ---------- Sozlamalar ---------- */
const DEF = {
  rates: { jshds: 12, yait: 12, inps: 0.1, profit: 15 },
  mgr: { on: true, pct: 5, base: 'profit' },
  charter: { amount: 0, paidPct: 100, date: '', nominal: 10000, holders: [] },
  rev: { mgmt: true, succ: true, custody: false },
  pay: { auto: true, day: 10 },
  start: '', opening: []
};
const num = (v, lo, hi, nm) => { const n = +v; if (!isFinite(n) || n < lo || n > hi) { const e = new Error(nm + ' ' + lo + '…' + hi + ' oralig‘ida bo‘lishi kerak.'); e.http = 400; throw e; } return n; };
const bad = m => { const e = new Error(m); e.http = 400; return e; };
function getCfg() { const c = db.get('acx', 'cfg') || {}, o = {}; Object.keys(DEF).forEach(k => { o[k] = (DEF[k] && typeof DEF[k] === 'object' && !Array.isArray(DEF[k])) ? Object.assign({}, DEF[k], c[k] || {}) : (c[k] != null ? c[k] : DEF[k]); }); return o; }
function saveCfg(b) {
  const c = getCfg(); b = b || {};
  if (b.rates) { const r = b.rates; c.rates = { jshds: num(r.jshds, 0, 50, 'JShDS'), yait: num(r.yait, 0, 50, 'Ijtimoiy to‘lov'), inps: num(r.inps, 0, 10, 'INPS'), profit: num(r.profit, 0, 50, 'Foyda solig‘i') }; }
  if (b.mgr) { const m = b.mgr; c.mgr = { on: !!m.on, pct: num(m.pct, 0, 100, 'Rahbar ulushi'), base: m.base === 'revenue' ? 'revenue' : 'profit' }; }
  if (b.charter) {
    const h = b.charter, hold = (Array.isArray(h.holders) ? h.holders : []).slice(0, 50).map(x => ({ name: String(x.name || '').trim().slice(0, 120), pct: num(x.pct, 0, 100, 'Aksiyador ulushi') })).filter(x => x.name);
    if (h.date && !isDate(h.date)) throw bad('Ustav kapitali sanasi noto‘g‘ri.');
    c.charter = { amount: num(h.amount || 0, 0, 1e15, 'Ustav kapitali'), paidPct: num(h.paidPct == null ? 100 : h.paidPct, 0, 100, 'To‘langan ulush'), date: h.date || '', nominal: num(h.nominal || 10000, 1, 1e12, 'Aksiya nominali'), holders: hold };
    if (hold.length && Math.abs(hold.reduce((s, x) => s + x.pct, 0) - 100) > 0.001) throw bad('Aksiyadorlar ulushlari yig‘indisi 100% bo‘lishi kerak.');
  }
  if (b.rev) c.rev = { mgmt: !!b.rev.mgmt, succ: !!b.rev.succ, custody: !!b.rev.custody };
  if (b.pay) c.pay = { auto: !!b.pay.auto, day: Math.round(num(b.pay.day, 1, 28, 'To‘lov kuni')) };
  if (b.start !== undefined) { if (b.start && !/^\d{4}-\d{2}$/.test(b.start)) throw bad('Boshlanish oyi YYYY-MM ko‘rinishida bo‘lsin.'); c.start = b.start || ''; }
  if (Array.isArray(b.opening)) {
    c.opening = b.opening.slice(0, 200).map(o => { if (!PM[o.code]) throw bad('Boshlang‘ich qoldiqda noma’lum hisobvaraq: ' + o.code); return { code: o.code, dt: Math.max(0, rd(+o.dt || 0)), kt: Math.max(0, rd(+o.kt || 0)) }; }).filter(o => o.dt || o.kt);
  }
  db.put('acx', Object.assign({ id: 'cfg' }, c)); return c;
}

/* ---------- Xodim, shartnoma, to'lov, qo'lda yozuvlar ---------- */
const coll = n => db.all(n).sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
const salaryAt = (e, d) => { let v = 0; (e.sal || []).slice().sort((a, b) => a.from.localeCompare(b.from)).forEach(s => { if (s.from <= d) v = s.amount; }); return v; };

/* ---------- ENGINE (sof funksiya: sinash oson) ---------- */
function engine(inp) {
  const cfg = inp.cfg, year = inp.year, upto = inp.upto, today = inp.today || todayStr(), asOf = minD(today, upto);
  const emps = inp.emps || [], cons = inp.cons || [], pays = (inp.pays || []).filter(p => !p.void), man = (inp.manual || []).filter(m => !m.void), rev = inp.revenue || {};
  const warnings = [];
  const ys = year + '-01-01', uy = +upto.slice(0, 4), um = +upto.slice(5, 7);
  /* boshlanish oyi */
  const cands = [year + '-01'];
  if (cfg.start) cands.push(cfg.start);
  const chAmt = cfg.charter.amount > 0 ? cfg.charter.amount : 0, chDate = cfg.charter.date || '';
  if (chAmt && chDate) cands.push(ymOf(chDate));
  emps.forEach(e => cands.push(ymOf(e.from))); cons.forEach(c => cands.push(ymOf(c.start))); man.forEach(m => cands.push(ymOf(m.date))); Object.keys(rev).forEach(k => cands.push(k));
  let start = cands.filter(Boolean).sort()[0];
  if (cfg.start) start = minD(cfg.start, start);
  if (start > year + '-01') start = year + '-01';
  let sy = +start.slice(0, 4), sm = +start.slice(5, 7);
  if (sy < 2000) { sy = 2000; sm = 1; }
  const months = []; for (let y = sy, m = sm; y < uy || (y === uy && m <= um); [y, m] = addMonth(y, m, 1)) months.push([y, m]);
  if (months.length > 240) throw bad('Davr juda uzun (20 yildan ko‘p).');
  const E = []; const add = (d, grp, doc, note, dt, kt, amt, src) => { amt = rd(amt); if (!amt || d > upto) return; E.push({ d, grp, doc, note, dt, kt, amt, src }); };
  const payDate = (y, m) => { const [ny, nm] = addMonth(y, m, 1); return ny + '-' + pad(nm) + '-' + pad(Math.min(cfg.pay.day, lastDay(ny, nm))); };
  const paid = (y, m) => cfg.pay.auto && payDate(y, m) <= asOf;
  const mDate = (y, m) => minD(eom(y, m), upto);

  /* ustav kapitali */
  if (chAmt) {
    const d = chDate || (start + '-01'), paidAmt = rd(chAmt * cfg.charter.paidPct / 100);
    add(d, 'main', 'Ustav', 'Ustav kapitali e’lon qilindi', '4610', '8310', chAmt, 'ustav');
    add(d, 'main', 'Ustav', 'Aksiyadorlar badali to‘landi', '5110', '4610', paidAmt, 'ustav');
  }
  /* daromad, ish haqi, shartnomalar */
  const payroll = [];
  months.forEach(([y, m]) => {
    const k = ym(y, m), dm = mDate(y, m), r = rev[k] || { mgmt: 0, succ: 0, custody: 0 };
    const total = (cfg.rev.mgmt ? r.mgmt : 0) + (cfg.rev.succ ? r.succ : 0) + (cfg.rev.custody ? r.custody : 0);
    add(dm, 'main', 'Daromad-' + k, 'Boshqaruv/muvaffaqiyat haqi hisoblandi (mijoz hisoblaridan)', '4010', '9030', total, 'daromad');
    if (paid(y, m)) add(payDate(y, m), 'main', 'Tushum-' + k, 'Haq mijozlardan olindi', '5110', '4010', total, 'daromad');
    /* ish haqi */
    const first = k + '-01', last = eom(y, m), rows = [];
    emps.forEach(e => { if (e.from > last || (e.to && e.to < first)) return; const g = salaryAt(e, last); if (!g) return; rows.push({ id: e.id, name: e.name, role: e.role, gross: g, jshds: rd(g * cfg.rates.jshds / 100), inps: rd(g * cfg.rates.inps / 100) }); });
    const G = rows.reduce((s, x) => s + x.gross, 0), J = rd(G * cfg.rates.jshds / 100), I = rd(G * cfg.rates.inps / 100), Y = rd(G * cfg.rates.yait / 100), net = G - J - I;
    rows.forEach(x => { x.net = x.gross - x.jshds - x.inps; });
    payroll.push({ k, y, m, rows, gross: G, jshds: J, inps: I, yait: Y, net, paid: paid(y, m) });
    add(dm, 'main', 'Maosh-' + k, 'Ish haqi hisoblandi', '9220', '6710', G, 'maosh');
    add(dm, 'main', 'Maosh-' + k, 'JShDS ushlandi', '6710', '6410', J, 'maosh');
    add(dm, 'main', 'Maosh-' + k, 'INPS ushlandi', '6710', '6520', I, 'maosh');
    add(dm, 'main', 'Maosh-' + k, 'Ijtimoiy to‘lov hisoblandi (ish beruvchi)', '9220', '6520', Y, 'maosh');
    if (paid(y, m)) {
      const pd = payDate(y, m);
      add(pd, 'main', 'Maosh-' + k, 'Netto ish haqi to‘landi', '6710', '5110', net, 'maosh');
      add(pd, 'main', 'Maosh-' + k, 'JShDS byudjetga o‘tkazildi', '6410', '5110', J, 'maosh');
      add(pd, 'main', 'Maosh-' + k, 'Ijtimoiy to‘lov va INPS o‘tkazildi', '6520', '5110', I + Y, 'maosh');
    }
  });
  const conRows = cons.map(c => {
    const [sy2, sm2] = [+c.start.slice(0, 4), +c.start.slice(5, 7)], base = Math.floor(c.total / c.months), accr = {};
    for (let i = 0; i < c.months; i++) {
      const [y, m] = addMonth(sy2, sm2, i), k = ym(y, m);
      if (c.cancelAt && k > ymOf(c.cancelAt)) break;
      accr[k] = i === c.months - 1 ? c.total - base * (c.months - 1) : base;
    }
    return { c, accr };
  });
  conRows.forEach(({ c, accr }) => {
    Object.keys(accr).sort().forEach(k => { const y = +k.slice(0, 4), m = +k.slice(5, 7); if (k > ym(uy, um)) return; add(mDate(y, m), 'main', c.code, (c.party || '') + ': ' + (c.subject || 'xarajat'), c.acct === '9230' ? '9230' : '9220', '6010', accr[k], 'shartnoma'); });
  });
  pays.forEach(p => { const c = cons.filter(x => x.code === p.con)[0]; add(p.date, 'main', p.con, 'To‘lov: ' + (c ? c.party : p.con) + (p.note ? ' (' + p.note + ')' : ''), '6010', '5110', p.amount, 'tolov'); });
  man.forEach(x => add(x.date, 'main', x.doc || 'Qo‘lda', x.note, x.dt, x.kt, x.amt, 'qolda'));

  /* Rahbar ulushi: yil bo'yicha kumulyativ baza, 5110-R maxsus schyot orqali */
  const boss = emps.filter(e => e.role === 'rahbar').sort((a, b) => b.from.localeCompare(a.from))[0] || null;
  const mgrRows = [];
  if (cfg.mgr.on && !boss) warnings.push('Rahbar xodimlar reestrida yo‘q: Rahbar ulushi hisoblanmadi.');
  if (cfg.mgr.on && boss && cfg.mgr.pct > 0) {
    const eff = e => (PM[e.kt] && PM[e.kt].type === 'Daromad' ? e.amt : 0) - (PM[e.dt] && PM[e.dt].type === 'Xarajat' ? e.amt : 0);
    const bm = {}; E.filter(e => e.grp === 'main').forEach(e => { const k = ymOf(e.d), b = bm[k] || (bm[k] = { profit: 0, revenue: 0 }); b.profit += eff(e); if (e.kt === '9030') b.revenue += e.amt; });
    let cum = 0, prevS = 0;
    months.forEach(([y, m]) => {
      const k = ym(y, m), dm = mDate(y, m); if (m === 1) { cum = 0; prevS = 0; }
      const b = bm[k] || { profit: 0, revenue: 0 }, base = cfg.mgr.base === 'revenue' ? b.revenue : b.profit; cum += base;
      const cs = rd(Math.max(0, cum) * cfg.mgr.pct / 100), F = Math.max(0, cs - prevS); prevS = Math.max(prevS, cs);   /* high-water mark: to‘langan ulush qaytarib olinmaydi */
      const J = rd(F * cfg.rates.jshds / 100), I = rd(F * cfg.rates.inps / 100), Y = rd(F * cfg.rates.yait / 100), net = F - J - I, pd = paid(y, m);
      mgrRows.push({ k, base, cum, share: F, jshds: J, inps: I, yait: Y, net, paid: pd });
      if (!F) return;
      add(dm, 'mgr', 'Rahbar-' + k, 'Rahbar ulushi hisoblandi (' + cfg.mgr.pct + '%)', '9220-R', '6710-R', F, 'rahbar');
      add(dm, 'mgr', 'Rahbar-' + k, 'Ish beruvchi ijtimoiy to‘lovi (ulushdan)', '9220-R', '6520', Y, 'rahbar');
      add(dm, 'mgr', 'Rahbar-' + k, 'JShDS ushlandi', '6710-R', '6410', J, 'rahbar');
      add(dm, 'mgr', 'Rahbar-' + k, 'INPS ushlandi', '6710-R', '6520', I, 'rahbar');
      add(dm, 'mgr', 'Rahbar-' + k, 'Netto ulush maxsus schyotga (5110-R) o‘tkazildi', '5110-R', '5110', net, 'rahbar');
      if (pd) {
        const pdt = payDate(y, m);
        add(pdt, 'mgr', 'Rahbar-' + k, 'Ulush Rahbarga maxsus schyotdan to‘landi', '6710-R', '5110-R', net, 'rahbar');
        add(pdt, 'mgr', 'Rahbar-' + k, 'JShDS byudjetga o‘tkazildi', '6410', '5110', J, 'rahbar');
        add(pdt, 'mgr', 'Rahbar-' + k, 'Ijtimoiy to‘lov va INPS o‘tkazildi', '6520', '5110', I + Y, 'rahbar');
      }
    });
  }

  /* Yillik yopish: foyda solig'i va natijani 8710 ga o'tkazish */
  const taxByYear = {};
  for (let y = sy; y <= uy; y++) {
    const cut = y < uy ? y + '-12-31' : upto, from = y + '-01-01';
    const inYear = E.filter(e => e.grp !== 'close' && e.d >= from && e.d <= cut), res = {};
    PLAN.filter(a => a.type === 'Daromad' || a.type === 'Xarajat').forEach(a => { res[a.code] = 0; });
    inYear.forEach(e => { if (PM[e.kt] && PM[e.kt].type === 'Daromad') res[e.kt] += e.amt; if (PM[e.dt] && PM[e.dt].type === 'Daromad') res[e.dt] -= e.amt; if (PM[e.dt] && PM[e.dt].type === 'Xarajat') res[e.dt] -= e.amt; if (PM[e.kt] && PM[e.kt].type === 'Xarajat') res[e.kt] += e.amt; });
    /* res: daromad uchun + (kredit−debet), xarajat uchun − (debet−kredit) */
    const pretax = Object.keys(res).reduce((s, c) => s + res[c], 0), tax = rd(Math.max(0, pretax) * cfg.rates.profit / 100);
    taxByYear[y] = { pretax, tax, from, cut };
    add(cut, 'close', 'Yopish-' + y, 'Foyda solig‘i hisoblandi', '9810', '6410', tax, 'yopish');
    let net = 0;
    Object.keys(res).forEach(c => { const v = res[c]; if (!v) return; if (PM[c].type === 'Daromad') { add(cut, 'close', 'Yopish-' + y, c + ' yopildi', c, '9910', v, 'yopish'); net += v; } else { add(cut, 'close', 'Yopish-' + y, c + ' yopildi', '9910', c, -v, 'yopish'); net += v; } });
    add(cut, 'close', 'Yopish-' + y, '9810 yopildi', '9910', '9810', tax, 'yopish');
    add(cut, 'close', 'Yopish-' + y, 'Sof foyda taqsimlanmagan foydaga o‘tkazildi', '9910', '8710', net - tax, 'yopish');
  }
  E.sort((a, b) => a.d.localeCompare(b.d) || String(a.doc).localeCompare(String(b.doc)));
  E.forEach((e, i) => { e.n = i + 1; });

  /* hisobvaraqlar qoldiqlari */
  const base = {}; PLAN.forEach(a => { base[a.code] = { dr: 0, kr: 0 }; });
  (cfg.opening || []).forEach(o => { if (base[o.code]) { base[o.code].dr += o.dt; base[o.code].kr += o.kt; } });
  const sums = fn => { const m = {}; PLAN.forEach(a => { m[a.code] = { dr: 0, kr: 0 }; }); E.forEach(e => { if (!fn(e)) return; if (m[e.dt]) m[e.dt].dr += e.amt; if (m[e.kt]) m[e.kt].kr += e.amt; }); return m; };
  const sd = (a, s) => (a.side === 'D' ? s.dr - s.kr : s.kr - s.dr);
  const before = sums(e => e.d < ys), per = sums(e => e.d >= ys && e.d <= upto && e.grp !== 'close'), cls = sums(e => e.d >= ys && e.d <= upto && e.grp === 'close');
  const tb = PLAN.map(a => {
    const o = { dr: base[a.code].dr + before[a.code].dr, kr: base[a.code].kr + before[a.code].kr }, p = per[a.code], c = cls[a.code];
    const cl = { dr: o.dr + p.dr + c.dr, kr: o.kr + p.kr + c.kr };
    return { code: a.code, name: a.name, type: a.type, side: a.side, open: sd(a, o), dt: p.dr, kt: p.kr, cdt: c.dr, ckt: c.kr, close: sd(a, cl) };
  });
  const T = {}; tb.forEach(r => { T[r.code] = r; });
  const vb = balanceLines(c => T[c].open), ve = balanceLines(c => T[c].close);
  const balans = BAL.map(r => ({ kind: r[0], code: r[1], label: r[2], begin: r[1] ? vb[r[1]] : null, end: r[1] ? ve[r[1]] : null }));

  /* Moliyaviy natija (2-shakl): davr aylanmasi (yopishgacha) */
  const net = code => { const r = T[code], a = PM[code]; return a.type === 'Daromad' ? r.kt - r.dt : r.dt - r.kt; };
  const tx = taxByYear[uy] || { tax: 0, pretax: 0 };
  const L = {}; const rows2 = [];
  const line = (code, label, inc, exp, bold) => { L[code] = { inc: inc || 0, exp: exp || 0 }; rows2.push({ code, label, inc: inc || 0, exp: exp || 0, bold: !!bold }); };
  const sig = (code, label, v) => { L[code] = { v }; rows2.push({ code, label, inc: Math.max(v, 0), exp: Math.max(-v, 0), res: v, bold: true }); };
  const rev9 = net('9030'), adm = net('9220') + net('9220-R'), oth = net('9230');
  line('010', 'Sof tushum (boshqaruv va muvaffaqiyat haqi)', rev9, 0); line('020', 'Sotilgan xizmatlar tannarxi', 0, 0);
  sig('030', 'Yalpi foyda (zarar)', rev9);
  line('040', 'Davr xarajatlari, jami', 0, adm + oth, true); line('050', 'Sotish xarajatlari', 0, 0); line('060', 'Ma’muriy xarajatlar (maosh, ijara, shartnomalar, Rahbar ulushi)', 0, adm); line('070', 'Boshqa operatsion xarajatlar', 0, oth);
  line('090', 'Asosiy faoliyatdan boshqa daromadlar', net('9310'), 0);
  sig('100', 'Asosiy faoliyat foydasi (zarari)', rev9 - adm - oth + net('9310'));
  line('110', 'Moliyaviy daromadlar, jami', net('9410') + net('9420'), 0, true); line('120', 'Dividend ko‘rinishidagi daromadlar', net('9410'), 0); line('130', 'Foiz ko‘rinishidagi daromadlar', net('9420'), 0);
  line('170', 'Moliyaviy xarajatlar, jami', 0, net('9510'), true); line('180', 'Foiz ko‘rinishidagi xarajatlar', 0, net('9510'));
  const preTax = rev9 - adm - oth + net('9310') + net('9410') + net('9420') - net('9510');
  sig('220', 'Umumxo‘jalik faoliyati foydasi (zarari)', preTax); sig('240', 'Foyda solig‘idan oldingi foyda (zarar)', preTax);
  line('250', 'Foyda solig‘i', 0, tx.tax); sig('270', 'Hisobot davrining sof foydasi (zarari)', preTax - tx.tax);
  const pnl = rows2;

  /* yig'ma ko'rsatkichlar va tekshiruvlar */
  const sdEnd = c => T[c].close, sdBeg = c => T[c].open;
  const checks = [];
  const chk = (name, okv, info) => checks.push({ name, ok: !!okv, info: info || '' });
  chk('Aktiv = Passiv (davr oxiri)', Math.abs(ve['400'] - ve['780']) < 1, ve['400'] - ve['780']);
  chk('Aktiv = Passiv (davr boshi)', Math.abs(vb['400'] - vb['780']) < 1, vb['400'] - vb['780']);
  const dSum = tb.reduce((s, r) => s + r.dt + r.cdt, 0), kSum = tb.reduce((s, r) => s + r.kt + r.ckt, 0);
  chk('Aylanma: debet = kredit', Math.abs(dSum - kSum) < 1, dSum - kSum);
  chk('Sof foyda = taqsimlanmagan foyda o‘zgarishi', Math.abs((preTax - tx.tax) - (sdEnd('8710') - sdBeg('8710'))) < 1, (preTax - tx.tax) - (sdEnd('8710') - sdBeg('8710')));
  chk('Rahbar maxsus schyoti (5110-R) = Rahbar ulushi qarzi (6710-R)', Math.abs(sdEnd('5110-R') - sdEnd('6710-R')) < 1, sdEnd('5110-R') - sdEnd('6710-R'));
  const sumYear = E.filter(e => e.grp !== 'close' && e.d >= ys && e.d <= upto);
  const monthly = months.filter(([y]) => y === year).map(([y, m]) => {
    const k = ym(y, m), me = sumYear.filter(e => ymOf(e.d) === k), pr = payroll.filter(p => p.k === k)[0], mg = mgrRows.filter(x => x.k === k)[0];
    const income = me.filter(e => PM[e.kt] && PM[e.kt].type === 'Daromad').reduce((s, e) => s + e.amt, 0), exp = me.filter(e => PM[e.dt] && PM[e.dt].type === 'Xarajat').reduce((s, e) => s + e.amt, 0);
    return { k, revenue: income, expense: exp, payroll: pr ? pr.gross + pr.yait : 0, contracts: me.filter(e => e.src === 'shartnoma').reduce((s, e) => s + e.amt, 0), manager: mg ? mg.share + mg.yait : 0, profit: income - exp };
  });
  const lastM = months.slice(-3), opexAvg = (() => { const ks = lastM.map(([y, m]) => ym(y, m)); const t = E.filter(e => e.grp === 'main' && (e.src === 'maosh' || e.src === 'shartnoma') && PM[e.dt] && PM[e.dt].type === 'Xarajat' && ks.indexOf(ymOf(e.d)) >= 0).reduce((s, e) => s + e.amt, 0); return ks.length ? t / ks.length : 0; })();
  const charter = { amount: T['8310'].close, paid: T['8310'].close - T['4610'].close, due: T['4610'].close, opexMonthly: rd(opexAvg), coverMonths: opexAvg > 0 ? Math.round(T['8310'].close / opexAvg * 10) / 10 : null, shares: cfg.charter.nominal > 0 ? Math.round(T['8310'].close / cfg.charter.nominal) : 0, holders: cfg.charter.holders };
  const conView = conRows.map(({ c, accr }) => { const acc = Object.keys(accr).filter(k => k <= ym(uy, um)).reduce((s, k) => s + accr[k], 0), pd = pays.filter(p => p.con === c.code).reduce((s, p) => s + p.amount, 0); return { code: c.code, date: c.date, party: c.party, subject: c.subject, kind: c.kind, total: c.total, start: c.start, months: c.months, acct: c.acct, cancelAt: c.cancelAt || '', accrued: acc, paid: pd, debt: acc - pd, remaining: c.total - pd }; });
  const mgrTot = mgrRows.filter(x => x.k.slice(0, 4) === String(year)).reduce((o, x) => ({ share: o.share + x.share, jshds: o.jshds + x.jshds, inps: o.inps + x.inps, yait: o.yait + x.yait, net: o.net + x.net }), { share: 0, jshds: 0, inps: 0, yait: 0, net: 0 });
  const summary = { revenue: rev9, expenses: adm + oth, pretax: preTax, tax: tx.tax, net: preTax - tx.tax, cash: sdEnd('5110') + sdEnd('5110-R'), cashMain: sdEnd('5110'), cashMgr: sdEnd('5110-R'), receivable: sdEnd('4010'), payables: ve['600'], assets: ve['400'], equity: ve['480'], mgr: mgrTot };
  return { year, upto, start, today, journal: E, tb, balans, pnl, payroll: payroll.filter(p => p.y === year), mgr: mgrRows.filter(x => x.k.slice(0, 4) === String(year)), mgrAll: mgrRows, boss: boss ? { id: boss.id, name: boss.name } : null, contracts: conView, monthly, charter, summary, checks, warnings, tax: taxByYear[uy] || null };
}
function ym(y, m) { return y + '-' + pad(m); }

/* ---------- Platforma ma'lumotlaridan daromad (mijoz hisoblari bo'yicha) ---------- */
let rcache = { rev: -1, t: 0, map: {} };
function platformRevenue(S, st, cfg, startYm, upto, warn) {
  const repCfg = reports.conf(st); Core.BENCHC.rate = st.benchRate != null ? st.benchRate : 25; Core.BENCHC.pay = st.benchPay || 'none';
  const roles = {}; db.db.prepare('SELECT id,role FROM users').all().forEach(u => { roles[u.id] = u.role; });
  const accs = S.accounts.filter(a => a.uid && roles[a.uid] === 'client');
  const key = [startYm, upto, repCfg.rate.mgmt, repCfg.rate.success, repCfg.rate.hurdle, repCfg.rate.custody, repCfg.rate.days].join('|');
  if (rcache.rev !== db.rev() || Date.now() - rcache.t > 600000) rcache = { rev: db.rev(), t: Date.now(), map: {} };
  if (rcache.map[key]) return rcache.map[key];
  const out = {}, uy = +upto.slice(0, 4), um = +upto.slice(5, 7); let errs = 0;
  for (let y = +startYm.slice(0, 4), m = +startYm.slice(5, 7); y < uy || (y === uy && m <= um); [y, m] = addMonth(y, m, 1)) {
    const k = ym(y, m), r = out[k] = { mgmt: 0, succ: 0, custody: 0 }, per = { from: k + '-01', to: minD(eom(y, m), upto), label: k };
    const qEnd = m % 3 === 0 && eom(y, m) <= upto, perQ = qEnd ? reports.periodOf('chorak', y + '-Q' + (m / 3)) : null;
    accs.forEach(a => {
      if (!S.tx.some(t => t.acc === a.id && t.status === 'Bajarildi')) return;
      try {
        const x = reports.accountPeriod(S, a, per, repCfg, {}); r.mgmt += x.mgmt || 0; r.custody += x.custody || 0;
        if (perQ) r.succ += reports.accountPeriod(S, a, perQ, repCfg, {}).succ || 0;
      } catch (e) { errs++; }
    });
    r.mgmt = rd(r.mgmt); r.custody = rd(r.custody); r.succ = rd(r.succ);
  }
  if (errs && warn) warn.push('Daromadni hisoblashda ' + errs + ' ta hisob/davr o‘tkazib yuborildi.');
  rcache.map[key] = out; return out;
}
function aumAt(S, upto) {
  const roles = {}; db.db.prepare('SELECT id,role FROM users').all().forEach(u => { roles[u.id] = u.role; });
  let t = 0, n = 0; S.accounts.filter(a => a.uid && roles[a.uid] === 'client').forEach(a => { try { const v = reports.viewAt(S, a, upto, {}); if (v.T > 0) { t += v.T; n++; } } catch (e) { /* o'tkazildi */ } });
  return { total: rd(t), accounts: n };
}

function build(S, st, year, upto) {
  const cfg = getCfg(), repCfg = reports.conf(st);
  if (!(cfg.charter.amount > 0) && repCfg.own && repCfg.own.charter > 0) cfg.charter = Object.assign({}, cfg.charter, { amount: repCfg.own.charter });
  const emps = coll('acx_emp'), cons = coll('acx_con'), pays = coll('acx_pay'), manual = coll('acx_je');
  /* daromad hisoblashda boshlanish oyini aniqlash uchun dastlabki engine (daromadsiz) */
  const warn = [];
  const probe = engine({ cfg, year, upto, emps, cons, pays, manual, revenue: {} });
  const revenue = platformRevenue(S, st, cfg, probe.start, upto, warn);
  const out = engine({ cfg, year, upto, emps, cons, pays, manual, revenue });
  out.warnings = warn.concat(out.warnings);
  out.aum = aumAt(S, upto); out.rates = cfg.rates; out.revenueByMonth = revenue; out.feeRates = { mgmt: repCfg.rate.mgmt, success: repCfg.rate.success, hurdle: repCfg.rate.hurdle, custody: repCfg.rate.custody };
  out.co = repCfg.co; out.cfg = { mgr: cfg.mgr, pay: cfg.pay, rev: cfg.rev };
  return out;
}

/* ---------- PDF ---------- */
const nfP = reports.pdf.nf;
async function pdfDoc(rep, kind, stamp) {
  const P = reports.pdf, title = { balans: 'Buxgalteriya balansi (1-shakl)', natija: 'Moliyaviy natijalar to‘g‘risida hisobot (2-shakl)', rahbar: 'Rahbar ulushi hisobi', toliq: 'Buxgalteriya hisoboti: balans va moliyaviy natija' }[kind] || 'Buxgalteriya hisoboti';
  const doc = P.newDoc({ title, co: (rep.co && rep.co.name) || 'BARLOS', stamp, subject: 'Hisobot sanasi ' + rep.upto });
  P.header(doc, title, (rep.co && rep.co.name ? rep.co.name + ' · ' : '') + 'Davr: ' + rep.year + '-yil boshidan ' + P.dmy(rep.upto) + ' gacha · Birlik: so‘m');
  if (kind === 'balans' || kind === 'toliq') {
    P.h2(doc, 'Balans (1-sonli shakl)');
    P.table(doc, [{ h: 'Ko‘rsatkich', w: 5 }, { h: 'Qator', w: 0.8, a: 'c' }, { h: 'Davr boshiga', w: 1.8, a: 'r' }, { h: 'Davr oxiriga', w: 1.8, a: 'r' }],
      rep.balans.filter(r => r.kind === 'h' || r.begin || r.end || ['400', '780', '480', '770', '130', '390'].indexOf(r.code) >= 0).map(r => r.kind === 'h' ? { cells: [r.label, '', '', ''], b: true, shade: true } : { cells: [r.label, r.code, nfP(r.begin), nfP(r.end)], b: r.kind === 'f' }), { fs: 8 });
  }
  if (kind === 'natija' || kind === 'toliq') {
    P.h2(doc, 'Moliyaviy natijalar (2-sonli shakl)');
    P.table(doc, [{ h: 'Ko‘rsatkich', w: 5 }, { h: 'Qator', w: 0.8, a: 'c' }, { h: 'Daromad (foyda)', w: 1.8, a: 'r' }, { h: 'Xarajat (zarar)', w: 1.8, a: 'r' }],
      rep.pnl.map(r => ({ cells: [r.label, r.code, nfP(r.inc), nfP(r.exp)], b: r.bold, shade: r.bold })), { fs: 8 });
  }
  if (kind === 'rahbar' || kind === 'toliq') {
    P.h2(doc, 'Rahbar ulushi (' + rep.cfg.mgr.pct + '%, baza: ' + (rep.cfg.mgr.base === 'revenue' ? 'tushum' : 'bonusgacha foyda') + ') – maxsus hisobraqam 5110-R' + (rep.boss ? ' · ' + rep.boss.name : ''));
    P.table(doc, [{ h: 'Oy', w: 1 }, { h: 'Baza', w: 1.6, a: 'r' }, { h: 'Ulush (brutto)', w: 1.6, a: 'r' }, { h: 'JShDS', w: 1.2, a: 'r' }, { h: 'INPS', w: 1, a: 'r' }, { h: 'Netto → 5110-R', w: 1.6, a: 'r' }, { h: 'Holat', w: 1, a: 'c' }],
      rep.mgr.map(x => [x.k, nfP(x.base), nfP(x.share), nfP(x.jshds), nfP(x.inps), nfP(x.net), x.paid ? 'to‘langan' : 'hisoblangan']), { fs: 8 });
  }
  P.h2(doc, 'Nazorat'); rep.checks.forEach(c => P.note(doc, (c.ok ? '✓ ' : '✗ ') + c.name + (c.ok ? '' : ' (farq ' + nfP(c.info) + ')'), c.ok ? null : '#A3281F'));
  P.note(doc, 'Bu hisobot BARLOS platformasi ma’lumotlaridan avtomatik tuzildi. Hisobvaraqlar kodlari, soliq stavkalari va imtiyozlar bosh buxgalter tomonidan tasdiqlanadi.');
  P.signLine(doc, ['Rahbar', 'Bosh buxgalter']);
  return P.finish(doc, 'Buxgalteriya');
}

/* ---------- API ---------- */
function mount(app, d) {
  const { A, wrap, bad: badD } = d, B = badD || bad;
  const D = (s, what) => { if (!isDate(s)) throw B(what + ' sanasi YYYY-MM-DD ko‘rinishida bo‘lsin.'); return s; };
  const parse = q => { const t = todayStr(); let year = +q.year || +t.slice(0, 4); if (year < 2000 || year > 2100) throw B('Yil noto‘g‘ri.'); let upto = q.upto || (year === +t.slice(0, 4) ? t : year + '-12-31'); D(upto, 'Hisobot'); if (+upto.slice(0, 4) !== year) throw B('Hisobot sanasi tanlangan yilga tegishli bo‘lishi kerak.'); return { year, upto }; };
  const run = q => { const p = parse(q); return build(d.loadS(), d.settings(), p.year, p.upto); };
  app.get('/api/acx/data', A, wrap((req, res) => {
    const users = db.db.prepare('SELECT id,name,email,role FROM users ORDER BY created').all();
    res.json({ cfg: getCfg(), emps: coll('acx_emp'), cons: coll('acx_con'), pays: coll('acx_pay'), manual: coll('acx_je'), users, plan: PLAN, today: todayStr() });
  }));
  app.get('/api/acx/report', A, wrap((req, res) => res.json(run(req.query))));
  app.get('/api/acx/pdf', A, wrap(async (req, res) => {
    const rep = run(req.query), kind = ['balans', 'natija', 'rahbar', 'toliq'].indexOf(req.query.kind) >= 0 ? req.query.kind : 'toliq';
    const buf = await pdfDoc(rep, kind, todayStr());
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline; filename="barlos-buxgalteriya-' + kind + '-' + rep.upto + '.pdf"'); res.send(buf);
  }));
  app.post('/api/acx/cfg', A, wrap((req, res) => res.json({ ok: true, cfg: saveCfg(req.body) })));

  app.post('/api/acx/emp', A, wrap((req, res) => {
    const b = req.body || {}, all = coll('acx_emp'), cur = b.id ? all.filter(e => e.id === b.id)[0] : null; if (b.id && !cur) throw B('Xodim topilmadi.', 404);
    const name = String(b.name || '').trim().slice(0, 120); if (name.length < 3) throw B('F.I.Sh. kiriting.');
    const role = b.role === 'rahbar' ? 'rahbar' : 'xodim', from = D(b.from || (cur && cur.from), 'Ishga qabul'), to = b.to ? D(b.to, 'Bo‘shash') : '';
    if (to && to < from) throw B('Bo‘shash sanasi qabul sanasidan oldin bo‘lmasin.');
    const pinfl = String(b.pinfl || '').replace(/\s/g, ''); if (pinfl && !/^\d{14}$/.test(pinfl)) throw B('PINFL 14 raqamdan iborat bo‘lsin.');
    if (b.uid && !db.db.prepare('SELECT 1 FROM users WHERE id=?').get(b.uid)) throw B('Bog‘lanadigan foydalanuvchi topilmadi.');
    if (role === 'rahbar' && all.some(e => e.role === 'rahbar' && e.id !== (cur && cur.id) && (!e.to || e.to >= from) && (!to || to >= e.from))) throw B('Bu davrda boshqa Rahbar bor. Avval uning bo‘shash sanasini kiriting.');
    const sal = (cur && cur.sal ? cur.sal.slice() : []), amt = b.salary == null || b.salary === '' ? (sal.length ? sal[sal.length - 1].amount : NaN) : num(b.salary, 0, 1e11, 'Oklad');
    if (!isFinite(amt)) throw B('Oklad kiriting.');
    const last = sal.length ? sal[sal.length - 1] : null;
    if (!last) sal.push({ from: b.salFrom && isDate(b.salFrom) ? b.salFrom : from, amount: rd(amt) });
    else if (rd(amt) !== last.amount) { const sf = D(b.salFrom || '', 'Yangi oklad amal qilish'); if (sf <= last.from) throw B('Yangi oklad sanasi oldingisidan keyin bo‘lsin.'); sal.push({ from: sf, amount: rd(amt) }); }
    const rec = Object.assign({}, cur || { id: 'E' + (1000 + db.seq('acx_emp')), created: Date.now() }, { name, position: String(b.position || '').slice(0, 120), role, pinfl, from, to, bank: String(b.bank || '').slice(0, 120), account: String(b.account || '').replace(/\s/g, '').slice(0, 30), uid: b.uid || '', sal, updated: Date.now() });
    db.put('acx_emp', rec); req.ad = (cur ? 'Xodim yangilandi ' : 'Xodim qo‘shildi ') + rec.id + ' ' + name + ' · ' + role + ' · oklad ' + rec.sal[rec.sal.length - 1].amount; res.json({ ok: true, emp: rec });
  }));
  app.post('/api/acx/con', A, wrap((req, res) => {
    const b = req.body || {}, all = coll('acx_con'), cur = b.id ? all.filter(c => c.id === b.id)[0] : null; if (b.id && !cur) throw B('Shartnoma topilmadi.', 404);
    const code = String(b.code || '').trim().slice(0, 30); if (!code) throw B('Shartnoma kodini kiriting (masalan SH-01).');
    if (all.some(c => c.code === code && c.id !== (cur && cur.id))) throw B('Bu kod band.');
    const acct = b.acct === '9230' ? '9230' : '9220', months = Math.round(num(b.months || 1, 1, 120, 'Muddat (oy)')), total = rd(num(b.total, 1, 1e13, 'Summa'));
    const rec = Object.assign({}, cur || { id: 'C' + (1000 + db.seq('acx_con')), created: Date.now() }, { code, date: D(b.date || todayStr(), 'Shartnoma'), party: String(b.party || '').trim().slice(0, 160), subject: String(b.subject || '').trim().slice(0, 240), kind: String(b.kind || '').slice(0, 60), total, start: D(b.start || b.date || todayStr(), 'Boshlanish'), months, acct, cancelAt: b.cancelAt ? D(b.cancelAt, 'Bekor qilish') : '', updated: Date.now() });
    if (!rec.party) throw B('Kontragentni kiriting.');
    if (cur && cur.code !== code) coll('acx_pay').filter(p => p.con === cur.code).forEach(p => db.put('acx_pay', Object.assign(p, { con: code }), true));
    db.put('acx_con', rec); req.ad = (cur ? 'Shartnoma yangilandi ' : 'Shartnoma qo‘shildi ') + code + ' ' + rec.party + ' ' + total; res.json({ ok: true, con: rec });
  }));
  app.post('/api/acx/pay', A, wrap((req, res) => {
    const b = req.body || {}, con = coll('acx_con').filter(c => c.code === b.con)[0]; if (!con) throw B('Shartnoma topilmadi.');
    const rec = { id: 'P' + (100000 + db.seq('acx_pay')), con: con.code, date: D(b.date || todayStr(), 'To‘lov'), amount: rd(num(b.amount, 1, 1e13, 'Summa')), note: String(b.note || '').slice(0, 200), created: Date.now(), void: false };
    db.put('acx_pay', rec); req.ad = 'To‘lov ' + rec.id + ' ' + con.code + ' ' + rec.amount; res.json({ ok: true, pay: rec });
  }));
  app.post('/api/acx/pay/:id/void', A, wrap((req, res) => {
    const p = db.get('acx_pay', req.params.id); if (!p) throw B('To‘lov topilmadi.', 404); const why = String((req.body || {}).reason || '').trim(); if (why.length < 3) throw B('Bekor qilish sababini yozing.');
    db.put('acx_pay', Object.assign(p, { void: true, voidReason: why.slice(0, 200), voidT: Date.now() })); req.ad = 'To‘lov bekor ' + p.id + ': ' + why.slice(0, 80); res.json({ ok: true });
  }));
  app.post('/api/acx/je', A, wrap((req, res) => {
    const b = req.body || {}; if (!PM[b.dt] || !PM[b.kt]) throw B('Debet va kredit hisobvaraqlarini rejadan tanlang.'); if (b.dt === b.kt) throw B('Debet va kredit bir xil bo‘lmasin.');
    if (b.dt === '9910' || b.kt === '9910') throw B('9910 yopish hisobvarag‘i avtomatik yuritiladi.');
    const note = String(b.note || '').trim(); if (note.length < 3) throw B('Izoh yozing.');
    const rec = { id: 'J' + (100000 + db.seq('acx_je')), date: D(b.date, 'Yozuv'), dt: b.dt, kt: b.kt, amt: rd(num(b.amt, 1, 1e13, 'Summa')), note: note.slice(0, 240), doc: String(b.doc || '').slice(0, 40), created: Date.now(), void: false };
    db.put('acx_je', rec); req.ad = 'Qo‘lda yozuv ' + rec.id + ' ' + rec.dt + '/' + rec.kt + ' ' + rec.amt; res.json({ ok: true, je: rec });
  }));
  app.post('/api/acx/je/:id/void', A, wrap((req, res) => {
    const j = db.get('acx_je', req.params.id); if (!j) throw B('Yozuv topilmadi.', 404); const why = String((req.body || {}).reason || '').trim(); if (why.length < 3) throw B('Bekor qilish sababini yozing.');
    db.put('acx_je', Object.assign(j, { void: true, voidReason: why.slice(0, 200), voidT: Date.now() })); req.ad = 'Yozuv bekor ' + j.id + ': ' + why.slice(0, 80); res.json({ ok: true });
  }));
}

/* Oy tugagach avtomatik: oldingi oy buxgalteriya hisoboti (PDF) saqlanadi, qayta yozilmaydi */
async function auto(S, st) {
  const t = todayStr(), y = +t.slice(0, 4), m = +t.slice(5, 7), [py, pm] = addMonth(y, m, -1), k = ym(py, pm), up = eom(py, pm);
  if (db.get('acx_snap', k)) return null;
  if (!coll('acx_emp').length && !coll('acx_con').length && !getCfg().charter.amount) return null;   /* hali sozlanmagan */
  const rep = build(S, st, py, up), buf = await pdfDoc(rep, 'toliq', t);
  const r = reports.store({ scope: 'admin', kind: 'buxgalteriya', ref: k, accId: '', uid: '', name: '', title: 'Buxgalteriya hisoboti · ' + k }, buf);
  db.put('acx_snap', { id: k, t: Date.now(), report: r.id, net: rep.summary.net, assets: rep.summary.assets, ok: rep.checks.every(c => c.ok) }); return r;
}

module.exports = { mount, build, engine, getCfg, saveCfg, auto, PLAN, BAL, pdfDoc, DEF };
