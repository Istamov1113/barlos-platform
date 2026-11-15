/* Sahifalar 4: ledger (debet/kredit), Mablag'lar matritsasi, birja/broker/bank ro'yxati, tranzaksiyalarni ommaviy import */
(function (B) {
  'use strict';
  var Core = B.Core, ST = B.ST, esc = B.esc, money = B.money, fdt = B.fdt, nf = B.nf, fld = B.fld, bind = B.bind, sel = B.sel, empty = B.empty;
  function D() { return B.D(); }
  function S() { var d = D(); return { fx: d.settings.fx, assets: d.assets, accounts: d.accounts, tx: d.tx, now: Date.now() }; }
  function venues() { var d = D(), l = (d.settings.venues || []).slice(); d.assets.forEach(function (a) { var v = Core.venueOf(a); if (!a.archived && l.indexOf(v) < 0) l.push(v); }); return l; }
  function am() { var m = {}; D().assets.forEach(function (a) { m[a.id] = a; }); return m; }
  function uzs(x, q) { return x && x.price != null ? q * x.price * Core.fxOf(S(), x.curr) : 0; }

  /* ---------- Mablag'lar matritsasi: tepadan pastga mijozlar, chapdan o'ngga birja/broker/bank ---------- */
  B.fundsMatrix = function () {
    var d = D(), s = S(), vs = venues(), a = am(), accs = d.accounts.filter(function (x) { return !x.archived; }), colT = {}, grand = 0, rows = [];
    accs.forEach(function (ac) {
      var vb = Core.venueBalances(s, ac.id), r = { ac: ac, cells: {}, tot: 0 };
      Object.keys(vb).forEach(function (v) { var sum = 0, det = []; Object.keys(vb[v]).forEach(function (id) { var x = a[id], val = uzs(x, vb[v][id]); sum += val; det.push((x ? x.sym : id) + ' ' + nf(vb[v][id], x && x.group === 'naqd' ? 2 : 6)); }); r.cells[v] = { sum: sum, det: det.join('\n') }; r.tot += sum; colT[v] = (colT[v] || 0) + sum; if (vs.indexOf(v) < 0) vs.push(v); });
      grand += r.tot; rows.push(r);
    });
    rows.sort(function (x, y) { return y.tot - x.tot; });
    var h = '<section class="card stack"><h2>Mablag‘lar matritsasi</h2><p class="sub">Qatorlar: mijozlar. Ustunlar: birja, broker va banklar. Qiymatlar so‘mda; ustiga bosilsa tarkibi ko‘rinadi.</p><div class="tw"><table style="min-width:' + (260 + vs.length * 120) + 'px"><thead><tr><th>Mijoz / hisob</th>' + vs.map(function (v) { return '<th class="n">' + esc(v) + '</th>'; }).join('') + '<th class="n">Jami</th></tr>' +
      '<tr style="background:var(--surface2)"><th>JAMI (barcha mijozlar)</th>' + vs.map(function (v) { return '<th class="n">' + money(colT[v] || 0) + '</th>'; }).join('') + '<th class="n">' + money(grand) + '</th></tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><td><b>' + esc(r.ac.owner) + '</b> <span class="muted">· ' + esc(r.ac.name) + '</span></td>' + vs.map(function (v) { var c = r.cells[v]; return '<td class="n"' + (c ? ' title="' + esc(c.det) + '"' : '') + '>' + (c && c.sum > 0.5 ? money(c.sum) : '<span class="muted">—</span>') + '</td>'; }).join('') + '<td class="n"><b>' + money(r.tot) + '</b></td></tr>'; });
    h += '<tr><td><b>Ulushi</b></td>' + vs.map(function (v) { return '<td class="n">' + (grand > 0 ? B.pct((colT[v] || 0) / grand * 100) : '—') + '</td>'; }).join('') + '<td class="n">100%</td></tr></tbody></table></div>';
    if (B.isAdmin()) h += '<div class="row" style="margin-top:8px"><input type="text" placeholder="Yangi birja / broker / bank nomi" style="max-width:260px"' + bind('vn_name') + '><button class="btn small" data-act="venueadd">+ Qo‘shish</button>' + vs.map(function (v) { return '<button class="chip" data-act="venuedel" data-v="' + esc(v) + '" title="Olib tashlash">' + esc(v) + ' ✕</button>'; }).join('') + '</div><p class="muted mini">Aktivning “Birja/joy” maydoni shu nomlardan biri bo‘lsa, uning qoldig‘i shu ustunda ko‘rinadi.</p>';
    return h + '</section>';
  };
  B.acts.venueadd = function () { var n = (ST.f.vn_name || '').trim(); if (!n) { B.toast('Nomni kiriting.'); return false; } return B.run(B.api('POST', '/api/venues', { add: n }), 'Qo‘shildi').then(function () { delete ST.f.vn_name; }); };
  B.acts.venuedel = function (el) { var n = el.getAttribute('data-v'); if (!confirm(n + ' ro‘yxatdan olib tashlansinmi?')) return false; return B.run(B.api('POST', '/api/venues', { remove: n }), 'Olib tashlandi'); };

  /* ---------- Ledger: har bir hisob bo'yicha debet/kredit ko'chirma ---------- */
  B.ledgerCard = function () {
    var d = D(), accs = d.accounts.filter(function (x) { return !x.archived; }); if (!accs.length) return '';
    var id = ST.lgAcc && accs.some(function (x) { return x.id === ST.lgAcc; }) ? ST.lgAcc : accs[0].id, vf = ST.lgVen || '', s = S(), lg = Core.ledger(s, id), vs = venues();
    var h = '<section class="card stack"><h2>Ledger (debet / kredit)</h2><p class="sub">Har bir tranzaksiya ikki yoqlama yozuv: <b>D</b> — qoldiq oshadi, <b>K</b> — kamayadi. “Tashqi hisob”, “Komissiya” va “Daromad” — qarshi hisoblar. Ledger tranzaksiyalar jurnalidan hisoblanadi, shuning uchun jurnal bilan doim mos.</p><div class="form-grid">' +
      fld('Mijoz / hisob', sel('lg_acc', accs.map(function (x) { return [x.id, x.owner + ' · ' + x.name]; }), id)) + fld('Birja / broker / bank', sel('lg_ven', [['', 'Hammasi']].concat(vs.map(function (v) { return [v, v]; })), vf)) + '</div>';
    var ents = lg.entries.filter(function (e) { return !vf || e.lines.some(function (l) { return l.venue === vf; }); }).slice().reverse().slice(0, 300);
    if (!ents.length) return h + empty('Yozuvlar yo‘q', 'Bu hisobda hali tranzaksiya yo‘q.') + '</section>';
    h += '<div class="tw"><table style="min-width:760px"><thead><tr><th>Sana</th><th>Tranz.</th><th>Hisob</th><th class="n">Debet (D)</th><th class="n">Kredit (K)</th><th class="n">Qoldiq</th></tr></thead><tbody>';
    ents.forEach(function (e) {
      e.lines.filter(function (l) { return !vf || l.venue === vf || l.acct === 'ext'; }).forEach(function (l, i) {
        var x = l.aid ? am()[l.aid] : null, q = x ? nf(l.qty, x.group === 'naqd' ? 2 : 6) + ' ' + esc(x.sym) : '';
        h += '<tr' + (l.acct === 'ext' ? ' style="opacity:.75"' : '') + '><td class="nowrap">' + (i === 0 ? fdt(e.t) : '') + '</td><td class="mono">' + (i === 0 ? e.tx + ' <span class="muted mini">' + e.type + '</span>' : '') + '</td><td>' + (l.acct === 'asset' ? '<b>' + esc(l.venue) + '</b> · ' + esc(l.sym) : esc(l.name)) + '</td><td class="n">' + (l.side === 'D' ? (q || '') + '<div class="muted mini">' + money(l.uzs) + '</div>' : '') + '</td><td class="n">' + (l.side === 'C' ? (q || '') + '<div class="muted mini">' + money(l.uzs) + '</div>' : '') + '</td><td class="n">' + (l.bal != null && x ? nf(l.bal, x.group === 'naqd' ? 2 : 6) + ' ' + esc(x.sym) : '') + '</td></tr>';
      });
    });
    return h + '</tbody></table></div></section>';
  };
  B.onbind['lg_acc'] = function (b, t) { ST.lgAcc = t.value; B.rerender(); };
  B.onbind['lg_ven'] = function (b, t) { ST.lgVen = t.value; B.rerender(); };

  /* ---------- Tranzaksiyalarni ommaviy import (CSV) ---------- */
  var COLS = ['date', 'account', 'asset', 'type', 'amount', 'price', 'fee', 'feeAsset', 'venue', 'note', 'to', 'toAmount'];
  var ALIAS = { sana: 'date', vaqt: 'date', mijoz: 'account', hisob: 'account', email: 'account', aktiv: 'asset', ticker: 'asset', belgi: 'asset', tur: 'type', miqdor: 'amount', narx: 'price', komissiya: 'fee', 'komissiya aktivi': 'feeAsset', birja: 'venue', joy: 'venue', izoh: 'note', qayerga: 'to', 'qabul miqdori': 'toAmount' };
  function csv(text) {
    text = String(text).replace(/^﻿/, ''); var first = text.split('\n')[0], dl = (first.split(';').length > first.split(',').length ? ';' : (first.split('\t').length > 2 ? '\t' : ',')), rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) { var c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === dl) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); } return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  }
  function toRows(text) {
    var t = csv(text); if (t.length < 2) return [];
    var hd = t[0].map(function (h) { h = String(h).trim().toLowerCase(); return ALIAS[h] || (COLS.map(function (c) { return c.toLowerCase(); }).indexOf(h) >= 0 ? COLS[COLS.map(function (c) { return c.toLowerCase(); }).indexOf(h)] : h); });
    return t.slice(1).map(function (r) { var o = {}; hd.forEach(function (k, i) { var v = r[i] == null ? '' : String(r[i]).trim(); if (v !== '') o[k] = ['amount', 'price', 'fee', 'toAmount'].indexOf(k) >= 0 ? +v.replace(/\s/g, '').replace(',', '.') : v; }); return o; });
  }
  B.importCard = function () {
    var p = ST.imp, h = '<section class="card stack"><h2>Tranzaksiyalarni import qilish</h2><p class="sub">Qo‘lda yuritgan ro‘yxatingizni CSV (Excel: “Saqlash → CSV”) ko‘rinishida yuklang yoki matnni shu yerga qo‘ying. Avval <b>tekshiriladi</b>; birorta qatorda xato bo‘lsa, hech narsa yozilmaydi. Sana tartibida bajariladi (yetarli qoldiq tekshiruvi bilan), shuning uchun avval depozitlar bo‘lishi kerak.</p>' +
      '<p class="muted mini">Ustunlar: <code>date</code> (2026-03-15 yoki 15.03.2026), <code>account</code> (mijoz emaili/ismi/hisob ID), <code>asset</code> (ticker), <code>type</code> (buy, sell, deposit, withdraw, dividend, foiz, kupon, transfer), <code>amount</code>, <code>price</code>; ixtiyoriy: <code>fee</code>, <code>feeAsset</code>, <code>venue</code>, <code>note</code>, <code>to</code>, <code>toAmount</code>.</p>' +
      '<div class="row"><input type="file" id="impfile" accept=".csv,.txt"><a class="btn ghost small" data-act="imptpl">Namuna yuklab olish</a></div><textarea rows="6" placeholder="date,account,asset,type,amount,price&#10;2026-01-10,mijoz@mail.uz,UZS,deposit,10000000,1" style="width:100%;font-family:monospace;font-size:12px"' + bind('imp_text') + '>' + esc(ST.f.imp_text || '') + '</textarea><div class="row"><button class="btn" data-act="impcheck">Tekshirish</button>' + (p && p.ok ? '<button class="btn" data-act="impgo">Import qilish (' + p.count + ' ta)</button>' : '') + '</div>';
    if (p) h += p.ok ? '<div class="notice" style="background:var(--accent-soft);color:var(--accent)">Tekshiruv muvaffaqiyatli: ' + p.count + ' ta tranzaksiya yoziladi.</div>' : '<div class="notice"><b>' + esc(p.error) + '</b><br>' + (p.errors || []).map(function (e) { return e.row + '-qator: ' + esc(e.error); }).join('<br>') + '</div>';
    return h + '</section>';
  };
  document.addEventListener('change', function (e) { var t = e.target; if (!t || t.id !== 'impfile' || !t.files || !t.files[0]) return; var r = new FileReader(); r.onload = function () { ST.f.imp_text = r.result; ST.imp = null; B.rerender(); }; r.readAsText(t.files[0]); });
  function impSend(dry) { var rows = toRows(ST.f.imp_text || ''); if (!rows.length) { B.toast('Ma’lumot topilmadi (sarlavha + kamida 1 qator).'); return Promise.resolve(false); } return B.api('POST', '/api/tx/import', { rows: rows, dry: dry }); }
  B.acts.impcheck = function () { return impSend(true).then(function (r) { if (r) ST.imp = r; B.rerender(); }).catch(function (e) { ST.imp = { ok: false, error: e.message, errors: e.data && e.data.errors }; B.rerender(); }); };
  B.acts.impgo = function () { if (!confirm('Import bajarilsinmi? Yozuvlar jurnalga qo‘shiladi.')) return false; return impSend(false).then(function (r) { if (r) { B.toast(r.count + ' ta tranzaksiya import qilindi'); ST.imp = null; delete ST.f.imp_text; B.reload ? B.reload() : B.rerender(); } }).catch(function (e) { B.toast(e.message); }); };
  B.acts.imptpl = function () { var t = 'date,account,asset,type,amount,price,fee,feeAsset,venue,note\n2026-01-10,mijoz@mail.uz,UZS,deposit,10000000,1,,,Bank,Boshlang‘ich depozit\n2026-01-12,mijoz@mail.uz,USDT,deposit,500,1,,,Bitget,\n2026-01-15,mijoz@mail.uz,BTC,buy,0.005,80000,,,Bitget,\n'; var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv' })); a.download = 'barlos-import-namuna.csv'; a.click(); return false; };
})(window.B);
