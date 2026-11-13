/* BARLOS hisoblash yadrosi: brauzerda ham, serverda ham bir xil ishlaydi.
   Hech qanday tashqi holat yo'q: hamma narsa S (assets, accounts, tx, fx) dan hisoblanadi. */
(function (root) {
  'use strict';
  var GROUPS = {
    kripto: { name: 'Kripto', type: 'foizsiz', ch: 'Bitget', dec: 8, k: 0.7285, step: 0.000001, min: 5, venue: 'Bitget' },
    xalqaro: { name: 'Xalqaro aksiya', type: 'foizsiz', ch: 'IBKR', dec: 4, k: 1.006, step: 0.0001, min: 1, venue: 'IBKR' },
    milliy: { name: 'Milliy aksiya', type: 'foizsiz', ch: 'Jet.uz', dec: 0, k: 0.9635, step: 1, min: 0, venue: 'Jet.uz' },
    metall: { name: 'Qimmatbaho metallar', type: 'foizsiz', ch: 'IBKR', dec: 4, k: 1.006, step: 0.0001, min: 1, venue: 'IBKR' },
    omonat: { name: 'Omonat', type: 'foizli', ch: 'Bank', dec: 0, k: 1.199, step: 1, min: 0, venue: 'Bank' },
    obligatsiya: { name: 'Obligatsiya', type: 'foizli', ch: 'Bank', dec: 0, k: 1.198, step: 1, min: 0, venue: 'Bank' },
    naqd: { name: 'Naqd pul', type: 'foizli', ch: 'Tizim ichida', dec: 0, k: 1.2, step: 1, min: 0, venue: 'Bank' }
  };
  var GKEYS = Object.keys(GROUPS);
  var STATUS = { STRONG_SELL: 'STRONG SELL', SELL: 'SELL', HOLD: 'HOLD', BUY: 'BUY', STRONG_BUY: 'STRONG BUY' };
  var TYPES = ['BUY', 'SELL', 'DEPOZIT', 'WITHDRAW', 'FOIZ', 'DIVIDEND', 'KUPON', 'TRANSFER'];
  var BENCHC = { rate: 25, pay: 'none' }, BENCH_RATE = 1.25, FEE = 0.10, AUTO_FEE = 0.001, MILLIY_FEE = 0.0099;
  var SET = { nBase: 3, nHold: 5, nSell: 7 };

  function fxOf(S, c) { return c === 'UZS' ? 1 : ((S.fx && S.fx[c]) || 0); }
  function assetMap(S) { var m = {}; S.assets.forEach(function (a) { m[a.id] = a; }); return m; }
  function cashAsset(S) { return S.assets.filter(function (a) { return a.group === 'naqd' && a.sym === 'UZS' && !a.archived; })[0] || null; }
  /* Savdo qaysi naqd aktiv hisobiga yoziladi: tranzaksiyada aniq ko'rsatilgan, aktivning o'zida belgilangan,
     aks holda qoida bo'yicha: USD aktivlar Bitget da USDT bilan, boshqa joyda USD bilan; so'mdagi aktivlar so'm bilan. */
  function settleAsset(S, x, t) {
    var am = assetMap(S), id = (t && t.settle) || x.quote;
    if (id && am[id] && !am[id].archived && am[id].id !== x.id) return am[id];
    var cash = S.assets.filter(function (a) { return a.group === 'naqd' && !a.archived && a.id !== x.id; });
    function bySym(q) { return cash.filter(function (a) { return a.sym === q; })[0]; }
    if (x.curr === 'USD') {
      var bg = venueOf(x) === 'Bitget' || (x.src && x.src.type === 'bitget');
      var r = bg ? (bySym('USDT') || bySym('USD')) : (bySym('USD') || bySym('USDT'));
      if (r) return r;
    }
    var c = cashAsset(S); return c && c.id !== x.id ? c : null;
  }
  function venueOf(x) { return x.venue || (x.sym === 'USDT' ? 'Bitget' : GROUPS[x.group].venue); }
  function isAuto(x) { return x.group === 'kripto' || x.group === 'xalqaro' || x.group === 'metall'; }
  function tradable(x) { return x.price != null && x.group !== 'naqd'; }

  function feeOf(x, type, price, amount) {
    if (x.group === 'milliy') return { fee: +(price * amount * MILLIY_FEE).toFixed(2), feeAsset: x.curr };
    if (!isAuto(x)) return { fee: 0, feeAsset: '' };
    if (type === 'BUY') return { fee: amount * AUTO_FEE, feeAsset: x.sym };
    return { fee: amount * price * AUTO_FEE, feeAsset: x.group === 'kripto' ? 'USDT' : 'USD' };
  }

  /* Hisob pozitsiyasi: tranzaksiyalar jurnalidan miqdorlar, o'rtacha narx va pul oqimlari */
  function position(S, accId) {
    var am = assetMap(S), q = {}, flows = [], av = {}, aq = {}, has = {}, income = 0;
    function add(id, v) { q[id] = (q[id] || 0) + v; }
    S.tx.filter(function (t) { return t.acc === accId && t.status === 'Bajarildi'; })
      .sort(function (a, b) { return a.t - b.t; }).forEach(function (t) {
        var x = am[t.aid]; if (!x) return;
        var fx = fxOf(S, x.curr), feeIn = (t.feeAsset && t.feeAsset === x.sym) ? (t.fee || 0) : 0;
        var feeUzs = (t.fee && !feeIn) ? t.fee * (t.feeAsset === 'UZS' ? 1 : fxOf(S, 'USD')) : 0;
        var st = settleAsset(S, x, t), useCash = st && t.cash !== false;
        function cu(uzs) { return uzs / ((fxOf(S, st.curr) || 1) * (st.price || 1)); }
        if (t.type === 'DEPOZIT') { add(x.id, t.amount); flows.push({ t: t.t, uzs: t.uzs || 0 }); }
        else if (t.type === 'WITHDRAW') { add(x.id, -t.amount); flows.push({ t: t.t, uzs: -(t.uzs || 0) }); }
        else if (t.type === 'TRANSFER') { add(x.id, -t.amount - (t.xfee || 0)); if (t.to) add(t.to, t.toAmount || 0); }
        else if (t.type === 'BUY') {
          var a0 = av[x.id] || 0, q0 = aq[x.id] || 0;
          av[x.id] = (a0 * q0 + t.price * t.amount) / (q0 + t.amount); aq[x.id] = q0 + t.amount - feeIn; has[x.id] = true;
          add(x.id, t.amount - feeIn); if (useCash) add(st.id, -cu(t.amount * t.price * fx + feeUzs));
        } else if (t.type === 'SELL') {
          aq[x.id] = (aq[x.id] || 0) - t.amount - feeIn;
          add(x.id, -t.amount - feeIn); if (useCash) add(st.id, cu(t.amount * t.price * fx - feeUzs));
        } else if (t.type === 'DIVIDEND' || t.type === 'FOIZ') {
          var a1 = av[x.id] || 0, q1 = aq[x.id] || 0;
          if (q1 + t.amount > 0) av[x.id] = (a1 * q1) / (q1 + t.amount);
          aq[x.id] = q1 + t.amount; add(x.id, t.amount); income += t.amount * fx * (x.price || 1);
        } else if (t.type === 'KUPON') { if (st) add(st.id, cu(t.amount * fx)); income += t.amount * fx; }
      });
    var avg = {};
    Object.keys(av).forEach(function (id) { var x = am[id]; avg[id] = (has[id] && av[id] > 0 && x.group !== 'naqd' && x.group !== 'omonat') ? av[id] : null; });
    return { q: q, avg: avg, flows: flows, income: income };
  }

  function val(S, x, qty) { return (x.price == null ? 0 : qty * x.price * fxOf(S, x.curr)); }

  function targetOf(acc, x) { var t = acc.targets && acc.targets[x.id]; return t != null ? +t : (x.target || 0); }

  /* Hisob ko'rinishi: aktivlar, qiymatlar, jami */
  function view(S, acc) {
    var p = position(S, acc.id), items = [], T = 0;
    S.assets.forEach(function (x) {
      var qty = p.q[x.id] || 0, v = val(S, x, qty), tg = targetOf(acc, x), ds = x.group === 'omonat' ? depState(S, acc.id, x, S.now) : null, acr = ds && ds.unpaid > 0.005 ? ds.unpaid : 0;
      if (acr > 0) v += acr * (x.price == null ? 1 : x.price) * fxOf(S, x.curr);   /* yig'ilgan, hali to'lanmagan foiz portfel qiymatiga kiradi */
      if (Math.abs(qty) < 1e-12 && !(acr > 0.5) && !(tg > 0 && !x.archived)) return;
      if (x.archived && Math.abs(qty) < 1e-12 && !(acr > 0.5)) return;
      items.push({ x: x, qty: qty, val: v, avg: p.avg[x.id] != null ? p.avg[x.id] : null, target: tg, acr: acr });
      T += v;
    });
    return { acc: acc, items: items, T: T, flows: p.flows, income: p.income, pos: p };
  }
  function held(V) { return V.items.filter(function (i) { return Math.abs(i.qty) > 1e-12 || i.val > 0; }); }

  function band(f) { if (f >= 40) return 'STRONG_BUY'; if (f >= 20) return 'BUY'; if (f <= -40) return 'STRONG_SELL'; if (f <= -20) return 'SELL'; return 'HOLD'; }

  /* ----- Stoch RSI (TradingView usuli): RSI(Wilder) -> Stoch -> K = SMA(stoch, k), D = SMA(K, d) ----- */
  var STOCH_DEF = { rsi: 14, len: 14, k: 7, d: 3 };
  function sma(a, n) { var o = []; for (var i = 0; i < a.length; i++) { if (i < n - 1) { o.push(null); continue; } var s = 0, ok = true; for (var j = i - n + 1; j <= i; j++) { if (a[j] == null) { ok = false; break; } s += a[j]; } o.push(ok ? s / n : null); } return o; }
  function stochRsi(closes, opt) {
    opt = opt || {}; var P = { rsi: +opt.rsi || STOCH_DEF.rsi, len: +opt.len || STOCH_DEF.len, k: +opt.k || STOCH_DEF.k, d: +opt.d || STOCH_DEF.d };
    var c = (closes || []).filter(function (v) { return isFinite(v); }), n = c.length;
    if (n < P.rsi + P.len + P.k - 1) return { k: null, d: null, bars: n, need: P.rsi + P.len + P.k - 1 };
    var rsi = new Array(n).fill(null), g = 0, l = 0, i;
    for (i = 1; i <= P.rsi; i++) { var df = c[i] - c[i - 1]; g += df > 0 ? df : 0; l += df < 0 ? -df : 0; }
    g /= P.rsi; l /= P.rsi; rsi[P.rsi] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (i = P.rsi + 1; i < n; i++) { var d2 = c[i] - c[i - 1]; g = (g * (P.rsi - 1) + (d2 > 0 ? d2 : 0)) / P.rsi; l = (l * (P.rsi - 1) + (d2 < 0 ? -d2 : 0)) / P.rsi; rsi[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    var st = new Array(n).fill(null);
    for (i = P.rsi + P.len - 1; i < n; i++) { var lo = Infinity, hi = -Infinity; for (var j = i - P.len + 1; j <= i; j++) { if (rsi[j] < lo) lo = rsi[j]; if (rsi[j] > hi) hi = rsi[j]; } st[i] = hi === lo ? 0 : (rsi[i] - lo) / (hi - lo) * 100; }
    var K = sma(st, P.k), D = sma(K, P.d);
    return { k: K[n - 1], d: D[n - 1], bars: n, rsi: rsi[n - 1] };
  }
  /* d = F - (F/3) * SIGN(s) * |s|^1.316,  s = (M - 50) / 50,  M = asosiy aktivning 1W Stoch RSI (K) qiymati */
  var STOCH_POW = 1.316;
  function typeTarget(F, M) { var s = (M - 50) / 50, sg = s > 0 ? 1 : s < 0 ? -1 : 0; return F - (F / 3) * sg * Math.pow(Math.abs(s), STOCH_POW); }

  /* Joriy maqsad.
     1) Turlar (kripto, xalqaro, milliy, metall): d = F - (F/3)*SIGN(s)*|s|^1.316 (F = turning normal ulushi, M = asosiy aktiv 1W Stoch RSI).
        Stoch RSI yo'q bo'lsa M = 50 (d = F), holat 'noStoch' bilan belgilanadi.
     2) Foizli guruhlar (omonat, obligatsiya, naqd): (100 - SUM(foizsiz d)) * guruh normali / SUM(foizli normal).
     3) Aktiv: guruh d * aktivning normal ulushi / guruhning normal ulushi.
     Normal ulushlar yig'indisi 100 bo'lmasa, 100 ga keltiriladi. */
  function analyze(S, V) {
    var T = V.T || 1, res = { assets: {}, groups: {}, types: {}, T: V.T, sumD: 0, sumN: 0 }, stoch = (S && S.stoch) || {};
    var as = V.items.filter(function (i) { return i.target > 0; });
    var tot = as.reduce(function (s, i) { return s + i.target; }, 0) || 1, gN = {};
    as.forEach(function (i) { gN[i.x.group] = (gN[i.x.group] || 0) + i.target * 100 / tot; });
    var gd = {}, fsSum = 0, fiN = 0, k;
    Object.keys(gN).forEach(function (g) { if (GROUPS[g].type === 'foizli') fiN += gN[g]; });
    Object.keys(gN).forEach(function (g) {
      if (GROUPS[g].type === 'foizli') return;
      var st = stoch[g], M = st && isFinite(st.m) ? +st.m : 50;
      gd[g] = typeTarget(gN[g], M); fsSum += gd[g];
    });
    var left = 100 - fsSum;
    if (!(fiN > 0)) { /* foizli guruhlar yo'q: foizsizlar 100 ga keltiriladi */ if (fsSum > 0) Object.keys(gd).forEach(function (g) { gd[g] = gd[g] * 100 / fsSum; }); }
    else Object.keys(gN).forEach(function (g) { if (GROUPS[g].type === 'foizli') gd[g] = left * gN[g] / fiN; });
    V.items.forEach(function (i) {
      var g0 = i.x.group, idx = as.indexOf(i), n = idx >= 0 ? i.target * 100 / tot : 0, d = idx >= 0 && gN[g0] > 0 ? gd[g0] * n / gN[g0] : 0, sh = i.val / T * 100;
      var fq = d > 0 ? (d - sh) / d * 100 : 0;
      res.assets[i.x.id] = { share: sh, n: n, d: d, farq: fq, status: d > 0 ? band(fq) : null };
      res.sumD += d; res.sumN += n;
      var g = res.groups[g0] || (res.groups[g0] = { share: 0, n: 0, d: 0, val: 0, m: null, noStoch: false });
      g.share += sh; g.n += n; g.d += d; g.val += i.val;
      if (GROUPS[g0].type === 'foizsiz') { var sx = stoch[g0]; g.m = sx && isFinite(sx.m) ? +sx.m : null; g.noStoch = g.m == null; }
      var ty = GROUPS[g0].type, o = res.types[ty] || (res.types[ty] = { share: 0, n: 0, d: 0, val: 0 });
      o.share += sh; o.n += n; o.d += d; o.val += i.val;
    });
    [res.groups, res.types].forEach(function (m) { Object.keys(m).forEach(function (k) { var g = m[k]; g.farq = g.d > 0 ? (g.d - g.share) / g.d * 100 : 0; g.status = g.d > 0 ? band(g.farq) : null; }); });
    return res;
  }


  function netDep(V) { return V.flows.reduce(function (s, f) { return s + f.uzs; }, 0); }
  /* Taqqoslash qiymati: kiritilgan va yechilgan pullar yillik BENCHC.rate % bilan omonatdagi kabi KUNLIK hisoblanganda bo'ladigan qiymat
     (foiz tushgan kundan keyingi kundan, yechilgan kun uchun yo'q, F = S x R / 365). Koeffitsient = joriy qiymat / shu qiymat. */
  function bench(V, now) {
    now = now || Date.now(); var ev = [];
    V.flows.forEach(function (f) { if (f.uzs) ev.push({ d: dayStr(dayNum(f.t + 5 * 3600e3)), type: f.uzs > 0 ? 'DEPOZIT' : 'WITHDRAW', amt: Math.abs(f.uzs) }); });
    var r = accrue(ev, { rate: BENCHC.rate / 100, to: dayStr(dayNum(now + 5 * 3600e3)), pay: BENCHC.pay, cap: true, loose: true });
    return r.balance + r.unpaid;
  }
  function quarter(V, now) {
    var d = new Date(now || Date.now()), qn = Math.floor(d.getMonth() / 3), qs = new Date(d.getFullYear(), qn * 3, 1).getTime();
    var inv = V.flows.filter(function (f) { return f.t >= qs; }).reduce(function (s, f) { return s + f.uzs; }, 0);
    var prev = +V.acc.prevQ || 0, profit = V.T - (inv + prev);
    return { label: (qn + 1) + '-chorak', inv: inv, prev: prev, profit: profit, fee: Math.max(0, profit) * FEE };
  }

  function decide(side, status, st) {
    st = st || SET;
    if (side === 'BUY') {
      if (status === 'STRONG_SELL') return { ok: false, n: null, why: 'Aktiv statusi STRONG SELL, BUY signali rad etildi.' };
      if (status === 'SELL') return { ok: true, n: st.nSell, why: 'Status SELL, signal BUY: ehtiyotkor, N=' + st.nSell };
      if (status === 'HOLD') return { ok: true, n: st.nHold, why: 'Status HOLD, signal BUY: ehtiyotkor, N=' + st.nHold };
      return { ok: true, n: st.nBase, why: 'Odatiy, N=' + st.nBase };
    }
    if (status === 'STRONG_BUY') return { ok: false, n: null, why: 'Aktiv statusi STRONG BUY, SELL signali rad etildi.' };
    if (status === 'BUY') return { ok: true, n: st.nSell, why: 'Status BUY, signal SELL: ehtiyotkor, N=' + st.nSell };
    if (status === 'HOLD') return { ok: true, n: st.nHold, why: 'Status HOLD, signal SELL: ehtiyotkor, N=' + st.nHold };
    return { ok: true, n: st.nBase, why: 'Odatiy, N=' + st.nBase };
  }

  function clientCalc(S, c, side, price, curr) {
    var d = decide(side, c.status, SET), o = { T: c.T, status: c.status, n: d.n, ok: d.ok, why: d.ok ? '' : d.why, qty: 0, uzs: 0 };
    if (!d.ok) return o;
    var fx = fxOf(S, curr);
    if (!(fx > 0)) { o.ok = false; o.why = 'Valyuta kursi (' + curr + ') kiritilmagan.'; return o; }
    if (side === 'BUY') {
      if (!(c.normal > 0)) { o.ok = false; o.why = 'Bu aktiv uchun normal ulush belgilanmagan.'; return o; }
      o.uzs = c.T * c.normal / 100 / d.n; o.qty = o.uzs / fx / price;
      if (c.cash != null && o.uzs > c.cash + 1e-6) { o.ok = false; o.why = 'Hisob-kitob uchun ' + (c.cashSym || 'naqd') + ' yetarli emas.'; o.qty = 0; o.uzs = 0; }
    } else {
      if (!(c.held > 0)) { o.ok = false; o.why = 'Sotish uchun aktiv yo’q.'; return o; }
      o.qty = c.held / d.n; o.uzs = o.qty * price * fx;
    }
    return o;
  }

  function accLabel(acc) { return (acc.owner || acc.name || acc.id) + (acc.kind === 'isl' ? ' (Islomiy)' : ''); }

  /* Yig'ma bitim: har bir hisob alohida hisoblanadi, qabul qilinganlar yig'ilib bitta buyurtma bo'ladi, keyin ulushga qarab taqsimlanadi */
  function poolRun(S, x, side, price, forced) {
    var g = GROUPS[x.group], cash = settleAsset(S, x, null);
    var rows = S.accounts.filter(function (a) { return !a.archived; }).map(function (acc) {
      var V = view(S, acc), an = analyze(S, V), it = V.items.filter(function (i) { return i.x.id === x.id; })[0];
      var h = it && it.qty > 0 ? it.qty : 0, a = an.assets[x.id];
      var st = forced || (a && a.status) || 'HOLD';
      var cs = cash ? V.items.filter(function (i) { return i.x.id === cash.id; })[0] : null;
      var o = clientCalc(S, { T: V.T, normal: it ? it.target : targetOf(acc, x), status: st, held: h, cash: cs ? cs.val : 0, cashSym: cash ? cash.sym : '' }, side, price, x.curr);
      o.acc = acc; o.name = accLabel(acc); o.held = h; return o;
    });
    var tot = rows.reduce(function (s, r) { return r.ok ? s + r.qty : s; }, 0), usd = tot * price * fxOf(S, x.curr) / (fxOf(S, 'USD') || 1);
    var out = { rows: rows, tot: tot, usd: usd, state: 'none', ord: 0, ratio: 1, step: g.step, min: g.min, feeTot: 0, feeAsset: side === 'BUY' ? x.sym : (x.group === 'kripto' ? 'USDT' : 'USD') };
    if (tot > 0) {
      var ord = +(Math.round(tot / g.step) * g.step).toFixed(8);
      if (usd < g.min || ord <= 0) out.state = 'wait'; else { out.state = 'fill'; out.ord = ord; out.ratio = ord / tot; }
    }
    rows.forEach(function (r) { r.alloc = out.state === 'fill' && r.ok ? r.qty * out.ratio : 0; if (side === 'SELL' && r.alloc > r.held) r.alloc = r.held; r.fee = 0; });
    if (out.state === 'fill') {
      var ff = x.group === 'milliy' ? MILLIY_FEE : AUTO_FEE;
      out.feeTot = side === 'BUY' ? out.ord * ff : out.ord * price * ff;
      if (x.group === 'milliy') out.feeAsset = x.curr;
      var sa = rows.reduce(function (s, r) { return s + r.alloc; }, 0) || 1;
      rows.forEach(function (r) { r.fee = out.feeTot * r.alloc / sa; });
    }
    return out;
  }
  function snap(pr) {
    return { rows: pr.rows.map(function (r) { return { acc: r.acc.id, name: r.name, T: r.T, status: r.status, n: r.n, ok: r.ok, why: r.why || '', qty: r.qty || 0, alloc: r.alloc || 0, fee: r.fee || 0 }; }),
      tot: pr.tot, ord: pr.ord, usd: pr.usd, state: pr.state, feeTot: pr.feeTot, feeAsset: pr.feeAsset, ratio: pr.ratio, step: pr.step, min: pr.min };
  }

  /* Tranzaksiya tekshiruvi. Natija: {ok, error, rec} */
  function checkTx(S, rec, opts) {
    opts = opts || {};
    var am = assetMap(S), x = am[rec.aid], acc = S.accounts.filter(function (a) { return a.id === rec.acc; })[0];
    if (!acc) return { ok: false, error: 'Hisob topilmadi.' };
    if (!x) return { ok: false, error: 'Aktiv topilmadi.' };
    if (TYPES.indexOf(rec.type) < 0) return { ok: false, error: 'Noma’lum tranzaksiya turi.' };
    rec.amount = +rec.amount; rec.price = rec.price === '' || rec.price == null ? NaN : +rec.price;
    if (!(rec.amount > 0) || !isFinite(rec.amount)) return { ok: false, error: 'Miqdor musbat son bo’lishi kerak.' };
    if (isNaN(rec.price)) { if (rec.type === 'TRANSFER') rec.price = x.price || 1; else if (x.group === 'naqd' || x.group === 'omonat' || rec.type === 'DEPOZIT' || rec.type === 'WITHDRAW' || rec.type === 'KUPON') rec.price = (x.group === 'naqd' || x.group === 'omonat') ? 1 : (x.price || 0); else return { ok: false, error: 'Narx kiritilmagan.' }; }
    if (rec.price < 0) return { ok: false, error: 'Narx manfiy bo’lmaydi.' };
    if ((rec.type === 'BUY' || rec.type === 'SELL') && !(rec.price > 0)) return { ok: false, error: 'Narx musbat bo’lishi kerak.' };
    var fx = fxOf(S, x.curr); if (!(fx > 0)) return { ok: false, error: x.curr + ' kursi kiritilmagan (Sozlamalar).' };
    rec.uzs = rec.amount * (rec.price || 0) * fx;
    rec.fee = +rec.fee || 0; rec.feeAsset = rec.feeAsset || '';
    if (!opts.skipBalance) {
      var V = view(S, acc), it = V.items.filter(function (i) { return i.x.id === x.id; })[0], hq = it ? it.qty : 0;
      if (rec.type === 'TRANSFER') { var to = am[rec.to]; if (!to || to.id === x.id) return { ok: false, error: 'Qabul qiluvchi aktiv noto’g’ri.' }; rec.toAmount = +rec.toAmount; if (!(rec.toAmount > 0)) return { ok: false, error: 'Qabul qilinadigan miqdor noto’g’ri.' }; }
      if ((rec.type === 'SELL' || rec.type === 'WITHDRAW') && rec.amount > hq + 1e-9) return { ok: false, error: 'Hisobda yetarli miqdor yo’q (bor: ' + hq + ').' };
      rec.xfee = +rec.xfee || 0; if (rec.type === 'TRANSFER' && rec.amount + rec.xfee > hq + 1e-9) return { ok: false, error: 'Hisobda yetarli miqdor yo’q (bor: ' + hq + ').' };
      var cash = settleAsset(S, x, rec);
      if (rec.type === 'BUY' && cash && rec.cash !== false) {
        var ci = V.items.filter(function (i) { return i.x.id === cash.id; })[0], cq = ci ? ci.qty : 0, need = rec.uzs / ((fxOf(S, cash.curr) || 1) * (cash.price || 1));
        if (need > cq + 1e-9) return { ok: false, error: 'Hisobda ' + cash.sym + ' yetarli emas (bor: ' + +cq.toFixed(4) + ', kerak: ' + +need.toFixed(4) + '). Avval Mablag’lar → Ichki o’tkazma orqali ' + cash.sym + ' ga o’tkazing yoki “Naqdga ta’sir qilmasin” ni belgilang.' };
      }
    }
    return { ok: true, rec: rec };
  }

  /* Orderni bajarish: har bir hisob uchun tranzaksiya yozuvlari ro'yxati (saqlash serverda) */
  function orderTx(S, order, pr, by, chan, blk, t) {
    var x = assetMap(S)[order.aid], out = [];
    pr.rows.forEach(function (r) {
      if (!(r.ok && r.alloc > 0)) return;
      out.push({ acc: r.acc.id, aid: x.id, type: order.side, t: t, price: order.price, amount: r.alloc, fee: r.fee, feeAsset: pr.feeAsset, ex: venueOf(x), chan: chan, by: by, blk: blk, orderId: order.id });
    });
    return out;
  }


  /* ---------- Omonat foizi (kunlik hisob) ----------
     Qoidalar: (1) foiz mablag' tushgan kundan KEYINGI kundan boshlanadi; (2) qaytarilgan/yechilgan kun uchun foiz yo'q;
     (3) foiz har kuni hisoblanadi (to'lov davriyligidan qat'i nazar); (4) qisman yechilsa, qolgan haqiqiy qoldiqdan.
     Kunlik foiz Fk = S * R / 365; davr uchun Fd = Fk * N.
     Har bir d-kun uchun S = (d-kun boshidagi qoldiq) - (shu kuni yechilgan summa); shu kuni tushgan summa hisobga olinmaydi.
     events: [{d:'YYYY-MM-DD', type:'DEPOZIT'|'WITHDRAW'|'FOIZ', amt}], FOIZ = to'langan foiz omonatga qo'shilgan.
     opt: { rate (0.22), to:'YYYY-MM-DD' (shu kun ham hisoblanadi), pay:'none'|'monthly'|'quarterly'|'yearly', cap:true|false, base:365 } */
  function dayNum(s) { if (typeof s === 'number') return Math.floor(s / 864e5); var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return NaN; return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5); }
  function dayStr(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }
  function addMonths(n, k, anchorDay) { var d = new Date(n * 864e5), y = d.getUTCFullYear(), m = d.getUTCMonth() + k, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Math.floor(Date.UTC(y, m, Math.min(anchorDay, last)) / 864e5); }
  function accrue(events, opt) {
    opt = opt || {}; var R = +opt.rate || 0, base = opt.base || 365, to = dayNum(opt.to), step = { monthly: 1, quarterly: 3, yearly: 12 }[opt.pay] || 0;
    var ev = (events || []).map(function (e) { return { d: dayNum(e.d), type: e.type, amt: +e.amt || 0 }; }).filter(function (e) { return isFinite(e.d) && e.amt > 0 && (e.type === 'DEPOZIT' || e.type === 'WITHDRAW' || e.type === 'FOIZ'); }).sort(function (a, b) { return a.d - b.d; });
    var out = { rows: [], total: 0, paid: 0, unpaid: 0, balance: 0, days: 0, errors: [], pays: [] };
    if (!ev.length || !isFinite(to)) return out;
    var first = ev[0].d, anchor = new Date(first * 864e5).getUTCDate(), bal = 0, unpaid = 0, i = 0, k = 1, nextPay = step ? addMonths(first, step, anchor) : Infinity;
    for (var d = first; d <= to; d++) {
      var dep = 0, wd = 0, cr = 0;
      while (i < ev.length && ev[i].d === d) { var e = ev[i++]; if (e.type === 'DEPOZIT') dep += e.amt; else if (e.type === 'WITHDRAW') wd += e.amt; else cr += e.amt; }
      if (wd > bal + 1e-9) {
        if (opt.loose) { unpaid = Math.max(0, unpaid - (wd - bal)); wd = bal; }   /* taqqoslash hisobida: ortiqcha yechish yig'ilgan foizdan ayriladi */
        else { out.errors.push(dayStr(d) + ': yechilgan summa qoldiqdan katta (' + Math.round(wd) + ' > ' + Math.round(bal) + ')'); wd = bal; }
      }
      var S = bal - wd, fk = S * R / base; if (opt.r8) fk = Math.round(fk * 1e8) / 1e8;                        /* shu kuni foiz beradigan qoldiq */
      out.total += fk; unpaid += fk; if (S > 0 && fk > 0) out.days++;
      bal = S + dep + cr;                                          /* shu kuni tushganlar ertadan boshlab foiz oladi */
      var pay = 0;
      if (d === nextPay && step) { pay = unpaid; if (opt.cap !== false) bal += pay; out.paid += pay; unpaid = 0; out.pays.push({ d: dayStr(d), amt: pay, cap: opt.cap !== false }); nextPay = addMonths(first, step * (++k), anchor); }
      out.rows.push({ d: dayStr(d), S: S, fk: fk, dep: dep, wd: wd, pay: pay, bal: bal, acc: unpaid });
    }
    out.balance = bal; out.unpaid = unpaid; return out;
  }

  /* ---------- Omonat: aktivning yillik foizi (x.rate, %) bo'yicha kunlik hisob ----------
     Hodisalar tranzaksiyalardan: kirim (DEPOZIT, BUY, TRANSFER kirimi), chiqim (WITHDRAW, SELL, TRANSFER chiqimi), FOIZ = omonatga qo'shilgan foiz.
     Foiz har kuni haqiqiy qoldiqdan hisoblanadi; to'langan foiz (FOIZ yoki KUPON yozuvi) hisobdan ayriladi: to'lanmagan = hisoblangan - to'langan. */
  function depEvents(S, accId, aid) {
    var ev = [], paid = [];
    S.tx.forEach(function (t) {
      if (t.acc !== accId || t.status !== 'Bajarildi') return; var d = dayStr(dayNum(t.t + 5 * 3600e3));
      if (t.aid === aid) {
        if (t.type === 'DEPOZIT' || t.type === 'BUY') ev.push({ d: d, type: 'DEPOZIT', amt: t.amount });
        else if (t.type === 'WITHDRAW' || t.type === 'SELL') ev.push({ d: d, type: 'WITHDRAW', amt: t.amount + (t.feeAsset && t.fee ? 0 : 0) });
        else if (t.type === 'TRANSFER') ev.push({ d: d, type: 'WITHDRAW', amt: t.amount + (t.xfee || 0) });
        else if (t.type === 'FOIZ') { ev.push({ d: d, type: 'FOIZ', amt: t.amount }); paid.push({ d: d, amt: t.amount }); }
        else if (t.type === 'KUPON') paid.push({ d: d, amt: t.amount });
      }
      if (t.type === 'TRANSFER' && t.to === aid) ev.push({ d: d, type: 'DEPOZIT', amt: t.toAmount || 0 });
    });
    return { ev: ev, paid: paid };
  }
  function r8(v) { return Math.round(v * 1e8) / 1e8; }
  var depCache = {}, depN = 0;
  function depAccrue(S, accId, x, toDay, upTo) {
    var R = +x.rate; if (!(R > 0)) return null;
    var E = depEvents(S, accId, x.id), ev = upTo ? E.ev.filter(function (e) { return e.d <= upTo; }) : E.ev; if (!ev.length) return null;
    var key = accId + '|' + x.id + '|' + R + '|' + toDay + '|' + ev.map(function (e) { return e.d + e.type[0] + e.amt; }).join(','), c = depCache[key];
    if (!c) { if (++depN > 400) { depCache = {}; depN = 0; } c = depCache[key] = accrue(ev, { rate: R / 100, to: toDay, pay: 'none', r8: true }); }
    var paid = E.paid.filter(function (p) { return !upTo || p.d <= upTo; }).reduce(function (s, p) { return s + p.amt; }, 0);
    return { total: r8(c.total), paid: r8(paid), unpaid: Math.max(0, r8(c.total - paid)), days: c.days, first: ev[0].d, rows: c.rows, errors: c.errors };
  }
  /* Bugungi holat: { total, paid, unpaid, days } yoki null */
  function depState(S, accId, x, now) { return depAccrue(S, accId, x, dayStr(dayNum((now || Date.now()) + 5 * 3600e3))); }
  var DEP_STEP = { monthly: 1 };
  /* To'lov: har oy bir marta. Boshlanish sanasi (x.dstart, bo'lmasa birinchi kirim kuni) kiritiladi; foiz har oy shu kunning ERTASIGA to'lanadi.
     Yoziladigan summa = shu kun (to'lov kunidan bir kun oldin) gacha hisoblangan, hali to'lanmagan foiz. To'langach omonat qoldig'iga qo'shiladi. Soliq hisoblanmaydi. */
  function depDue(S, now, opt) {
    opt = opt || {}; var back = opt.back != null ? opt.back : 400, ahead = opt.ahead != null ? opt.ahead : 7, today = dayNum((now || Date.now()) + 5 * 3600e3), out = [];
    S.assets.filter(function (x) { return x.group === 'omonat' && !x.archived && +x.rate > 0 && DEP_STEP[x.dpay]; }).forEach(function (x) {
      S.accounts.filter(function (a) { return !a.archived; }).forEach(function (acc) {
        var E = depEvents(S, acc.id, x.id); if (!E.ev.length) return;
        var first = x.dstart && isFinite(dayNum(x.dstart)) ? dayNum(x.dstart) : dayNum(E.ev[0].d), anchor = new Date(first * 864e5).getUTCDate(), step = DEP_STEP[x.dpay];
        for (var k = 1; k < 600; k++) {
          var ann = addMonths(first, step * k, anchor), pn = ann + 1; if (pn > today + ahead) break; if (pn < today - back) continue;
          var ps = dayStr(pn), pd = dayStr(ann), key = 'dp|' + x.id + '|' + acc.id + '|' + ps, done = S.tx.some(function (t) { return t.bk === key && t.status === 'Bajarildi'; });
          var st = pn <= today ? depAccrue(S, acc.id, x, pd, pd) : null, amt = st ? st.unpaid : 0, dd = pn - today;
          if (!done && pn <= today && !(amt > 0)) continue;
          out.push({ key: key, acc: acc.id, accName: accLabel(acc), aid: x.id, sym: x.sym, date: ps, upto: pd, kind: 'FOIZ', amt: amt, days: dd, done: done, status: done ? 'yozilgan' : dd < 0 ? 'yozilmagan' : dd === 0 ? 'bugun' : 'yaqin' });
        }
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  /* ---------- Obligatsiya: kupon jadvali, yig'ilgan kupon foizi, YTM, signal, kutilayotgan to'lovlar ----------
     bond: { nominal (1 dona, aktiv valyutasida), rate (yillik kupon, %), freq (yiliga kupon soni: 1/2/4/12),
             first ('YYYY-MM-DD' birinchi kupon sanasi) yoki coupons:[{d, amt?}] (aniq sanalar), maturity (so'ndirish sanasi),
             issue (birinchi davr boshlanishi, ixtiyoriy), redeem (so'ndirish narxi, nominalning %, standart 100) }
     Kupon summasi (1 dona) = nominal * rate / freq (amt berilsa, o'sha). Yig'ilgan foiz = kupon * (oxirgi kupondan o'tgan kun / davr kunlari). */
  function bondSched(b) {
    var out = []; if (!b || !(+b.nominal > 0)) return out;
    var f = Math.max(1, Math.round(b.freq || 4)), per = 12 / f, nom = +b.nominal, red = (b.redeem == null || b.redeem === '' ? 100 : +b.redeem) / 100 * nom, mat = b.maturity ? dayNum(b.maturity) : NaN, cp = nom * (+b.rate || 0) / 100 / f, ds = [];
    if (Array.isArray(b.coupons) && b.coupons.length) b.coupons.forEach(function (c) { var d = dayNum(c.d); if (isFinite(d)) ds.push({ n: d, amt: +c.amt > 0 ? +c.amt : cp }); });
    else if (b.first) { var fd = dayNum(b.first); if (isFinite(fd)) { var anc = new Date(fd * 864e5).getUTCDate(), k = 0, d = fd; while ((!isFinite(mat) || d <= mat) && k < 400) { ds.push({ n: d, amt: cp }); k++; d = addMonths(fd, per * k, anc); if (!isFinite(mat) && k > 60) break; } } }
    if (isFinite(mat) && !ds.some(function (x) { return x.n === mat; })) ds.push({ n: mat, amt: cp });
    ds.sort(function (a, b2) { return a.n - b2.n; });
    var last = ds.length - 1, iss = b.issue ? dayNum(b.issue) : NaN;
    ds.forEach(function (x, i) {
      var prev = i ? ds[i - 1].n : (isFinite(iss) ? iss : addMonths(x.n, -per, new Date(x.n * 864e5).getUTCDate()));
      out.push({ n: x.n, d: dayStr(x.n), prev: dayStr(prev), cpn: x.amt, red: (isFinite(mat) ? x.n === mat : i === last) ? red : 0 });
    });
    return out;
  }
  function bondAccrued(b, date) {
    var n = dayNum(date), s = bondSched(b), r = s.filter(function (x) { return x.n > n; })[0];
    if (!r) return { accrued: 0, prev: null, next: null, days: 0, period: 0 };
    var pn = dayNum(r.prev), days = Math.max(0, n - pn), per = Math.max(1, r.n - pn);
    return { accrued: n < pn ? 0 : r.cpn * days / per, prev: r.prev, next: r.d, days: days, period: per, cpn: r.cpn };
  }
  /* Yillik samarali daromadlilik (actual/365). price: 1 dona narxi (toza, ya'ni yig'ilgan kuponsiz); opt.dirty=true bo'lsa narx yig'ilgan kupon bilan */
  function bondYtm(b, price, date, opt) {
    opt = opt || {}; var n = dayNum(date), cf = bondSched(b).filter(function (x) { return x.n > n; }), ac = bondAccrued(b, date).accrued, dirty = +price + (opt.dirty ? 0 : ac);
    if (!cf.length || !(dirty > 0)) return null;
    function pv(y) { return cf.reduce(function (s, x) { return s + (x.cpn + x.red) / Math.pow(1 + y, (x.n - n) / 365); }, 0); }
    var lo = -0.9, hi = 20; if (pv(lo) < dirty || pv(hi) > dirty) return null;
    for (var i = 0; i < 100; i++) { var m = (lo + hi) / 2; if (pv(m) > dirty) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  /* Signal: YTM maqsadli daromaddan (hurdle, %) yetarlicha yuqori bo'lsa BUY, past bo'lsa SELL */
  function bondSignal(b, price, date, opt) {
    opt = opt || {}; var h = opt.hurdle != null ? +opt.hurdle : 25, bm = opt.buy != null ? +opt.buy : 1, sm = opt.sell != null ? +opt.sell : 3, y = bondYtm(b, price, date, opt);
    var ac = bondAccrued(b, date).accrued, o = { ytm: y == null ? null : y * 100, accrued: ac, dirty: +price + (opt.dirty ? 0 : ac), side: null, why: '' };
    if (y == null) { o.why = 'Daromadlilikni hisoblab bo‘lmadi (narx yoki jadval yetarli emas).'; return o; }
    if (o.ytm >= h + bm) { o.side = 'BUY'; o.why = 'YTM ' + o.ytm.toFixed(2) + '% ≥ maqsad ' + h + '% + ' + bm + ' punkt'; }
    else if (o.ytm <= h - sm) { o.side = 'SELL'; o.why = 'YTM ' + o.ytm.toFixed(2) + '% ≤ maqsad ' + h + '% − ' + sm + ' punkt'; }
    else o.why = 'YTM ' + o.ytm.toFixed(2) + '%: maqsad ' + h + '% atrofida, signal yo‘q';
    return o;
  }
  function qtyAt(S, accId, aid, ms) { var S2 = { assets: S.assets, fx: S.fx, accounts: S.accounts, tx: S.tx.filter(function (t) { return t.t <= ms; }) }; return position(S2, accId).q[aid] || 0; }
  /* Hisob bo'yicha kupon/so'ndirish hodisalari: o'tgan (yozilmagan bo'lsa taklif) va yaqin kunlardagi. now: ms */
  function bondDue(S, now, opt) {
    opt = opt || {}; var ahead = opt.ahead != null ? opt.ahead : 7, back = opt.back != null ? opt.back : 60, today = dayNum((now || Date.now()) + 5 * 3600e3), out = [];
    S.assets.filter(function (x) { return x.group === 'obligatsiya' && !x.archived && x.bond; }).forEach(function (x) {
      var sc = bondSched(x.bond);
      S.accounts.filter(function (a) { return !a.archived; }).forEach(function (acc) {
        sc.forEach(function (r) {
          if (r.n < today - back || r.n > today + ahead) return;
          var qty = qtyAt(S, acc.id, x.id, (r.n + 1) * 864e5 - 5 * 3600e3); if (!(qty > 1e-12)) return;
          [['KUPON', r.cpn], ['SONDIRISH', r.red]].forEach(function (k) {
            if (!(k[1] > 0)) return;
            var key = x.id + '|' + acc.id + '|' + r.d + '|' + k[0], done = S.tx.some(function (t) { return t.bk === key && t.status === 'Bajarildi'; }), dd = r.n - today;
            out.push({ key: key, acc: acc.id, accName: accLabel(acc), aid: x.id, sym: x.sym, date: r.d, kind: k[0], qty: qty, per: k[1], amt: qty * k[1], days: dd, done: done,
              status: done ? 'yozilgan' : dd < 0 ? 'yozilmagan' : dd === 0 ? 'bugun' : 'yaqin' });
          });
        });
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function groupSums(S, V) {
    var m = {}; V.items.forEach(function (i) { if (i.val > 0) m[i.x.group] = (m[i.x.group] || 0) + i.val; });
    return GKEYS.filter(function (k) { return m[k] > 0; }).map(function (k) { return { key: k, name: GROUPS[k].name, type: GROUPS[k].type, sum: m[k], share: m[k] / (V.T || 1) * 100 }; });
  }

  /* ---------- Aktiv kartochkasi: F4 maydonlari, daromad va aktivga xos 25% koeffitsient ----------
     Faqat shu aktivga kiritilgan va undan qaytgan pul hisobga olinadi: BUY/DEPOZIT/TRANSFER kirimi = kiritilgan, SELL/WITHDRAW/KUPON/TRANSFER chiqimi = qaytgan.
     Koeffitsient = aktivning hozirgi qiymati / shu pul oqimlari yillik 25% bilan kunlik hisoblanganda bo'ladigan qiymat. Naqd pul uchun hisoblanmaydi (savdolar bilan o'zgaradi). */
  function assetTx(S, accs, x) {
    var ids = {}; accs.forEach(function (a) { ids[a.id] = 1; });
    return S.tx.filter(function (t) { return ids[t.acc] && t.status === 'Bajarildi' && (t.aid === x.id || (t.type === 'TRANSFER' && t.to === x.id)); }).sort(function (a, b) { return a.t - b.t; });
  }
  function assetStats(S, accs, x, now) {
    now = now || S.now || Date.now();
    var fx = fxOf(S, x.curr), px = x.price == null ? 0 : x.price, cash = x.group === 'naqd', T = 0, st = { x: x, cash: cash, qty: 0, cost: 0, value: 0, acr: 0, inn: 0, out: 0, realized: 0, income: 0, flows: [], by: [], avgNum: 0, avgDen: 0 };
    accs.forEach(function (acc) {
      var V = view(S, acc); T += V.T;
      var it = V.items.filter(function (i) { return i.x.id === x.id; })[0], q = 0, c = 0, ai = 0, ao = 0, ar = 0, ainc = 0;
      var txs = assetTx(S, [acc], x), p = position(S, acc.id);
      if (!cash) txs.forEach(function (t) {
        var feeIn = (t.feeAsset && t.feeAsset === x.sym) ? (t.fee || 0) : 0, feeUzs = (t.fee && !feeIn) ? t.fee * (t.feeAsset === 'UZS' ? 1 : fxOf(S, 'USD')) : 0, uzs;
        function buy(qty, uz) { q += qty; c += uz; ai += uz; st.flows.push({ t: t.t, uzs: uz }); }
        function sell(qty, uz) { var u = q > 0 ? c / q : 0, qq = Math.min(qty, Math.max(q, 0)); ar += uz - u * qq; c -= u * qq; q -= qq; ao += uz; st.flows.push({ t: t.t, uzs: -uz }); }
        if (t.type === 'BUY') { uzs = t.amount * t.price * fx + feeUzs; q += t.amount - feeIn; c += uzs; ai += uzs; st.flows.push({ t: t.t, uzs: uzs }); }
        else if (t.type === 'SELL') sell(t.amount + feeIn, t.amount * t.price * fx - feeUzs);
        else if (t.type === 'DEPOZIT') buy(t.amount, t.uzs != null ? t.uzs : t.amount * (t.price || px || 1) * fx);
        else if (t.type === 'WITHDRAW') sell(t.amount, t.uzs != null ? t.uzs : t.amount * (t.price || px || 1) * fx);
        else if (t.type === 'TRANSFER') { if (t.aid === x.id) sell(t.amount + (t.xfee || 0), t.amount * (px || 1) * fx); else buy(t.toAmount || 0, (t.toAmount || 0) * (px || 1) * fx); }
        else if (t.type === 'DIVIDEND' || t.type === 'FOIZ') { var inc = t.amount * (px || 1) * fx; q += t.amount; c += inc; ainc += inc; }
        else if (t.type === 'KUPON') { ao += t.amount * fx; ainc += t.amount * fx; st.flows.push({ t: t.t, uzs: -t.amount * fx }); }
      });
      var qty = it ? it.qty : 0, val = it ? it.val : 0, acrv = it ? (it.acr || 0) * (px || 1) * fx : 0;
      if (cash) { st.qty += qty; st.value += val; st.by.push({ acc: acc, qty: qty, value: val }); return; }
      st.qty += qty; st.value += val; st.acr += acrv; st.cost += c; st.inn += ai; st.out += ao; st.realized += ar; st.income += ainc;
      if (p.avg[x.id] != null && qty > 0) { st.avgNum += p.avg[x.id] * qty; st.avgDen += qty; }
      st.by.push({ acc: acc, qty: qty, value: val, cost: c, avg: p.avg[x.id] != null ? p.avg[x.id] : null, share: V.T > 0 ? val / V.T * 100 : 0 });
    });
    st.price = x.price; st.avg = st.avgDen > 0 ? st.avgNum / st.avgDen : null; st.T = T; st.share = T > 0 ? st.value / T * 100 : 0;
    if (cash) return st;
    st.reval = st.value - st.cost;                                   /* qayta baholash natijasi (F4): qiymat - tannarx */
    st.unreal = st.reval; st.total = st.value + st.out - st.inn; st.pct = st.inn > 0 ? st.total / st.inn * 100 : null;
    st.bench = bench({ flows: st.flows }, now); st.coef = st.bench > 1e-9 && st.value > 1e-9 ? st.value / st.bench : null;
    st.benchGain = st.bench - (st.inn - st.out); st.benchPct = st.inn > 0 ? st.benchGain / st.inn * 100 : null;
    return st;
  }

  var Core = { GROUPS: GROUPS, GKEYS: GKEYS, STATUS: STATUS, TYPES: TYPES, SET: SET, BENCH_RATE: BENCH_RATE, BENCHC: BENCHC, FEE: FEE, fxOf: fxOf, assetMap: assetMap, cashAsset: cashAsset,
    venueOf: venueOf, settleAsset: settleAsset, isAuto: isAuto, tradable: tradable, feeOf: feeOf, position: position, val: val, targetOf: targetOf, view: view, held: held, band: band, analyze: analyze,
    netDep: netDep, bench: bench, quarter: quarter, decide: decide, clientCalc: clientCalc, poolRun: poolRun, snap: snap, checkTx: checkTx, orderTx: orderTx, groupSums: groupSums, accLabel: accLabel, accrue: accrue, stochRsi: stochRsi, typeTarget: typeTarget, STOCH_DEF: STOCH_DEF, dayNum: dayNum, dayStr: dayStr, addMonths: addMonths, depState: depState, depDue: depDue, bondSched: bondSched, bondAccrued: bondAccrued, bondYtm: bondYtm, bondSignal: bondSignal, bondDue: bondDue, qtyAt: qtyAt, assetStats: assetStats, assetTx: assetTx };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
