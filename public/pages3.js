/* Sahifalar 3: aktiv oynasi (modal), omonat oynasi, birlashgan hisobot/hujjatlar, omonat signali (Avto savdo), profil, chat */
(function (B) {
  'use strict';
  var Core = B.Core, GROUPS = B.GROUPS, ST = B.ST, esc = B.esc, money = B.money, pct = B.pct, sgn = B.sgn, fdt = B.fdt, nf = B.nf, gcol = B.gcol, fld = B.fld, bind = B.bind, empty = B.empty;
  function D() { return B.D(); }
  function bd(n) { return ' data-bind="' + n + '"'; }
  function post(u, b, m) { return B.run(B.api('POST', u, b || {}), m); }
  function two(n) { return String(n).padStart(2, '0'); }
  function dmy(s) { return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4); }
  function tm(t) { var d = new Date(t + 5 * 3600e3); return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()) + ' ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()); }
  function dayOf(t) { return Core.dayStr(Core.dayNum(t + 5 * 3600e3)); }
  B.hooks = B.hooks || [];

  /* ================= MODAL TIZIMI ================= */
  B.acts.mx = function () { ST.modal = null; };
  B.acts.mclose = function (el, e) { if (e && e.target !== el) return false; ST.modal = null; };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ST.modal) { ST.modal = null; B.rerender(); } });
  B.hooks.push(function () { document.body.classList.toggle('mdl-open', !!ST.modal); });
  B.modalHtml = function () {
    var m = ST.modal; if (!m) return '';
    var f = B.modals[m.t], c = f ? f(m) : null; if (!c) return '';
    return '<div class="mdl-bg" data-act="mclose"><div class="mdl' + (c.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(c.aria || '') + '"><button class="mdl-x" data-act="mx" aria-label="Yopish">×</button>' + c.html + '</div></div>';
  };
  B.modals = {};

  /* ================= AKTIV OYNASI ================= */
  var INSTR = { kripto: 'Kripto-aktiv', xalqaro: 'Xalqaro aksiya / ETF', milliy: 'Milliy aksiya', metall: 'Qimmatbaho metall', omonat: 'Bank omonati', obligatsiya: 'Obligatsiya', naqd: 'Pul mablag‘lari' };
  var SRCN = { bitget: 'Bitget/Binance', cmc: 'CoinMarketCap', finviz: 'Finviz', web: 'Veb-sahifa', uzse: 'uzse.uz' };
  B.acts.assetopen = function (el) { ST.modal = { t: 'asset', aid: el.getAttribute('data-v'), acc: el.getAttribute('data-acc') || 'all', f: 'all' }; ST.mtab = 'all'; };
  B.acts.atxf = function (el) { ST.modal.f = el.getAttribute('data-v'); };
  function scope(m) { var d = D(); return m.acc && m.acc !== 'all' ? d.accounts.filter(function (a) { return a.id === m.acc; }) : d.accounts.filter(function (a) { return !a.archived; }); }
  function kv(rows) { return '<dl class="kv">' + rows.map(function (r) { return r ? '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>' : ''; }).join('') + '</dl>'; }
  function tone(v) { return v > 0 ? 'good' : v < 0 ? 'bad' : ''; }
  function signed(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v)); }

  var SIDE = { BUY: ['Sotib olish', 'in'], SELL: ['Sotish', 'out'], DEPOZIT: ['Kirim', 'in'], WITHDRAW: ['Chiqim', 'out'], TRANSFER: ['O‘tkazma', 'out'], DIVIDEND: ['Dividend', 'in'], FOIZ: ['Foiz', 'in'], KUPON: ['Kupon', 'in'] };
  var TF = { all: ['Hammasi', null], trade: ['Savdo', ['BUY', 'SELL']], inc: ['Daromad', ['FOIZ', 'DIVIDEND', 'KUPON']], flow: ['Kirim/chiqim', ['DEPOZIT', 'WITHDRAW', 'TRANSFER']] };
  function pairOf(x) { var q = x.curr === 'UZS' ? 'UZS' : (x.group === 'kripto' || x.group === 'metall' ? 'USDT' : 'USD'); return x.group === 'omonat' || x.group === 'naqd' ? x.sym : x.sym + '/' + q; }
  /* Binance buyurtmalar tarixi ko'rinishidagi jadval */
  function txBook(accs, x, f) {
    var S = B.S(), list = Core.assetTx(S, accs, x).slice().reverse(), staff = B.isStaff() && accs.length > 1, fl = TF[f] && TF[f][1];
    var aname = {}; accs.forEach(function (a) { aname[a.id] = a.owner || a.name; });
    var all = list.length; if (fl) list = list.filter(function (t) { return fl.indexOf(t.type) >= 0; });
    var h = '<div class="row sb" style="margin-top:6px"><h3>Tranzaksiyalar <span class="muted mini">(' + all + ')</span></h3><div class="row" role="group">' + Object.keys(TF).map(function (k) { return '<button class="chip" data-act="atxf" data-v="' + k + '" aria-pressed="' + (f === k) + '">' + TF[k][0] + '</button>'; }).join('') + '</div></div>';
    if (!list.length) return h + '<p class="muted">Bu aktivda tranzaksiya yo‘q.</p>';
    h += '<div class="tw"><table class="bn"><thead><tr><th>Sana (UTC+5)</th><th>Juftlik</th><th>Tur</th><th class="n">Narx</th><th class="n">Bajarildi</th><th class="n">Summa</th><th class="n">Komissiya</th>' + (staff ? '<th>Mijoz</th>' : '') + '<th>Holat</th></tr></thead><tbody>';
    list.forEach(function (t) {
      var s = SIDE[t.type] || [t.type, 'in'], toIn = t.type === 'TRANSFER' && t.to === x.id, side = toIn ? 'in' : s[1], lab = toIn ? 'O‘tkazma (kirim)' : s[0];
      var qty = toIn ? t.toAmount : t.amount, px = t.price, tot = (t.type === 'KUPON') ? t.amount : (qty || 0) * (px != null ? px : 1);
      var fee = t.fee ? nf(t.fee, 8) + ' ' + esc(t.feeAsset || '') : '—';
      h += '<tr><td class="mono"><span class="dbar ' + side + '"></span>' + tm(t.t) + '</td><td><b>' + esc(pairOf(x)) + '</b></td><td><span class="sd ' + side + '">' + lab + '</span></td><td class="n">' + (px != null && t.type !== 'TRANSFER' && x.group !== 'omonat' && x.group !== 'naqd' ? B.pxStr(x, px) : '—') + '</td><td class="n">' + B.qtyStr(x, qty) + '</td><td class="n">' + (x.curr === 'UZS' || x.group === 'omonat' ? nf(tot, 2) + ' so‘m' : nf(tot, 2) + ' ' + x.curr) + '</td><td class="n">' + fee + '</td>' + (staff ? '<td>' + esc(aname[t.acc] || t.acc) + '</td>' : '') + '<td><span class="pill ok">Bajarildi</span><div class="muted mini">' + esc(t.id) + '</div></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function niceTicks(lo, hi, n) { var span = (hi - lo) || 1, st = Math.pow(10, Math.floor(Math.log10(span / n))), e = span / n / st; st *= e >= 5 ? 5 : e >= 2 ? 2 : 1; var o = []; for (var v = Math.ceil(lo / st) * st; v <= hi + st * 0.001; v += st) o.push(Math.round(v / st) * st); if (o[o.length - 1] < hi) o.push(o[o.length - 1] + st); return o; }
  function lineChart(rows, key, div, step, color, label) {
    if (!rows.length) return '<p class="muted">Ma’lumot yo‘q.</p>';
    var W = 560, H = 200, L = 46, R = 10, T = 10, Bt = 24, xs = rows.map(function (r) { return Core.dayNum(r.d); }), x0 = xs[0], x1 = xs[xs.length - 1] || x0 + 1;
    var ys = rows.map(function (r) { return r[key] / div; }), hi = Math.max.apply(null, ys.concat([0.0001])), tk = niceTicks(0, hi, 4), top = tk[tk.length - 1] || 1;
    var X = function (d) { return L + (x1 === x0 ? 0 : (d - x0) / (x1 - x0)) * (W - L - R); }, Y = function (v) { return T + (1 - v / top) * (H - T - Bt); };
    var pts = []; rows.forEach(function (r, i) { var x = X(xs[i]), y = Y(ys[i]); if (step && i) pts.push([x, pts[pts.length - 1][1]]); pts.push([x, y]); });
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '), area = path + ' L' + X(x1).toFixed(1) + ' ' + Y(0) + ' L' + X(x0).toFixed(1) + ' ' + Y(0) + ' Z';
    var g = tk.map(function (v) { return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + (Math.round(v * 100) / 100) + '</text>'; }).join('');
    var xt = [0, 1, 2, 3].map(function (k) { var d = Math.round(x0 + (x1 - x0) * k / 3); return '<text x="' + X(d).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (k === 0 ? 'start' : k === 3 ? 'end' : 'middle') + '">' + dmy(Core.dayStr(d)).slice(0, 5) + '</text>'; }).join('');
    var lp = pts[pts.length - 1];
    return '<svg class="mchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">' + g + xt + '<path d="' + area + '" fill="' + color + '" fill-opacity=".12"/><path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/><circle cx="' + lp[0].toFixed(1) + '" cy="' + lp[1].toFixed(1) + '" r="3.5" fill="' + color + '"/></svg>';
  }

  function assetHead(x, accs, st) {
    var one = accs.length === 1 ? accs[0] : null, sub = one ? esc(one.owner || '') + ' · ' + esc(one.name || '') : (accs.length + ' ta hisob bo‘yicha jami');
    return '<div class="mdl-h">' + B.logo(x, 46) + '<div><h2>' + esc(x.name || x.sym) + '</h2><p class="sub" style="margin:0"><span class="tag">' + esc(x.sym) + ' · ' + (INSTR[x.group] || '') + '</span> · ' + sub + '</p></div></div>';
  }

  B.modals.asset = function (m) {
    var S = B.S(), x = D().assets.filter(function (a) { return a.id === m.aid; })[0]; if (!x) return null;
    var accs = scope(m), st = Core.assetStats(S, accs, x, Date.now());
    if (x.group === 'omonat') return { wide: true, aria: x.sym, html: omonatModal(x, accs, st, m) };
    var h = assetHead(x, accs, st);
    var src = x.src && SRCN[x.src.type] ? SRCN[x.src.type] : 'Qo‘lda kiritilgan narx';
    var hier = (x.group === 'obligatsiya') ? '2-daraja' : '1-daraja';
    var method = x.group === 'naqd' ? 'Nominal qiymat' : 'Bozor narxi (' + src + ')';
    h += '<h3>Aktiv kartochkasi</h3>';
    h += kv([
      ['Instrument turi', INSTR[x.group] || ''], ['Nomi / emitent', esc(x.issuer || x.name || x.sym)], ['ISIN / kod', x.isin ? '<span class="mono">' + esc(x.isin) + '</span>' : '<span class="muted">kiritilmagan</span>'], ['Valyuta', esc(x.curr)],
      ['Soni (miqdori)', B.qtyStr(x, st.qty)], st.cash ? null : ['O‘rtacha narx', st.avg != null ? B.pxStr(x, st.avg) : '—'], st.cash ? null : ['Jami tannarx', money(st.cost)], ['Baholash narxi', x.price == null ? '<span class="bad">narxsiz</span>' : B.pxStr(x, x.price)],
      ['Joriy bozor qiymati', '<b>' + money(st.value) + '</b>'], st.cash ? null : ['Qayta baholash natijasi', '<span class="' + tone(st.reval) + '">' + signed(st.reval) + '</span>'], ['Portfeldagi ulushi', pct(st.share, 2)], ['Ierarxiya darajasi', hier], ['Baholash usuli', method]
    ]);
    if (st.cash) return { wide: true, aria: x.sym, html: h + '<p class="muted mini">Pul mablag‘i savdolar bilan avtomatik o‘zgaradi, shuning uchun alohida daromad va koeffitsient hisoblanmaydi.</p>' + txBook(accs, x, m.f) };
    h += '<h3>Daromad</h3><div class="stats mstats"><div class="stat"><small>Jami daromad (so‘m)</small><b class="' + tone(st.total) + '">' + signed(st.total) + '</b></div><div class="stat"><small>Jami daromad (%)</small><b class="' + tone(st.pct || 0) + '">' + (st.pct == null ? '—' : sgn(st.pct, 2)) + '</b></div>' +
      '<div class="stat"><small>Koeffitsient (25% yillik bilan)</small><b>' + (st.coef == null ? '—' : nf(st.coef, 3)) + '</b></div><div class="stat"><small>Kiritilgan pul</small><b>' + money(st.inn) + '</b></div></div>';
    h += kv([['Sotuvdan olingan (realizatsiya)', '<span class="' + tone(st.realized) + '">' + signed(st.realized) + '</span>'], ['Baholash natijasi (sotilmagan qism)', '<span class="' + tone(st.unreal) + '">' + signed(st.unreal) + '</span>'], ['Dividend / foiz / kupon', '<span class="' + tone(st.income) + '">' + signed(st.income) + '</span>'], ['Qaytgan pul (sotuv, kupon)', money(st.out)]]);
    var br = Core.BENCHC.rate;
    h += '<div class="note"><b>Koeffitsient nima?</b> Faqat shu aktivga kiritilgan va undan qaytgan pullar olinadi. Bu pul sanalari bo‘yicha yillik ' + nf(br, 0) + '% (kunlik) hisoblansa, bugun ' + (st.bench > 0 ? '<b>' + money(st.bench) + '</b>' : '—') + ' bo‘lar edi. Koeffitsient = aktiv qiymati ÷ shu qiymat. ' + (st.coef == null ? 'Aktiv qiymati yoki taqqoslash qiymati yo‘q, shuning uchun hisoblanmadi.' : (st.coef >= 1 ? 'Aktiv ' + br + '% yillik foizdan <b class="good">yuqori</b> natija bergan.' : 'Aktiv ' + br + '% yillik foizdan <b class="bad">past</b> natija bergan.')) + (st.benchPct != null && st.pct != null ? ' Aktiv: ' + sgn(st.pct, 2) + ', ' + br + '% taqqoslash: ' + sgn(st.benchPct, 2) + '.' : '') + ' Valyuta kursi hozirgi kurs bo‘yicha olinadi.</div>';
    if (accs.length > 1 && st.by.length) {
      h += '<h3>Hisoblar bo‘yicha</h3><div class="tw"><table><thead><tr><th>Mijoz</th><th class="n">Miqdor</th><th class="n">Qiymat</th><th class="n">Ulush</th></tr></thead><tbody>' + st.by.filter(function (r) { return r.qty > 1e-12; }).sort(function (a, b) { return b.value - a.value; }).map(function (r) { return '<tr><td>' + esc(r.acc.owner || r.acc.name) + '</td><td class="n">' + B.qtyStr(x, r.qty) + '</td><td class="n">' + money(r.value) + '</td><td class="n">' + pct(r.share || 0, 2) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    return { wide: true, aria: x.sym, html: h + txBook(accs, x, m.f) };
  };

  /* ---- Omonat oynasi: avvalgi "Omonat foizi" artifaktiga o'xshash, lekin hammasi avtomatik va o'zgartirib bo'lmaydi ---- */
  function omonatModal(x, accs, st, m) {
    var S = B.S(), now = Date.now(), per = accs.map(function (a) { return Core.depState(S, a.id, x, now); }).filter(Boolean);
    var h = assetHead(x, accs, st) + '<div class="note lock">🔒 Bu oynadagi hamma ma’lumot tranzaksiyalardan avtomatik hisoblanadi va o‘zgartirib bo‘lmaydi.</div>';
    var tot = per.reduce(function (s, p) { return s + p.total; }, 0), paid = per.reduce(function (s, p) { return s + p.paid; }, 0), unpaid = per.reduce(function (s, p) { return s + p.unpaid; }, 0), days = per.reduce(function (s, p) { return Math.max(s, p.days); }, 0);
    var map = {}, firstD = null; per.forEach(function (p) { p.rows.forEach(function (r) { var o = map[r.d] || (map[r.d] = { d: r.d, S: 0, fk: 0, dep: 0, wd: 0, bal: 0, acc: 0 }); ['S', 'fk', 'dep', 'wd', 'bal', 'acc'].forEach(function (k) { o[k] += r[k]; }); }); });
    var rows = Object.keys(map).sort().map(function (k) { return map[k]; }), txs = Core.assetTx(S, accs, x), payBy = {};
    txs.forEach(function (t) { if (t.type === 'FOIZ' || t.type === 'KUPON') payBy[dayOf(t.t)] = (payBy[dayOf(t.t)] || 0) + t.amount; });
    var cum = 0; rows.forEach(function (r) { cum += payBy[r.d] || 0; r.unp = Math.max(0, r.acc - cum); r.pay = payBy[r.d] || 0; });
    var dpay = x.dpay === 'monthly' ? 'Har oy bir marta (boshlanish kunining ertasi)' : 'To‘lov signali yo‘q';
    h += '<h3>Omonat shartlari</h3>' + kv([['Yillik foiz stavkasi', pct(+x.rate || 0, 2)], ['Foiz to‘lovi', dpay], ['Boshlanish sanasi', x.dstart ? dmy(x.dstart) : (rows[0] ? dmy(rows[0].d) : '—')], ['To‘langan foiz', 'omonat qoldig‘iga qo‘shiladi'], ['Hisoblash', 'qoldiq × stavka ÷ 365 (kunlik)'], ['Soliq', 'omonat foizidan soliq hisoblanmaydi']]);
    h += '<div class="stats mstats"><div class="stat"><small>Jami hisoblangan foiz</small><b>' + money(tot) + '</b><small>' + days + ' kun foiz hisoblandi</small></div><div class="stat"><small>To‘langan foiz</small><b>' + money(paid) + '</b></div><div class="stat"><small>To‘lanmagan (yig‘ilgan)</small><b>' + money(unpaid) + '</b></div><div class="stat"><small>Omonat qoldig‘i</small><b>' + money(st.value - st.acr) + '</b></div><div class="stat"><small>Portfeldagi ulushi</small><b>' + pct(st.share, 2) + '</b></div><div class="stat"><small>Koeffitsient (25% bilan)</small><b>' + (st.coef == null ? '—' : nf(st.coef, 3)) + '</b></div></div>';
    h += '<div class="g2"><div class="card inner"><h3>Omonat qoldig‘i (mln so‘m)</h3>' + lineChart(rows, 'bal', 1e6, true, 'var(--accent)', 'Omonat qoldig‘i') + '</div><div class="card inner"><h3>To‘lanmagan foiz (ming so‘m)</h3>' + lineChart(rows.map(function (r) { return { d: r.d, v: r.unp }; }), 'v', 1e3, false, 'var(--good)', 'To‘lanmagan foiz') + '</div></div>';
    var shown = m.all ? rows : rows.filter(function (r) { return r.dep || r.wd || r.pay; });
    h += '<div class="row sb"><h3>Kunlik jadval (' + shown.length + ' / ' + rows.length + ' kun)</h3><button class="chip" data-act="omall" aria-pressed="' + !!m.all + '">Barcha kunlar</button></div>';
    h += '<div class="tw" style="max-height:340px;overflow:auto"><table><thead><tr><th>Sana</th><th class="n">Qoldiq (S)</th><th class="n">Kunlik foiz</th><th class="n">Tushdi</th><th class="n">Yechildi</th><th class="n">Kun oxiri qoldiq</th><th>Izoh</th></tr></thead><tbody>' + (shown.map(function (r) {
      var note = []; if (r.dep) note.push('<span class="sd in">tushgan kun</span>'); if (r.wd) note.push('<span class="sd out">yechilgan kun</span>'); if (r.pay) note.push('<span class="sd in">foiz qo‘shildi</span> ' + nf(r.pay, 2));
      return '<tr><td class="mono">' + dmy(r.d) + '</td><td class="n">' + nf(r.S, 2) + '</td><td class="n">' + nf(r.fk, 2) + '</td><td class="n">' + (r.dep ? nf(r.dep, 2) : '') + '</td><td class="n">' + (r.wd ? nf(r.wd, 2) : '') + '</td><td class="n">' + nf(r.bal, 2) + '</td><td>' + note.join(' ') + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="muted">Hali harakat yo‘q.</td></tr>') + '</tbody></table></div>';
    return h + txBook(accs, x, m.f);
  }
  B.acts.omall = function () { ST.modal.all = !ST.modal.all; };

  /* ================= BIRLASHGAN HISOBOTLAR VA HUJJATLAR ================= */
  /* pages2.js dagi pageHisobot jadval hisobotlari (xlsx) sahifasi; bu yerda PDF hujjatlar bilan bitta sahifaga birlashtiriladi. */
  B.acts.hbtab = function (el) { ST.hbTab = el.getAttribute('data-v'); };
  B.acts.rtype = function (el) { ST.rType = el.getAttribute('data-v'); };
  function pageHisobotMerged() {
    var staff = B.isAdmin(), tab = ST.hbTab || 'pdf';
    if (!staff) tab = 'pdf';
    var tabs = [['pdf', 'PDF hisobot va hujjatlar'], ['xls', 'Jadvallar (Excel)'], ['sh', 'Shartnoma']];
    var h = '<div class="stack">';
    if (staff) h += '<div class="seg tabs" role="tablist">' + tabs.map(function (t) { return '<button data-act="hbtab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'xls') return h + B.pageTables() + '</div>';
    if (tab === 'sh') return h + B.contractBlock() + '</div>';
    return h + B.pageHujjat();
  }

  /* ================= AVTO SAVDO: OMONAT FOIZI SIGNALI ================= */
  B.depLoad = function () { return B.api('GET', '/api/deposits').then(function (r) { ST.dep = r; B.rerender(); }).catch(function (e) { ST.dep = { error: e.message, due: [] }; B.rerender(); }); };
  B.acts.dgroup = function (el) { var k = el.getAttribute('data-v'); ST.open['dg' + k] = !ST.open['dg' + k]; };
  B.acts.dacceptg = function (el) {
    var aid = el.getAttribute('data-v'), date = el.getAttribute('data-d');
    if (!window.confirm('Barcha mijozlar uchun omonat foizi (' + date + ') tranzaksiyalari yoziladi. Davom etasizmi?')) return false;
    return B.api('POST', '/api/deposits/accept-group', { aid: aid, date: date }).then(function (r) { B.toast(r.ids.length + ' ta mijozga foiz yozildi'); return B.depLoad(); }).catch(function (e) { B.toast(e.message); });
  };
  function groups(due) {
    var map = {}; due.forEach(function (i) { var k = i.aid + '|' + i.date, g = map[k] || (map[k] = { k: k, aid: i.aid, sym: i.sym, date: i.date, upto: i.upto, items: [], sum: 0, done: 0 }); g.items.push(i); if (i.done) g.done++; else g.sum += i.amt; });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  var DST = { bugun: ['Bugun', 'warn'], yozilmagan: ['Kechikkan', 'bad'], yaqin: ['Yaqinlashmoqda', ''], yozilgan: ['Yozilgan', 'ok'] };
  B.depSignalCount = function () { return ST.dep && ST.dep.due ? groups(ST.dep.due).filter(function (g) { return g.done < g.items.length && g.items.some(function (i) { return !i.done && i.days <= 0 && i.amt > 0; }); }).length : 0; };
  B.depSignals = function () {
    if (!ST.dep) { B.depLoad(); return '<section class="card">' + '<p class="muted">Yuklanmoqda…</p></section>'; }
    var due = ST.dep.due || [], gs = groups(due), h = '<section class="card stack"><div class="row sb"><h2>Omonat foizi signallari</h2><span class="muted mini">Har oy, boshlanish kunining ertasi</span></div><p class="sub" style="margin:0">Signal bitta omonat va sana uchun umumiy summa va har bir mijozga taqsimlangan ulushni ko‘rsatadi. Tasdiqlansa, har bir mijoz hisobiga “Foiz” tranzaksiyasi yoziladi va omonat qoldig‘iga qo‘shiladi.</p>';
    if (ST.dep.error) h += '<div class="err">' + esc(ST.dep.error) + '</div>';
    if (!gs.length) return h + empty('Signal yo‘q', 'Omonat aktivida foiz, boshlanish sanasi va “har oy” to‘lov belgilanganda signallar shu yerda chiqadi.') + '</section>';
    gs.forEach(function (g) {
      var open = !!ST.open['dg' + g.k], undone = g.items.filter(function (i) { return !i.done; }), ready = undone.length && undone.every(function (i) { return i.days <= 0; }) && g.sum > 0;
      var blocked = gs.some(function (o) { return o.aid === g.aid && o.date < g.date && o.items.some(function (i) { return !i.done && i.amt > 0; }); });
      var st = g.done === g.items.length ? 'yozilgan' : (undone[0] ? undone[0].status : 'yaqin'), tot = g.items.reduce(function (s, i) { return s + i.amt; }, 0), sh = DST[st] || ['', ''];
      h += '<div class="sig"><button class="sig-h" data-act="dgroup" data-v="' + esc(g.k) + '" aria-expanded="' + open + '"><span class="acc-t"><b>' + esc(g.sym) + ' · foiz to‘lovi ' + dmy(g.date) + '</b><small>' + g.items.length + ' ta mijoz · ' + dmy(g.upto) + ' gacha hisoblangan</small></span><span class="acc-n"><b class="num">' + money(tot) + '</b><small><span class="pill ' + sh[1] + '">' + sh[0] + '</span></small></span>' + B.CHEV + '</button>';
      if (open) {
        h += '<div class="sig-b"><div class="tw"><table><thead><tr><th>Mijoz</th><th class="n">Foiz summasi</th><th class="n">Taqsim ulushi</th><th>Holat</th></tr></thead><tbody>' + g.items.slice().sort(function (a, b) { return b.amt - a.amt; }).map(function (i) { var s = DST[i.status] || ['', '']; return '<tr><td>' + esc(i.accName) + '</td><td class="n">' + money(i.amt) + '</td><td class="n">' + (tot > 0 ? pct(i.amt / tot * 100, 2) : '—') + '</td><td><span class="pill ' + s[1] + '">' + s[0] + '</span></td></tr>'; }).join('') + '</tbody><tfoot><tr><td>Jami</td><td class="n">' + money(tot) + '</td><td class="n">' + (tot > 0 ? '100.00%' : '—') + '</td><td></td></tr></tfoot></table></div>';
        if (undone.length) h += '<div class="row">' + (ready && !blocked ? '<button class="btn" data-act="dacceptg" data-v="' + esc(g.aid) + '" data-d="' + g.date + '">Barcha mijozlarga yozish (' + undone.length + ')</button>' : '<button class="btn" disabled>' + (!ready ? 'Hali vaqti kelmagan' : 'Avval oldingi sanani tasdiqlang') + '</button>') + '</div>';
        h += '</div>';
      }
      h += '</div>';
    });
    return h + '</section>';
  };

  /* ================= PROFIL ================= */
  B.avUrl = function (id, v) { if (window.__avCache && window.__avCache[id]) return window.__avCache[id]; return v ? '/api/avatar/' + encodeURIComponent(id) + '?v=' + v : ''; };
  B.avatar = function (u, sz) {
    sz = sz || 40; var url = B.avUrl(u.id, u.av), nm = (u.name || u.username || u.email || '?').trim();
    return url ? '<img class="avi" src="' + esc(url) + '" alt="" style="width:' + sz + 'px;height:' + sz + 'px">' : '<span class="avi ph" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * 0.42) + 'px">' + esc(nm.slice(0, 1).toUpperCase()) + '</span>';
  };
  B.acts.pickav = function () { var i = document.getElementById('avfile'); if (i) i.click(); return false; };
  B.acts.delav = function () { return post('/api/me/avatar', { data: null }, 'Rasm olib tashlandi'); };
  B.acts.copyid = function (el) { var v = el.getAttribute('data-v'); try { navigator.clipboard.writeText(v); B.toast('Nusxalandi: ' + v); } catch (e) { B.toast(v); } return false; };
  /* rasmni brauzerda 256×256 JPEG ga kichraytirish (markaziy kvadrat) */
  function shrink(file, cb) {
    var rd = new FileReader(); rd.onerror = function () { cb(null); };
    rd.onload = function () { var im = new Image(); im.onerror = function () { cb(null); }; im.onload = function () {
      var s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
      g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256); var q = 0.85, d = c.toDataURL('image/jpeg', q); while (d.length > 190000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } cb(d);
    }; im.src = rd.result; }; rd.readAsDataURL(file);
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || t.id !== 'avfile' || !t.files || !t.files[0]) return;
    shrink(t.files[0], function (d) { if (!d) return B.toast('Rasmni o‘qib bo‘lmadi'); post('/api/me/avatar', { data: d }, 'Rasm yangilandi').catch(function () { }); t.value = ''; });
  });
  B.forms.profile2 = function () {
    var f = ST.f, me = D().me, body = { name: f.pf_name != null ? f.pf_name : me.name, phone: f.pf_phone != null ? f.pf_phone : me.phone, username: f.pf_user != null ? f.pf_user : me.username, bio: f.pf_bio != null ? f.pf_bio : me.bio, dm: f.pf_dm != null ? f.pf_dm : me.dm, findable: f.pf_find != null ? !!f.pf_find : me.findable };
    return B.run(B.api('POST', '/api/me/profile', body), 'Profil saqlandi').then(function () { ['pf_name', 'pf_phone', 'pf_user', 'pf_bio', 'pf_dm', 'pf_find'].forEach(function (k) { delete f[k]; }); B.rerender(); });
  };
  B.profileInfo = function () {
    var d = D(), me = d.me, f = ST.f, v = function (k, cur) { return f[k] != null ? f[k] : (cur == null ? '' : cur); };
    var role = { admin: 'Admin', operator: 'Operator', client: 'Mijoz' }[me.role], accs = d.accounts.filter(function (a) { return !a.archived; });
    var checks = [['Ism kiritilgan', !!me.name], ['Telefon kiritilgan', !!me.phone], ['Profil rasmi qo‘yilgan', !!me.av], ['Username tanlangan', !!me.username], ['Qisqa tavsif yozilgan', !!me.bio]], ok = checks.filter(function (c) { return c[1]; }).length;
    var h = '<section class="card stack"><div class="row" style="gap:18px;align-items:center;flex-wrap:wrap"><div class="av-big">' + B.avatar(me, 96) + '</div><div class="stack" style="gap:6px"><div class="row"><button class="btn small" data-act="pickav" type="button">Rasm yuklash</button>' + (me.av ? '<button class="btn ghost small" data-act="delav" type="button">Olib tashlash</button>' : '') + '<input id="avfile" type="file" accept="image/jpeg,image/png,image/webp" hidden></div><p class="muted mini" style="margin:0">JPEG, PNG yoki WebP. Rasm brauzerda avtomatik 256×256 ga kichraytiriladi.</p></div></div>';
    h += '<div class="idcard"><div><small>Tizim ID (o‘zgarmaydi)</small><b class="mono">' + esc(me.id) + '</b></div><div><small>Username</small><b class="mono">' + (me.username ? '@' + esc(me.username) : '—') + '</b></div><div><small>Rol</small><b>' + role + '</b></div><div><small>Ro‘yxatdan o‘tgan</small><b>' + (me.created ? fdt(me.created).split(' ')[0] : '—') + '</b></div><button class="btn ghost small" type="button" data-act="copyid" data-v="' + esc(me.id) + '">ID ni nusxalash</button></div></section>';
    h += '<section class="card stack"><h2>Shaxsiy ma’lumotlar</h2><form data-form="profile2" class="stack"><div class="form-grid">' +
      fld('F.I.O.', '<input type="text"' + bd('pf_name') + ' value="' + esc(v('pf_name', me.name)) + '">') + fld('Telefon', '<input type="text"' + bd('pf_phone') + ' value="' + esc(v('pf_phone', me.phone)) + '">') + fld('Email (o‘zgarmaydi)', '<input type="text" value="' + esc(me.email) + '" disabled>') +
      fld('Username (ixtiyoriy, o‘zgartirsa bo‘ladi)', '<input type="text" placeholder="masalan: aziz_invest" maxlength="20"' + bd('pf_user') + ' value="' + esc(v('pf_user', me.username)) + '" autocapitalize="off">') + fld('Qisqa tavsif (160 belgigacha)', '<input type="text" maxlength="160"' + bd('pf_bio') + ' value="' + esc(v('pf_bio', me.bio)) + '">') + '</div>' +
      '<h3>Maxfiylik (chat uchun)</h3><div class="form-grid">' + fld('Kimlar menga yozishi mumkin', '<select data-bind="pf_dm"><option value="all"' + (v('pf_dm', me.dm) === 'all' ? ' selected' : '') + '>Hamma</option><option value="staff"' + (v('pf_dm', me.dm) === 'staff' ? ' selected' : '') + '>Faqat BARLOS xodimlari</option></select>') +
      '<label class="chk"><input type="checkbox"' + bd('pf_find') + (v('pf_find', me.findable) ? ' checked' : '') + '> Username bo‘yicha qidiruvda topilsin (o‘chiq bo‘lsa, faqat ID yoki aniq username bilan topiladi)</label></div>' +
      '<div class="row"><button class="btn" type="submit">Saqlash</button></div></form></section>';
    h += '<section class="card stack"><div class="row sb"><h2>Profil to‘liqligi</h2><b class="num">' + ok + ' / ' + checks.length + '</b></div><div class="bar" style="height:8px"><i style="width:' + (ok / checks.length * 100) + '%;background:var(--accent)"></i></div><div class="chk-list">' + checks.map(function (c) { return '<span class="' + (c[1] ? 'good' : 'muted') + '">' + (c[1] ? '✓ ' : '○ ') + c[0] + '</span>'; }).join('') + '</div></section>';
    if (me.role === 'client') h += '<section class="card stack"><h2>Hisob va shartnoma</h2>' + kv([['Hisoblar soni', accs.length + ' ta'], ['Shartnoma', me.consent && me.consent.ok ? '<span class="good">Joriy versiya tasdiqlangan</span>' : '<span class="bad">Tasdiqlanmagan</span>'], ['Oxirgi kirish', me.last ? fdt(me.last) : '—'], ['Faol seanslar', (me.sessions || []).length + ' ta']]) + '</section>';
    return h;
  };

  /* ================= CHAT ================= */
  var C = ST.chat = ST.chat || { list: null, dir: [], cur: null, data: null, last: 0, panel: null, q: '', users: [] };
  var TYN = { dm: 'Shaxsiy', group: 'Guruh', channel: 'Kanal' };
  function ago(t) { var d = new Date(t + 5 * 3600e3), n = new Date(Date.now() + 5 * 3600e3); return d.toISOString().slice(0, 10) === n.toISOString().slice(0, 10) ? two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) : two(d.getUTCDate()) + '.' + two(d.getUTCMonth() + 1); }
  function chatAv(c, sz) {
    sz = sz || 44; if (c.type === 'dm' && c.other) return B.avatar(c.other, sz);
    var col = c.type === 'channel' ? 'var(--accent)' : 'var(--c-xalqaro)';
    return '<span class="avi ph" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * 0.4) + 'px;background:' + col + '">' + (c.type === 'channel' ? '📢' : esc((c.title || '?').slice(0, 1).toUpperCase())) + '</span>';
  }
  function listLoad(quiet) {
    return B.api('GET', '/api/chat/list').then(function (r) { C.list = r.chats; C.dir = r.dir; C.me = r.me; navBadge(); if (ST.page === 'chat') paintList(); return r; }).catch(function (e) { if (!quiet) B.toast(e.message); });
  }
  function totalUnread() { return (C.list || []).reduce(function (s, c) { return s + (c.unread || 0); }, 0); }
  function navBadge() { var b = document.querySelector('.nav button[data-v="chat"]'); if (!b) return; var u = totalUnread(), el = b.querySelector('.nbadge'); if (!u) { if (el) el.remove(); return; } if (!el) { el = document.createElement('i'); el.className = 'nbadge'; b.appendChild(el); } el.textContent = u > 99 ? '99+' : u; }
  B.hooks.push(navBadge);
  B.hooks.push(function () { if (B.D() && !C.list && !C.loading) { C.loading = true; listLoad(true).then(function () { C.loading = false; }); } });
  function paintList() {
    var el = document.getElementById('clist'); if (!el) return; el.innerHTML = listHtml();
  }
  function listHtml() {
    var q = (ST.f.cs_q || '').toLowerCase(), ls = (C.list || []).filter(function (c) { return !q || (c.title || '').toLowerCase().indexOf(q) >= 0; });
    if (!C.list) return '<p class="muted pad">Yuklanmoqda…</p>';
    if (!ls.length) return '<p class="muted pad">Hali chat yo‘q. “＋ Yangi” tugmasi bilan boshlang.</p>';
    return ls.map(function (c) {
      var l = c.last, pre = l ? (l.sys ? '' : (c.type !== 'dm' && l.uid === (C.me && C.me.id) ? 'Siz: ' : '')) + l.text : 'Xabar yo‘q';
      return '<button class="ci" data-act="chatopen" data-v="' + esc(c.id) + '" aria-current="' + (C.cur === c.id) + '">' + chatAv(c, 44) + '<span class="ci-t"><b>' + esc(c.title) + '</b><small>' + esc(pre) + '</small></span><span class="ci-r"><small>' + (l ? ago(l.t) : '') + '</small>' + (c.unread ? '<i class="ub">' + (c.unread > 99 ? '99+' : c.unread) + '</i>' : '') + '</span></button>';
    }).join('');
  }
  function userName(u) { return u ? (u.name || u.username || u.id) : '?'; }
  function msgHtml(m, c, users, byseq) {
    var me = C.me && C.me.id, mine = m.uid === me;
    if (m.sys) return '<div class="sysmsg">' + esc(m.text) + '</div>';
    var u = users[m.uid] || { id: m.uid, name: m.uid }, rp = m.reply && byseq[m.reply], h = '<div class="msg' + (mine ? ' mine' : '') + '" data-seq="' + m.seq + '">';
    if (!mine && c.type !== 'dm') h += '<div class="mav">' + B.avatar(u, 30) + '</div>';
    h += '<div class="bub">';
    if (!mine && c.type !== 'dm') h += '<div class="who">' + esc(userName(u)) + (u.staff ? ' <span class="stf">' + u.staff + '</span>' : '') + '</div>';
    if (m.fwd) h += '<div class="fwd">📢 Kanal posti</div>';
    if (rp) h += '<div class="rq" data-act="chatgoto" data-v="' + rp.seq + '"><b>' + esc(userName(users[rp.uid])) + '</b>' + esc((rp.text || '').slice(0, 80)) + '</div>';
    h += '<div class="tx">' + esc(m.text).replace(/\n/g, '<br>') + '</div><div class="mt"><span class="hs" title="SHA-256: ' + esc(m.hash) + '\nOldingi: ' + esc(m.prev) + '">#' + esc(m.hash.slice(0, 8)) + '</span> ' + ago(m.t) + '</div>';
    var acts = [];
    if (c.type !== 'channel' || c.post) acts.push('<button data-act="chatreply" data-v="' + m.seq + '">↩ Javob</button>');
    if (c.type === 'channel' && c.disc) acts.push('<button data-act="chatdisc" data-v="' + esc(c.disc) + '" data-s="' + m.seq + '">💬 Muhokama' + (m.cc ? ' (' + m.cc + ')' : '') + '</button>');
    if (c.type === 'group' && m.fwd && c.ch) acts.push('<span class="muted mini">💬 ' + (m.cc || 0) + ' izoh</span>');
    if (acts.length) h += '<div class="macts">' + acts.join('') + '</div>';
    return h + '</div></div>';
  }
  function paintMsgs(stick) {
    var el = document.getElementById('cmsgs'), d = C.data; if (!el || !d) return;
    var near = el.scrollHeight - el.scrollTop - el.clientHeight < 80, byseq = {}; C.msgs.forEach(function (m) { byseq[m.seq] = m; });
    el.innerHTML = C.msgs.length ? C.msgs.map(function (m) { return msgHtml(m, d.chat, C.users, byseq); }).join('') : '<p class="muted pad">Hali xabar yo‘q.</p>';
    if (stick || near) el.scrollTop = el.scrollHeight;
  }
  function chatLoad(id, full) {
    var after = full ? 0 : C.last;
    return B.api('GET', '/api/chat/' + encodeURIComponent(id) + '?after=' + after).then(function (r) {
      if (C.cur !== id) return;
      var fresh = full || !C.data; C.data = r; C.users = Object.assign(C.users || {}, r.users);
      if (fresh) C.msgs = r.msgs; else if (r.msgs.length) { var seen = {}; C.msgs.forEach(function (m) { seen[m.seq] = 1; }); r.msgs.forEach(function (m) { if (!seen[m.seq]) C.msgs.push(m); }); }
      C.last = C.msgs.length ? C.msgs[C.msgs.length - 1].seq : 0;
      if (fresh) B.rerender(); else { paintHead(); if (r.msgs.length) paintMsgs(false); }
      if (C.last && r.chat.unread >= 0) { var row = (C.list || []).filter(function (c) { return c.id === id; })[0]; if (row && row.unread) { row.unread = 0; paintList(); navBadge(); } B.api('POST', '/api/chat/' + encodeURIComponent(id) + '/read', { seq: C.last }).catch(function () { }); }
    }).catch(function (e) { if (e.status === 403 || e.status === 404) { C.cur = null; C.data = null; B.rerender(); } });
  }
  function paintHead() { var el = document.getElementById('chead'); if (el && C.data) el.innerHTML = headHtml(); }
  function headHtml() {
    var c = C.data.chat; return '<button class="btn ghost small cback" data-act="chatback">←</button>' + chatAv(c, 40) + '<div class="ch-t"><b>' + esc(c.title) + '</b><small>' + (c.type === 'dm' ? (c.other && c.other.username ? '@' + esc(c.other.username) : 'Shaxsiy yozishma') : TYN[c.type] + ' · ' + c.cnt + ' a’zo') + '</small></div><button class="btn ghost small" data-act="chatinfo">ⓘ Ma’lumot</button>';
  }
  B.acts.chatopen = function (el) { C.cur = el.getAttribute('data-v'); C.data = null; C.msgs = []; C.last = 0; C.reply = 0; chatLoad(C.cur, true); };
  B.acts.chatback = function () { C.cur = null; C.data = null; };
  B.acts.chatgoto = function (el) { var n = document.querySelector('#cmsgs .msg[data-seq="' + el.getAttribute('data-v') + '"]'); if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('flash'); setTimeout(function () { n.classList.remove('flash'); }, 1200); } return false; };
  B.acts.chatreply = function (el) { C.reply = +el.getAttribute('data-v'); B.rerender(); var t = document.getElementById('ctext'); if (t) t.focus(); return false; };
  B.acts.chatnoreply = function () { C.reply = 0; };
  B.acts.chatdisc = function (el) { var id = el.getAttribute('data-v'), s = el.getAttribute('data-s'); C.cur = id; C.data = null; C.msgs = []; C.last = 0; C.reply = 0; chatLoad(id, true).then(function () { var row = C.msgs.filter(function (m) { return m.fwd && m.fwd.seq === +s; })[0]; if (row) { var n = document.querySelector('#cmsgs .msg[data-seq="' + row.seq + '"]'); if (n) n.scrollIntoView({ block: 'center' }); } }); };
  function sendMsg() {
    var t = (ST.f.cm_text || '').trim(); if (!t || !C.cur) return;
    var id = C.cur, rep = C.reply; ST.f.cm_text = ''; C.reply = 0; var ta = document.getElementById('ctext'); if (ta) ta.value = '';
    B.api('POST', '/api/chat/' + encodeURIComponent(id) + '/send', { text: t, reply: rep }).then(function () { return chatLoad(id, false); }).then(function () { listLoad(true); if (rep) B.rerender(); }).catch(function (e) { ST.f.cm_text = t; if (ta) ta.value = t; B.toast(e.message); });
  }
  B.forms.chatsend = function () { sendMsg(); };
  document.addEventListener('keydown', function (e) { if (e.target && e.target.id === 'ctext' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  B.acts.chatnew = function () { ST.modal = { t: 'chatnew', tab: 'dm' }; C.users = C.users || {}; C.found = []; delete ST.f.cn_q; userSearch(''); };
  B.acts.cntab = function (el) { ST.modal.tab = el.getAttribute('data-v'); if (ST.modal.tab === 'dir') listLoad(true); };
  B.acts.chatinfo = function () { ST.modal = { t: 'chatinfo' }; };
  B.acts.chatverify = function () {
    var id = C.cur; ST.modal.ver = { loading: true }; B.rerender();
    return B.api('GET', '/api/chat/' + encodeURIComponent(id) + '/verify').then(function (r) { ST.modal.ver = r; B.rerender(); }).catch(function (e) { ST.modal.ver = { ok: false, why: e.message }; B.rerender(); });
  };
  var uTimer = null;
  function userSearch(q) { B.api('GET', '/api/chat/users?q=' + encodeURIComponent(q)).then(function (r) { C.found = r.users; if (ST.modal && (ST.modal.t === 'chatnew' || ST.modal.t === 'chatinfo')) { var el = document.getElementById('ufound'); if (el) el.innerHTML = foundHtml(); } }).catch(function () { }); }
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.getAttribute && (t.getAttribute('data-bind') === 'cn_q' || t.getAttribute('data-bind') === 'ci_q')) { clearTimeout(uTimer); uTimer = setTimeout(function () { userSearch(t.value.trim()); }, 250); } if (t && t.getAttribute && t.getAttribute('data-bind') === 'cs_q') paintList(); });
  function foundHtml() { var f = C.found || []; return f.length ? f.map(function (u) { return '<button type="button" class="ci" data-act="cnpick" data-v="' + esc(u.id) + '">' + B.avatar(u, 36) + '<span class="ci-t"><b>' + esc(userName(u)) + (u.staff ? ' <span class="stf">' + u.staff + '</span>' : '') + '</b><small>' + (u.username ? '@' + esc(u.username) + ' · ' : '') + esc(u.id) + '</small></span></button>'; }).join('') : '<p class="muted mini pad">Topilmadi. ID (U1001) yoki aniq username yozing.</p>'; }
  B.acts.cnpick = function (el) {
    var id = el.getAttribute('data-v'), m = ST.modal;
    if (m.t === 'chatinfo') return B.api('POST', '/api/chat/' + encodeURIComponent(C.cur) + '/members', { add: [id] }).then(function () { B.toast('Qo‘shildi'); return chatLoad(C.cur, true); }).catch(function (e) { B.toast(e.message); });
    if (m.tab === 'dm') return B.api('POST', '/api/chat/dm', { to: id }).then(function (r) { ST.modal = null; return listLoad(true).then(function () { C.cur = r.id; C.data = null; C.msgs = []; C.last = 0; return chatLoad(r.id, true); }); }).catch(function (e) { B.toast(e.message); });
    m.pick = m.pick || []; var i = m.pick.indexOf(id); if (i >= 0) m.pick.splice(i, 1); else m.pick.push(id);
  };
  B.forms.chatcreate = function () {
    var f = ST.f, m = ST.modal, ty = m.tab === 'channel' ? 'channel' : 'group';
    return B.api('POST', '/api/chat/create', { type: ty, title: f.cn_title, about: f.cn_about, public: !!f.cn_pub, disc: ty === 'channel' && !!f.cn_disc, members: m.pick || [] }).then(function (r) {
      ['cn_title', 'cn_about', 'cn_pub', 'cn_disc'].forEach(function (k) { delete f[k]; }); ST.modal = null; return listLoad(true).then(function () { C.cur = r.id; C.data = null; C.msgs = []; C.last = 0; return chatLoad(r.id, true); });
    }).catch(function (e) { B.toast(e.message); });
  };
  B.forms.chatjoin = function () { var c = (ST.f.cn_code || '').trim(); if (!c) return; return B.api('POST', '/api/chat/join', { code: c }).then(function (r) { delete ST.f.cn_code; ST.modal = null; return listLoad(true).then(function () { C.cur = r.id; C.data = null; C.msgs = []; C.last = 0; return chatLoad(r.id, true); }); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.cnjoin = function (el) { return B.api('POST', '/api/chat/join', { id: el.getAttribute('data-v') }).then(function (r) { ST.modal = null; return listLoad(true).then(function () { C.cur = r.id; C.data = null; C.msgs = []; C.last = 0; return chatLoad(r.id, true); }); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.chatleave = function () { if (!window.confirm('Chatdan chiqasizmi?')) return false; var id = C.cur; return B.api('POST', '/api/chat/' + encodeURIComponent(id) + '/leave', {}).then(function () { ST.modal = null; C.cur = null; C.data = null; return listLoad(true).then(B.rerender); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.chatkick = function (el) { return B.api('POST', '/api/chat/' + encodeURIComponent(C.cur) + '/members', { remove: el.getAttribute('data-v') }).then(function () { return chatLoad(C.cur, true); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.chatadm = function (el) { return B.api('POST', '/api/chat/' + encodeURIComponent(C.cur) + '/members', { setRole: { uid: el.getAttribute('data-v'), r: el.getAttribute('data-r') } }).then(function () { return chatLoad(C.cur, true); }).catch(function (e) { B.toast(e.message); }); };
  B.forms.chatadd = function () { var q = (ST.f.ci_add || '').trim(); if (!q) return; return B.api('POST', '/api/chat/' + encodeURIComponent(C.cur) + '/members', { add: [q] }).then(function () { delete ST.f.ci_add; B.toast('Qo‘shildi'); return chatLoad(C.cur, true); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.chatcode = function () { return B.api('POST', '/api/chat/' + encodeURIComponent(C.cur) + '/edit', { newCode: true }).then(function () { return chatLoad(C.cur, true); }).catch(function (e) { B.toast(e.message); }); };

  B.modals.chatnew = function (m) {
    var tabs = [['dm', 'Yangi xabar'], ['group', 'Guruh'], ['channel', 'Kanal'], ['dir', 'Ochiq chatlar'], ['code', 'Kod bilan']], f = ST.f;
    var h = '<h2>Yangi</h2><div class="seg tabs">' + tabs.map(function (t) { return '<button data-act="cntab" data-v="' + t[0] + '" aria-pressed="' + (m.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (m.tab === 'dm' || m.tab === 'group' || m.tab === 'channel') {
      if (m.tab !== 'dm') h += '<form data-form="chatcreate" class="stack" style="margin-top:12px"><div class="form-grid">' + fld(m.tab === 'channel' ? 'Kanal nomi' : 'Guruh nomi', '<input type="text" maxlength="60"' + bd('cn_title') + ' value="' + esc(f.cn_title || '') + '">') + fld('Tavsif (ixtiyoriy)', '<input type="text" maxlength="300"' + bd('cn_about') + ' value="' + esc(f.cn_about || '') + '">') + '</div><label class="chk"><input type="checkbox"' + bd('cn_pub') + (f.cn_pub ? ' checked' : '') + '> Ochiq (hamma qidirib qo‘shila oladi)</label>' + (m.tab === 'channel' ? '<label class="chk"><input type="checkbox"' + bd('cn_disc') + (f.cn_disc ? ' checked' : '') + '> Muhokama guruhini ham yaratish (har bir postga izoh yozish uchun)</label>' : '') + '<p class="muted mini" style="margin:0">A’zolarni quyidagi qidiruvdan belgilang yoki keyin ID / username bilan qo‘shing. ' + (m.tab === 'channel' ? 'Kanalga faqat adminlar yozadi.' : '') + '</p><div class="row"><button class="btn" type="submit">Yaratish' + (m.pick && m.pick.length ? ' (' + m.pick.length + ' a’zo bilan)' : '') + '</button></div></form>';
      h += '<div class="stack" style="margin-top:12px"><input type="text" placeholder="ID (U1001), @username yoki ism" data-bind="cn_q" value="' + esc(f.cn_q || '') + '"><div id="ufound" class="clist small">' + foundHtml().replace(/data-v="([^"]+)"/g, function (a, id) { return a + ((m.pick || []).indexOf(id) >= 0 ? ' aria-current="true"' : ''); }) + '</div></div>';
    } else if (m.tab === 'dir') {
      h += '<div class="clist small" style="margin-top:12px">' + ((C.dir || []).length ? C.dir.map(function (c) { return '<div class="ci static">' + chatAv(c, 40) + '<span class="ci-t"><b>' + esc(c.title) + '</b><small>' + TYN[c.type] + ' · ' + c.cnt + ' a’zo' + (c.about ? ' · ' + esc(c.about) : '') + '</small></span><button class="btn small" data-act="cnjoin" data-v="' + esc(c.id) + '">Qo‘shilish</button></div>'; }).join('') : '<p class="muted pad">Ochiq guruh yoki kanal yo‘q.</p>') + '</div>';
    } else h += '<form data-form="chatjoin" class="stack" style="margin-top:12px">' + fld('Taklif kodi', '<input type="text"' + bd('cn_code') + ' value="' + esc(f.cn_code || '') + '" placeholder="masalan: 3fa9c1b07d">') + '<div class="row"><button class="btn" type="submit">Qo‘shilish</button></div></form>';
    return { aria: 'Yangi chat', html: h };
  };
  B.modals.chatinfo = function (m) {
    var d = C.data; if (!d) return null; var c = d.chat, me = C.me && C.me.id, h = '<div class="mdl-h">' + chatAv(c, 52) + '<div><h2>' + esc(c.title) + '</h2><p class="sub" style="margin:0">' + TYN[c.type] + (c.public ? ' · ochiq' : ' · yopiq') + '</p></div></div>';
    if (c.about) h += '<p>' + esc(c.about) + '</p>';
    h += '<h3>Xabarlar zanjiri (heshlash)</h3><div class="note">Har bir xabar oldingisining SHA-256 hashi bilan bog‘lanadi va serverning yashirin kaliti bilan imzolanadi. Xabar keyin o‘zgartirilsa, o‘chirilsa yoki tartibi buzilsa, tekshiruv buzilgan joyni ko‘rsatadi. <b>Bu shifrlash emas</b>: server xabarlarni o‘qiy oladi, administrator bazaga kirishi mumkin.</div>' +
      kv([['Xabarlar soni', d.n], ['Zanjir uchi (oxirgi hash)', '<span class="mono hs2">' + (d.tip ? esc(d.tip) : '—') + '</span>']]) + '<div class="row"><button class="btn small" data-act="chatverify">Zanjirni tekshirish</button>' + (m.ver ? (m.ver.loading ? '<span class="muted">Tekshirilmoqda…</span>' : m.ver.ok ? '<span class="good">✓ Zanjir butun: ' + m.ver.n + ' ta xabar</span>' : '<span class="bad">✗ ' + esc(m.ver.why || 'Buzilgan') + '</span>') : '') + '</div>';
    if (c.manage && c.type !== 'dm') {
      h += '<h3>Boshqaruv</h3><div class="row"><span class="muted">Taklif kodi:</span> <b class="mono">' + esc(c.code || '—') + '</b> <button class="btn ghost small" data-act="chatcode">Yangi kod</button></div>';
      h += '<form data-form="chatadd" class="row" style="margin-top:8px"><input type="text" placeholder="ID yoki @username qo‘shish"' + bd('ci_add') + ' value="' + esc(ST.f.ci_add || '') + '" style="flex:1"><button class="btn small" type="submit">Qo‘shish</button></form>';
    }
    h += '<h3>A’zolar (' + d.members.length + ')</h3><div class="clist small">' + d.members.map(function (u) {
      var rl = { owner: 'ega', admin: 'admin', member: '' }[u.r], owner = c.role === 'owner', ctl = '';
      if (c.manage && u.id !== me && u.r !== 'owner' && c.type !== 'dm') ctl = (owner ? '<button class="btn ghost small" data-act="chatadm" data-v="' + esc(u.id) + '" data-r="' + (u.r === 'admin' ? 'member' : 'admin') + '">' + (u.r === 'admin' ? 'Admin emas' : 'Admin qilish') + '</button>' : '') + ((u.r !== 'admin' || owner) ? '<button class="btn ghost small" data-act="chatkick" data-v="' + esc(u.id) + '">Chiqarish</button>' : '');
      return '<div class="ci static">' + B.avatar(u, 36) + '<span class="ci-t"><b>' + esc(userName(u)) + (u.staff ? ' <span class="stf">' + u.staff + '</span>' : '') + (rl ? ' <span class="stf">' + rl + '</span>' : '') + '</b><small>' + (u.username ? '@' + esc(u.username) + ' · ' : '') + esc(u.id) + '</small></span>' + ctl + '</div>';
    }).join('') + '</div>';
    if (c.type !== 'dm' && c.role !== 'owner') h += '<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="chatleave">Chatdan chiqish</button></div>';
    return { aria: c.title, html: h };
  };

  function pageChat() {
    if (!C.list && !C.loading) { C.loading = true; listLoad().then(function () { C.loading = false; }); }
    var open = !!C.cur, h = '<div class="chat' + (open ? ' open' : '') + '"><aside class="cside"><div class="cs-top"><input type="search" placeholder="Qidirish" data-bind="cs_q" value="' + esc(ST.f.cs_q || '') + '"><button class="btn small" data-act="chatnew">＋ Yangi</button></div><div id="clist" class="clist">' + listHtml() + '</div></aside>';
    h += '<section class="cmain">';
    if (!C.cur) return h + '<div class="cempty"><p><b>BARLOS chat</b></p><p class="muted">Chatni tanlang yoki yangisini boshlang. Guruh, kanal va kanalga bog‘langan muhokama guruhi yaratish mumkin.</p><p class="muted mini">Xabarlar saqlanadi va heshlanadi (zanjir). Ular o‘chirilmaydi. Shifrlanmagan: serverda o‘qiladi.</p></div></section></div>';
    if (!C.data) return h + '<p class="muted pad">Yuklanmoqda…</p></section></div>';
    var c = C.data.chat, rp = C.reply && C.msgs.filter(function (m) { return m.seq === C.reply; })[0];
    h += '<header id="chead" class="chead">' + headHtml() + '</header><div id="cmsgs" class="cmsgs"></div>';
    if (c.post) h += '<form data-form="chatsend" class="cform">' + (rp ? '<div class="rbar"><span><b>Javob:</b> ' + esc((rp.text || '').slice(0, 70)) + '</span><button type="button" data-act="chatnoreply">×</button></div>' : '') + '<div class="row" style="align-items:flex-end"><textarea id="ctext" rows="1" maxlength="4000" placeholder="Xabar yozing…"' + bd('cm_text') + '>' + esc(ST.f.cm_text || '') + '</textarea><button class="btn" type="submit">Yuborish</button></div></form>';
    else h += '<div class="cform ro">Bu kanalga faqat adminlar yozadi.</div>';
    return h + '</section></div>';
  }
  B.hooks.push(function () { if (ST.page === 'chat' && C.data) paintMsgs(true); });
  /* fon yangilash: ochiq chat har 3 soniyada, ro'yxat/nishon har 12 soniyada */
  setInterval(function () { if (!B.D() || document.hidden) return; if (ST.page === 'chat' && C.cur && C.data) chatLoad(C.cur, false); }, 3000);
  setInterval(function () { if (!B.D() || document.hidden) return; listLoad(true); }, 12000);
  B.chatBoot = function () { if (B.D() && !C.list) listLoad(true); };

  Object.assign(B.pages, { chat: pageChat });
  B.pageHisobotMerged = pageHisobotMerged;
  Object.assign(B.pages, { hisobot: pageHisobotMerged, hujjat: pageHisobotMerged });
})(window.B || window.BARLOS);
