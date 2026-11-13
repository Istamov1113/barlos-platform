/* Sahifalar 2: aktivlar (import), avto savdo, hisobotlar, mablag'lar, profil, sozlamalar */
(function (B) {
  'use strict';
  var Core = B.Core, GROUPS = B.GROUPS, GKEYS = B.GKEYS, ST = B.ST, esc = B.esc, money = B.money, pct = B.pct, fdt = B.fdt, nf = B.nf, pill = B.pill, gcol = B.gcol, fld = B.fld, bind = B.bind, sel = B.sel, empty = B.empty;
  function D() { return B.D(); }
  function post(u, b, m) { return B.run(B.api('POST', u, b || {}), m); }

  /* ================= AKTIVLAR ================= */
  var SRC_INFO = {
    bitget: { n: 'Bitget', hint: 'Binance (zaxirada Bitget): kripto, metall (XAUT) va tokenlashgan xalqaro aksiyalar. Masalan: BTC, ETH, XAUT, NVDAON', ph: 'BTC' },
    cmc: { n: 'CoinMarketCap', hint: 'Kripto aktivlar. Masalan: BTC yoki Bitcoin. (.env da CMC_API_KEY bo‘lmasa CoinGecko ishlatiladi.)', ph: 'BTC' },
    finviz: { n: 'Finviz', hint: 'AQSh aksiyalari va ETF. Tiker kiriting. Masalan: AAPL, NVDA, QQQ', ph: 'AAPL' },
    web: { n: 'Veb-sahifa (selektor)', hint: 'Istalgan sahifadan narx (Google Sheets IMPORTXML kabi). Format: havola || CSS-selektor. Selektor: brauzerda narx ustida o‘ng tugma → Inspect → element ustida o‘ng tugma → Copy → Copy selector.', ph: 'https://uzse.uz/isu_infos/STK?isu_cd=UZ7058980010 || .price' },
    uzse: { n: 'uzse.uz', hint: 'Milliy aksiya va obligatsiyalar. ISIN kodi (UZ…), tiker yoki sahifa havolasi', ph: 'UZ7011340003 yoki UZNF' }
  };
  var AF = ['id', 'sym', 'name', 'group', 'curr', 'price', 'rate', 'target', 'venue', 'tv', 'stype', 'sref', 'quote'];
  function aclear() { AF.forEach(function (k) { delete ST.f['as_' + k]; }); ST.lookup = null; }
  B.acts.addasset = function () { ST.assetForm = !ST.assetForm; if (ST.assetForm) aclear(); };
  B.acts.quickcash = function (el) {
    var c = el.getAttribute('data-v');
    return B.run(B.api('POST', '/api/assets', c === 'UZS' ? { sym: 'UZS', name: 'O‘zbek so‘mi', group: 'naqd', curr: 'UZS', price: 1 } : { sym: 'USD', name: 'AQSh dollari', group: 'naqd', curr: 'USD', price: 1 }), 'Qo‘shildi');
  };
  B.acts.editasset = function (el) {
    var a = D().assets.filter(function (x) { return x.id === el.getAttribute('data-v'); })[0]; aclear(); ST.assetForm = true;
    var f = ST.f; f.as_id = a.id; f.as_sym = a.sym; f.as_name = a.name; f.as_group = a.group; f.as_curr = a.curr; f.as_price = a.price == null ? '' : a.price; f.as_rate = a.rate == null ? '' : a.rate; f.as_dpay = a.dpay || 'monthly'; f.as_dstart = a.dstart || ''; f.as_target = a.target || ''; f.as_venue = a.venue || '';
    f.as_stype = a.src ? a.src.type : ''; f.as_sref = a.src ? a.src.ref : ''; f.as_quote = a.quote || ''; f.as_csym = a.csym || ''; f.as_isin = a.isin || ''; f.as_issuer = a.issuer || ''; f.as_hurl = a.hurl || ''; f.as_close = a.close || ''; window.scrollTo(0, 0);
  };
  B.acts.archasset = function (el) { var id = el.getAttribute('data-v'), a = D().assets.filter(function (x) { return x.id === id; })[0]; return post('/api/assets', Object.assign({}, a, { archived: !a.archived }), a.archived ? 'Tiklandi' : 'Arxivlandi'); };
  B.acts.dolookup = function () {
    var type = ST.f.as_lsrc || 'bitget', q = (ST.f.as_lq || '').trim(); if (!q) { B.toast('Qidiruv so‘zini kiriting'); return false; }
    ST.lookup = { loading: true }; B.rerender();
    return B.api('GET', '/api/lookup?src=' + encodeURIComponent(type) + '&q=' + encodeURIComponent(q)).then(function (r) { ST.lookup = { results: r.results, type: type }; B.rerender(); }).catch(function (e) { ST.lookup = { error: e.message }; B.rerender(); });
  };
  B.acts.pickres = function (el) {
    var r = ST.lookup.results[+el.getAttribute('data-v')], f = ST.f, type = ST.lookup.type;
    f.as_sym = r.sym; f.as_name = r.name || r.sym; f.as_group = r.group; f.as_curr = r.curr; f.as_price = r.price == null ? '' : r.price; f.as_stype = type; f.as_sref = r.ref;
    delete f.as_id; B.toast('Ma’lumotlar forma ichiga yozildi. Normal ulushni kiriting va saqlang.');
  };
  B.forms.asset = function () {
    var f = ST.f, body = { id: f.as_id, sym: f.as_sym, name: f.as_name, group: f.as_group || 'kripto', curr: f.as_curr || 'USD', price: f.as_price, rate: f.as_rate, dpay: f.as_group === 'omonat' ? (f.as_dpay || 'monthly') : undefined, dstart: f.as_group === 'omonat' ? (f.as_dstart || '') : undefined, target: f.as_target, venue: f.as_venue, quote: f.as_quote || '', csym: f.as_csym || '', isin: f.as_isin || '', issuer: f.as_issuer || '', hurl: f.as_hurl || '', close: f.as_close || '', src: f.as_stype && f.as_sref ? { type: f.as_stype, ref: f.as_sref } : null };
    var old = f.as_id ? D().assets.filter(function (a) { return a.id === f.as_id; })[0] : null; if (old) body.archived = old.archived;
    return B.run(B.api('POST', '/api/assets', body), 'Aktiv saqlandi').then(function () { ST.assetForm = false; aclear(); B.rerender(); });
  };
  B.acts.refreshprices = function () { ST.pricing = true; B.rerender(); return B.api('POST', '/api/prices/refresh', {}).then(function (r) { ST.pricing = false; var bad = Object.keys(r.assets || {}).filter(function (k) { return typeof r.assets[k] === 'string'; }); B.toast(bad.length ? 'Yangilandi, lekin ' + bad.length + ' ta aktivda xato bor (jadvalga qarang)' : 'Narxlar yangilandi'); return B.reload().then(B.rerender); }).catch(function (e) { ST.pricing = false; B.toast(e.message); B.rerender(); }); };
  B.acts.srctest = function () { ST.srctest = { loading: true }; B.rerender(); return B.api('GET', '/api/sources/test').then(function (r) { ST.srctest = r; B.rerender(); }).catch(function (e) { ST.srctest = { error: e.message }; B.rerender(); }); };

  function assetForm() {
    var f = ST.f, groups = GKEYS.map(function (k) { return [k, GROUPS[k].name]; }), src = ST.f.as_lsrc || 'bitget', L = ST.lookup, h = '';
    h += '<section class="card stack"><h2>' + (f.as_id ? 'Aktivni tahrirlash' : 'Aktiv qo‘shish') + '</h2>';
    if (!f.as_id) {
      h += '<div class="stack" style="gap:8px"><b>Saytdan import qilish</b><div class="row">' + sel('as_lsrc', Object.keys(SRC_INFO).map(function (k) { return [k, SRC_INFO[k].n]; }), 'bitget') + '<input type="text" style="flex:1;min-width:180px" placeholder="' + SRC_INFO[src].ph + '"' + bind('as_lq') + '><button type="button" class="btn" data-act="dolookup"' + (L && L.loading ? ' disabled' : '') + '>Qidirish</button></div><p class="sub" style="margin:0">' + SRC_INFO[src].hint + '</p>';
      if (L && L.loading) h += '<p class="muted">Qidirilmoqda…</p>';
      if (L && L.error) h += '<div class="err">' + esc(L.error) + '</div>';
      if (L && L.results) { if (!L.results.length) h += '<p class="muted">Hech narsa topilmadi.</p>'; L.results.forEach(function (r, i) { h += '<div class="res"><div><b>' + esc(r.sym) + '</b> · ' + esc(r.name || '') + '<div class="muted mini">' + GROUPS[r.group].name + ' · ' + esc(r.ref) + '</div></div><div class="row"><b class="num">' + (r.price != null ? nf(r.price) + ' ' + r.curr : '—') + '</b><button type="button" class="btn small" data-act="pickres" data-v="' + i + '">Tanlash</button></div></div>'; }); }
      h += '</div><div class="sep"></div>';
    }
    h += '<form data-form="asset" class="stack"><div class="form-grid">' + fld('Belgi (ticker)', '<input type="text"' + bind('as_sym') + '>') + fld('Nomi', '<input type="text"' + bind('as_name') + '>') + fld('Guruh', sel('as_group', groups, 'kripto')) + fld('Valyuta', sel('as_curr', [['USD', 'USD'], ['UZS', 'So‘m (UZS)']], 'USD')) +
      fld('Narx (qo‘lda yoki importdan)', '<input type="number" step="any" min="0"' + bind('as_price') + '>') + fld('Normal ulush %', '<input type="number" step="0.01" min="0" max="100"' + bind('as_target') + '>') + fld('Yillik foiz (omonat/obligatsiya)', '<input type="number" step="any"' + bind('as_rate') + '>') + ((ST.f.as_group === 'omonat') ? fld('Omonat foizi to‘lov davriyligi', sel('as_dpay', [['monthly', 'Har oy bir marta (boshlanish kunining ertasi)'], ['none', 'To‘lov signali kerak emas']], 'monthly')) + fld('Omonat boshlanish sanasi', '<input type="date"' + bind('as_dstart') + '>') : '') + fld('Birja/joy (bo‘sh = avto)', '<input type="text" placeholder="Bitget, IBKR, Jet.uz, Bank"' + bind('as_venue') + '>') +
      fld('Emitent nomi (aktiv kartochkasida ko‘rinadi)', '<input type="text"' + bind('as_issuer') + '>') + fld('ISIN / kod', '<input type="text" placeholder="UZ7058980010"' + bind('as_isin') + '>') + fld('Hisob-kitob aktivi (savdo juftligi)', sel('as_quote', [['', 'Avto (USD aktiv Bitgetda USDT, boshqa joyda USD; so‘m aktiv so‘m)']].concat(D().assets.filter(function (a) { return a.group === 'naqd' && !a.archived; }).map(function (a) { return [a.id, a.sym]; })), '')) + fld('Narx manbasi', sel('as_stype', [['', 'Qo‘lda (avto yangilanmaydi)']].concat(Object.keys(SRC_INFO).map(function (k) { return [k, SRC_INFO[k].n]; })), '')) + fld('Tarix havolasi (uzse.uz va b., ixtiyoriy)', '<input type="text" placeholder="https://…{isin}…{from}…{to}"' + bind('as_hurl') + '>') + fld('Seans yopilishi (Toshkent, masalan 16:00 yoki 05:00 all)', '<input type="text" placeholder="avto"' + bind('as_close') + '>') + fld('Chart manbasi (ixtiyoriy)', '<input type="text" placeholder="bitget:BTCUSDT yoki yahoo:GC=F"' + bind('as_csym') + '>') + fld('Manba kodi / havolasi', '<input type="text" placeholder="BTCUSDT, AAPL, UZ…"' + bind('as_sref') + '>') + '</div>' +
      '<div class="row"><button class="btn" type="submit">Saqlash</button><button type="button" class="btn ghost" data-act="addasset">Bekor</button></div></form></section>';
    return h;
  }

  /* ----- tarixiy kunlik ma'lumotlar (uzse.uz Excel/CSV, havola orqali doimiy yangilash) ----- */
  function loadHist() { return B.api('GET', '/api/history/status').then(function (r) { ST.hist = r; if (ST.f.hs_tpl == null) ST.f.hs_tpl = r.uzseHist || ''; B.rerender(); }).catch(function () { }); }
  function ymd(t) { if (!t) return '—'; var d = new Date(t * 1000); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear(); }
  function histTools() {
    var H = ST.hist || { uzseHist: '' };
    return '<details class="stack" style="margin-top:14px"><summary class="btn ghost small" style="display:inline-block;cursor:pointer">Tarix sozlamalari (havola shabloni, ko‘p fayl)</summary><div class="stack" style="margin-top:10px">' +
      '<p class="sub">Tarix aktiv qo‘shilganda bir marta olinadi (kripto/metall: Binance, zaxirada Bitget; uzse.uz: quyidagi havola orqali). Keyin havola tarixi har 2 soatda faqat yangi kunlarni qo‘shadi, Binance narxi va oxirgi shamlari har 5 daqiqada yangilanadi; 429 bo‘lsa 1 soat kutiladi. Olinmasa, qatordagi “Excel yuklash” bilan o‘zingiz yuklaysiz: sanasi bir xil kunlar yangilanadi, yangilari qo‘shiladi, eskisi o‘chmaydi.</p>' +
      '<div class="form-grid">' + fld('Umumiy havola shabloni (uzse.uz aktivlari uchun)', '<input type="text" placeholder="https://uzse.uz/…isu_cd={isin}…&from={from}&to={to}"' + bind('hs_tpl') + '>') + '</div>' +
      '<p class="sub" style="margin:0">Havoladagi ISIN o‘rniga <code>{isin}</code>, sanalar o‘rniga <code>{from}</code> va <code>{to}</code> (kun.oy.yil) yozing. <code>STK</code> (aksiya) / <code>BND</code> (obligatsiya) qismini tizim aktiv turiga qarab o‘zi qo‘yadi (xohlasangiz <code>{type}</code> deb yozing).</p>' +
      '<div class="row"><button class="btn ghost small" data-act="histtpl">Havolani saqlash</button><button class="btn ghost small" data-act="histsync">Barcha aktivlar tarixini hozir olish</button><button class="btn ghost small" data-act="histresetall">Barcha tarixni tozalash</button></div>' +
      '<div class="row"><input type="file" id="histfiles" accept=".xlsx,.xls,.csv,.txt,.html" multiple><button class="btn small" data-act="histup">Ko‘p faylni yuklash (nomidagi ISIN bo‘yicha)</button></div></div></details>';
  }
  document.addEventListener('change', function (e) {
    var t = e.target, id = t && t.getAttribute && t.getAttribute('data-histone'); if (!id || !t.files || !t.files.length) return;
    var files = t.files, list = [], n = 0; B.toast('Yuklanmoqda…');
    Array.prototype.forEach.call(files, function (f) { var r = new FileReader(); r.onload = function () { var b = r.result; list.push({ name: f.name, data: b.slice(b.indexOf(',') + 1) }); if (++n === files.length) B.api('POST', '/api/history/import', { aid: id, strict: true, files: list }).then(function (res) { B.toast(res.files.map(function (x) { return x.error ? (x.name + ': ' + x.error) : (x.sym + ' +' + x.added + '/~' + x.changed); }).join(' | ')); ST.hist = null; ST.histReq = 0; B.rerender(); }).catch(function (er) { B.toast(er.message); }); }; r.readAsDataURL(f); });
  });
  B.acts.histone = function (el) { var id = el.getAttribute('data-v'); B.toast('Olinmoqda…'); return B.api('POST', '/api/history/sync', { aid: id }).then(function (r) { var x = r.result && Object.keys(r.result).map(function (k) { var q = r.result[k]; return k + ': ' + (q.error ? q.error : (q.skipped ? q.skipped : '+' + (q.added || 0) + '/~' + (q.changed || 0))); }).join(' | '); B.toast(x || 'Bu aktivda havola/API yo‘q: Excel yuklang'); ST.hist = null; ST.histReq = 0; B.rerender(); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.histup = function () {
    var inp = document.getElementById('histfiles'), files = inp && inp.files; if (!files || !files.length) { B.toast('Avval fayllarni tanlang.'); return false; }
    var list = [], n = 0; B.toast('Yuklanmoqda…');
    Array.prototype.forEach.call(files, function (f) { var r = new FileReader(); r.onload = function () { var b = r.result; list.push({ name: f.name, data: b.slice(b.indexOf(',') + 1) }); if (++n === files.length) B.api('POST', '/api/history/import', { files: list }).then(function (res) { B.toast(res.files.map(function (x) { return x.error ? (x.name + ': ' + x.error) : (x.sym + ' +' + x.added + '/~' + x.changed); }).join(' | ')); ST.hist = null; ST.histReq = 0; B.rerender(); }).catch(function (e) { B.toast(e.message); }); }; r.readAsDataURL(f); });
    return false;
  };
  B.acts.histreset = function (el) { var id = el.getAttribute('data-v'); var a = ST.hist && ST.hist.assets.filter(function (x) { return x.id === id; })[0]; if (!confirm((a ? a.sym : '') + ' aktivining yuklangan rasmiy kunlik tarixi tozalansinmi? (Avval avtomatik zaxira nusxa olinadi; keyin to‘g‘ri faylni qayta yuklaysiz.)')) return false; return B.api('POST', '/api/history/reset', { aid: id }).then(function (r) { B.toast('Tozalandi: ' + r.removed + ' ta sham'); ST.hist = null; ST.histReq = 0; B.rerender(); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.histresetall = function () { if (!confirm('BARCHA aktivlarning yuklangan rasmiy kunlik tarixi tozalansinmi? Avval avtomatik zaxira nusxa olinadi. Keyin fayllarni (nomida ISIN bilan) qayta yuklaysiz.')) return false; return B.api('POST', '/api/history/reset', { all: true }).then(function (r) { B.toast('Tozalandi: ' + r.removed + ' ta sham'); ST.hist = null; ST.histReq = 0; B.rerender(); }).catch(function (e) { B.toast(e.message); }); };
  B.acts.histtpl = function () { var v = ST.f.hs_tpl != null ? ST.f.hs_tpl : (ST.hist && ST.hist.uzseHist) || ''; return B.api('POST', '/api/settings', { uzseHist: v }).then(function () { B.toast('Saqlandi'); ST.hist = null; ST.histReq = 0; B.rerender(); }); };
  B.acts.histsync = function () { B.toast('Yangilanmoqda…'); return B.api('POST', '/api/history/sync', {}).then(function (r) { var k = Object.keys(r.result); B.toast(k.length ? k.map(function (s) { var x = r.result[s]; return s + ': ' + (x.error ? x.error : '+' + x.added + '/~' + x.changed); }).join(' | ') : 'Havola sozlangan aktiv yo‘q'); ST.hist = null; ST.histReq = 0; B.rerender(); }).catch(function (e) { B.toast(e.message); }); };
  var ICON_REF = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
  function shortTxt(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }


  function depLoad() {
    if (!B.isStaff()) return null;
    if (!ST.depBusy && (!ST.dep || Date.now() - (ST.depT || 0) > 60000)) {
      ST.depBusy = 1;
      B.api('GET', '/api/deposits').then(function (r) { var ch = JSON.stringify(((ST.dep || {}).due || []).map(function (d) { return d.key + d.done; })) !== JSON.stringify(r.due.map(function (d) { return d.key + d.done; })) || !ST.dep; ST.dep = r; ST.depT = Date.now(); ST.depBusy = 0; if (ch) B.rerender(); }).catch(function () { ST.depBusy = 0; ST.depT = Date.now(); if (!ST.dep) ST.dep = { items: [], due: [] }; });
    }
    return ST.dep || null;
  }
  /* Signal: omonat foizi to'lov kuni kelganda (yoki o'tib ketgan, yozilmagan bo'lsa) bosh sahifada ko'rinadi; tasdiqlansa tranzaksiya bo'lib yoziladi */
  B.depBanner = function () {
    return ''; var T = depLoad(); if (!T) return '';
    var due = T.due.filter(function (d) { return !d.done && d.days <= 3 && (d.days > 0 || d.amt > 0); }); if (!due.length) return '';
    return '<section class="card sig-banner stack" role="status"><h2>Omonat foizi to‘lovi</h2>' + due.map(function (d) {
      var now = d.days <= 0;
      return '<div class="row sb sigrow"><div><b>' + esc(d.sym) + '</b> · ' + esc(d.accName) + '<div class="muted mini">' + d.date + ' sanasi · ' + (now ? (d.days < 0 ? Math.abs(d.days) + ' kun oldin to‘langan bo‘lishi kerak edi' : 'bugun to‘lanadi') : d.days + ' kundan keyin') + ' · ' + d.upto + ' gacha hisoblangan foiz</div></div>' +
        '<div class="row"><b class="mono">' + nf(d.amt, 8) + ' so‘m</b>' + (now && d.amt > 0 ? '<button class="btn small" data-act="depaccept" data-v="' + esc(d.key) + '">Tasdiqlash</button>' : '<span class="st">kutilmoqda</span>') + '</div></div>';
    }).join('') + '<p class="sub">Tasdiqlasangiz foiz tranzaksiya sifatida yoziladi va omonat qoldig‘iga qo‘shiladi.</p></section>';
  };
  /* Omonat foizi: kunlik hisoblangan foiz va to'lov sanalari bo'yicha FOIZ yozuvlari */
  function depCard() {
    return ''; var T = depLoad(); if (!T || !T.items.length) return '';
    var PAY = { none: 'signal yo‘q', monthly: 'har oy bir marta' }, h = '<section class="card stack"><div><h2>Omonat foizi</h2><p class="sub">Foiz omonat kirgan kundan keyingi kundan boshlab har kuni qoldiqdan hisoblanadi (S × R / 365, 8 xonagacha aniqlikda). Yechilgan kun uchun foiz yo‘q. Har oy boshlanish kunining ertasi to‘lov signali keladi; tasdiqlasangiz foiz tranzaksiya bo‘lib, omonatga qo‘shiladi. Soliq hisoblanmaydi.</p></div>';
    h += '<div class="tw"><table><thead><tr><th>Omonat</th><th>Hisob</th><th class="n">Stavka</th><th>To‘lov</th><th class="n">Hisoblangan</th><th class="n">To‘langan</th><th class="n">To‘lanmagan</th><th class="n">Kunlar</th></tr></thead><tbody>';
    T.items.forEach(function (it) { it.accounts.forEach(function (a) { var x = D().assets.filter(function (z) { return z.id === it.aid; })[0] || { sym: it.sym, group: 'omonat', name: it.sym };
      h += '<tr><td>' + B.assetCell(x, 34) + '</td><td>' + esc(a.name) + '</td><td class="n">' + nf(it.rate, 2) + '%</td><td>' + PAY[it.dpay] + (it.dpay !== 'none' ? '<div class="muted mini">boshlanish ' + (it.dstart || 'birinchi kirim') + ' · ertasiga to‘lanadi, omonatga qo‘shiladi</div>' : '') + '</td><td class="n">' + nf(a.total, 8) + '</td><td class="n">' + nf(a.paid, 8) + '</td><td class="n"><b>' + nf(a.unpaid, 8) + '</b></td><td class="n">' + a.days + '</td></tr>'; }); });
    h += '</tbody></table></div>';
    var due = T.due.filter(function (d) { return !d.done || d.date >= T.today.slice(0, 8) + '00'; }).slice(-12).reverse();
    if (due.length) {
      h += '<div><h3 style="margin-bottom:8px">To‘lov sanalari</h3><div class="tw"><table><thead><tr><th>Sana</th><th>Omonat</th><th>Hisob</th><th class="n">Foiz summasi</th><th>Holat</th><th></th></tr></thead><tbody>';
      due.forEach(function (d) {
        var cls = d.done ? 'ok' : d.status === 'yozilmagan' ? 'bad' : d.status === 'bugun' ? 'warn' : '', lab = d.done ? 'Yozilgan' : d.status === 'yozilmagan' ? 'Yozilmagan' : d.status === 'bugun' ? 'Bugun' : d.days + ' kundan keyin';
        h += '<tr><td class="mono nowrap">' + d.date + '</td><td>' + esc(d.sym) + '</td><td>' + esc(d.accName) + '</td><td class="n">' + (d.amt > 0 ? nf(d.amt, 8) : '—') + '</td><td><span class="st ' + cls + '">' + lab + '</span></td><td class="n">' + (!d.done && d.days <= 0 && d.amt > 0 ? '<button class="btn small" data-act="depaccept" data-v="' + esc(d.key) + '">Foizni yozish</button>' : '') + '</td></tr>';
      });
      h += '</tbody></table></div></div>';
    }
    return h + '</section>';
  }
  B.acts.depaccept = function (el) { return B.run(B.api('POST', '/api/deposits/accept', { key: el.getAttribute('data-v') }), 'Foiz yozildi').then(function () { ST.dep = null; ST.depT = 0; return B.reload().then(B.rerender); }); };
  function pageAktiv() {
    var list = D().assets.slice().sort(function (a, b) { return (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || GKEYS.indexOf(a.group) - GKEYS.indexOf(b.group) || a.sym.localeCompare(b.sym); });
    if (!ST.hist && !ST.histReq) { ST.histReq = 1; loadHist(); }
    if (ST.srctest === undefined) { ST.srctest = null; B.api('GET', '/api/sources/test?cached=1').then(function (r) { if (r && r.results) { ST.srctest = r; B.rerender(); } }).catch(function () { }); }
    var hasCash = function (s) { return D().assets.some(function (a) { return a.group === 'naqd' && a.sym === s; }); };
    var h = '<div class="stack">';
    if (!hasCash('UZS') || !hasCash('USD')) h += '<div class="row">' + (hasCash('UZS') ? '' : '<button class="btn ghost" data-act="quickcash" data-v="UZS">+ Naqd so‘m (UZS)</button>') + (hasCash('USD') ? '' : '<button class="btn ghost" data-act="quickcash" data-v="USD">+ Naqd dollar (USD)</button>') + '</div>';
    /* 1) Narx manbalari holati: o'ng tepada yangilash belgisi */
    var T = ST.srctest;
    h += '<section class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Narx manbalari holati</h2><button class="btn ghost small" data-act="srctest" title="Manbalarni qayta tekshirish"' + (T && T.loading ? ' disabled' : '') + '>' + ICON_REF + '</button></div>';
    if (T && T.loading) h += '<p class="muted">Tekshirilmoqda…</p>';
    else if (T && T.error) h += '<div class="err">' + esc(T.error) + '</div>';
    else if (T && T.results) h += '<div class="stack" style="gap:6px;margin-top:8px">' + T.results.map(function (r) { return '<div class="res"><div><i class="dot ' + (r.ok ? 'dot-ok' : 'dot-bad') + '"></i> <b>' + esc(r.name) + '</b><div class="muted mini">' + esc(shortTxt(r.info, 160)) + '</div></div><span class="muted mini">' + r.ms + ' ms</span></div>'; }).join('') + '</div><p class="sub">Qizil bo‘lsa: server shu saytga chiqa olmayapti (tarmoq cheklovi) yoki sayt tuzilishi o‘zgargan.' + (T.t ? ' Oxirgi tekshiruv: ' + fdt(T.t) + '.' : '') + '</p>';
    else h += '<p class="muted">Hali tekshirilmagan. O‘ng tepadagi belgini bosing.</p>';
    h += '</section>';
    h += depCard();
    if (ST.assetForm) h += assetForm();
    /* 2) Aktivlar katalogi */
    h += '<section class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Aktivlar katalogi</h2><span class="row" style="gap:6px"><button class="btn small" data-act="addasset" title="Aktiv qo‘shish">+ Aktiv</button><button class="btn ghost small" data-act="refreshprices" title="Narxlarni yangilash"' + (ST.pricing ? ' disabled' : '') + '>' + (ST.pricing ? '…' : ICON_REF) + '</button></span></div><p class="sub">Aktivlar o‘chirilmaydi, faqat arxivlanadi.' + (D().settings.priceT ? ' Narxlar oxirgi marta: ' + fdt(D().settings.priceT) + '.' : '') + '</p>';
    if (!list.length) return h + empty('Aktivlar hali qo‘shilmagan', 'O‘ng tepadagi “+ Aktiv” tugmasi orqali qo‘lda yoki Bitget, CoinMarketCap, Finviz, uzse.uz dan import qilib qo‘shing. Avval naqd so‘m (UZS) aktivini qo‘shing: depozitlar shu orqali kiritiladi.') + '</section></div>';
    var HM = {}; ((ST.hist && ST.hist.assets) || []).forEach(function (x) { HM[x.id] = x; });
    h += '<div class="tw"><table><thead><tr><th>Aktiv</th><th>Guruh</th><th class="n">Narx</th><th>Manba</th><th class="n">Normal %</th><th class="n">Kunlar</th><th>Havola</th><th></th></tr></thead><tbody>';
    list.forEach(function (a) {
      var x = HM[a.id], tracked = a.group !== 'naqd' && !a.archived;
      var link = '';
      if (x) {
        var err = x.hsyncErr || x.bfErr, kind = (x.hurl ? 'havola' : '') + (x.hurl && x.prov ? ' + ' : '') + (x.prov ? 'API' : '');
        link = (kind ? '<span class="good">' + kind + '</span>' : '<span class="muted">fayl</span>') + (err ? '<div class="bad mini" title="' + esc(err) + '">' + esc(shortTxt(err, 44)) + '</div>' : (x.hsyncT || x.bfT ? '<div class="muted mini">' + B.ago(Math.max(x.hsyncT || 0, x.bfT || 0)) + '</div>' : '')) + (kind ? ' <button class="btn ghost small" data-act="histone" data-v="' + a.id + '" title="Tarixni hozir olish">' + ICON_REF + '</button>' : '');
      }
      h += '<tr' + (a.archived ? ' style="opacity:.5"' : '') + '><td><span class="alink" role="button" tabindex="0" data-act="assetopen" data-v="' + esc(a.id) + '" data-acc="all">' + B.assetCell(a, 34) + '</span></td><td>' + GROUPS[a.group].name + '</td><td class="n">' + (a.price == null ? '<span class="bad">yo‘q</span>' : B.pxStr(a, a.price)) + (a.priceT ? '<div class="muted mini">' + (a.priceFrom ? 'tarixdan · ' : '') + B.ago(a.priceT) + '</div>' : '') + (a.srcErr ? '<div class="bad mini" title="' + esc(a.srcErr) + '">' + esc(shortTxt(a.srcErr, 36)) + '</div>' : '') + '</td><td>' + (a.src ? esc(SRC_INFO[a.src.type] ? SRC_INFO[a.src.type].n : a.src.type) + '<div class="muted mini">' + esc(a.src.ref) + '</div>' : '<span class="muted">qo‘lda</span>') + '</td><td class="n">' + nf(a.target || 0, 2) + '</td><td class="n">' + (x && x.n ? x.n + '<div class="muted mini">' + ymd(x.first).slice(0, 6) + ymd(x.first).slice(8) + ' – ' + ymd(x.last).slice(0, 6) + ymd(x.last).slice(8) + '</div>' : '<span class="muted">0</span>') + '</td><td>' + link + '</td><td class="nowrap"><button class="btn ghost small" data-act="editasset" data-v="' + a.id + '">Tahrirlash</button> <button class="btn ghost small" data-act="archasset" data-v="' + a.id + '">' + (a.archived ? 'Tiklash' : 'Arxiv') + '</button>' +
        (tracked ? ' <label class="btn ghost small" title="Shu aktivning kunlik tarixini Excel/CSV dan yuklash" style="cursor:pointer">Excel yuklash<input type="file" hidden accept=".xlsx,.xls,.csv,.txt,.html" multiple data-histone="' + a.id + '"></label>' + (x && x.n ? ' <a class="btn ghost small" href="/api/history/export?aid=' + esc(a.id) + '">CSV</a> <button class="btn ghost small" data-act="histreset" data-v="' + esc(a.id) + '">Tozalash</button>' : '') : '') + '</td></tr>';
    });
    h += '</tbody></table></div>' + histTools() + '</section></div>';
    return h;
  }

  /* ================= AVTO SAVDO ================= */
  var SLAB = { 'Kutilmoqda': 'p-w', 'Bajarilgan': 'p-b', 'Rad etilgan': 'p-s', 'Bekor qilingan': 'p-h', 'Muddati o’tgan': 'p-h' };
  B.acts.trtab = function (el) { ST.trTab = el.getAttribute('data-v'); };
  B.acts.autorel = function (el) { return post('/api/settings', { autoRel: !D().settings.autoRel }); };
  B.forms.signal = function () { var f = ST.f; return post('/api/signals', { aid: f.sg_aid, side: f.sg_side || 'BUY', price: f.sg_price }, 'Signal qabul qilindi'); };
  B.acts.sendord = function (el) {
    var id = el.getAttribute('data-v'), o = D().orders.filter(function (x) { return x.id === id; })[0];
    var p = prompt('Bozorda haqiqiy bajarilgan narx (' + o.sym + '). O‘zgartirmasangiz order narxi ishlatiladi:', o.price); if (p === null) return false;
    return post('/api/orders/' + id + '/send', { price: +p }, 'Order bajarildi va mijozlar hisobiga taqsimlandi');
  };
  B.acts.cancelord = function (el) { if (!confirm('Order bekor qilinsinmi?')) return false; return post('/api/orders/' + el.getAttribute('data-v') + '/cancel', {}, 'Order bekor qilindi'); };
  function ordDetail(o, x) {
    var p = o.pr, h = '<tr class="det"><td colspan="9"><div class="stack" style="gap:8px"><div class="mini muted">Umumiy hajm: <b>' + B.qtyStr(x, p.tot) + '</b> · Order hajmi: <b>' + B.qtyStr(x, p.ord) + '</b> (qadam ' + p.step + ', minimal ' + p.min + ' USD) · Komissiya: <b>' + nf(p.feeTot) + ' ' + esc(p.feeAsset) + '</b></div><table style="min-width:640px"><thead><tr><th>Mijoz</th><th>Status</th><th class="n">N</th><th>Natija</th><th class="n">Hisoblangan</th><th class="n">Taqsimot</th><th class="n">Komissiya</th></tr></thead><tbody>';
    p.rows.forEach(function (r) { h += '<tr><td>' + esc(r.name) + '</td><td>' + pill(r.status) + '</td><td class="n">' + (r.n || '—') + '</td><td>' + (r.ok ? '<span class="pill p-b">Ruxsat</span>' : '<span class="pill p-s" title="' + esc(r.why) + '">Rad</span><div class="muted mini">' + esc(r.why) + '</div>') + '</td><td class="n">' + (r.ok ? B.qtyStr(x, r.qty) : '—') + '</td><td class="n">' + (r.alloc ? B.qtyStr(x, r.alloc) : '—') + '</td><td class="n">' + (r.fee ? nf(r.fee) : '—') + '</td></tr>'; });
    if (!p.rows.length) h += '<tr><td colspan="7" class="muted">Hisoblar yo‘q.</td></tr>';
    return h + '</tbody></table></div></td></tr>';
  }
  function pageSavdo() {
    if (!B.isAdmin()) return '<div class="stack">' + B.depSignals() + '</div>';
    var d = D(), st = d.settings, am = Core.assetMap(B.S()), tab = ST.trTab || 'ord';
    var h = '<div class="stack"><section class="card stack"><div class="row sb"><h2>Signal qabul qilish</h2><label class="switch"><input type="checkbox" ' + (st.autoRel ? 'checked ' : '') + 'data-act="autorel"> Avtomatik bozorga chiqarish</label></div>' +
      '<p class="sub">Signallar shu yerdagi qo‘lda yuborish va chartdagi alertlar (🔔, masalan BB AlgoAlpha BUY/SELL) orqali keladi. Har bir mijoz uchun miqdor alohida hisoblanadi, ruxsat berilganlar bitta orderga yig‘iladi.</p>';
    var tr = d.assets.filter(function (a) { return !a.archived && Core.tradable(a); });
    if (tr.length) h += '<form data-form="signal" class="row" style="align-items:end"><b>Qo‘lda signal:</b>' + sel('sg_aid', tr.map(function (a) { return [a.id, a.sym]; }), tr[0].id) + sel('sg_side', [['BUY', 'BUY'], ['SELL', 'SELL']], 'BUY') + '<input type="number" step="any" min="0" placeholder="Narx (bo‘sh = joriy)"' + bind('sg_price') + '><button class="btn small" type="submit">Yuborish</button></form>';
    h += '</section>';
    var act = d.orders.filter(function (o) { return o.status === 'Kutilmoqda'; }), done = d.orders.filter(function (o) { return o.status !== 'Kutilmoqda'; });
    h += '<div class="seg tabs" role="tablist">' + [['sig', 'Signallar (' + d.signals.length + ')'], ['ord', 'Orderlar (' + act.length + ')'], ['done', 'Yakunlangan (' + done.length + ')'], ['dep', 'Omonat foizi' + (B.depSignalCount() ? ' (' + B.depSignalCount() + ')' : '')]].map(function (t) { return '<button data-act="trtab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'dep') h += B.depSignals();
    else if (tab === 'sig') {
      h += '<section class="card"><div class="row sb"><h2>Signallar</h2><span class="lock">O‘chirish mumkin emas</span></div>';
      var sg = d.signals.slice().sort(function (a, b) { return b.t - a.t; });
      if (!sg.length) h += empty('Signallar yo‘q', 'Chartdagi alert ishlaganda yoki qo‘lda signal yuborilganda shu yerda paydo bo‘ladi.');
      else { h += '<div class="tw"><table><thead><tr><th>ID</th><th>Vaqt</th><th>Aktiv</th><th>Juftlik</th><th>Tomon</th><th class="n">Narx</th><th>Manba</th><th>Order</th></tr></thead><tbody>'; sg.slice(0, 200).forEach(function (s) { h += '<tr><td class="mono">' + s.id + '</td><td class="nowrap">' + fdt(s.t) + '</td><td><b>' + esc(s.sym) + '</b></td><td class="mono">' + esc(s.pair) + '</td><td><span class="pill ' + (s.side === 'BUY' ? 'p-b' : 'p-s') + '">' + s.side + '</span></td><td class="n">' + nf(s.price) + '</td><td>' + esc(s.src) + '</td><td class="mono">' + (s.ord || '—') + '</td></tr>'; }); h += '</tbody></table></div>'; }
      h += '</section>';
    } else {
      var list = tab === 'ord' ? act : done, title = tab === 'ord' ? 'Orderlar' : 'Yakunlangan orderlar';
      list = list.slice().sort(function (a, b) { return (b.fin || b.t) - (a.fin || a.t); });
      h += '<section class="card"><h2>' + title + '</h2>';
      if (!list.length) h += empty(tab === 'ord' ? 'Kutayotgan order yo‘q.' : 'Yakunlangan orderlar yo‘q.');
      else {
        h += '<div class="tw"><table style="min-width:900px"><thead><tr><th></th><th>Order / Signal</th><th>Vaqt</th><th>Aktiv</th><th>Tomon</th><th class="n">Narx</th><th class="n">Hajm</th><th>Holat</th><th class="act"></th></tr></thead><tbody>';
        list.slice(0, 150).forEach(function (o) {
          var x = am[o.aid]; if (!x) return; var open = !!ST.open['ord' + o.id];
          h += '<tr class="rowlink" data-act="tog" data-v="ord' + o.id + '"><td>' + B.CHEV.replace('class="chev"', 'class="chev" style="transform:rotate(' + (open ? 180 : 0) + 'deg)"') + '</td><td class="mono">' + o.id + '<div class="muted mini">' + o.sid + '</div></td><td class="nowrap">' + fdt(o.t) + '</td><td><div class="asset-cell">' + B.logo(x, 24) + '<b>' + esc(o.sym) + '</b></div></td><td><span class="pill ' + (o.side === 'BUY' ? 'p-b' : 'p-s') + '">' + o.side + '</span></td><td class="n">' + nf(o.price) + '</td><td class="n">' + B.qtyStr(x, o.pr.ord || o.pr.tot) + '</td><td><span class="pill ' + (SLAB[o.status] || 'p-h') + '">' + o.status + '</span>' + (o.by ? '<div class="muted mini">' + esc(o.by) + '</div>' : '') + '</td><td class="act">' +
            (tab === 'ord' ? '<button class="btn small" data-act="sendord" data-v="' + o.id + '">Bozorga yuborish</button> <button class="btn ghost small" data-act="cancelord" data-v="' + o.id + '">Bekor qilish</button>' : (o.blk ? '<span class="mono mini">' + o.blk + '</span>' : '')) + '</td></tr>';
          if (open) h += ordDetail(o, x);
        });
        h += '</tbody></table></div>';
      }
      h += '</section>';
    }
    return h + '</div>';
  }

  /* ================= HISOBOTLAR ================= */
  var REP = {
    acc: { n: 'Hisoblar (mijozlar)', cols: [['Mijoz', 's', 22], ['Email', 's', 26], ['Hisob turi', 's', 16], ['Kiritilgan (so‘m)', 'n', 18], ['Joriy qiymat (so‘m)', 'n', 18], ['Foyda (so‘m)', 'n', 16], ['Foyda %', 'p', 10], ['Koeffitsient', 'f', 12], ['Chorak foydasi (so‘m)', 'n', 18], ['Xizmat haqi (so‘m)', 'n', 16], ['Aktivlar soni', 'n', 12]], sum: [3, 4, 5, 8, 9] },
    tx: { n: 'Tranzaksiyalar', cols: [['ID', 's', 10], ['Sana', 'd', 18], ['Mijoz', 's', 22], ['Hisob', 's', 16], ['Aktiv', 's', 12], ['Guruh', 's', 18], ['Tur', 's', 11], ['Price', 'f', 14], ['Amount', 'f', 16], ['Total', 'f', 16], ['Valyuta', 's', 8], ['Total (so‘m)', 'n', 16], ['Fee', 'f', 12], ['Fee aktiv', 's', 10], ['Exchange', 's', 12], ['Kanal', 's', 12], ['Bajaruvchi', 's', 20], ['Holat', 's', 14], ['Bitim ID', 's', 10], ['Izoh', 's', 24]], sum: [11] },
    pos: { n: 'Portfel (aktivlar bo‘yicha)', cols: [['Mijoz', 's', 22], ['Hisob', 's', 16], ['Aktiv', 's', 12], ['Nomi', 's', 24], ['Guruh', 's', 18], ['Turi', 's', 10], ['Miqdor', 'f', 16], ['Narx', 'f', 14], ['Valyuta', 's', 8], ['O‘rt. olish narxi', 'f', 16], ['Qiymat (so‘m)', 'n', 18], ['Ulush %', 'p', 10], ['Maqsad %', 'p', 10], ['Status', 's', 12], ['Daromad %', 'p', 11]], sum: [10, 11] },
    log: { n: 'Harakatlar jurnali', cols: [['Vaqt', 'd', 18], ['IP manzil', 's', 16], ['Qurilma', 's', 18], ['Tizim / brauzer', 's', 22], ['Foydalanuvchi', 's', 22], ['Email', 's', 26], ['Rol', 's', 10], ['Harakat', 's', 32], ['Tafsilot', 's', 70]] },
    ast: { n: 'Aktivlar katalogi', cols: [['Aktiv', 's', 12], ['Nomi', 's', 26], ['Guruh', 's', 18], ['Valyuta', 's', 8], ['Narx', 'f', 14], ['Manba', 's', 16], ['Narx vaqti', 'd', 18], ['Normal %', 'p', 10], ['Mijozlardagi miqdor', 'f', 18], ['Mijozlardagi qiymat (so‘m)', 'n', 22], ['Holat', 's', 10]], sum: [9] }
  };
  function repRows(kind) {
    var S = B.S(), d = D(), am = Core.assetMap(S), accOf = {}, users = {}, out = [];
    d.accounts.forEach(function (a) { accOf[a.id] = a; }); (d.users || []).forEach(function (u) { users[u.id] = u; });
    if (kind === 'acc') d.accounts.forEach(function (a) { var s = B.summary(a); out.push({ m: { client: a.owner, kind: a.kind }, v: [a.owner, (users[a.uid] || {}).email || '', a.name + (a.archived ? ' (arxiv)' : ''), s.dep, s.T, s.pl, s.dep > 0 ? s.pl / s.dep * 100 : null, s.ratio, s.q.profit, s.q.fee, B.view(a).items.filter(function (i) { return i.val > 0; }).length] }); });
    else if (kind === 'tx') d.tx.forEach(function (t) { var x = am[t.aid], a = accOf[t.acc]; if (!x || !a) return; var tot = t.amount * (t.price || 0); out.push({ m: { client: a.owner, kind: a.kind, aid: x.id, group: x.group, type: t.type, status: t.status, t: t.t }, v: [t.id, t.t, a.owner, a.name, x.sym, GROUPS[x.group].name, t.type, t.price, t.amount, tot, x.curr, t.uzs != null && (t.type === 'DEPOZIT' || t.type === 'WITHDRAW') ? t.uzs : tot * Core.fxOf(S, x.curr), t.fee || null, t.feeAsset || '', t.ex, t.chan, t.by, t.status, t.blk, t.note || ''] }); });
    else if (kind === 'pos') d.accounts.forEach(function (a) { var V = B.view(a), an = Core.analyze(S, V); V.items.forEach(function (i) { if (!(Math.abs(i.qty) > 1e-12)) return; var x = i.x, r = an.assets[x.id]; out.push({ m: { client: a.owner, kind: a.kind, aid: x.id, group: x.group, status: r && r.status }, v: [a.owner, a.name, x.sym, x.name, GROUPS[x.group].name, GROUPS[x.group].type === 'foizli' ? 'Foizli' : 'Foizsiz', i.qty, x.price, x.curr, i.avg, i.val, V.T > 0 ? i.val / V.T * 100 : 0, r && r.d > 0 ? r.d : null, r && r.status ? Core.STATUS[r.status] : '', i.avg && x.price != null ? (x.price / i.avg - 1) * 100 : null] }); }); });
    else if (kind === 'log') (d.audit || []).forEach(function (l) { out.push({ m: { client: l.actor, t: l.t }, v: [l.t, l.ip, l.dev, l.os + ' · ' + l.br, l.actor, l.email, { admin: 'Admin', operator: 'Operator', client: 'Mijoz' }[l.role] || '', l.action, l.detail] }); });
    else if (kind === 'ast') d.assets.forEach(function (x) { var q = 0, v = 0; d.accounts.forEach(function (a) { B.view(a).items.forEach(function (i) { if (i.x.id === x.id) { q += i.qty; v += i.val; } }); }); out.push({ m: { aid: x.id, group: x.group, status: x.archived ? 'arxiv' : 'faol' }, v: [x.sym, x.name, GROUPS[x.group].name, x.curr, x.price, x.src ? x.src.type + ': ' + x.src.ref : 'qo‘lda', x.priceT, x.target || 0, q, v, x.archived ? 'arxiv' : 'faol'] }); });
    return out;
  }
  function repFiltered(kind) {
    var f = ST.f, rows = repRows(kind), q = (f.rp_q || '').toLowerCase(), from = f.rp_from ? new Date(f.rp_from).getTime() : null, to = f.rp_to ? new Date(f.rp_to).getTime() + 864e5 : null;
    rows = rows.filter(function (r) {
      var m = r.m;
      if (f.rp_client && f.rp_client !== 'all' && m.client !== f.rp_client) return false;
      if (kind !== 'log' && f.rp_kind && f.rp_kind !== 'all' && m.kind !== f.rp_kind) return false;
      if (kind !== 'log') {
        if (f.rp_aid && f.rp_aid !== 'all' && m.aid !== f.rp_aid) return false;
        if (f.rp_group && f.rp_group !== 'all' && m.group !== f.rp_group) return false;
        if (f.rp_type && f.rp_type !== 'all' && m.type && m.type !== f.rp_type) return false;
      }
      if (kind === 'log') { /* jurnalda faqat mijoz, sana va qidiruv */ } else if (f.rp_status && f.rp_status !== 'all' && m.status && kind === 'tx' && m.status !== f.rp_status) return false;
      if (from != null && m.t != null && m.t < from) return false; if (to != null && m.t != null && m.t >= to) return false;
      if (q && r.v.join(' ').toLowerCase().indexOf(q) < 0) return false; return true;
    });
    var s = ST.rsort || {}; if (s.kind === kind && s.col != null) { var c = s.col, dir = s.dir; rows.sort(function (a, b) { var x = a.v[c], y = b.v[c]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir; }); }
    return rows;
  }
  function curKind() { return ST.page === 'jurnal' ? 'log' : ((ST.rkind && ST.rkind !== 'log') ? ST.rkind : 'acc'); }
  B.acts.repkind = function (el) { ST.rkind = el.getAttribute('data-v'); ST.rsort = null; };
  B.acts.repsort = function (el) { var c = +el.getAttribute('data-v'), k = curKind(), s = ST.rsort; ST.rsort = { kind: k, col: c, dir: s && s.kind === k && s.col === c ? -s.dir : 1 }; };
  B.acts.represet = function () { Object.keys(ST.f).forEach(function (k) { if (k.indexOf('rp_') === 0) delete ST.f[k]; }); };
  B.acts.repxlsx = function () {
    var k = curKind(), def = REP[k], rows = repFiltered(k);
    var blob = window.Xlsx.build([{ name: def.n, cols: def.cols.map(function (c) { return { h: c[0], t: c[1], w: c[2] }; }), rows: rows.map(function (r) { return r.v; }) }]);
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); var dt = new Date(); a.download = 'barlos-' + k + '-' + dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0') + '.xlsx'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    B.toast(rows.length + ' qator yuklab olindi'); return false;
  };
  function cell(c, v) {
    if (v == null || v === '') return '—';
    if (c[1] === 'd') return fdt(v); if (c[1] === 'n') return nf(v, 0); if (c[1] === 'p') return nf(v, 2) + '%'; if (c[1] === 'f') return nf(v); return esc(v);
  }
  function pageHisobot() {
    var k = curKind(), def = REP[k], rows = repFiltered(k), d = D(), s = ST.rsort || {}, log = k === 'log';
    var clients = {}; if (log) (d.audit || []).forEach(function (l) { clients[l.actor] = 1; }); else d.accounts.forEach(function (a) { clients[a.owner] = 1; });
    var h = '<div class="stack">' + (log ? '<div class="notice" style="background:var(--accent-soft);color:var(--accent)">Jurnal o‘chirilmaydi va o‘zgartirilmaydi. Har bir yozuvda vaqt, IP manzil, qurilma, foydalanuvchi va harakat saqlanadi. Ekranda so‘nggi 5000 ta yozuv mavjud.</div>' : '<div class="seg tabs">' + ['acc', 'tx', 'pos', 'ast'].map(function (x) { return '<button data-act="repkind" data-v="' + x + '" aria-pressed="' + (k === x) + '">' + REP[x].n + '</button>'; }).join('') + '</div>');
    h += '<section class="card stack"><div class="filters"><div class="field"><label>Qidirish</label><input type="text" placeholder="Istalgan so‘z…"' + bind('rp_q', ' data-live="1"') + '></div>' +
      fld(log ? 'Foydalanuvchi' : 'Mijoz', sel('rp_client', [['all', 'Barchasi']].concat(Object.keys(clients).map(function (c) { return [c, c]; })), 'all')) +
      (log ? '' : fld('Hisob turi', sel('rp_kind', [['all', 'Barchasi'], ['uni', 'Universal'], ['isl', 'Islomiy']], 'all')) + fld('Aktiv', sel('rp_aid', [['all', 'Barchasi']].concat(d.assets.map(function (a) { return [a.id, a.sym]; })), 'all')) + fld('Guruh', sel('rp_group', [['all', 'Barchasi']].concat(GKEYS.map(function (g) { return [g, GROUPS[g].name]; })), 'all'))) +
      (k === 'tx' ? fld('Tur', sel('rp_type', [['all', 'Barchasi']].concat(Core.TYPES.map(function (t) { return [t, t]; })), 'all')) + fld('Holat', sel('rp_status', [['all', 'Barchasi'], ['Bajarildi', 'Bajarildi'], ['Bekor qilingan', 'Bekor qilingan']], 'all')) : '') +
      ((k === 'tx' || log) ? fld('Sanadan', '<input type="date"' + bind('rp_from') + '>') + fld('Sanagacha', '<input type="date"' + bind('rp_to') + '>') : '') + '</div>' +
      '<div class="row sb"><span class="muted">' + rows.length + ' ta qator topildi</span><div class="row"><button class="btn ghost small" data-act="represet">Filtrlarni tozalash</button><button class="btn" data-act="repxlsx"' + (rows.length ? '' : ' disabled') + '>Excel (.xlsx) yuklab olish</button></div></div>';
    if (!rows.length) return h + empty('Ma’lumot yo‘q', 'Filtrga mos yoki umuman yozuv topilmadi.') + '</section></div>';
    h += '<div class="tw"><table style="min-width:' + Math.max(640, def.cols.length * 110) + 'px"><thead><tr>' + def.cols.map(function (c, i) { return '<th class="sortable' + (c[1] === 's' ? '' : ' n') + '" data-act="repsort" data-v="' + i + '">' + c[0] + (s.kind === k && s.col === i ? (s.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.slice(0, 250).forEach(function (r) { h += '<tr>' + def.cols.map(function (c, i) { return '<td class="' + (c[1] === 's' ? '' : 'n') + '"' + (log && i === 8 ? ' style="white-space:normal;min-width:260px"' : '') + '>' + cell(c, r.v[i]) + '</td>'; }).join('') + '</tr>'; });
    if (def.sum) { h += '<tr>' + def.cols.map(function (c, i) { if (def.sum.indexOf(i) < 0) return '<td>' + (i === 0 ? '<b>Jami</b>' : '') + '</td>'; var t = 0; rows.forEach(function (r) { if (typeof r.v[i] === 'number' && isFinite(r.v[i])) t += r.v[i]; }); return '<td class="n"><b>' + cell(c, t) + '</b></td>'; }).join('') + '</tr>'; }
    return h + '</tbody></table></div>' + (rows.length > 250 ? '<p class="muted">Ekranda dastlabki 250 qator. Excel faylga hammasi (' + rows.length + ') yoziladi.</p>' : '') + '</section></div>';
  }

  /* ================= MABLAG'LAR ================= */
  var WMODE = { darhol: 'Darhol (naqd pul va omonatdan)', kutish: 'Kelgusida: aktivlar sotilishini kutaman', bozor: 'Kelgusida: bozor narxida sotilsin' };
  B.forms.wd = function () { var f = ST.f; return B.run(B.api('POST', '/api/wd', { acc: f.wd_acc || B.curAcc().id, amount: f.wd_amount, mode: f.wd_mode || 'darhol', note: f.wd_note }), 'So‘rov yuborildi').then(function () { delete ST.f.wd_amount; delete ST.f.wd_note; B.rerender(); }); };
  B.acts.wdok = function (el) { if (!confirm('So‘rov bajarildi deb belgilansinmi? Naqd so‘mdan yechish tranzaksiyasi yoziladi.')) return false; return post('/api/wd/' + el.getAttribute('data-v'), { status: 'Bajarildi' }, 'Bajarildi'); };
  B.acts.wdno = function (el) { return post('/api/wd/' + el.getAttribute('data-v'), { status: 'Rad etildi' }, 'Rad etildi'); };
  function wdTable(list, staff) {
    var accOf = {}; D().accounts.forEach(function (a) { accOf[a.id] = a; });
    if (!list.length) return empty('So‘rovlar yo‘q');
    var h = '<div class="tw"><table><thead><tr><th>ID</th>' + (staff ? '<th>Mijoz</th>' : '') + '<th>Sana</th><th class="n">Summa</th><th>Usul</th><th>Holat</th>' + (staff ? '<th></th>' : '') + '</tr></thead><tbody>';
    list.sort(function (a, b) { return b.t - a.t; }).forEach(function (w) { h += '<tr><td class="mono">' + w.id + '</td>' + (staff ? '<td>' + esc(accOf[w.acc] ? accOf[w.acc].owner : '') + '</td>' : '') + '<td class="nowrap">' + fdt(w.t) + '</td><td class="n">' + money(w.amount) + '</td><td>' + esc(WMODE[w.mode]) + (w.note ? '<div class="muted mini">' + esc(w.note) + '</div>' : '') + '</td><td><span class="pill ' + (w.status === 'Bajarildi' ? 'p-b' : w.status === 'Kutilmoqda' ? 'p-w' : 'p-s') + '">' + w.status + '</span></td>' + (staff ? '<td class="nowrap">' + (w.status === 'Kutilmoqda' ? '<button class="btn small" data-act="wdok" data-v="' + w.id + '">Bajarildi</button> <button class="btn ghost small" data-act="wdno" data-v="' + w.id + '">Rad</button>' : '') + '</td>' : '') + '</tr>'; });
    return h + '</tbody></table></div>';
  }
  /* ----- depozit: to'lov usullari, QR, so'rovlar ----- */
  function qrSvg(text) { try { var q = window.qrcode(0, 'M'); q.addData(String(text)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { return ''; } }
  var DST = { 'To‘lov kutilmoqda': 'p-w', 'Tasdiqlash kutilmoqda': 'p-w', 'Bajarildi': 'p-b', 'Rad etildi': 's', 'Bekor qilingan': 'p-h' };
  B.forms.depnew = function () { var f = ST.f, pay = D().settings.pay || []; return B.run(B.api('POST', '/api/dep', { acc: f.dp_acc || B.curAcc().id, amount: f.dp_amount, method: f.dp_method || (pay[0] && pay[0].id) }), 'So‘rov yaratildi. Endi to‘lovni amalga oshiring.').then(function () { delete f.dp_amount; B.rerender(); }); };
  B.acts.deppaid = function (el) { var r = prompt('To‘lov cheki raqami yoki izoh (ixtiyoriy):', ''); if (r === null) return false; return post('/api/dep/' + el.getAttribute('data-v') + '/paid', { ref: r }, 'Administratorga yuborildi: tasdiqlashni kuting'); };
  B.acts.depcancel = function (el) { if (!confirm('So‘rov bekor qilinsinmi?')) return false; return post('/api/dep/' + el.getAttribute('data-v') + '/cancel', {}, 'Bekor qilindi'); };
  B.acts.depok = function (el) { var id = el.getAttribute('data-v'), d = D().dep.filter(function (x) { return x.id === id; })[0], a = prompt('Hisobga tushgan haqiqiy summa (so‘m). So‘ralgan: ' + d.amount, d.amount); if (a === null) return false; return post('/api/dep/' + id, { status: 'Bajarildi', amount: +a }, 'Depozit hisobga qo‘shildi'); };
  B.acts.depno = function (el) { var r = prompt('Rad etish sababi:', ''); if (r === null) return false; return post('/api/dep/' + el.getAttribute('data-v'), { status: 'Rad etildi', reason: r }, 'Rad etildi'); };
  function depBox(d, pm) {
    var h = '<div class="card stack" style="border-color:var(--accent)"><div class="row sb"><h3>So‘rov ' + d.id + ': ' + money(d.amount) + '</h3><span class="pill p-w">' + d.status + '</span></div>';
    if (d.status === 'To‘lov kutilmoqda') {
      h += '<p class="sub" style="margin:0">Quyidagi rekvizitlarga <b>' + money(d.amount) + '</b> o‘tkazing. To‘lov izohiga <b class="mono">' + d.code + '</b> kodini yozing: shunda to‘lovni tezroq topamiz.</p>';
      if (pm) {
        h += '<div class="row" style="align-items:flex-start;gap:18px"><div class="stack" style="gap:6px;flex:1;min-width:220px"><div><small class="muted">Usul</small><div><b>' + esc(pm.name) + '</b></div></div>' + (pm.number ? '<div><small class="muted">Karta / hisob raqami</small><pre class="code" style="user-select:all">' + esc(pm.number) + '</pre></div>' : '') + (pm.holder ? '<div><small class="muted">Qabul qiluvchi</small><div><b>' + esc(pm.holder) + '</b></div></div>' : '') + (pm.note ? '<div class="muted">' + esc(pm.note) + '</div>' : '') + (pm.url ? '<a class="btn small" target="_blank" rel="noopener" href="' + esc(pm.url) + '">To‘lov sahifasiga o‘tish</a>' : '') + '</div>';
        var qr = qrSvg(pm.url || pm.number || pm.name); if (qr) h += '<div style="width:170px;flex:none"><div style="background:#fff;border-radius:10px;padding:6px;border:1px solid var(--line)">' + qr + '</div><small class="muted">QR kod' + (pm.url ? ' (to‘lov havolasi)' : ' (rekvizit)') + '</small></div>';
        h += '</div>';
      }
      h += '<div class="row"><button class="btn" data-act="deppaid" data-v="' + d.id + '">To‘lov qildim</button><button class="btn ghost" data-act="depcancel" data-v="' + d.id + '">Bekor qilish</button></div>';
    } else h += '<p class="sub" style="margin:0">To‘lovingiz administrator tomonidan tekshirilmoqda. Tasdiqlangach mablag‘ hisobingizda ko‘rinadi.' + (d.ref ? ' Izoh: ' + esc(d.ref) : '') + '</p><div class="row"><button class="btn ghost small" data-act="depcancel" data-v="' + d.id + '">So‘rovni bekor qilish</button></div>';
    return h + '</div>';
  }
  function depTable(list, staff) {
    var accOf = {}; D().accounts.forEach(function (a) { accOf[a.id] = a; });
    if (!list.length) return empty('So‘rovlar yo‘q');
    var h = '<div class="tw"><table style="min-width:760px"><thead><tr><th>ID</th>' + (staff ? '<th>Mijoz</th>' : '') + '<th>Sana</th><th class="n">Summa</th><th>Usul / kod</th><th>Izoh</th><th>Holat</th>' + (staff ? '<th></th>' : '') + '</tr></thead><tbody>';
    list.slice().sort(function (a, b) { return b.t - a.t; }).forEach(function (d) {
      h += '<tr><td class="mono">' + d.id + '</td>' + (staff ? '<td>' + esc(accOf[d.acc] ? accOf[d.acc].owner : '') + '</td>' : '') + '<td class="nowrap">' + fdt(d.t) + '</td><td class="n">' + money(d.amount) + (d.amountOk != null && d.amountOk !== d.amount ? '<div class="muted mini">tushgan: ' + money(d.amountOk) + '</div>' : '') + '</td><td>' + esc(d.methodName) + '<div class="mono mini muted">' + d.code + '</div></td><td>' + esc(d.ref || d.reason || '') + '</td><td><span class="pill ' + (DST[d.status] === 's' ? 'p-s' : DST[d.status] || 'p-h') + '">' + d.status + '</span></td>' +
        (staff ? '<td class="nowrap">' + ((B.isAdmin() && (d.status === 'To‘lov kutilmoqda' || d.status === 'Tasdiqlash kutilmoqda')) ? '<button class="btn small" data-act="depok" data-v="' + d.id + '">Tasdiqlash</button> <button class="btn ghost small" data-act="depno" data-v="' + d.id + '">Rad</button>' : '') + '</td>' : '') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ----- ichki o'tkazma ----- */
  function xfAssets() { return D().assets.filter(function (a) { return !a.archived; }); }
  function xfParams() {
    var f = ST.f, cash = Core.cashAsset(B.S()), usdt = xfAssets().filter(function (a) { return a.group === 'naqd' && a.sym === 'USDT'; })[0] || xfAssets().filter(function (a) { return a.group === 'naqd' && cash && a.id !== cash.id; })[0];
    var from = f.xf_from || (cash && cash.id), to = f.xf_to || (usdt && usdt.id);
    var accs = D().accounts.filter(function (a) { return !a.archived && (ST.xfSel ? ST.xfSel[a.id] : true); }).map(function (a) { return a.id; });
    return { from: from, to: to, unit: f.xf_unit || 'from', total: f.xf_total, rate: f.xf_rate || B.fx() || '', accs: accs, note: f.xf_note, feePct: f.xf_feePct || 0, feeFix: f.xf_feeFix || 0, feeMode: f.xf_feeMode || 'incl' };
  }
  B.acts.xfsel = function (el) { ST.xfSel = ST.xfSel || {}; var id = el.getAttribute('data-v'); var cur = ST.xfSel[id] !== undefined ? ST.xfSel[id] : true; ST.xfSel[id] = !cur; ST.xfPlan = null; };
  B.acts.xfall = function (el) { var v = el.getAttribute('data-v') === '1'; ST.xfSel = {}; D().accounts.forEach(function (a) { ST.xfSel[a.id] = v; }); ST.xfPlan = null; };
  B.onbind['xf_from'] = B.onbind['xf_to'] = B.onbind['xf_unit'] = B.onbind['xf_feeMode'] = function () { ST.xfPlan = null; B.rerender(); };
  B.acts.xfpreview = function () { var p = xfParams(); return B.api('POST', '/api/transfers/preview', p).then(function (r) { ST.xfPlan = { params: p, data: r }; B.rerender(); }).catch(function (e) { ST.xfPlan = null; B.toast(e.message); B.rerender(); }); };
  B.acts.xfrun = function () {
    if (!ST.xfPlan) return false; if (!confirm('O‘tkazma bajarilsinmi? ' + ST.xfPlan.data.rows.length + ' ta hisobga ta’sir qiladi.')) return false;
    var p = ST.xfPlan.params; return B.run(B.api('POST', '/api/transfers', p), 'O‘tkazma bajarildi').then(function () { ST.xfPlan = null; delete ST.f.xf_total; B.rerender(); });
  };
  function xferCard() {
    var as = xfAssets(), p = xfParams();
    if (as.length < 2) return '<section class="card"><h2>Ichki o‘tkazma</h2>' + empty('Aktivlar yetarli emas', 'Avval Aktivlar sahifasida naqd so‘m (UZS) va USDT aktivlarini qo‘shing.') + '</section>';
    var from = as.filter(function (a) { return a.id === p.from; })[0], to = as.filter(function (a) { return a.id === p.to; })[0], opts = as.map(function (a) { return [a.id, a.sym + ' — ' + a.name]; });
    var h = '<section class="card stack"><h2>Ichki o‘tkazma</h2><p class="sub">Masalan: <b>NAQD so‘m → Bitget USDT</b>. Tanlangan hisoblardan summa ulushlariga (ularda mavjud qoldiqqa) qarab proporsional ayriladi. Keyin shu USDT dan BTC va boshqa aktivlar sotib olinadi.</p><div class="form-grid">' +
      fld('Qaysi aktivdan', sel('xf_from', opts, p.from)) + fld('Qaysi aktivga', sel('xf_to', opts, p.to)) + fld('Summa qaysi aktivda berilgan', sel('xf_unit', [['from', from ? from.sym + ' (chiqariladigan)' : 'chiqariladigan'], ['to', to ? to.sym + ' (olinadigan)' : 'olinadigan']], p.unit)) +
      fld('Summa', '<input type="number" step="any" min="0"' + bind('xf_total') + '>') + fld('Dollar kursi (so‘m), bo‘sh = joriy ' + (B.fx() || ''), '<input type="number" step="any" min="0" placeholder="' + (B.fx() || '') + '"' + bind('xf_rate') + '>') + fld('Izoh', '<input type="text"' + bind('xf_note') + '>') +
      fld('Komissiya, % (o‘tkazma summasidan)', '<input type="number" step="any" min="0" max="99" placeholder="0"' + bind('xf_feePct') + '>') + fld('Qat’iy komissiya (jami, ' + (from ? esc(from.sym) : '') + ' da; ulushga qarab bo‘linadi)', '<input type="number" step="any" min="0" placeholder="0"' + bind('xf_feeFix') + '>') +
      fld('Komissiya qanday olinadi', sel('xf_feeMode', [['incl', 'Summa ichidan ushlanadi (olinadigan miqdor kamayadi)'], ['extra', 'Hisobdan qo‘shimcha yechiladi']], p.feeMode)) + '</div>';
    h += '<div class="stack" style="gap:6px"><div class="row sb"><b>Hisoblar</b><span><button class="btn ghost small" data-act="xfall" data-v="1">Hammasini belgilash</button> <button class="btn ghost small" data-act="xfall" data-v="0">Tozalash</button></span></div><div class="tw"><table style="min-width:420px"><tbody>';
    D().accounts.filter(function (a) { return !a.archived; }).forEach(function (a) {
      var it = from ? B.view(a).items.filter(function (i) { return i.x.id === from.id; })[0] : null, bal = it ? it.qty : 0, on = ST.xfSel ? ST.xfSel[a.id] !== undefined ? ST.xfSel[a.id] : true : true;
      h += '<tr class="rowlink" data-act="xfsel" data-v="' + a.id + '"><td style="width:34px"><input type="checkbox"' + (on ? ' checked' : '') + ' style="pointer-events:none" tabindex="-1"></td><td><b>' + esc(a.owner) + '</b> <span class="muted">· ' + esc(a.name) + '</span></td><td class="n">' + (from ? nf(bal, 2) + ' ' + esc(from.sym) : '—') + '</td></tr>';
    });
    h += '</tbody></table></div></div><div class="row"><button class="btn" data-act="xfpreview">Hisoblash (ko‘rish)</button></div>';
    if (ST.xfPlan) {
      var d = ST.xfPlan.data, pf = as.filter(function (a) { return a.id === ST.xfPlan.params.from; })[0], pt = as.filter(function (a) { return a.id === ST.xfPlan.params.to; })[0];
      h += '<div class="stack" style="gap:8px"><b>Natija (hali bajarilmagan)</b><div class="tw"><table style="min-width:560px"><thead><tr><th>Mijoz</th><th class="n">Mavjud</th><th class="n">Ulushi</th><th class="n">Ayriladi (' + esc(pf.sym) + ')</th><th class="n">Komissiya (' + esc(pf.sym) + ')</th><th class="n">Qo‘shiladi (' + esc(pt.sym) + ')</th></tr></thead><tbody>';
      var sf = 0, st = 0, sfee = 0; d.rows.forEach(function (r) { sf += r.from; st += r.to; sfee += r.fee || 0; h += '<tr><td>' + esc(r.owner) + '</td><td class="n">' + nf(r.bal, 2) + '</td><td class="n">' + pct(r.share * 100, 2) + '</td><td class="n">' + nf(r.from, 2) + '</td><td class="n">' + nf(r.fee || 0, 2) + '</td><td class="n">' + nf(r.to, 4) + '</td></tr>'; });
      h += '<tr><td><b>Jami</b></td><td class="n">' + nf(d.available, 2) + '</td><td></td><td class="n"><b>' + nf(sf, 2) + '</b></td><td class="n"><b>' + nf(sfee, 2) + '</b></td><td class="n"><b>' + nf(st, 4) + '</b></td></tr></tbody></table></div><div class="row"><button class="btn" data-act="xfrun">Tasdiqlash va bajarish</button></div></div>';
    }
    return h + '</section>';
  }

  function pageFunds() {
    var d = D(), staff = B.isStaff(), pay = d.settings.pay || [];
    if (!staff) {
      var acc = B.curAcc(); if (!acc) return ''; var V = B.view(acc), cash = V.items.filter(function (i) { return i.x.group === 'naqd' || i.x.group === 'omonat'; }).reduce(function (s, i) { return s + i.val; }, 0);
      var mine = d.wd.filter(function (w) { return w.acc === acc.id; }), deps = d.dep.filter(function (w) { return w.acc === acc.id; }), open = deps.filter(function (x) { return x.status === 'To‘lov kutilmoqda' || x.status === 'Tasdiqlash kutilmoqda'; });
      var h = '<div class="stack">' + accSwitchSafe() + '<section class="card stack"><h2>Depozit (hisobni to‘ldirish)</h2>';
      if (!pay.length) h += '<p class="muted">To‘lov usullari hali sozlanmagan. Administrator bilan bog‘laning.</p>';
      else h += '<form data-form="depnew" class="stack"><div class="form-grid">' + fld('Summa (so‘m)', '<input type="number" min="1000" step="any"' + bind('dp_amount') + '>') + fld('To‘lov usuli', sel('dp_method', pay.map(function (x) { return [x.id, x.name]; }), pay[0].id)) + '</div><div class="row"><button class="btn" type="submit">Depozit so‘rovi yaratish</button><span class="muted">Keyingi qadamda rekvizit va QR kod ko‘rsatiladi. To‘lovdan so‘ng administrator tasdiqlaydi.</span></div></form>';
      h += '</section>' + open.map(function (x) { return depBox(x, pay.filter(function (p) { return p.id === x.method; })[0]); }).join('');
      h += '<section class="card"><h2>Mening depozit so‘rovlarim</h2>' + depTable(deps, false) + '</section>';
      h += '<section class="card stack"><h2>Pul yechish</h2><div class="stats"><div class="stat"><small>Joriy balans</small><b>' + money(V.T) + '</b></div><div class="stat"><small>Darhol yechish mumkin (naqd + omonat)</small><b>' + money(cash) + '</b></div></div><form data-form="wd" class="stack"><div class="form-grid">' + fld('Summa (so‘m)', '<input type="number" min="0" step="any"' + bind('wd_amount') + '>') + fld('Usul', sel('wd_mode', Object.keys(WMODE).map(function (k) { return [k, WMODE[k]]; }), 'darhol')) + fld('Izoh', '<input type="text"' + bind('wd_note') + '>') + '</div><div class="row"><button class="btn" type="submit">Yechish so‘rovi yuborish</button><span class="muted">So‘rovni administrator ko‘rib chiqadi.</span></div></form></section><section class="card"><h2>Mening yechish so‘rovlarim</h2>' + wdTable(mine.slice(), false) + '</section></div>';
      return h;
    }
    var venues = {}; ['Bitget', 'IBKR', 'Jet.uz', 'Bank'].forEach(function (v) { venues[v] = { sum: 0, items: {} }; });
    d.accounts.forEach(function (a) { B.view(a).items.forEach(function (i) { if (!(i.val > 0)) return; var v = Core.venueOf(i.x), o = venues[v] || (venues[v] = { sum: 0, items: {} }); o.sum += i.val; o.items[i.x.sym] = (o.items[i.x.sym] || 0) + i.val; }); });
    var tot = Object.keys(venues).reduce(function (s, v) { return s + venues[v].sum; }, 0);
    var h = '<div class="stack">' + (B.isAdmin() ? xferCard() : '') + '<section class="card"><h2>Mijozlar mablag‘i joylashuvi</h2><div class="tw" style="margin-top:8px"><table style="min-width:420px"><thead><tr><th>Joy</th><th class="n">Summa</th><th class="n">Ulushi</th></tr></thead><tbody>';
    Object.keys(venues).forEach(function (v) { var o = venues[v]; h += '<tr class="rowlink" data-act="tog" data-v="fv' + v + '"><td><b>' + v + '</b></td><td class="n">' + money(o.sum) + '</td><td class="n">' + (tot > 0 ? pct(o.sum / tot * 100) : '—') + '</td></tr>'; if (ST.open['fv' + v]) Object.keys(o.items).forEach(function (s2) { h += '<tr class="det"><td>&nbsp;&nbsp;' + esc(s2) + '</td><td class="n">' + money(o.items[s2]) + '</td><td></td></tr>'; }); });
    h += '<tr><td><b>Jami</b></td><td class="n"><b>' + money(tot) + '</b></td><td></td></tr></tbody></table></div></section>';
    var pd = d.dep.filter(function (x) { return x.status === 'To‘lov kutilmoqda' || x.status === 'Tasdiqlash kutilmoqda'; }).length;
    h += '<section class="card"><h2>Depozit so‘rovlari (kutilmoqda: ' + pd + ')</h2>' + depTable(d.dep.slice(), true) + '</section>';
    h += '<section class="card"><h2>Yechish so‘rovlari (kutilmoqda: ' + d.wd.filter(function (w) { return w.status === 'Kutilmoqda'; }).length + ')</h2>' + wdTable(d.wd.slice(), true) + '</section></div>';
    return h;
  }
  function accSwitchSafe() { var l = D().accounts.filter(function (a) { return !a.archived; }); if (l.length < 2) return ''; return '<div class="seg" role="group">' + l.map(function (a) { return '<button data-act="pickacc" data-v="' + a.id + '" aria-pressed="' + (B.curAcc() && B.curAcc().id === a.id) + '">' + esc(a.name) + '</button>'; }).join('') + '</div>'; }

  /* ================= PROFIL ================= */
  B.forms.profile = function () { return post('/api/me', { name: ST.f.pf_name, phone: ST.f.pf_phone }, 'Saqlandi'); };
  B.forms.pass = function () { var f = ST.f; return B.run(B.api('POST', '/api/me/password', { old: f.pw_old, password: f.pw_new }), 'Parol o‘zgartirildi, boshqa seanslar tugatildi').then(function () { delete f.pw_old; delete f.pw_new; B.rerender(); }); };
  B.acts.endsess = function (el) { return post('/api/sessions/end', { id: el.getAttribute('data-v'), uid: el.getAttribute('data-u') || undefined }, 'Seans tugatildi'); };
  B.acts.endothers = function (el) { return post('/api/sessions/end', { others: true, uid: el.getAttribute('data-u') || undefined }, 'Boshqa seanslar tugatildi'); };
  B.acts.pftab = function (el) { ST.pfTab = el.getAttribute('data-v'); };
  B.acts.userrole = function (el) { return post('/api/users/' + el.getAttribute('data-v'), { role: el.getAttribute('data-r') }, 'Rol o‘zgartirildi'); };
  B.acts.userblock = function (el) { return post('/api/users/' + el.getAttribute('data-v'), { blocked: el.getAttribute('data-b') === '1' }, 'Bajarildi'); };
  B.acts.userpass = function (el) { var p = prompt('Foydalanuvchi uchun vaqtinchalik parol (kamida 8 belgi). Uning barcha seanslari tugatiladi:'); if (!p) return false; return post('/api/users/' + el.getAttribute('data-v'), { password: p }, 'Parol o‘rnatildi'); };
  B.acts.useracc = function (el) { return post('/api/accounts', { uid: el.getAttribute('data-v'), kind: el.getAttribute('data-k') }, 'Hisob ochildi'); };
  function sessList(list, uid) {
    return '<div class="stack" style="gap:6px">' + list.map(function (s) { return '<div class="res"><div><b>' + esc(s.dev) + '</b> · ' + esc(s.os) + ' · ' + esc(s.br) + '<div class="muted mini">IP ' + esc(s.ip || '') + ' · oxirgi faollik ' + B.ago(s.last) + '</div></div>' + (s.cur ? '<span class="pill p-b">Joriy seans</span>' : '<button class="btn ghost small" data-act="endsess" data-v="' + s.id + '"' + (uid ? ' data-u="' + uid + '"' : '') + '>Seansni tugatish</button>') + '</div>'; }).join('') + '</div>';
  }
  function pageProfil() {
    var d = D(), me = d.me, tabs = [['info', 'Shaxsiy ma’lumotlar'], ['sess', 'Faol seanslar']];
    if (!B.isStaff()) tabs.push(['targets', 'Maqsadli ulushlar'], ['bill', 'Xizmat haqi va yechish']);
    if (B.isAdmin()) tabs.push(['users', 'Foydalanuvchilar va qurilmalar']);
    var tab = ST.pfTab || 'info'; if (!tabs.some(function (t) { return t[0] === tab; })) tab = 'info';
    var h = '<div class="stack"><div class="card row">' + B.avatar(me, 56) + '<div><h2>' + esc(me.name || me.email) + '</h2><p class="sub" style="margin:0">' + (me.username ? '@' + esc(me.username) + ' · ' : '') + esc(me.id) + ' · ' + esc(me.email) + ' · ' + { admin: 'Admin', operator: 'Operator', client: 'Mijoz' }[me.role] + '</p></div></div>';
    h += '<div class="seg tabs" role="tablist">' + tabs.map(function (t) { return '<button data-act="pftab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'info') {
      h += B.profileInfo() +
        '<section class="card stack"><h2>Parolni o’zgartirish</h2><form data-form="pass" class="stack"><div class="form-grid">' + fld('Joriy parol', '<input type="password" autocomplete="current-password"' + bind('pw_old') + '>') + fld('Yangi parol (kamida 8 belgi)', '<input type="password" autocomplete="new-password"' + bind('pw_new') + '>') + '</div><div class="row"><button class="btn" type="submit">O‘zgartirish</button></div></form></section>';
    } else if (tab === 'sess') {
      h += '<section class="card stack"><div class="row sb"><h2>Faol seanslar</h2><button class="btn ghost small" data-act="endothers">Boshqa barcha seanslarni tugatish</button></div>' + sessList(me.sessions) + '</section>';
    } else if (tab === 'targets') {
      var acc = B.curAcc(); h += acc ? B.targetsView(acc, false) : '';
    } else if (tab === 'bill') {
      h += '<section class="card stack"><h2>Xizmat haqi</h2><p class="sub">Har chorak foydasining 10% xizmat haqi olinadi. Foyda manfiy bo‘lsa, xizmat haqi olinmaydi.</p>' + d.accounts.filter(function (a) { return !a.archived; }).map(function (a) { var s = B.summary(a); return '<div class="stats"><div class="stat"><small>' + esc(a.name) + ' · ' + s.q.label + ' foydasi</small><b>' + money(s.q.profit) + '</b></div><div class="stat"><small>Xizmat haqi (10%)</small><b>' + money(s.q.fee) + '</b></div></div>'; }).join('') + '</section>';
    } else if (tab === 'users') {
      h += '<section class="card"><h2>Foydalanuvchilar va qurilmalar</h2><p class="sub">Qatorni bosib qurilmalarni ko‘ring. Email tasdiqlash ' + (d.cfg && d.cfg.smtp ? 'yoqilgan.' : 'yoqilmagan (SMTP sozlanmagan): parol tiklashni siz vaqtinchalik parol bilan bajarasiz.') + '</p><div class="tw"><table style="min-width:760px"><thead><tr><th>Foydalanuvchi</th><th>Rol</th><th>Hisoblar</th><th>Oxirgi kirish</th><th>Qurilmalar</th><th>Holat</th></tr></thead><tbody>';
      d.users.forEach(function (u) {
        var open = !!ST.open['u' + u.id], accs = d.accounts.filter(function (a) { return a.uid === u.id; });
        h += '<tr class="rowlink" data-act="tog" data-v="u' + u.id + '"><td><b>' + esc(u.name || '—') + '</b><div class="muted mini">' + esc(u.email) + ' · ' + u.id + '</div></td><td>' + { admin: 'Admin', operator: 'Operator', client: 'Mijoz' }[u.role] + '</td><td>' + (accs.map(function (a) { return a.kind === 'isl' ? 'Islomiy' : 'Universal'; }).join(', ') || '—') + '</td><td>' + (u.last ? B.ago(u.last) : '—') + '</td><td>' + u.sessions.length + '</td><td>' + (u.blocked ? '<span class="pill p-s">Bloklangan</span>' : u.verified ? '<span class="pill p-b">Faol</span>' : '<span class="pill p-w">Tasdiqlanmagan</span>') + '</td></tr>';
        if (open) {
          h += '<tr class="det"><td colspan="6"><div class="stack">' + (u.sessions.length ? sessList(u.sessions.map(function (s) { return Object.assign({}, s, { cur: u.id === me.id && s.id === (me.sessions.filter(function (x) { return x.cur; })[0] || {}).id }); }), u.id) : '<span class="muted">Faol seans yo‘q.</span>');
          if (u.role !== 'admin') h += '<div class="row">' + (u.role === 'client' ? '<button class="btn ghost small" data-act="userrole" data-v="' + u.id + '" data-r="operator">Operator qilish</button>' : '<button class="btn ghost small" data-act="userrole" data-v="' + u.id + '" data-r="client">Mijoz qilish</button>') + '<button class="btn ghost small" data-act="userpass" data-v="' + u.id + '">Vaqtinchalik parol o‘rnatish</button><button class="btn ghost small" data-act="userblock" data-v="' + u.id + '" data-b="' + (u.blocked ? 0 : 1) + '">' + (u.blocked ? 'Blokdan chiqarish' : 'Bloklash') + '</button>' + (u.role === 'client' && !accs.some(function (a) { return a.kind === 'isl' && !a.archived; }) ? '<button class="btn ghost small" data-act="useracc" data-v="' + u.id + '" data-k="isl">Islomiy hisob ochish</button>' : '') + '</div>';
          h += '</div></td></tr>';
        }
      });
      h += '</tbody></table></div></section>';
    }
    return h + '</div>';
  }

  /* ================= SOZLAMALAR ================= */
  B.acts.setlang = function (el) { ST.lang = el.getAttribute('data-v'); B.savePrefs(); };
  B.acts.settheme = function (el) { ST.theme = el.getAttribute('data-v'); B.savePrefs(); B.applyTheme(); };
  B.acts.setcur = function (el) { ST.cur = el.getAttribute('data-v'); B.savePrefs(); };
  B.forms.sys = function () {
    var f = ST.f, s = D().settings, body = { fxAuto: f.sy_auto != null ? !!f.sy_auto : s.fxAuto, nBase: f.sy_nb != null ? f.sy_nb : s.nBase, nHold: f.sy_nh != null ? f.sy_nh : s.nHold, nSell: f.sy_ns != null ? f.sy_ns : s.nSell, priceMin: f.sy_pm != null ? f.sy_pm : s.priceMin, benchRate: f.sy_br != null ? f.sy_br : s.benchRate, benchPay: f.sy_bp != null ? f.sy_bp : s.benchPay };
    if (f.sy_usd) body.fx = { USD: f.sy_usd }; return B.run(B.api('POST', '/api/settings', body), 'Sozlamalar saqlandi').then(function () { delete f.sy_usd; B.rerender(); });
  };
  function opts(name, list, cur) { return '<div class="opts">' + list.map(function (o) { return '<button class="opt" data-act="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>'; }).join('') + '</div>'; }

  /* Asosiy aktivlar va 1W Stoch RSI sozlamalari */
  var STG = ['kripto', 'xalqaro', 'milliy', 'metall'];
  function stochCard() {
    var s = D().settings, P = s.stoch || { rsi: 14, len: 14, k: 7, d: 3 }, M = D().stoch || {}, f = ST.f;
    var h = '<section class="card stack"><h2>Asosiy aktivlar va 1W Stoch RSI (admin)</h2><p class="sub">Turning joriy maqsadi asosiy aktivning 1 haftalik Stoch RSI (K chiziq) qiymatidan olinadi. Qiymat serverda soatiga bir marta saqlangan haftalik tarixdan hisoblanadi.</p><form data-form="stoch" class="stack"><div class="form-grid">';
    STG.forEach(function (g) {
      var list = D().assets.filter(function (x) { return x.group === g && !x.archived; }), cur = f['st_' + g] != null ? f['st_' + g] : ((s.mainAsset || {})[g] || '');
      h += fld(Core.GROUPS[g].name + ': asosiy aktiv', list.length ? sel('st_' + g, [['', '— avtomatik —']].concat(list.map(function (x) { return [x.id, x.sym]; })), cur) : '<span class="muted">Bu turda aktiv yo‘q</span>');
    });
    h += fld('RSI davri', '<input type="number" min="2" data-bind="st_rsi" value="' + esc(f.st_rsi != null ? f.st_rsi : P.rsi) + '">') + fld('Stoch davri', '<input type="number" min="2" data-bind="st_len" value="' + esc(f.st_len != null ? f.st_len : P.len) + '">') + fld('K (silliqlash)', '<input type="number" min="1" data-bind="st_k" value="' + esc(f.st_k != null ? f.st_k : P.k) + '">') + fld('D (silliqlash)', '<input type="number" min="1" data-bind="st_d" value="' + esc(f.st_d != null ? f.st_d : P.d) + '">') + '</div>';
    h += '<div class="tw"><table style="min-width:520px"><thead><tr><th>Tur</th><th>Asosiy aktiv</th><th class="n">K (M)</th><th class="n">D</th><th class="n">Shamlar</th><th>Yangilangan</th></tr></thead><tbody>' + STG.map(function (g) {
      var r = M[g]; return '<tr><td>' + Core.GROUPS[g].name + '</td><td>' + esc(r ? r.sym || '—' : '—') + '</td><td class="n">' + (r && r.m != null ? nf(r.m, 2) : '<span class="bad">yo‘q</span>') + '</td><td class="n">' + (r && r.dl != null ? nf(r.dl, 2) : '—') + '</td><td class="n">' + (r && r.bars != null ? r.bars : '—') + '</td><td>' + (r ? fdt(r.t) : '—') + (r && r.err ? '<div class="bad mini">' + esc(r.err) + '</div>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div><div class="row"><button class="btn" type="submit">Saqlash</button><button class="btn ghost" type="button" data-act="stochrefresh">Hozir hisoblash</button></div></form></section>';
    return h;
  }
  B.forms.stoch = function () {
    var f = ST.f, s = D().settings, P = s.stoch || {}, ma = {};
    STG.forEach(function (g) { var v = f['st_' + g] != null ? f['st_' + g] : ((s.mainAsset || {})[g] || ''); if (v) ma[g] = v; });
    var body = { mainAsset: ma, stoch: { rsi: f.st_rsi != null ? f.st_rsi : P.rsi, len: f.st_len != null ? f.st_len : P.len, k: f.st_k != null ? f.st_k : P.k, d: f.st_d != null ? f.st_d : P.d } };
    return B.run(B.api('POST', '/api/settings', body), 'Saqlandi, Stoch RSI qayta hisoblanmoqda').then(function () { STG.forEach(function (g) { delete f['st_' + g]; }); setTimeout(function () { B.reload().then(B.rerender); }, 2500); });
  };
  B.acts.stochrefresh = function () { return B.run(B.api('POST', '/api/stoch/refresh', {}), 'Stoch RSI yangilandi').then(function () { return B.reload(); }).then(B.rerender); };

  /* Shartnoma bandlari muharriri (admin) */
  function contractCard() {
    var A = ST.ctrA;
    if (A === undefined) { ST.ctrA = null; B.api('GET', '/api/contract/admin').then(function (r) { ST.ctrA = r; B.rerender(); }).catch(function () { ST.ctrA = { sections: [], show: [], ver: 0, accepted: 0, history: 0 }; }); }
    if (!A) return '<section class="card stack"><h2>Shartnoma bandlari (admin)</h2><p class="sub">Yuklanmoqda…</p></section>';
    var f = ST.f, open = !!ST.ctrOpen, h = '<section class="card stack"><h2>Shartnoma bandlari (admin)</h2><p class="sub">Belgilangan bandlar mijozga ro‘yxatdan o‘tishda, avval ro‘yxatdan o‘tganlarga esa qayta kirishda ko‘rsatiladi. Mijoz roziligini bildirmaguncha ishlay olmaydi. Ko‘rsatiladigan bandlar o‘zgarsa versiya oshadi va hamma qayta tasdiqlaydi. Joriy versiya: <b>' + A.ver + '</b>, shu versiyani tasdiqlaganlar: <b>' + A.accepted + '</b>.</p>';
    var todo = 0; A.sections.forEach(function (sec) { sec.cl.forEach(function (x) { var sh = f['cs_' + x.id] != null ? f['cs_' + x.id] : A.show.indexOf(x.id) >= 0; if (x.id && sh && /\[/.test(f['ct_' + x.id] != null ? f['ct_' + x.id] : x.text)) todo++; }); });
    if (todo) h += '<div class="notice">Ko‘rsatiladigan ' + todo + ' ta bandda to‘ldirilmagan [ ] joy bor. Mijozga ko‘rsatishdan oldin to‘ldiring.</div>';
    h += '<div class="row"><button class="btn ghost" type="button" data-act="ctropen">' + (open ? 'Bandlarni yashirish' : 'Bandlarni tahrirlash') + '</button><button class="btn ghost" type="button" data-act="ctrlist">Tasdiqlash yozuvlari</button></div>';
    if (ST.ctrL) h += '<div class="tw"><table style="min-width:520px"><thead><tr><th>Mijoz</th><th class="n">Versiya</th><th>Vaqt</th><th>IP</th><th>Qayerda</th></tr></thead><tbody>' + (ST.ctrL.list.length ? ST.ctrL.list.map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td class="n">' + r.ver + '</td><td>' + fdt(r.t) + '</td><td>' + esc(r.ip || '') + '</td><td>' + (r.via === 'register' ? 'Ro‘yxatdan o‘tishda' : 'Kirishda') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">Hali tasdiqlash yo‘q.</td></tr>') + '</tbody></table></div>';
    if (open) {
      h += '<form data-form="contract" class="stack">';
      A.sections.forEach(function (sec) {
        var items = sec.cl.filter(function (x) { return x.id; }); if (!items.length) return;
        h += '<details class="add"><summary>' + esc(sec.n + '. ' + sec.title) + '</summary><div class="stack" style="margin-top:10px">' + items.map(function (x) {
          var sh = f['cs_' + x.id] != null ? f['cs_' + x.id] : A.show.indexOf(x.id) >= 0, tx = f['ct_' + x.id] != null ? f['ct_' + x.id] : x.text;
          return '<div class="ctl-row"><label class="switch"><input type="checkbox" data-bind="cs_' + x.id + '"' + (sh ? ' checked' : '') + '> <b>' + esc(x.id) + '</b> mijozga ko‘rsatilsin</label><textarea rows="3" data-bind="ct_' + x.id + '">' + esc(tx) + '</textarea></div>';
        }).join('') + '</div></details>';
      });
      h += '<div class="row"><button class="btn" type="submit">Saqlash</button></div></form>';
    }
    return h + '</section>';
  }
  B.acts.ctropen = function () { ST.ctrOpen = !ST.ctrOpen; };
  B.acts.ctrlist = function () { return B.api('GET', '/api/consents').then(function (r) { ST.ctrL = r; B.rerender(); }); };
  B.forms.contract = function () {
    var A = ST.ctrA, f = ST.f, texts = {}, show = [];
    A.sections.forEach(function (sec) { sec.cl.forEach(function (x) { if (!x.id) return; if (f['ct_' + x.id] != null) texts[x.id] = f['ct_' + x.id]; if (f['cs_' + x.id] != null ? f['cs_' + x.id] : A.show.indexOf(x.id) >= 0) show.push(x.id); }); });
    return B.run(B.api('POST', '/api/contract/admin', { texts: texts, show: show }), 'Shartnoma bandlari saqlandi').then(function () { Object.keys(f).forEach(function (k) { if (/^c[ts]_/.test(k)) delete f[k]; }); ST.ctrA = undefined; ST.ctrL = null; B.rerender(); });
  };

  /* ================= HUJJATLAR (PDF hisobotlar) ================= */
  var RKIND = { oylik: 'Oylik', chorak: 'Chorak', yillik: 'Yillik', napp: 'NAPP', soliq: 'Soliq' };
  function repLoad(force) {
    if (!ST.repBusy && (force || ST.reps === undefined)) { ST.repBusy = 1; B.api('GET', '/api/reports').then(function (r) { ST.reps = r; ST.repBusy = 0; B.rerender(); }).catch(function () { ST.repBusy = 0; if (ST.reps === undefined) ST.reps = { list: [] }; }); }
    return ST.reps || null;
  }
  function repTable(list, showWho) {
    var ty = ST.rType || 'all'; var chips = '<div class="row" role="group">' + [['all', 'Hammasi'], ['oylik', 'Oylik'], ['chorak', 'Chorak'], ['yillik', 'Yillik'], ['napp', 'NAPP'], ['soliq', 'Soliq']].filter(function (c) { return c[0] === 'all' || list.some(function (r) { return r.kind === c[0]; }); }).map(function (c) { return '<button class="chip" data-act="rtype" data-v="' + c[0] + '" aria-pressed="' + (ty === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>';
    if (ty !== 'all') list = list.filter(function (r) { return r.kind === ty; });
    if (!list.length) return '<p class="muted">Hali hujjat yo‘q. Hisobotlar davr tugagach avtomatik tayyorlanadi.</p>';
    return chips + '<div class="tw"><table style="min-width:560px"><thead><tr><th>Hujjat</th>' + (showWho ? '<th>Mijoz</th>' : '') + '<th>Tayyorlangan</th><th class="n">Hajmi</th><th></th></tr></thead><tbody>' + list.map(function (r) {
      return '<tr><td><b>' + esc(r.title) + '</b>' + (r.ver > 1 ? ' <span class="st">v' + r.ver + '</span>' : '') + '</td>' + (showWho ? '<td>' + esc(r.name || '') + '</td>' : '') + '<td>' + fdt(r.t) + '</td><td class="n">' + Math.max(1, Math.round(r.size / 1024)) + ' KB</td><td class="n"><a class="btn small ghost" href="/api/reports/' + r.id + '/pdf" target="_blank" rel="noopener">Ko‘rish</a> <a class="btn small" href="/api/reports/' + r.id + '/pdf?dl=1" download>Yuklab olish</a></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function pageHujjat() {
    var R = repLoad(), me = D().me, admin = B.isAdmin(), h = '<div class="stack">';
    if (!R) return h + '<section class="card"><p class="sub">Yuklanmoqda…</p></section></div>';
    var admDocs = R.list.filter(function (r) { return r.scope === 'admin'; }), cl = R.list.filter(function (r) { return r.scope === 'client'; });
    h += '<div class="notice" style="background:var(--accent-soft);color:var(--accent)">Hisobotlar avtomatik tayyorlanadi va PDF ko‘rinishida saqlanadi: oylik, har chorak va yillik. Eski hujjatlar o‘chirilmaydi.</div>';
    if (admin) {
      h += '<section class="card stack"><h2>Soliq va NAPP hujjatlari</h2><p class="sub">Har chorak tugagach avtomatik tayyorlanadi (NAPP: F1, F2, F8; soliq: F6 va mijoz daromadlari jamlanmasi). Faqat admin ko‘radi.</p>' + repTable(admDocs, false) + '</section>';
      var accs = D().accounts.filter(function (a) { return !a.archived; });
      h += '<section class="card stack"><h2>Hozir tayyorlash</h2><p class="sub">Istalgan davr uchun qo‘lda tayyorlash. Yangi versiya qo‘shiladi, eskisi saqlanadi. Davr: oylik 2026-10, chorak 2026-Q3, yillik 2026.</p><form data-form="repgen" class="stack"><div class="form-grid">' +
        fld('Hujjat turi', sel('rg_kind', [['chorak', 'Mijozga: chorak hisoboti'], ['oylik', 'Mijozga: oylik hisobot'], ['yillik', 'Mijozga: yillik hisobot va soliq ma’lumotnomasi'], ['napp', 'NAPPga hisobot (F1, F2, F8)'], ['soliq', 'Soliq organiga (F6, F7)']], 'chorak')) + fld('Davr', '<input type="text" placeholder="2026-Q3"' + bind('rg_ref') + '>') +
        fld('Hisob (mijozga tayyorlanganda)', sel('rg_acc', [['', 'Barcha hisoblar']].concat(accs.map(function (a) { return [a.id, a.owner + ' · ' + a.name]; })), '')) + '</div><div class="row"><button class="btn" type="submit">Tayyorlash</button></div></form></section>';
      h += '<section class="card stack"><h2>Mijozlarga tayyorlangan hisobotlar</h2>' + repTable(cl, true) + '</section>';
    } else {
      h += '<section class="card stack"><h2>Hisobotlarim</h2>' + repTable(cl, B.isStaff()) + '</section>';
      if (!B.isStaff()) h += '<section class="card stack"><h2>Shartnoma</h2><p class="sub">Ishonchli boshqarish shartnomasi bandlari ' + (me.consent && me.consent.t ? fdt(me.consent.t) + ' da tasdiqlangan (versiya ' + me.consent.ver + ').' : 'tasdiqlangan.') + '</p>' + contractBlock() + '</section>';
    }
    return h + '</div>';
  }
  function contractBlock() {
    if (ST.ctrP === undefined) { ST.ctrP = null; B.api('GET', '/api/contract').then(function (c) { ST.ctrP = c; B.rerender(); }).catch(function () { ST.ctrP = false; }); }
    if (!ST.ctrP) return '<p class="muted">Yuklanmoqda…</p>';
    return '<details class="ctr-full"><summary>Tasdiqlangan bandlarni ko‘rish</summary><div class="ctr" style="margin-top:8px">' + ST.ctrP.items.map(function (x) { return '<p><b>' + esc(x.id) + '-band.</b> ' + esc(x.text) + '<small>' + esc(x.sec) + '</small></p>'; }).join('') + '</div></details>';
  }
  B.forms.repgen = function () {
    var f = ST.f, kind = f.rg_kind || 'chorak', ref = String(f.rg_ref || '').trim();
    if (!ref) { var t = new Date(Date.now() + 5 * 3600e3), y = t.getUTCFullYear(), m = t.getUTCMonth() + 1; ref = kind === 'oylik' ? (m === 1 ? (y - 1) + '-12' : y + '-' + (m < 11 ? '0' : '') + (m - 1)) : kind === 'yillik' ? String(y - 1) : (Math.ceil(m / 3) === 1 ? (y - 1) + '-Q4' : y + '-Q' + (Math.ceil(m / 3) - 1)); }
    return B.run(B.api('POST', '/api/reports/generate', { kind: kind, ref: ref, acc: f.rg_acc || undefined }), 'Hisobot tayyorlandi').then(function () { delete f.rg_ref; return repLoad(true); });
  };

  /* Hisobot sozlamalari (admin): kompaniya, o'z mablag'lari, stavkalar, F8 qo'lda belgilar */
  var F8L = ['O‘z mablag‘lari ≥ minimal ulush (F2)', 'Baholash va usul hujjatlashtirildi', 'Aktivlar alohida hisobda', 'NAPPga muddatida topshirildi', 'Buxgalteriya balansi ilova qilindi', 'Mijozga davriy hisobot yuborildi', '10% pasayishda mijoz xabardor qilindi', 'Konsentratsiya va cheklovlar', 'Manfaatlar to‘qnashuvi ko‘rib chiqildi', 'Ustav kapital/rahbariyat o‘zgarishi kelishildi', 'Shartnoma kesimida soliq hisobi', 'Shikoyatlar reyestri', 'AML/CFT ichki nazorat', 'Yillik auditor xulosasi'];
  function repCard() {
    var R = repLoad(); if (!R || !R.conf) return '<section class="card stack"><h2>Hisobot sozlamalari (admin)</h2><p class="sub">Yuklanmoqda…</p></section>';
    var c = R.conf, f = ST.f, v = function (k, d) { return f[k] != null ? f[k] : d; }, inp = function (k, lbl, d, t) { return fld(lbl, '<input type="' + (t || 'text') + '"' + (t === 'number' ? ' step="any" min="0"' : '') + ' data-bind="' + k + '" value="' + esc(v(k, d)) + '">'); };
    var h = '<section class="card stack"><h2>Hisobot sozlamalari (admin)</h2><p class="sub">Avtomatik PDF hisobotlar shu ma’lumotlardan foydalanadi. Stavkalar namuna: shartnoma 3-ilovasiga va Soliq kodeksiga qarab to‘ldiring.</p><form data-form="repconf" class="stack"><h3>Kompaniya</h3><div class="form-grid">' +
      inp('rc_name', 'Nomi', c.co.name) + inp('rc_stir', 'STIR', c.co.stir) + inp('rc_license', 'Litsenziya', c.co.license) + inp('rc_head', 'Rahbar F.I.Sh.', c.co.head) + inp('rc_acct', 'Bosh buxgalter F.I.Sh.', c.co.accountant) + '</div><h3>O‘z mablag‘lari (F2), so‘m</h3><div class="form-grid">' +
      inp('rc_o_charter', 'Ustav kapitali', c.own.charter, 'number') + inp('rc_o_added', 'Qo‘shilgan kapital', c.own.added, 'number') + inp('rc_o_reserve', 'Zaxira kapital', c.own.reserve, 'number') + inp('rc_o_retained', 'Taqsimlanmagan foyda', c.own.retained, 'number') + inp('rc_o_target', 'Maqsadli tushumlar', c.own.target, 'number') + inp('rc_o_prov', 'Xarajatlar zaxiralari', c.own.provisions, 'number') + inp('rc_o_intang', 'Nomoddiy aktivlar (chegiriladi)', c.own.intangible, 'number') + '</div><h3>Stavkalar</h3><div class="form-grid">' +
      inp('rc_r_mgmt', 'Boshqaruv haqi, yillik %', c.rate.mgmt, 'number') + inp('rc_r_succ', 'Muvaffaqiyat haqi, %', c.rate.success, 'number') + inp('rc_r_hurdle', 'Hurdle, yillik %', c.rate.hurdle, 'number') + inp('rc_r_cust', 'Saqlash/depozitariy, yillik %', c.rate.custody, 'number') + inp('rc_r_ptax', 'Foyda solig‘i, %', c.rate.profitTax, 'number') + inp('rc_r_dtax', 'Dividend solig‘i, %', c.rate.divTax, 'number') + inp('rc_r_vat', 'QQS, %', c.rate.vat, 'number') + inp('rc_r_min', 'O‘z mablag‘lari minimal ulushi, %', c.rate.minOwn, 'number') + inp('rc_r_lim', 'Bitta pozitsiya limiti, %', c.rate.limit, 'number') + fld('Yildagi kunlar', sel('rc_r_days', [['365', '365'], ['360', '360']], String(c.rate.days))) + '</div><h3>Soliq (F6)</h3><div class="form-grid">' +
      fld('QQS to‘lovchimi?', sel('rc_t_vp', [['Tekshiring', 'Tekshiring'], ['Ha', 'Ha'], ['Yo‘q', 'Yo‘q']], c.tax.vatPayer)) + fld('Boshqaruv haqi QQSdan ozodmi?', sel('rc_t_ve', [['Tekshiring', 'Tekshiring'], ['Ha', 'Ha'], ['Yo‘q', 'Yo‘q']], c.tax.vatExempt)) + inp('rc_t_dir', 'Qo‘shimcha to‘g‘ridan-to‘g‘ri xarajat, so‘m', c.tax.direct, 'number') + inp('rc_t_gen', 'Umumiy xarajat, so‘m', c.tax.general, 'number') + '</div><h3>Muvofiqlik ro‘yxati (F8): qo‘lda belgilanadiganlar</h3><div class="form-grid">';
    [4, 5, 9, 10, 12, 13, 14].forEach(function (n) { var m = c.f8[n] || {}; h += fld(n + '. ' + F8L[n - 1], sel('rc_f8_' + n, [['', 'To‘ldirilmagan'], ['Ha', 'Ha'], ['Yo‘q', 'Yo‘q'], ['Qisman', 'Qisman'], ['N/A', 'N/A']], m.status || '')); });
    return h + '</div><div class="row"><button class="btn" type="submit">Saqlash</button></div></form></section>';
  }
  B.forms.repconf = function () {
    var R = ST.reps, c = R.conf, f = ST.f, v = function (k, d) { return f[k] != null ? f[k] : d; }, f8 = {};
    [4, 5, 9, 10, 12, 13, 14].forEach(function (n) { var st = v('rc_f8_' + n, (c.f8[n] || {}).status || ''); if (st) f8[n] = { status: st }; });
    var rep = { co: { name: v('rc_name', c.co.name), stir: v('rc_stir', c.co.stir), license: v('rc_license', c.co.license), head: v('rc_head', c.co.head), accountant: v('rc_acct', c.co.accountant) },
      own: { charter: v('rc_o_charter', c.own.charter), added: v('rc_o_added', c.own.added), reserve: v('rc_o_reserve', c.own.reserve), retained: v('rc_o_retained', c.own.retained), target: v('rc_o_target', c.own.target), provisions: v('rc_o_prov', c.own.provisions), intangible: v('rc_o_intang', c.own.intangible) },
      rate: { mgmt: v('rc_r_mgmt', c.rate.mgmt), success: v('rc_r_succ', c.rate.success), hurdle: v('rc_r_hurdle', c.rate.hurdle), custody: v('rc_r_cust', c.rate.custody), profitTax: v('rc_r_ptax', c.rate.profitTax), divTax: v('rc_r_dtax', c.rate.divTax), vat: v('rc_r_vat', c.rate.vat), minOwn: v('rc_r_min', c.rate.minOwn), limit: v('rc_r_lim', c.rate.limit), days: v('rc_r_days', c.rate.days) },
      tax: { vatPayer: v('rc_t_vp', c.tax.vatPayer), vatExempt: v('rc_t_ve', c.tax.vatExempt), direct: v('rc_t_dir', c.tax.direct), general: v('rc_t_gen', c.tax.general) }, f8: f8 };
    return B.run(B.api('POST', '/api/settings', { rep: rep }), 'Hisobot sozlamalari saqlandi').then(function () { Object.keys(f).forEach(function (k) { if (/^rc_/.test(k)) delete f[k]; }); return repLoad(true); });
  };
  function pageSozlama() {
    var s = D().settings, h = '<div class="stack"><section class="card stack"><h2>Til</h2><p class="sub">Interfeys tilini tanlang.</p>' + opts('setlang', [['uz', 'O’zbekcha', 'Lotin yozuvi'], ['ru', 'Русский', 'Русский язык'], ['en', 'English', 'English']], ST.lang) + '</section>' +
      '<section class="card stack"><h2>Tizim ko’rinishi</h2><p class="sub">BARLOS asosiy ko’rinishi qora va tillarang. Xohlasangiz yorug’ ko’rinishni tanlashingiz mumkin.</p>' + opts('settheme', [['system', 'Standart', 'Qora va tillarang (asosiy ko’rinish)'], ['light', 'Yorug’', 'Iliq oq fon, tillarang urg’u'], ['dark', 'Qorong’u', 'Qora fon, tillarang urg’u']], ST.theme) + '</section>' +
      '<section class="card stack"><h2>Valyuta</h2><p class="sub">Summalar qaysi valyutada ko’rsatilsin.</p>' + opts('setcur', [['UZS', 'So’m', 'O’zbek so’mi'], ['USD', 'USD', 'AQSh dollari']], ST.cur) + '<p class="muted">Tanlovlar shu brauzerda saqlanadi.</p></section>';
    if (B.isAdmin()) {
      h += '<section class="card stack"><h2>Tizim sozlamalari (admin)</h2><form data-form="sys" class="stack"><div class="form-grid">' + fld('Dollar kursi (so‘m)' + (s.fxT ? ' — yangilangan ' + fdt(s.fxT) : ''), '<input type="number" step="any" min="0" placeholder="' + (s.fx.USD || '') + '"' + bind('sy_usd') + '>') +
        fld('Narxlarni avto yangilash (daqiqa)', '<input type="number" min="1" max="1440" data-bind="sy_pm" value="' + esc(ST.f.sy_pm != null ? ST.f.sy_pm : s.priceMin) + '">') + fld('Taqqoslash stavkasi, yillik % (portfel koeffitsienti)', '<input type="number" step="any" min="0" data-bind="sy_br" value="' + esc(ST.f.sy_br != null ? ST.f.sy_br : s.benchRate) + '">') + fld('Taqqoslash foizi qo‘shilishi', sel('sy_bp', [['none', 'Qo‘shilmaydi (oddiy foiz)'], ['monthly', 'Har oy qo‘shiladi'], ['quarterly', 'Har chorak qo‘shiladi'], ['yearly', 'Har yil qo‘shiladi']], s.benchPay || 'none')) + fld('N: odatiy', '<input type="number" min="1" data-bind="sy_nb" value="' + esc(ST.f.sy_nb != null ? ST.f.sy_nb : s.nBase) + '">') + fld('N: HOLD holatida', '<input type="number" min="1" data-bind="sy_nh" value="' + esc(ST.f.sy_nh != null ? ST.f.sy_nh : s.nHold) + '">') + fld('N: qarama-qarshi holatda', '<input type="number" min="1" data-bind="sy_ns" value="' + esc(ST.f.sy_ns != null ? ST.f.sy_ns : s.nSell) + '">') + '</div>' +
        '<label class="switch"><input type="checkbox" data-bind="sy_auto"' + ((ST.f.sy_auto != null ? ST.f.sy_auto : s.fxAuto) ? ' checked' : '') + '> Dollar kursini CBU (Markaziy bank) dan avtomatik olish</label><div class="row"><button class="btn" type="submit">Saqlash</button></div></form></section>';
    }
    if (B.isAdmin()) h += stochCard();
    if (B.isAdmin()) h += contractCard();
    if (B.isAdmin()) h += repCard();
    if (B.isAdmin()) h += payEditor();
    if (B.isAdmin()) h += '<section class="card stack"><h2>Zaxira nusxa</h2><p class="sub">Barcha ma‘lumotlar (mijozlar, aktivlar, bitimlar, jurnal, chart sozlamalari) bitta faylda. Server o‘zi har 6 soatda <code>data/backups</code> papkasiga nusxa saqlaydi (oxirgi 30 ta). Yangi versiya o‘rnatishdan oldin ham yuklab oling.</p><div class="row"><a class="btn" href="/api/backup" download>Zaxira nusxani yuklab olish (.db)</a></div></section>';
    return h + '</div>';
  }
  var PF = ['name', 'holder', 'number', 'url', 'note'];
  function payRows() { return ST.payRows || (ST.payRows = (D().settings.pay || []).map(function (p) { return Object.assign({}, p); })); }
  function paySync() { var rows = payRows(); return rows.map(function (r, i) { var o = Object.assign({}, r); PF.forEach(function (f) { var v = ST.f['pm_' + i + '_' + f]; if (v !== undefined) o[f] = v; }); return o; }); }
  function payClear() { Object.keys(ST.f).forEach(function (k) { if (k.indexOf('pm_') === 0) delete ST.f[k]; }); }
  B.acts.payadd = function () { var r = paySync(); payClear(); r.push({ name: '', holder: '', number: '', url: '', note: '' }); ST.payRows = r; };
  B.acts.paydel = function (el) { var r = paySync(); payClear(); r.splice(+el.getAttribute('data-v'), 1); ST.payRows = r; };
  B.acts.paysave = function () { var r = paySync(); return B.run(B.api('POST', '/api/settings', { pay: r }), 'To‘lov usullari saqlandi').then(function () { payClear(); ST.payRows = null; B.rerender(); }); };
  function payEditor() {
    var rows = payRows(), h = '<section class="card stack"><h2>To‘lov usullari (mijozlar depozit qilishi uchun)</h2><p class="sub">Karta/hisob raqami va qabul qiluvchini kiriting. “To‘lov havolasi” ga Click, Payme, Uzum yoki bank to‘lov havolasini qo‘ysangiz, mijozga tugma va shu havola uchun QR kod ko‘rsatiladi. Havola bo‘lmasa, QR kod karta raqamini o‘z ichiga oladi. To‘lovlarni avtomatik tasdiqlash (Click/Payme merchant ulanishi) hozircha yo‘q: har bir to‘lovni siz tasdiqlaysiz.</p>';
    rows.forEach(function (r, i) {
      h += '<div class="card stack" style="background:var(--surface2)"><div class="form-grid">' + PF.map(function (f) { var lab = { name: 'Nomi (masalan: Uzcard)', holder: 'Qabul qiluvchi', number: 'Karta / hisob raqami', url: 'To‘lov havolasi (ixtiyoriy)', note: 'Izoh' }[f]; return fld(lab, '<input type="text" data-bind="pm_' + i + '_' + f + '" value="' + esc(ST.f['pm_' + i + '_' + f] != null ? ST.f['pm_' + i + '_' + f] : (r[f] || '')) + '">'); }).join('') + '</div><div class="row"><button class="btn ghost small" data-act="paydel" data-v="' + i + '">Olib tashlash</button></div></div>';
    });
    return h + '<div class="row"><button class="btn ghost" data-act="payadd">+ To‘lov usuli qo‘shish</button><button class="btn" data-act="paysave">Saqlash</button></div></section>';
  }

  B.pageTables = pageHisobot; B.pageHujjat = pageHujjat; B.contractBlock = contractBlock;
  Object.assign(B.pages, { aktiv: pageAktiv, savdo: pageSavdo, hisobot: pageHisobot, hujjat: pageHujjat, jurnal: pageHisobot, funds: pageFunds, profil: pageProfil, sozlama: pageSozlama });
})(window.B);
