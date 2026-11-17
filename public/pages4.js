/* BARLOS: Buxgalteriya sahifasi (2.12.0), faqat admin uchun.
   Hamma raqam serverdagi /api/acx/report dan keladi va saytdagi ma'lumotlardan AVTOMATIK hisoblanadi. */
(function (B) {
  'use strict';
  var ST = B.ST, esc = B.esc, bind = B.bind, sel = B.sel, fld = B.fld;
  var X = { year: null, upto: null, tab: 'umumiy', rep: null, data: null, key: '', busy: false, err: '', eid: null, cid: null, month: null, q: '' };
  var TABS = [['umumiy', 'Umumiy'], ['balans', 'Balans'], ['natija', 'Moliyaviy natija'], ['rahbar', 'Rahbar ulushi'], ['xodim', 'Xodimlar va maosh'], ['shartnoma', 'Shartnomalar'], ['jurnal', 'Jurnal'], ['aylanma', 'Aylanma'], ['ustav', 'Ustav kapitali'], ['sozlama', 'Sozlamalar']];
  var MN = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

  function N(v) { if (v == null || isNaN(v)) return '—'; var r = Math.round(v); return (r < 0 ? '−' : '') + B.fi(Math.abs(r)); }
  function P(v) { return v == null ? '—' : (Math.round(v * 100) / 100) + '%'; }
  function tdy() { var d = new Date(Date.now() + 5 * 3600e3); return d.toISOString().slice(0, 10); }
  function mname(k) { return MN[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); }
  function qs() { return 'year=' + X.year + '&upto=' + X.upto; }
  function dmy(s) { return s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '—'; }

  /* ---------- yuklash ---------- */
  function load() {
    if (X.busy) return; X.busy = true; X.err = '';
    var key = B.Dv.rev + '|' + X.year + '|' + X.upto;
    Promise.all([B.api('GET', '/api/acx/report?' + qs()), B.api('GET', '/api/acx/data')]).then(function (r) {
      X.rep = r[0]; X.data = r[1]; X.key = key; X.busy = false; if (!X.month || X.month.slice(0, 4) !== String(X.year)) X.month = (r[0].payroll.length ? r[0].payroll[r[0].payroll.length - 1].k : null);
      B.rerender();
    }).catch(function (e) { X.busy = false; X.err = e.message; X.key = key; B.rerender(); });
  }
  function ensure() {
    if (!X.year) { X.year = +tdy().slice(0, 4); X.upto = tdy(); }
    var key = B.Dv.rev + '|' + X.year + '|' + X.upto;
    if (X.key !== key && !X.busy) setTimeout(load, 0);
  }

  /* ---------- umumiy bloklar ---------- */
  function head() {
    var dl = qs();
    return '<section class="card"><div class="row sb" style="flex-wrap:wrap;gap:10px"><div class="row" style="gap:10px;flex-wrap:wrap">' +
      fld('Yil', '<input type="number" min="2000" max="2100" data-bind="ax_year" value="' + esc(ST.f.ax_year != null ? ST.f.ax_year : X.year) + '" style="width:90px">') +
      fld('Hisobot sanasi', '<input type="date" data-bind="ax_upto" value="' + esc(ST.f.ax_upto != null ? ST.f.ax_upto : X.upto) + '">') +
      '<div class="field"><label>&nbsp;</label><button class="btn small" data-act="axgo">Hisoblash</button></div></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn ghost small" target="_blank" href="/api/acx/pdf?' + dl + '&kind=toliq">PDF (to‘liq)</a><a class="btn ghost small" target="_blank" href="/api/acx/pdf?' + dl + '&kind=balans">PDF balans</a>' +
      '<button class="btn ghost small" data-act="axxlsx">Excel (.xlsx)</button></div></div>' + (X.busy ? '<p class="muted mini">Hisoblanmoqda…</p>' : '') + '</section>';
  }
  function tabs() { return '<div class="seg tabs" role="tablist" style="flex-wrap:wrap">' + TABS.map(function (t) { return '<button data-act="axtab" data-v="' + t[0] + '" aria-pressed="' + (X.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>'; }
  function stat(l, v, cls) { return '<div class="stat"><small>' + l + '</small><b class="' + (cls || '') + '">' + v + '</b></div>'; }
  function checksHtml(rep) {
    var bad = rep.checks.filter(function (c) { return !c.ok; });
    return '<section class="card stack"><h2>Nazorat tekshiruvlari</h2>' + rep.checks.map(function (c) { return '<div class="row" style="gap:8px"><span class="' + (c.ok ? 'good' : 'bad') + '">' + (c.ok ? '✓' : '✗') + '</span><span>' + esc(c.name) + (c.ok ? '' : ' <span class="bad mini">(farq ' + N(c.info) + ')</span>') + '</span></div>'; }).join('') +
      (bad.length ? '<p class="bad mini">Farq bor: Sozlamalarda boshlang‘ich qoldiq yoki qo‘lda kiritilgan yozuvlarni tekshiring.</p>' : '') + '</section>';
  }
  function warnHtml(rep) { return rep.warnings.length ? '<div class="notice">' + rep.warnings.map(esc).join('<br>') + '</div>' : ''; }

  function tUmumiy(rep) {
    var s = rep.summary, h = '<section class="card"><div class="stats">' + stat('Boshqaruvdagi aktivlar (mijozlar)', N(rep.aum.total) + ' so‘m') + stat('Tushum (davr)', N(s.revenue)) + stat('Xarajat (davr)', N(s.expenses)) + stat('Sof foyda', N(s.net), s.net >= 0 ? 'good' : 'bad') + '</div>' +
      '<div class="stats" style="margin-top:10px">' + stat('Jami aktiv (balans)', N(s.assets)) + stat('Pul: asosiy schyot', N(s.cashMain)) + stat('Pul: Rahbar schyoti 5110-R', N(s.cashMgr)) + stat('Foyda solig‘i', N(s.tax)) + '</div></section>';
    h += '<section class="card stack"><h2>Oylar bo‘yicha</h2><div class="tw"><table><thead><tr><th>Oy</th><th class="n">Tushum</th><th class="n">Ish haqi + ijt. to‘lov</th><th class="n">Shartnomalar</th><th class="n">Rahbar ulushi</th><th class="n">Foyda (soliqqacha)</th></tr></thead><tbody>' +
      rep.monthly.map(function (m) { return '<tr><td>' + mname(m.k) + '</td><td class="n">' + N(m.revenue) + '</td><td class="n">' + N(m.payroll) + '</td><td class="n">' + N(m.contracts) + '</td><td class="n">' + N(m.manager) + '</td><td class="n ' + (m.profit >= 0 ? 'good' : 'bad') + '">' + N(m.profit) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    h += '<section class="card stack"><h2>Daromad manbai</h2><p class="muted">Tushum mijoz hisoblari bo‘yicha avtomatik hisoblanadi: boshqaruv haqi ' + P(rep.feeRates.mgmt) + ' (yillik, o‘rtacha aktivdan), muvaffaqiyat haqi ' + P(rep.feeRates.success) + ' (chorak oxirida, hurdle ' + P(rep.feeRates.hurdle) + '). Stavkalar <b>Hisobotlar → Sozlamalar</b> bo‘limidagi haq stavkalaridan olinadi.</p></section>';
    return warnHtml(rep) + h + checksHtml(rep);
  }
  function tBalans(rep) {
    return '<section class="card stack"><h2>Buxgalteriya balansi (1-sonli shakl)</h2><p class="muted mini">' + dmy(rep.year + '-01-01') + ' va ' + dmy(rep.upto) + ' holatiga. Jurnaldan avtomatik hosil bo‘ladi, qo‘lda o‘zgartirilmaydi. Nol qatorlar yashirilgan.</p><div class="tw"><table><thead><tr><th>Ko‘rsatkich</th><th>Qator</th><th class="n">Davr boshiga</th><th class="n">Davr oxiriga</th></tr></thead><tbody>' +
      rep.balans.filter(function (r) { return r.kind === 'h' || r.begin || r.end || ['400', '780'].indexOf(r.code) >= 0; }).map(function (r) {
        if (r.kind === 'h') return '<tr><td colspan="4"><b>' + esc(r.label) + '</b></td></tr>';
        return '<tr' + (r.kind === 'f' ? ' style="font-weight:600"' : '') + '><td>' + esc(r.label) + '</td><td>' + r.code + '</td><td class="n">' + N(r.begin) + '</td><td class="n">' + N(r.end) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' + checksHtml(rep);
  }
  function tNatija(rep) {
    return '<section class="card stack"><h2>Moliyaviy natijalar to‘g‘risida hisobot (2-sonli shakl)</h2><p class="muted mini">' + dmy(rep.year + '-01-01') + ' – ' + dmy(rep.upto) + '</p><div class="tw"><table><thead><tr><th>Ko‘rsatkich</th><th>Qator</th><th class="n">Daromad (foyda)</th><th class="n">Xarajat (zarar)</th></tr></thead><tbody>' +
      rep.pnl.map(function (r) { return '<tr' + (r.bold ? ' style="font-weight:600"' : '') + '><td>' + esc(r.label) + '</td><td>' + r.code + '</td><td class="n">' + N(r.inc) + '</td><td class="n">' + N(r.exp) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  }
  function tRahbar(rep) {
    var m = rep.cfg.mgr, tb = {}; rep.tb.forEach(function (r) { tb[r.code] = r; });
    var t = rep.summary.mgr;
    var h = '<section class="card stack"><h2>Rahbar ulushi: ' + m.pct + '%' + (rep.boss ? ' · ' + esc(rep.boss.name) : '') + '</h2><p class="muted">Baza: <b>' + (m.base === 'revenue' ? 'tushum' : 'bonusgacha foyda (soliqqacha)') + '</b>, yil boshidan kumulyativ. Har oy ulush hisoblanadi, soliqlar ushlanadi va netto qism asosiy schyotdan <b>maxsus 5110-R hisobraqamiga</b> o‘tkaziladi. Rahbarga to‘lov faqat shu hisobraqamdan amalga oshiriladi. Zarar oylarida hisoblangan ulush qaytarib olinmaydi: yangi ulush kumulyativ foyda avvalgi eng yuqori darajadan oshgandan keyin hisoblanadi.</p>' +
      '<div class="stats">' + stat('Maxsus schyot 5110-R qoldig‘i', N(tb['5110-R'].close)) + stat('Rahbar ulushi qarzi 6710-R', N(tb['6710-R'].close)) + stat('Yil bo‘yicha ulush (brutto)', N(t.share)) + stat('Netto (qo‘liga)', N(t.net)) + '</div>';
    h += '<div class="tw"><table><thead><tr><th>Oy</th><th class="n">Baza (oy)</th><th class="n">Baza (kumulyativ)</th><th class="n">Ulush (brutto)</th><th class="n">JShDS</th><th class="n">INPS</th><th class="n">Netto → 5110-R</th><th class="n">Ish beruvchi to‘lovi</th><th>Holat</th></tr></thead><tbody>' +
      rep.mgr.map(function (x) { return '<tr><td>' + mname(x.k) + '</td><td class="n">' + N(x.base) + '</td><td class="n">' + N(x.cum) + '</td><td class="n"><b>' + N(x.share) + '</b></td><td class="n">' + N(x.jshds) + '</td><td class="n">' + N(x.inps) + '</td><td class="n">' + N(x.net) + '</td><td class="n">' + N(x.yait) + '</td><td>' + (x.paid ? '<span class="good">to‘langan</span>' : '<span class="muted">hisoblangan</span>') + '</td></tr>'; }).join('') +
      '<tr style="font-weight:600"><td>Jami</td><td></td><td></td><td class="n">' + N(t.share) + '</td><td class="n">' + N(t.jshds) + '</td><td class="n">' + N(t.inps) + '</td><td class="n">' + N(t.net) + '</td><td class="n">' + N(t.yait) + '</td><td></td></tr></tbody></table></div>' +
      '<p class="muted mini">Huquqiy eslatma: ulush bonus sifatida mehnat haqi soliqlariga tortiladi. Ulush tartibi mehnat shartnomasi va Kuzatuv kengashi/umumiy yig‘ilish qarori bilan tasdiqlansin. Sozlamalarda foiz va bazani o‘zgartirish mumkin.</p></section>';
    return warnHtml(rep) + h;
  }

  /* ---------- xodimlar ---------- */
  function userOpts() { return [['', '— bog‘lanmagan —']].concat((X.data.users || []).map(function (u) { return [u.id, (u.name || u.email) + ' (' + u.email + ')']; })); }
  function empForm() {
    var e = X.eid ? X.data.emps.filter(function (x) { return x.id === X.eid; })[0] : null, f = ST.f;
    function v(k, d) { return f[k] != null ? f[k] : d; }
    var last = e && e.sal && e.sal.length ? e.sal[e.sal.length - 1].amount : '';
    return '<section class="card stack"><h2>' + (e ? 'Xodimni tahrirlash: ' + esc(e.name) : 'Yangi xodim / Rahbar qo‘shish') + '</h2><form data-form="axemp"><div class="form-grid">' +
      fld('F.I.Sh.', '<input type="text" data-bind="ax_e_name" value="' + esc(v('ax_e_name', e ? e.name : '')) + '">') + fld('Lavozim', '<input type="text" data-bind="ax_e_pos" value="' + esc(v('ax_e_pos', e ? e.position : '')) + '">') +
      fld('Turi', sel('ax_e_role', [['xodim', 'Xodim'], ['rahbar', 'Rahbar (5% ulush oladi)']], v('ax_e_role', e ? e.role : 'xodim'))) + fld('PINFL (14 raqam)', '<input type="text" inputmode="numeric" data-bind="ax_e_pinfl" value="' + esc(v('ax_e_pinfl', e ? e.pinfl : '')) + '">') +
      fld('Ishga qabul sanasi', '<input type="date" data-bind="ax_e_from" value="' + esc(v('ax_e_from', e ? e.from : '')) + '">') + fld('Bo‘shagan sana (bo‘sh = ishlaydi)', '<input type="date" data-bind="ax_e_to" value="' + esc(v('ax_e_to', e ? e.to : '')) + '">') +
      fld('Oylik oklad (so‘m)', '<input type="number" min="0" data-bind="ax_e_sal" value="' + esc(v('ax_e_sal', last)) + '">') + (e ? fld('Yangi oklad amal qilish sanasi (oklad o‘zgarsa)', '<input type="date" data-bind="ax_e_salfrom" value="' + esc(v('ax_e_salfrom', '')) + '">') : '') +
      fld('Bank', '<input type="text" data-bind="ax_e_bank" value="' + esc(v('ax_e_bank', e ? e.bank : '')) + '">') + fld('Hisob raqam', '<input type="text" data-bind="ax_e_acct" value="' + esc(v('ax_e_acct', e ? e.account : '')) + '">') +
      fld('Sayt foydalanuvchisi (ixtiyoriy)', sel('ax_e_uid', userOpts(), v('ax_e_uid', e ? e.uid : ''))) +
      '</div><div class="row"><button class="btn" type="submit">Saqlash</button>' + (e ? '<button type="button" class="btn ghost" data-act="axecancel">Bekor</button>' : '') + '<span class="muted mini">Hech narsa o‘chirilmaydi: ishdan ketganda bo‘shash sanasi kiritiladi. Oklad o‘zgarishi tarixi saqlanadi.</span></div></form></section>';
  }
  function tXodim(rep) {
    var d = X.data, h = '<section class="card stack"><h2>Rahbar va xodimlar</h2><div class="tw"><table><thead><tr><th>F.I.Sh.</th><th>Lavozim</th><th>Turi</th><th class="n">Oklad</th><th>Qabul</th><th>Bo‘shagan</th><th>Hisob</th><th></th></tr></thead><tbody>' +
      (d.emps.length ? d.emps.map(function (e) { var s = e.sal && e.sal.length ? e.sal[e.sal.length - 1].amount : 0; return '<tr><td>' + esc(e.name) + '</td><td>' + esc(e.position) + '</td><td>' + (e.role === 'rahbar' ? '<span class="pill p-b">Rahbar</span>' : 'Xodim') + '</td><td class="n">' + N(s) + '</td><td>' + dmy(e.from) + '</td><td>' + dmy(e.to) + '</td><td class="mono">' + esc(e.account || '') + '</td><td><button class="btn ghost small" data-act="axeedit" data-v="' + e.id + '">Tahrirlash</button></td></tr>'; }).join('') : '<tr><td colspan="8" class="muted">Hali xodim kiritilmagan.</td></tr>') + '</tbody></table></div></section>';
    h += empForm();
    var mo = rep.payroll, cur = X.month && mo.filter(function (p) { return p.k === X.month; })[0] || mo[mo.length - 1];
    h += '<section class="card stack"><h2>Maosh varaqasi</h2>' + (mo.length ? '<div class="row" style="gap:8px;flex-wrap:wrap">' + sel('ax_month', mo.map(function (p) { return [p.k, mname(p.k)]; }), cur ? cur.k : '') + '</div>' : '') + (cur ? maoshTable(rep, cur) : '<p class="muted">Tanlangan yilda ish haqi hisoblanmagan.</p>') + '</section>';
    return h;
  }
  function maoshTable(rep, p) {
    var mg = rep.mgr.filter(function (x) { return x.k === p.k; })[0] || null, rows = p.rows.map(function (r) {
      var sh = (r.role === 'rahbar' && mg) ? mg : null, g = r.gross + (sh ? sh.share : 0), j = r.jshds + (sh ? sh.jshds : 0), i = r.inps + (sh ? sh.inps : 0);
      return '<tr><td>' + esc(r.name) + (r.role === 'rahbar' ? ' <span class="pill p-b">Rahbar</span>' : '') + '</td><td class="n">' + N(r.gross) + '</td><td class="n">' + (sh ? N(sh.share) : '') + '</td><td class="n">' + N(g) + '</td><td class="n">' + N(j) + '</td><td class="n">' + N(i) + '</td><td class="n"><b>' + N(g - j - i) + '</b></td></tr>';
    }).join('');
    var T = { g: p.gross + (mg ? mg.share : 0), j: p.jshds + (mg ? mg.jshds : 0), i: p.inps + (mg ? mg.inps : 0) };
    return '<div class="tw"><table><thead><tr><th>F.I.Sh.</th><th class="n">Oklad</th><th class="n">Rahbar ulushi</th><th class="n">Jami hisoblangan</th><th class="n">JShDS</th><th class="n">INPS</th><th class="n">Qo‘liga (netto)</th></tr></thead><tbody>' + rows +
      '<tr style="font-weight:600"><td>Jami</td><td class="n">' + N(p.gross) + '</td><td class="n">' + N(mg ? mg.share : 0) + '</td><td class="n">' + N(T.g) + '</td><td class="n">' + N(T.j) + '</td><td class="n">' + N(T.i) + '</td><td class="n">' + N(T.g - T.j - T.i) + '</td></tr></tbody></table></div>' +
      '<p class="muted mini">Ish beruvchining ijtimoiy to‘lovi: ' + N(p.yait + (mg ? mg.yait : 0)) + ' so‘m. Oklad to‘lovi asosiy schyotdan, Rahbar ulushining netto qismi maxsus 5110-R schyotdan to‘lanadi. Holat: ' + (p.paid ? 'to‘langan' : 'hisoblangan, to‘lanmagan') + '.</p>';
  }

  /* ---------- shartnomalar ---------- */
  function tShartnoma(rep) {
    var d = X.data, c = X.cid ? d.cons.filter(function (x) { return x.id === X.cid; })[0] : null, f = ST.f;
    function v(k, dv) { return f[k] != null ? f[k] : dv; }
    var h = '<section class="card stack"><h2>Shartnomalar va xarajatlar</h2><div class="tw"><table><thead><tr><th>Kod</th><th>Kontragent</th><th>Predmet</th><th class="n">Jami</th><th>Boshlanish</th><th class="n">Oy</th><th class="n">Hisoblangan</th><th class="n">To‘langan</th><th class="n">Qarz</th><th></th></tr></thead><tbody>' +
      (rep.contracts.length ? rep.contracts.map(function (r) { var raw = d.cons.filter(function (x) { return x.code === r.code; })[0]; return '<tr><td>' + esc(r.code) + '</td><td>' + esc(r.party) + '</td><td>' + esc(r.subject) + '</td><td class="n">' + N(r.total) + '</td><td>' + dmy(r.start) + '</td><td class="n">' + r.months + '</td><td class="n">' + N(r.accrued) + '</td><td class="n">' + N(r.paid) + '</td><td class="n ' + (r.debt > 0 ? 'bad' : '') + '">' + N(r.debt) + '</td><td>' + (raw ? '<button class="btn ghost small" data-act="axcedit" data-v="' + raw.id + '">Tahrirlash</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="10" class="muted">Hali shartnoma kiritilmagan.</td></tr>') + '</tbody></table></div><p class="muted mini">Xarajat shartnoma muddati bo‘yicha har oyga teng hisoblanadi (Dt 9220/9230, Kt 6010). To‘lov kiritilganda Dt 6010, Kt 5110.</p></section>';
    h += '<section class="card stack"><h2>' + (c ? 'Shartnomani tahrirlash: ' + esc(c.code) : 'Yangi shartnoma') + '</h2><form data-form="axcon"><div class="form-grid">' +
      fld('Kod (masalan SH-01)', '<input type="text" data-bind="ax_c_code" value="' + esc(v('ax_c_code', c ? c.code : '')) + '">') + fld('Kontragent', '<input type="text" data-bind="ax_c_party" value="' + esc(v('ax_c_party', c ? c.party : '')) + '">') +
      fld('Predmet', '<input type="text" data-bind="ax_c_subject" value="' + esc(v('ax_c_subject', c ? c.subject : '')) + '">') + fld('Toifa (ijara, IT, audit…)', '<input type="text" data-bind="ax_c_kind" value="' + esc(v('ax_c_kind', c ? c.kind : '')) + '">') +
      fld('Jami summa (QQS bilan, so‘m)', '<input type="number" min="1" data-bind="ax_c_total" value="' + esc(v('ax_c_total', c ? c.total : '')) + '">') + fld('Shartnoma sanasi', '<input type="date" data-bind="ax_c_date" value="' + esc(v('ax_c_date', c ? c.date : tdy())) + '">') +
      fld('Xarajat boshlanish sanasi', '<input type="date" data-bind="ax_c_start" value="' + esc(v('ax_c_start', c ? c.start : tdy())) + '">') + fld('Muddat (oy)', '<input type="number" min="1" max="120" data-bind="ax_c_months" value="' + esc(v('ax_c_months', c ? c.months : 1)) + '">') +
      fld('Xarajat hisobi', sel('ax_c_acct', [['9220', '9220 Ma’muriy xarajat'], ['9230', '9230 Boshqa operatsion xarajat']], v('ax_c_acct', c ? c.acct : '9220'))) + fld('Bekor qilingan sana (bo‘sh = amalda)', '<input type="date" data-bind="ax_c_cancel" value="' + esc(v('ax_c_cancel', c ? c.cancelAt : '')) + '">') +
      '</div><div class="row"><button class="btn" type="submit">Saqlash</button>' + (c ? '<button type="button" class="btn ghost" data-act="axccancel">Bekor</button>' : '') + '</div></form></section>';
    var pays = d.pays.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    h += '<section class="card stack"><h2>To‘lovlar</h2><form data-form="axpay"><div class="form-grid">' + fld('Shartnoma', sel('ax_p_con', [['', '— tanlang —']].concat(d.cons.map(function (x) { return [x.code, x.code + ' · ' + x.party]; })), v('ax_p_con', ''))) + fld('Sana', '<input type="date" data-bind="ax_p_date" value="' + esc(v('ax_p_date', tdy())) + '">') +
      fld('Summa (so‘m)', '<input type="number" min="1" data-bind="ax_p_amt" value="' + esc(v('ax_p_amt', '')) + '">') + fld('Izoh', '<input type="text" data-bind="ax_p_note" value="' + esc(v('ax_p_note', '')) + '">') + '</div><div class="row"><button class="btn" type="submit">To‘lovni kiritish</button></div></form>' +
      '<div class="tw"><table><thead><tr><th>Sana</th><th>Shartnoma</th><th class="n">Summa</th><th>Izoh</th><th></th></tr></thead><tbody>' + (pays.length ? pays.slice(0, 200).map(function (p) { return '<tr' + (p.void ? ' style="opacity:.5;text-decoration:line-through"' : '') + '><td>' + dmy(p.date) + '</td><td>' + esc(p.con) + '</td><td class="n">' + N(p.amount) + '</td><td>' + esc(p.note) + (p.void ? ' · bekor: ' + esc(p.voidReason) : '') + '</td><td>' + (p.void ? '' : '<button class="btn ghost small" data-act="axpvoid" data-v="' + p.id + '">Bekor qilish</button>') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">To‘lov yo‘q.</td></tr>') + '</tbody></table></div></section>';
    return h;
  }

  /* ---------- jurnal va aylanma ---------- */
  function tJurnal(rep) {
    var d = X.data, q = (ST.f.ax_q || '').toLowerCase(), f = ST.f, plan = [['', '—']].concat(d.plan.filter(function (a) { return a.code !== '9910'; }).map(function (a) { return [a.code, a.code + ' ' + a.name]; }));
    var rows = rep.journal.filter(function (e) { return e.d >= rep.year + '-01-01' && (!q || (e.doc + ' ' + e.note + ' ' + e.dt + ' ' + e.kt).toLowerCase().indexOf(q) >= 0); });
    var h = '<section class="card stack"><h2>Qo‘lda yozuv kiritish</h2><p class="muted mini">Odatda hamma yozuv avtomatik hosil bo‘ladi. Faqat avtomatik qamrab olinmagan operatsiyalar uchun (masalan: soliq to‘lovi, dividend, asosiy vosita xaridi).</p><form data-form="axje"><div class="form-grid">' +
      fld('Sana', '<input type="date" data-bind="ax_j_date" value="' + esc(f.ax_j_date != null ? f.ax_j_date : tdy()) + '">') + fld('Debet', sel('ax_j_dt', plan, f.ax_j_dt || '')) + fld('Kredit', sel('ax_j_kt', plan, f.ax_j_kt || '')) +
      fld('Summa (so‘m)', '<input type="number" min="1" data-bind="ax_j_amt" value="' + esc(f.ax_j_amt || '') + '">') + fld('Hujjat №', '<input type="text" data-bind="ax_j_doc" value="' + esc(f.ax_j_doc || '') + '">') + fld('Izoh', '<input type="text" data-bind="ax_j_note" value="' + esc(f.ax_j_note || '') + '">') +
      '</div><div class="row"><button class="btn" type="submit">Yozuvni kiritish</button></div></form>' +
      (d.manual.length ? '<div class="tw"><table><thead><tr><th>Sana</th><th>Dt</th><th>Kt</th><th class="n">Summa</th><th>Izoh</th><th></th></tr></thead><tbody>' + d.manual.slice().reverse().slice(0, 100).map(function (j) { return '<tr' + (j.void ? ' style="opacity:.5;text-decoration:line-through"' : '') + '><td>' + dmy(j.date) + '</td><td>' + j.dt + '</td><td>' + j.kt + '</td><td class="n">' + N(j.amt) + '</td><td>' + esc(j.note) + (j.void ? ' · bekor: ' + esc(j.voidReason) : '') + '</td><td>' + (j.void ? '' : '<button class="btn ghost small" data-act="axjvoid" data-v="' + j.id + '">Bekor qilish</button>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') + '</section>';
    h += '<section class="card stack"><h2>Umumiy jurnal (' + rows.length + ' ta yozuv)</h2><div class="field"><label>Qidiruv</label><input type="text" data-bind="ax_q" data-live="1" value="' + esc(ST.f.ax_q || '') + '" placeholder="hujjat, izoh yoki hisobvaraq"></div><div class="tw"><table><thead><tr><th>№</th><th>Sana</th><th>Hujjat</th><th>Izoh</th><th>Dt</th><th>Kt</th><th class="n">Summa</th></tr></thead><tbody>' +
      rows.slice(0, 600).map(function (e) { return '<tr><td>' + e.n + '</td><td>' + dmy(e.d) + '</td><td>' + esc(e.doc) + '</td><td>' + esc(e.note) + '</td><td>' + e.dt + '</td><td>' + e.kt + '</td><td class="n">' + N(e.amt) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (rows.length > 600 ? '<p class="muted mini">Dastlabki 600 ta ko‘rsatildi. Hammasi Excel faylida.</p>' : '') + '</section>';
    return h;
  }
  function tAylanma(rep) {
    return '<section class="card stack"><h2>Aylanma vedomost</h2><div class="tw"><table><thead><tr><th>Kod</th><th>Nomi</th><th class="n">Boshiga qoldiq</th><th class="n">Debet aylanma</th><th class="n">Kredit aylanma</th><th class="n">Yopish</th><th class="n">Oxiriga qoldiq</th></tr></thead><tbody>' +
      rep.tb.filter(function (r) { return r.open || r.dt || r.kt || r.close || r.cdt || r.ckt; }).map(function (r) { return '<tr><td>' + r.code + '</td><td>' + esc(r.name) + '</td><td class="n">' + N(r.open) + '</td><td class="n">' + N(r.dt) + '</td><td class="n">' + N(r.kt) + '</td><td class="n">' + N(r.cdt - r.ckt) + '</td><td class="n"><b>' + N(r.close) + '</b></td></tr>'; }).join('') + '</tbody></table></div><p class="muted mini">Qoldiq hisobvaraqning o‘z tomoni bo‘yicha (aktiv: debet, passiv: kredit).</p></section>';
  }

  /* ---------- ustav kapitali va sozlamalar ---------- */
  function tUstav(rep) {
    var c = rep.charter, cfg = X.data.cfg, f = ST.f;
    function v(k, d) { return f[k] != null ? f[k] : d; }
    var holders = v('ax_u_holders', (cfg.charter.holders || []).map(function (x) { return x.name + '; ' + x.pct; }).join('\n'));
    return '<section class="card stack"><h2>Ustav kapitali</h2><div class="stats">' + stat('Ustav kapitali', N(c.amount)) + stat('To‘langan', N(c.paid)) + stat('To‘lanmagan (4610)', N(c.due)) + stat('Aksiyalar soni', B.fi(c.shares)) + stat('Oylik doimiy xarajat (o‘rt.)', N(c.opexMonthly)) + stat('Qoplash muddati (oy)', c.coverMonths == null ? '—' : c.coverMonths) + '</div></section>' +
      '<section class="card stack"><h2>Ustav kapitalini kiritish</h2><form data-form="axustav"><div class="form-grid">' + fld('Ustav kapitali (so‘m)', '<input type="number" min="0" data-bind="ax_u_amt" value="' + esc(v('ax_u_amt', cfg.charter.amount || '')) + '">') + fld('E’lon qilingan sana', '<input type="date" data-bind="ax_u_date" value="' + esc(v('ax_u_date', cfg.charter.date || '')) + '">') +
      fld('To‘langan ulush (%)', '<input type="number" min="0" max="100" data-bind="ax_u_paid" value="' + esc(v('ax_u_paid', cfg.charter.paidPct)) + '">') + fld('Bitta aksiya nominali (so‘m)', '<input type="number" min="1" data-bind="ax_u_nom" value="' + esc(v('ax_u_nom', cfg.charter.nominal)) + '">') +
      '</div>' + fld('Aksiyadorlar (har qatorda: nomi; ulush %)', '<textarea rows="4" data-bind="ax_u_holders" style="width:100%">' + esc(holders) + '</textarea>') + '<div class="row"><button class="btn" type="submit">Saqlash</button></div></form></section>' +
      '<section class="card stack"><h2>Tavsiyalar</h2><ul style="margin:0;padding-left:18px;line-height:1.6"><li>Qonuniy minimum ustav kapitali va ishonchli boshqaruv/qimmatli qog‘ozlar faoliyati uchun NAPP talablarini aniq tekshiring (bu sahifa ularni tasdiqlamaydi).</li><li>Kamida 12 oylik doimiy xarajatni qoplaydigan miqdor belgilang (yuqoridagi “qoplash muddati”).</li><li>Faqat pul bilan shakllantiring; to‘lanmagan qism 4610 hisobida ko‘rinadi.</li><li>Mijozlar aktivlari BARLOS balansiga kirmaydi: ular alohida (balansdan tashqari) hisobda yuritiladi.</li><li>Zaxira kapitalini (8510) qonun talabiga ko‘ra yillik foydadan shakllantiring.</li></ul></section>';
  }
  function tSozlama(rep) {
    var cfg = X.data.cfg, f = ST.f;
    function v(k, d) { return f[k] != null ? f[k] : d; }
    function ck(k, d) { return (f[k] != null ? f[k] : d) ? ' checked' : ''; }
    var opening = v('ax_s_open', (cfg.opening || []).map(function (o) { return o.code + '; ' + o.dt + '; ' + o.kt; }).join('\n'));
    return '<section class="card stack"><h2>Hisoblash sozlamalari</h2><form data-form="axcfg"><div class="form-grid">' +
      fld('JShDS (%)', '<input type="number" step="any" data-bind="ax_s_jshds" value="' + esc(v('ax_s_jshds', cfg.rates.jshds)) + '">') + fld('Ijtimoiy to‘lov, ish beruvchi (%)', '<input type="number" step="any" data-bind="ax_s_yait" value="' + esc(v('ax_s_yait', cfg.rates.yait)) + '">') +
      fld('INPS (%)', '<input type="number" step="any" data-bind="ax_s_inps" value="' + esc(v('ax_s_inps', cfg.rates.inps)) + '">') + fld('Foyda solig‘i (%)', '<input type="number" step="any" data-bind="ax_s_profit" value="' + esc(v('ax_s_profit', cfg.rates.profit)) + '">') +
      fld('Rahbar ulushi (%)', '<input type="number" step="any" data-bind="ax_s_mpct" value="' + esc(v('ax_s_mpct', cfg.mgr.pct)) + '">') + fld('Rahbar ulushi bazasi', sel('ax_s_mbase', [['profit', 'Bonusgacha foyda (soliqqacha)'], ['revenue', 'Tushum']], v('ax_s_mbase', cfg.mgr.base))) +
      fld('To‘lov kuni (keyingi oyning kuni)', '<input type="number" min="1" max="28" data-bind="ax_s_pday" value="' + esc(v('ax_s_pday', cfg.pay.day)) + '">') + fld('Hisobni boshlash oyi (bo‘sh = avto)', '<input type="month" data-bind="ax_s_start" value="' + esc(v('ax_s_start', cfg.start)) + '">') + '</div>' +
      '<label class="switch"><input type="checkbox" data-bind="ax_s_mon"' + ck('ax_s_mon', cfg.mgr.on) + '> Rahbar ulushi hisoblansin</label>' +
      '<label class="switch"><input type="checkbox" data-bind="ax_s_pauto"' + ck('ax_s_pauto', cfg.pay.auto) + '> Maosh, soliq va tushumlar to‘lov kunida avtomatik to‘langan deb hisoblansin</label>' +
      '<label class="switch"><input type="checkbox" data-bind="ax_s_rm"' + ck('ax_s_rm', cfg.rev.mgmt) + '> Daromadga boshqaruv haqi kirsin</label>' +
      '<label class="switch"><input type="checkbox" data-bind="ax_s_rs"' + ck('ax_s_rs', cfg.rev.succ) + '> Daromadga muvaffaqiyat haqi kirsin (chorak oxirida)</label>' +
      '<label class="switch"><input type="checkbox" data-bind="ax_s_rc"' + ck('ax_s_rc', cfg.rev.custody) + '> Daromadga saqlash/depozitariy haqi kirsin (odatda uchinchi shaxsga o‘tadi)</label>' +
      fld('Boshlang‘ich qoldiqlar (har qatorda: hisobvaraq kodi; debet; kredit). Faqat dastlabki joriy qoldiq bo‘lsa.', '<textarea rows="4" data-bind="ax_s_open" style="width:100%">' + esc(opening) + '</textarea>') +
      '<div class="row"><button class="btn" type="submit">Saqlash</button></div></form></section>' +
      '<section class="card stack"><h2>Hisobvaraqlar rejasi</h2><div class="tw"><table><thead><tr><th>Kod</th><th>Nomi</th><th>Turi</th><th>Balans qatori</th></tr></thead><tbody>' + X.data.plan.map(function (a) { return '<tr><td>' + a.code + '</td><td>' + esc(a.name) + '</td><td>' + a.type + '</td><td>' + (a.line || '') + '</td></tr>'; }).join('') + '</tbody></table></div><p class="muted mini">Kodlar UzNIF hisobotidagi xo‘jalik yurituvchi subyektlar rejasiga mos. Bosh buxgalter tasdiqlasin.</p></section>';
  }

  /* ---------- sahifa ---------- */
  function page() {
    ensure();
    if (X.err) return '<div class="stack">' + head() + '<div class="err" role="alert">' + esc(X.err) + '</div></div>';
    if (!X.rep || !X.data) return '<div class="stack">' + head() + '<section class="card"><p class="muted">Hisob-kitob yuklanmoqda…</p></section></div>';
    var rep = X.rep, body = { umumiy: tUmumiy, balans: tBalans, natija: tNatija, rahbar: tRahbar, xodim: tXodim, shartnoma: tShartnoma, jurnal: tJurnal, aylanma: tAylanma, ustav: tUstav, sozlama: tSozlama }[X.tab](rep);
    return '<div class="stack">' + head() + tabs() + body + '</div>';
  }

  /* ---------- amallar ---------- */
  B.acts.axgo = function () { var y = +ST.f.ax_year || X.year, u = ST.f.ax_upto || X.upto; if (u.slice(0, 4) !== String(y)) u = (y === +tdy().slice(0, 4) ? tdy() : y + '-12-31'); X.year = y; X.upto = u; delete ST.f.ax_year; delete ST.f.ax_upto; X.key = ''; X.rep = null; };
  B.acts.axtab = function (el) { X.tab = el.getAttribute('data-v'); };
  B.acts.axeedit = function (el) { X.eid = el.getAttribute('data-v'); ['name', 'pos', 'role', 'pinfl', 'from', 'to', 'sal', 'salfrom', 'bank', 'acct', 'uid'].forEach(function (k) { delete ST.f['ax_e_' + k]; }); };
  B.acts.axecancel = function () { X.eid = null; ['name', 'pos', 'role', 'pinfl', 'from', 'to', 'sal', 'salfrom', 'bank', 'acct', 'uid'].forEach(function (k) { delete ST.f['ax_e_' + k]; }); };
  B.acts.axcedit = function (el) { X.cid = el.getAttribute('data-v'); ['code', 'party', 'subject', 'kind', 'total', 'date', 'start', 'months', 'acct', 'cancel'].forEach(function (k) { delete ST.f['ax_c_' + k]; }); };
  B.acts.axccancel = function () { X.cid = null; ['code', 'party', 'subject', 'kind', 'total', 'date', 'start', 'months', 'acct', 'cancel'].forEach(function (k) { delete ST.f['ax_c_' + k]; }); };
  function voidIt(url, id, msg) { var why = window.prompt('Bekor qilish sababi (kamida 3 belgi):'); if (!why) return false; return B.run(B.api('POST', url + id + '/void', { reason: why }), msg); }
  B.acts.axpvoid = function (el) { return voidIt('/api/acx/pay/', el.getAttribute('data-v'), 'To‘lov bekor qilindi'); };
  B.acts.axjvoid = function (el) { return voidIt('/api/acx/je/', el.getAttribute('data-v'), 'Yozuv bekor qilindi'); };
  B.onbind.ax_month = function (b, t) { X.month = t.value; B.rerender(); };

  B.forms.axemp = function () {
    var f = ST.f, e = X.eid ? X.data.emps.filter(function (x) { return x.id === X.eid; })[0] : null;
    function g(k, d) { return f['ax_e_' + k] != null ? f['ax_e_' + k] : d; }
    var body = { id: X.eid || undefined, name: g('name', e ? e.name : ''), position: g('pos', e ? e.position : ''), role: g('role', e ? e.role : 'xodim'), pinfl: g('pinfl', e ? e.pinfl : ''), from: g('from', e ? e.from : ''), to: g('to', e ? e.to : ''), salary: g('sal', e && e.sal.length ? e.sal[e.sal.length - 1].amount : ''), salFrom: g('salfrom', ''), bank: g('bank', e ? e.bank : ''), account: g('acct', e ? e.account : ''), uid: g('uid', e ? e.uid : '') };
    return B.run(B.api('POST', '/api/acx/emp', body), 'Xodim saqlandi').then(function () { B.acts.axecancel(); B.rerender(); });
  };
  B.forms.axcon = function () {
    var f = ST.f, c = X.cid ? X.data.cons.filter(function (x) { return x.id === X.cid; })[0] : null;
    function g(k, d) { return f['ax_c_' + k] != null ? f['ax_c_' + k] : d; }
    var body = { id: X.cid || undefined, code: g('code', c ? c.code : ''), party: g('party', c ? c.party : ''), subject: g('subject', c ? c.subject : ''), kind: g('kind', c ? c.kind : ''), total: g('total', c ? c.total : ''), date: g('date', c ? c.date : tdy()), start: g('start', c ? c.start : tdy()), months: g('months', c ? c.months : 1), acct: g('acct', c ? c.acct : '9220'), cancelAt: g('cancel', c ? c.cancelAt : '') };
    return B.run(B.api('POST', '/api/acx/con', body), 'Shartnoma saqlandi').then(function () { B.acts.axccancel(); B.rerender(); });
  };
  B.forms.axpay = function () { var f = ST.f; return B.run(B.api('POST', '/api/acx/pay', { con: f.ax_p_con, date: f.ax_p_date || tdy(), amount: f.ax_p_amt, note: f.ax_p_note }), 'To‘lov kiritildi').then(function () { delete f.ax_p_amt; delete f.ax_p_note; B.rerender(); }); };
  B.forms.axje = function () { var f = ST.f; return B.run(B.api('POST', '/api/acx/je', { date: f.ax_j_date || tdy(), dt: f.ax_j_dt, kt: f.ax_j_kt, amt: f.ax_j_amt, note: f.ax_j_note, doc: f.ax_j_doc }), 'Yozuv kiritildi').then(function () { ['amt', 'note', 'doc', 'dt', 'kt'].forEach(function (k) { delete f['ax_j_' + k]; }); B.rerender(); }); };
  B.forms.axustav = function () {
    var f = ST.f, cfg = X.data.cfg, hs = (f.ax_u_holders != null ? f.ax_u_holders : (cfg.charter.holders || []).map(function (x) { return x.name + '; ' + x.pct; }).join('\n')).split(/\n/).map(function (l) { var p = l.split(';'); return p.length >= 2 ? { name: p[0].trim(), pct: parseFloat(p[1].replace(',', '.')) } : null; }).filter(Boolean);
    return B.run(B.api('POST', '/api/acx/cfg', { charter: { amount: f.ax_u_amt != null ? f.ax_u_amt : cfg.charter.amount, date: f.ax_u_date != null ? f.ax_u_date : cfg.charter.date, paidPct: f.ax_u_paid != null ? f.ax_u_paid : cfg.charter.paidPct, nominal: f.ax_u_nom != null ? f.ax_u_nom : cfg.charter.nominal, holders: hs } }), 'Ustav kapitali saqlandi').then(function () { ['amt', 'date', 'paid', 'nom', 'holders'].forEach(function (k) { delete f['ax_u_' + k]; }); B.rerender(); });
  };
  B.forms.axcfg = function () {
    var f = ST.f, c = X.data.cfg;
    function g(k, d) { return f[k] != null ? f[k] : d; }
    var open = g('ax_s_open', (c.opening || []).map(function (o) { return o.code + '; ' + o.dt + '; ' + o.kt; }).join('\n')).split(/\n/).map(function (l) { var p = l.split(';'); return p.length >= 2 ? { code: p[0].trim(), dt: parseFloat((p[1] || '0').replace(/\s/g, '')) || 0, kt: parseFloat((p[2] || '0').replace(/\s/g, '')) || 0 } : null; }).filter(Boolean);
    var body = { rates: { jshds: g('ax_s_jshds', c.rates.jshds), yait: g('ax_s_yait', c.rates.yait), inps: g('ax_s_inps', c.rates.inps), profit: g('ax_s_profit', c.rates.profit) }, mgr: { on: g('ax_s_mon', c.mgr.on), pct: g('ax_s_mpct', c.mgr.pct), base: g('ax_s_mbase', c.mgr.base) }, pay: { auto: g('ax_s_pauto', c.pay.auto), day: g('ax_s_pday', c.pay.day) }, rev: { mgmt: g('ax_s_rm', c.rev.mgmt), succ: g('ax_s_rs', c.rev.succ), custody: g('ax_s_rc', c.rev.custody) }, start: g('ax_s_start', c.start), opening: open };
    return B.run(B.api('POST', '/api/acx/cfg', body), 'Sozlamalar saqlandi').then(function () { Object.keys(f).forEach(function (k) { if (k.indexOf('ax_s_') === 0) delete f[k]; }); B.rerender(); });
  };

  /* ---------- Excel ---------- */
  B.acts.axxlsx = function () {
    var rep = X.rep; if (!rep) return false;
    var S = [
      { name: 'Balans', cols: [{ h: 'Ko‘rsatkich', w: 60 }, { h: 'Qator', w: 8 }, { h: 'Davr boshiga', w: 18, t: 'n' }, { h: 'Davr oxiriga', w: 18, t: 'n' }], rows: rep.balans.map(function (r) { return [r.label, r.code, r.begin, r.end]; }) },
      { name: 'Moliyaviy natija', cols: [{ h: 'Ko‘rsatkich', w: 60 }, { h: 'Qator', w: 8 }, { h: 'Daromad (foyda)', w: 18, t: 'n' }, { h: 'Xarajat (zarar)', w: 18, t: 'n' }], rows: rep.pnl.map(function (r) { return [r.label, r.code, r.inc, r.exp]; }) },
      { name: 'Jurnal', cols: [{ h: '№', w: 7, t: 'n' }, { h: 'Sana', w: 12 }, { h: 'Hujjat', w: 16 }, { h: 'Izoh', w: 50 }, { h: 'Debet', w: 9 }, { h: 'Kredit', w: 9 }, { h: 'Summa', w: 18, t: 'n' }], rows: rep.journal.map(function (e) { return [e.n, e.d, e.doc, e.note, e.dt, e.kt, e.amt]; }) },
      { name: 'Aylanma', cols: [{ h: 'Kod', w: 9 }, { h: 'Nomi', w: 50 }, { h: 'Boshiga', w: 16, t: 'n' }, { h: 'Debet', w: 16, t: 'n' }, { h: 'Kredit', w: 16, t: 'n' }, { h: 'Oxiriga', w: 16, t: 'n' }], rows: rep.tb.map(function (r) { return [r.code, r.name, r.open, r.dt, r.kt, r.close]; }) },
      { name: 'Rahbar ulushi', cols: [{ h: 'Oy', w: 10 }, { h: 'Baza', w: 16, t: 'n' }, { h: 'Kumulyativ', w: 16, t: 'n' }, { h: 'Ulush', w: 16, t: 'n' }, { h: 'JShDS', w: 14, t: 'n' }, { h: 'INPS', w: 12, t: 'n' }, { h: 'Netto 5110-R', w: 16, t: 'n' }, { h: 'Holat', w: 12 }], rows: rep.mgr.map(function (x) { return [x.k, x.base, x.cum, x.share, x.jshds, x.inps, x.net, x.paid ? 'to‘langan' : 'hisoblangan']; }) },
      { name: 'Maosh', cols: [{ h: 'Oy', w: 10 }, { h: 'F.I.Sh.', w: 36 }, { h: 'Oklad', w: 16, t: 'n' }, { h: 'JShDS', w: 14, t: 'n' }, { h: 'INPS', w: 12, t: 'n' }, { h: 'Netto', w: 16, t: 'n' }], rows: [].concat.apply([], rep.payroll.map(function (p) { return p.rows.map(function (r) { return [p.k, r.name, r.gross, r.jshds, r.inps, r.net]; }); })) },
      { name: 'Shartnomalar', cols: [{ h: 'Kod', w: 10 }, { h: 'Kontragent', w: 30 }, { h: 'Predmet', w: 36 }, { h: 'Jami', w: 16, t: 'n' }, { h: 'Hisoblangan', w: 16, t: 'n' }, { h: 'To‘langan', w: 16, t: 'n' }, { h: 'Qarz', w: 16, t: 'n' }], rows: rep.contracts.map(function (r) { return [r.code, r.party, r.subject, r.total, r.accrued, r.paid, r.debt]; }) }
    ];
    var blob = window.Xlsx.build(S), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'barlos-buxgalteriya-' + rep.upto + '.xlsx'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); return false;
  };

  B.pages.buxgalteriya = page;
})(window.B);
