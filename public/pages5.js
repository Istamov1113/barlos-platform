/* BARLOS 2.14.0: "Amallar" bo'limi — bitta "Yangi amal" oynasi (bitim kiritish + ichki o'tkazma + ko'p hisobga xarid/sotish),
   tranzaksiyalar ro'yxati va kiritish/yechish so'rovlari bir joyda. Faqat admin/operator. */
(function (B) {
  'use strict';
  var Core = B.Core, ST = B.ST, esc = B.esc, money = B.money, nf = B.nf, fld = B.fld, bind = B.bind, sel = B.sel, empty = B.empty;
  function D() { return B.D(); }
  var W = ST.am = ST.am || { open: false, kind: '', sel: {}, plan: null, busy: false };

  var KINDS = [
    ['in', 'Pul kirdi', 'Mijoz hisobiga pul tushdi', '+'], ['out', 'Pul chiqdi', 'Mijozga pul qaytarildi', '−'],
    ['buy', 'Aktiv sotib olindi', 'BTC, aksiya, omonat va h.k.', '⬇'], ['sell', 'Aktiv sotildi', 'Aktiv sotildi, pul qaytdi', '⬆'],
    ['swap', 'Pul almashtirildi', 'Masalan: so‘m → USDT', '⇄'], ['inc', 'Foiz / dividend tushdi', 'Foiz, dividend yoki kupon', '%']
  ];
  var KN = {}; KINDS.forEach(function (k) { KN[k[0]] = k[1]; });

  function assets() { return D().assets.filter(function (a) { return !a.archived; }); }
  function cashA() { return Core.cashAsset(B.S()); }
  function defAid(kind) { var l = assets(), c = cashA(); if ((kind === 'in' || kind === 'out') && c) return c.id; var nc = l.filter(function (a) { return a.group !== 'naqd'; })[0]; return (nc || l[0] || {}).id; }
  function curAid() { return ST.f.am_aid || defAid(W.kind); }
  function accList() { return D().accounts.filter(function (a) { return !a.archived; }); }

  B.amalOpen = function (accId, kind) { W.open = true; W.kind = kind || ''; W.plan = null; W.sel = {}; if (accId) W.sel[accId] = true; ['am_aid', 'am_total', 'am_price', 'am_fee', 'am_note', 'am_t', 'am_settle', 'am_itype'].forEach(function (k) { delete ST.f[k]; }); ST.page = 'amal'; };
  B.acts.amalopen = function (el) { B.amalOpen(el.getAttribute('data-a') || '', el.getAttribute('data-k') || ''); };
  B.acts.amalclose = function () { W.open = false; W.plan = null; };
  B.acts.amkind = function (el) { W.kind = el.getAttribute('data-v'); W.plan = null; delete ST.f.am_aid; delete ST.f.am_price; };
  B.acts.amback = function () { W.kind = ''; W.plan = null; };
  B.acts.amsel = function (el) { var id = el.getAttribute('data-v'); W.sel[id] = !W.sel[id]; W.plan = null; };
  B.acts.amall = function (el) { var on = el.getAttribute('data-v') === '1'; W.sel = {}; if (on) accList().forEach(function (a) { W.sel[a.id] = true; }); W.plan = null; };
  B.acts.amtab = function (el) { ST.amTab = el.getAttribute('data-v'); };
  B.onbind['am_aid'] = function () { delete ST.f.am_price; W.plan = null; B.rerender(); };
  B.onbind['am_itype'] = function () { W.plan = null; };

  function body() {
    var ids = Object.keys(W.sel).filter(function (k) { return W.sel[k]; }), x = assets().filter(function (a) { return a.id === curAid(); })[0];
    var price = ST.f.am_price != null && ST.f.am_price !== '' ? ST.f.am_price : (x && x.group !== 'naqd' ? x.price : 1);
    var t = ST.f.am_t ? new Date(ST.f.am_t).getTime() : undefined;
    return { kind: W.kind, accs: ids, aid: curAid(), total: ST.f.am_total, price: price, t: t, fee: ST.f.am_fee, settle: ST.f.am_settle || undefined, note: ST.f.am_note, itype: ST.f.am_itype || 'FOIZ' };
  }
  B.acts.ampreview = function () {
    return B.api('POST', '/api/amal/preview', body()).then(function (r) { W.plan = r; B.rerender(); }).catch(function (e) { W.plan = null; B.toast ? B.toast(e.message, true) : alert(e.message); B.rerender(); });
  };
  B.acts.amrun = function () {
    var b = body();
    return B.run(B.api('POST', '/api/amal', b), 'Amal bajarildi').then(function () { W.open = false; W.kind = ''; W.plan = null; W.sel = {}; ['am_total', 'am_fee', 'am_note', 'am_t'].forEach(function (k) { delete ST.f[k]; }); B.rerender(); });
  };

  function step(n, title, inner) { return '<div class="stack" style="gap:8px"><div class="row" style="gap:8px;align-items:center"><span class="pill p-b">' + n + '</span><b>' + title + '</b></div>' + inner + '</div>'; }

  function wizard() {
    var h = '<section class="card stack"><div class="row sb"><h2>Yangi amal' + (W.kind ? ': ' + esc(KN[W.kind]) : '') + '</h2><span>' + (W.kind ? '<button class="btn ghost small" data-act="amback">← Boshqa amal</button> ' : '') + '<button class="btn ghost small" data-act="amalclose">Yopish</button></span></div>';
    if (!W.kind) {
      return h + step(1, 'Nima bo‘ldi?', '<div class="form-grid">' + KINDS.map(function (k) { return '<button class="btn ghost" style="text-align:left;padding:14px" data-act="amkind" data-v="' + k[0] + '"><b>' + k[3] + ' ' + k[1] + '</b><br><span class="muted mini">' + k[2] + '</span></button>'; }).join('') + '</div>') + '</section>';
    }
    if (W.kind === 'swap') return h + '<p class="sub">Tanlangan hisoblardan summa ularda mavjud qoldiqqa qarab ulushga bo‘linadi. Pastda natijani ko‘rib, keyin tasdiqlaysiz.</p>' + B.xferCard(true) + '</section>';
    var x = assets().filter(function (a) { return a.id === curAid(); })[0], k = W.kind, cash = k === 'in' || k === 'out';
    /* 2-qadam: hisoblar */
    var rows = accList().map(function (a) {
      var it = x ? B.view(a).items.filter(function (i) { return i.x.id === x.id; })[0] : null, on = !!W.sel[a.id];
      return '<tr class="rowlink" data-act="amsel" data-v="' + a.id + '"><td style="width:34px"><input type="checkbox"' + (on ? ' checked' : '') + ' style="pointer-events:none" tabindex="-1"></td><td><b>' + esc(a.owner) + '</b> <span class="muted">· ' + esc(a.name) + '</span></td><td class="n">' + (x ? nf(it ? it.qty : 0, 2) + ' ' + esc(x.sym) : '') + '</td></tr>';
    }).join('');
    h += step(2, 'Kimning hisobiga?', '<div class="row"><button class="btn ghost small" data-act="amall" data-v="1">Hammasi</button><button class="btn ghost small" data-act="amall" data-v="0">Tozalash</button><span class="muted mini">Bir nechtasi tanlansa summa hisoblardagi qoldiq (yoki hisob qiymati) ulushiga qarab bo‘linadi.</span></div><div class="tw"><table style="min-width:360px"><tbody>' + rows + '</tbody></table></div>');
    /* 3-qadam: raqamlar */
    var opts = assets().sort(function (a, b) { return (b.group === 'naqd') - (a.group === 'naqd'); }).map(function (a) { return [a.id, a.sym + ' — ' + a.name]; });
    var price = ST.f.am_price != null ? ST.f.am_price : (x && x.price != null ? x.price : '');
    var grid = fld(cash ? 'Qaysi pul' : 'Aktiv', sel('am_aid', opts, curAid())) + fld('Jami miqdor' + (x ? ' (' + esc(x.sym) + ')' : ''), '<input type="number" step="any" min="0"' + bind('am_total') + '>');
    if (k === 'buy' || k === 'sell') grid += fld('Narx (' + (x ? x.curr : '') + ')', '<input type="number" step="any" min="0" data-bind="am_price" value="' + esc(price) + '">');
    if (k === 'inc') grid += fld('Turi', sel('am_itype', [['FOIZ', 'Foiz'], ['DIVIDEND', 'Dividend'], ['KUPON', 'Kupon']], ST.f.am_itype || 'FOIZ'));
    grid += fld('Sana va vaqt (bo‘sh = hozir)', '<input type="datetime-local"' + bind('am_t', '') + '>');
    var more = '<details><summary class="muted">Qo‘shimcha (odatda kerak emas)</summary><div class="form-grid" style="margin-top:8px">' + fld('Komissiya (bo‘sh = avtomatik)', '<input type="number" step="any" min="0"' + bind('am_fee') + '>') + fld('Izoh', '<input type="text"' + bind('am_note') + '>') +
      ((k === 'buy' || k === 'sell' || k === 'inc') ? fld('Qaysi naqddan hisob-kitob', sel('am_settle', [['', 'Avtomatik']].concat(D().assets.filter(function (a) { return a.group === 'naqd' && !a.archived; }).map(function (a) { return [a.id, a.sym]; })), ST.f.am_settle || '')) : '') + '</div></details>';
    h += step(3, 'Raqamlar', '<div class="form-grid">' + grid + '</div>' + more);
    /* 4-qadam */
    var pv = '<div class="row"><button class="btn" data-act="ampreview">Ko‘rib chiqish</button><span class="muted mini">Tasdiqlamaguncha hech narsa yozilmaydi.</span></div>';
    if (W.plan) {
      var p = W.plan;
      pv += '<div class="tw"><table style="min-width:520px"><thead><tr><th>Hisob</th><th class="n">Miqdor</th><th class="n">Narx</th><th class="n">Komissiya</th><th>Holat</th></tr></thead><tbody>' + p.rows.map(function (r) { return '<tr><td>' + esc(r.owner) + '</td><td class="n">' + nf(r.amount, 4) + ' ' + esc(r.sym) + '</td><td class="n">' + (r.price != null ? nf(r.price, 4) : '') + '</td><td class="n">' + (r.fee ? nf(r.fee, 4) + ' ' + esc(r.feeAsset || '') : '—') + '</td><td>' + (r.ok ? '<span class="pill p-g">Tayyor</span>' : '<span class="pill p-r">' + esc(r.error) + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (p.ok ? '<div class="row"><button class="btn" data-act="amrun">Tasdiqlash va yozish (' + p.rows.length + ' ta hisob)</button></div>' : '<p class="bad">Xato bor: tuzating va qayta ko‘rib chiqing. Hech narsa yozilmadi.</p>');
    }
    return h + step(4, 'Ko‘rib chiqish', pv) + '</section>';
  }

  function pageAmal() {
    if (!B.isStaff()) return '';
    var tab = ST.amTab || 'list', tabs = [['list', 'Tranzaksiyalar'], ['req', 'So‘rovlar va mablag‘lar']];
    var h = '<div class="stack"><div class="row sb" style="flex-wrap:wrap;gap:8px"><div class="seg tabs" role="tablist">' + tabs.map(function (t) { return '<button data-act="amtab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' + (W.open ? '' : '<button class="btn" data-act="amalopen">＋ Yangi amal</button>') + '</div>';
    if (W.open) h += wizard();
    return h + (tab === 'req' ? B.pages.funds() : B.pages.tranz()) + '</div>';
  }

  /* ================= CHORAKNI YOPISH (Hisobotlar → Chorak) ================= */
  B.qLoad = function () {
    if (ST.qsLoading) return; ST.qsLoading = true;
    return B.api('GET', '/api/acx/quarters').then(function (r) { ST.qs = r; ST.qsLoading = false; B.rerender(); }).catch(function (e) { ST.qs = { error: e.message, quarters: [] }; ST.qsLoading = false; B.rerender(); });
  };
  B.acts.qview = function (el) {
    var k = el.getAttribute('data-v'); if (ST.qprev && ST.qprev.key === k) { ST.qprev = null; return; }
    return B.api('GET', '/api/acx/quarter/' + k).then(function (r) { ST.qprev = r; B.rerender(); }).catch(function (e) { alert(e.message); });
  };
  B.acts.qclose = function (el) {
    var k = el.getAttribute('data-v'), p = ST.qprev;
    if (!p || p.key !== k) return false;
    if (!window.confirm(p.per.label + ' yopiladi: ' + p.rows.length + ' ta mijoz hisobidan jami ' + money(p.totals.due) + ' xizmat haqi yechiladi (naqd yetmasa — bor qismi). Davom etasizmi?')) return false;
    return B.run(B.api('POST', '/api/acx/quarter/' + k + '/close', {}), 'Chorak yopildi: xizmat haqi hisoblardan yechildi').then(function () { ST.qprev = null; ST.qs = null; B.rerender(); });
  };
  B.acts.qstart = function () {
    var v = ST.f.q_start; if (!v) return false;
    return B.run(B.api('POST', '/api/acx/feestart', { key: v }), 'Boshlanish choragi saqlandi').then(function () { ST.qs = null; B.rerender(); });
  };
  function quarterTab() {
    if (!ST.qs) { B.qLoad(); return '<section class="card"><p class="muted">Yuklanmoqda…</p></section>'; }
    var q = ST.qs; if (q.error) return '<section class="card"><p class="bad">' + esc(q.error) + '</p></section>';
    var anyClosed = q.quarters.some(function (x) { return x.closed; });
    var h = '<section class="card stack"><h2>Chorakni yopish</h2><p class="sub">Chorak tugagach shu yerda bitta tugma bilan yopasiz: sayt har mijoz hisobi uchun xizmat haqini (boshqaruv + muvaffaqiyat + saqlash) hisoblaydi, hisobdan yechadi va hisobda “Xizmat haqi” yozuvini yaratadi. Buxgalteriyadagi daromad va Rahbar ulushi aynan shu summadan hisoblanadi. Zarar bo‘lsa, keyingi foyda avval zararni qoplaydi.</p>';
    if (!q.quarters.length) h += '<p class="muted">Hozircha yopiladigan chorak yo‘q — joriy chorak tugagach shu yerda paydo bo‘ladi.</p>';
    else {
      h += '<div class="tw"><table style="min-width:640px"><thead><tr><th>Chorak</th><th>Holat</th><th class="n">Boshqaruv</th><th class="n">Muvaffaqiyat</th><th class="n">Saqlash</th><th class="n">Undirildi</th><th></th></tr></thead><tbody>';
      q.quarters.forEach(function (x) {
        var t = x.totals || {}, open = ST.qprev && ST.qprev.key === x.key;
        h += '<tr><td><b>' + esc(x.label) + '</b></td><td>' + (x.closed ? '<span class="pill p-g">Yopilgan</span>' : (x.key === q.next ? '<span class="pill p-y">Yopilishi kerak</span>' : '<span class="pill">Navbat kutmoqda</span>')) + '</td><td class="n">' + (x.closed ? money(t.mgmt) : '') + '</td><td class="n">' + (x.closed ? money(t.succ) : '') + '</td><td class="n">' + (x.closed ? money(t.custody) : '') + '</td><td class="n">' + (x.closed ? money(x.charged) : '') + '</td><td class="n">' + (x.closed || x.key === q.next ? '<button class="btn ghost small" data-act="qview" data-v="' + x.key + '">' + (open ? 'Yashirish' : (x.closed ? 'Ko‘rish' : 'Hisoblash')) + '</button>' : '') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    if (ST.qprev) {
      var p = ST.qprev;
      h += '<div class="stack" style="gap:8px"><b>' + esc(p.per.label) + (p.closed ? ' — yopilgan' : ' — hisoblash (hali yozilmagan)') + '</b><div class="tw"><table style="min-width:900px"><thead><tr><th>Mijoz</th><th class="n">Boshida</th><th class="n">Oxirida</th><th class="n">Foyda</th><th class="n">Boshqaruv</th><th class="n">Muvaffaqiyat</th><th class="n">Saqlash</th><th class="n">Zarar qoldig‘i</th><th class="n">' + (p.closed ? 'Undirildi' : 'Undiriladi') + '</th></tr></thead><tbody>';
      p.rows.forEach(function (r) {
        h += '<tr><td>' + esc(r.name) + '</td><td class="n">' + money(r.open) + '</td><td class="n">' + money(r.close) + '</td><td class="n ' + (r.gain >= 0 ? 'good' : 'bad') + '">' + money(r.gain) + '</td><td class="n">' + money(r.mgmt) + '</td><td class="n">' + money(r.succ) + (r.offset > 0 ? '<div class="muted mini">zarar qoplandi: ' + money(r.offset) + '</div>' : '') + '</td><td class="n">' + money(r.custody) + '</td><td class="n">' + (r.carryOut > 0 ? money(r.carryOut) : '—') + '</td><td class="n"><b>' + money(p.closed ? r.charged : r.due) + '</b>' + ((p.closed ? r.unpaidOut : (r.due > r.cash)) > 0 ? '<div class="bad mini">naqd yetmaydi' + (p.closed ? ': ' + money(r.unpaidOut) + ' keyingi choraka' : '') + '</div>' : '') + '</td></tr>';
      });
      var T = p.totals || {}; h += '<tr><td><b>Jami</b></td><td></td><td></td><td></td><td class="n"><b>' + money(T.mgmt) + '</b></td><td class="n"><b>' + money(T.succ) + '</b></td><td class="n"><b>' + money(T.custody) + '</b></td><td></td><td class="n"><b>' + money(p.closed ? p.charged : T.due) + '</b></td></tr></tbody></table></div>';
      if (!p.closed) h += '<div class="row"><button class="btn" data-act="qclose" data-v="' + p.key + '">Tasdiqlash va chorakni yopish</button><span class="muted mini">Yopilgach qayta hisoblanmaydi. Xato bo‘lsa, hisobdagi “Xizmat haqi” yozuvini sabab bilan bekor qilasiz.</span></div>';
      h += '</div>';
    }
    if (!anyClosed) {
      var cur = new Date(), opts = [], y = cur.getFullYear(), qn = Math.floor(cur.getMonth() / 3) + 1;
      for (var i = 1; i <= 8; i++) { qn--; if (qn < 1) { qn = 4; y--; } opts.push([y + '-Q' + qn, qn + '-chorak ' + y]); }
      h += '<details><summary class="muted">Qaysi choraklikdan boshlab hisoblansin? (hozir: ' + esc(q.start) + ')</summary><div class="row" style="margin-top:8px">' + sel('q_start', opts, ST.f.q_start || q.start) + '<button class="btn ghost small" data-act="qstart">Saqlash</button></div></details>';
    }
    return h + '</section>';
  }
  B.quarterTab = quarterTab;


  /* ================= BUGUNGI ISHLAR (Bosh sahifa tepasida) ================= */
  B.acts.todo = function (el) {
    var p = el.getAttribute('data-p'), t = el.getAttribute('data-t');
    if (p === 'hisobot') ST.hbTab = t; if (p === 'amal') ST.amTab = t; if (p === 'savdo') ST.trTab = t; ST.accId = null; ST.page = p; window.scrollTo(0, 0);
  };
  B.todoCard = function () {
    var d = D(), items = [];
    if (B.isAdmin()) {
      if (!ST.qs) B.qLoad(); else if (ST.qs.next) { var nq = ST.qs.quarters.filter(function (x) { return x.key === ST.qs.next; })[0]; items.push(['Chorakni yopish', (nq ? nq.label : ST.qs.next) + ': xizmat haqi va Rahbar ulushi hisoblanadi', 'Yopish', 'hisobot', 'chorak']); }
    }
    if (!ST.dep && !ST.depLoadStarted) { ST.depLoadStarted = true; B.depLoad(); }
    var dc = B.depSignalCount ? B.depSignalCount() : 0; if (dc && B.isAdmin()) items.push(['Omonat foizi', dc + ' ta signal tasdiqlashni kutmoqda', 'Orderlarga', 'savdo', 'ord']);
    var pd = (d.dep || []).filter(function (x) { return x.status === 'Tasdiqlash kutilmoqda'; }).length, pw = (d.wd || []).filter(function (w) { return w.status === 'Kutilmoqda'; }).length;
    if (pd) items.push(['Depozit so‘rovlari', pd + ' ta to‘lov tasdiqlashni kutmoqda', 'Ko‘rish', 'amal', 'req']);
    if (pw) items.push(['Yechish so‘rovlari', pw + ' ta so‘rov kutmoqda', 'Ko‘rish', 'amal', 'req']);
    var po = (d.orders || []).filter(function (o) { return o.status === 'Kutilmoqda'; }).length; if (po && B.isAdmin()) items.push(['Orderlar', po + ' ta order yuborilishini kutmoqda', 'Ko‘rish', 'savdo', 'ord']);
    var h = '<section class="card stack"><h2>Bugungi ishlar</h2>';
    if (!items.length) return h + '<p class="muted" style="margin:0">Hozircha bajariladigan ish yo‘q ✓</p></section>';
    return h + items.map(function (i) { return '<div class="row sb sigrow"><div><b>' + esc(i[0]) + '</b><div class="muted mini">' + esc(i[1]) + '</div></div><button class="btn small" data-act="todo" data-p="' + i[3] + '" data-t="' + i[4] + '">' + esc(i[2]) + '</button></div>'; }).join('') + '</section>';
  };

  B.amalDone = function () { W.open = false; W.kind = ''; W.plan = null; };
  B.pages.amal = pageAmal;
})(window.B);
