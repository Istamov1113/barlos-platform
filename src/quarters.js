'use strict';
/* BARLOS — chorak yopish: xizmat haqi (boshqaruv + muvaffaqiyat + saqlash) mijoz hisobidan CHORAK OXIRIDA
   avtomatik undiriladi. Yopilgan chorak `acx_close` yozuvida saqlanadi (qayta hisoblanmaydi), daromad
   buxgalteriyaga shu yozuvdan olinadi. Zarar bo'lsa: keyingi foyda avval zararni qoplaydi, undirilgan haq qaytarilmaydi. */
const db = require('./db');
const Core = require('../public/core.js');
const reports = require('./reports');

const rd = v => Math.round(v * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const todayStr = () => Core.dayStr(Math.floor((Date.now() + 5 * 3600e3) / 86400e3));
const keyOf = (y, q) => y + '-Q' + q;
const qOfDate = d => keyOf(+d.slice(0, 4), Math.floor((+d.slice(5, 7) - 1) / 3) + 1);
const nextKey = k => { const y = +k.slice(0, 4), q = +k.slice(6); return q === 4 ? keyOf(y + 1, 1) : keyOf(y, q + 1); };
const prevKey = k => { const y = +k.slice(0, 4), q = +k.slice(6); return q === 1 ? keyOf(y - 1, 4) : keyOf(y, q - 1); };
const endsBefore = (k, today) => reports.periodOf('chorak', k).to < today;     /* chorak tugagan */

const closed = () => db.all('acx_close').sort((a, b) => a.id.localeCompare(b.id));
function clientAccounts(S) {
  const roles = {}; db.db.prepare('SELECT id,role FROM users').all().forEach(u => { roles[u.id] = u.role; });
  return S.accounts.filter(a => a.uid && roles[a.uid] === 'client' && !a.archived);
}
/* haq hisoblash boshlanadigan chorak: sozlangan yoki birinchi yopilgan yoki avvalgi chorak */
function startKey(today) {
  const c = db.get('acx', 'cfg') || {}; if (c.feeStart && /^\d{4}-Q[1-4]$/.test(c.feeStart)) return c.feeStart;
  const cl = closed(); if (cl.length) return cl[0].id;
  return prevKey(qOfDate(today || todayStr()));
}
function carryOf(accId, key) {            /* oldingi yopilgan choraklardan: zarar va undirilmagan haq */
  let carry = 0, unpaid = 0;
  closed().forEach(c => { if (c.id >= key) return; const r = (c.rows || []).filter(x => x.accId === accId)[0]; if (r) { carry = r.carryOut || 0; unpaid = r.unpaidOut || 0; } });
  return { carry, unpaid };
}

/* bitta chorak uchun hisob-kitob (yopmasdan) */
function preview(S, st, key) {
  const rec = db.get('acx_close', key); if (rec) return Object.assign({ closed: true }, rec);
  const per = reports.periodOf('chorak', key), cfg = reports.conf(st), cash = Core.cashAsset(S), rows = [];
  Core.BENCHC.rate = st.benchRate != null ? st.benchRate : 25; Core.BENCHC.pay = st.benchPay || 'none';
  clientAccounts(S).forEach(a => {
    const has = S.tx.some(t => t.acc === a.id && t.status === 'Bajarildi' && t.t <= (reports.endMs ? reports.endMs(per.to) : Infinity));
    if (!has) return;
    let x; try { x = reports.accountPeriod(S, a, per, cfg, {}); } catch (e) { return; }
    if (!(x.open > 0 || x.close > 0)) return;
    const c = carryOf(a.id, key), excess = x.excess || 0;
    const offset = excess > 0 ? Math.min(c.carry, excess) : 0, carryOut = excess < 0 ? c.carry - excess : c.carry - offset;
    const succ = Math.max(0, excess - offset) * cfg.rate.success / 100;
    const mgmt = x.mgmt, cust = x.custody, due = rd(mgmt + succ + cust + c.unpaid);
    const it = cash ? x.closeV.items.filter(i => i.x.id === cash.id)[0] : null, cashQ = it ? it.qty : 0;
    rows.push({ accId: a.id, uid: a.uid, name: a.owner || a.name, acc: a.name, open: rd(x.open), close: rd(x.close), gain: rd(x.gain), gross: x.gross, nav: rd(x.nav),
      mgmt: rd(mgmt), custody: rd(cust), excess: rd(excess), carryIn: rd(c.carry), offset: rd(offset), succ: rd(succ), unpaidIn: rd(c.unpaid), carryOut: rd(carryOut), due, cash: rd(cashQ) });
  });
  const tot = rows.reduce((o, r) => ({ mgmt: o.mgmt + r.mgmt, succ: o.succ + r.succ, custody: o.custody + r.custody, due: o.due + r.due }), { mgmt: 0, succ: 0, custody: 0, due: 0 });
  return { id: key, key, closed: false, per, rows, totals: { mgmt: rd(tot.mgmt), succ: rd(tot.succ), custody: rd(tot.custody), due: rd(tot.due) } };
}

/* chorak ro'yxati: boshlanishdan oxirgi tugagan chorakkacha */
function list(S, st) {
  const today = todayStr(), cur = qOfDate(today), out = [];
  for (let k = startKey(today); k < cur; k = nextKey(k)) {
    const rec = db.get('acx_close', k);
    if (rec) out.push({ key: k, label: reports.periodOf('chorak', k).label, closed: true, closedAt: rec.closedAt, by: rec.by, totals: rec.totals, charged: rec.charged, accounts: rec.rows.length });
    else out.push({ key: k, label: reports.periodOf('chorak', k).label, closed: false });
  }
  const next = out.filter(q => !q.closed)[0];
  return { quarters: out, next: next ? next.key : null, current: cur, start: startKey(today) };
}

/* choraknii yopish: har hisobdan FEE yoziladi (chorak oxiri sanasi bilan) */
function close(S, st, key, by, writeTx, opts) {
  const today = todayStr(); opts = opts || {};
  if (!/^\d{4}-Q[1-4]$/.test(key || '')) throw httpErr('Chorak noto‘g‘ri.');
  if (db.get('acx_close', key)) throw httpErr('Bu chorak allaqachon yopilgan.');
  if (!endsBefore(key, today)) throw httpErr('Chorak hali tugamagan — tugagach yopiladi.');
  const start = startKey(today); if (key < start) throw httpErr('Bu chorak haq hisoblash boshlanishidan oldin.');
  const prev = prevKey(key); if (prev >= start && !db.get('acx_close', prev)) throw httpErr('Avval ' + reports.periodOf('chorak', prev).label + 'ni yoping.');
  const pv = preview(S, st, key), cash = Core.cashAsset(S); if (!cash) throw httpErr('Naqd so‘m aktivi (UZS) katalogda yo‘q.');
  const T = reports.endMs(pv.per.to), rows = [], blk = 'B' + (10000 + db.seq('blk'));
  let charged = 0;
  db.tx(() => {
    pv.rows.forEach(r => {
      const a = S.accounts.filter(z => z.id === r.accId)[0];
      /* yetarli naqd bo'lmasa — bor qismi undiriladi, qolgani keyingi chorakka o'tadi */
      const curCash = (() => { const V = Core.view(S, a), it = V.items.filter(i => i.x.id === cash.id)[0]; return it ? it.qty : 0; })();
      const amt = rd(Math.max(0, Math.min(r.due, r.cash, curCash))); let txId = '';
      if (amt > 0) {
        const t = writeTx(S, { acc: r.accId, aid: cash.id, type: 'FEE', amount: amt, price: 1, t: T, note: 'Xizmat haqi · ' + pv.per.label + ' (boshqaruv ' + Math.round(r.mgmt) + ', muvaffaqiyat ' + Math.round(r.succ) + (r.custody ? ', saqlash ' + Math.round(r.custody) : '') + ')', autoFee: false }, by, 'Chorak', blk);
        txId = t.id; charged += amt;
      }
      rows.push(Object.assign({}, r, { charged: amt, unpaidOut: rd(r.due - amt), txId }));
    });
    const tot = rows.reduce((o, r) => ({ mgmt: o.mgmt + r.mgmt, succ: o.succ + r.succ, custody: o.custody + r.custody }), { mgmt: 0, succ: 0, custody: 0 });
    /* daromad: haqiqatda undirilgan summa (turlar bo'yicha ulushi bilan) */
    const dueNew = rows.reduce((s, r) => s + (r.mgmt + r.succ + r.custody), 0) || 1, f = Math.min(1, charged / dueNew);
    const rev = { mgmt: rd(tot.mgmt * f), succ: rd(tot.succ * f), custody: rd(tot.custody * f) };
    db.put('acx_close', { id: key, key, per: pv.per, rows, totals: { mgmt: rd(tot.mgmt), succ: rd(tot.succ), custody: rd(tot.custody), due: pv.totals.due }, charged: rd(charged), rev, closedAt: Date.now(), by: by || 'Tizim' });
  });
  return db.get('acx_close', key);
}
function httpErr(m) { const e = new Error(m); e.http = 400; return e; }

/* buxgalteriya uchun: oy -> { mgmt, succ, custody, date } (yopilgan choraklardan) */
function revenueByMonth() {
  const out = {};
  closed().forEach(c => { const k = c.per.to.slice(0, 7); out[k] = { mgmt: c.rev.mgmt, succ: c.rev.succ, custody: c.rev.custody, date: c.per.to }; });
  return out;
}

/* hisobning avvalgi chorak oxiridagi balansi (avtomatik) */
const pcache = {};
function fillPrevQ(S) {
  const today = todayStr(), pk = prevKey(qOfDate(today)), per = reports.periodOf('chorak', pk), cnt = {};
  S.tx.forEach(t => { cnt[t.acc] = (cnt[t.acc] || 0) + 1; });
  S.accounts.forEach(a => {
    const ck = a.id + '|' + pk + '|' + (cnt[a.id] || 0);
    if (pcache[ck] == null) { let v = 0; try { v = reports.viewAt(S, a, per.to, {}).T || 0; } catch (e) { v = 0; } pcache[ck] = v; }
    a.prevQ = pcache[ck];
  });
}

module.exports = { preview, list, close, revenueByMonth, fillPrevQ, startKey, qOfDate, prevKey };
