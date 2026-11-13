/* BARLOS interfeysi: yordamchilar, kirish ekranlari, qobiq va yo'naltirish */
window.B = (function () {
  'use strict';
  var Core = window.Core, GROUPS = Core.GROUPS, GKEYS = Core.GKEYS;
  var B = { Core: Core, GROUPS: GROUPS, GKEYS: GKEYS, pages: {}, acts: {} };
  var D = null, ST = { page: 'bosh', accId: null, cur: 'UZS', lang: 'uz', theme: 'system', open: {}, f: {}, auth: 'login', tab: {}, busy: false, err: '', msg: '' };
  B.ST = ST; B.D = function () { return D; };
  var STATUS = Core.STATUS, SCLS = { STRONG_SELL: 'p-ss', SELL: 'p-s', HOLD: 'p-h', BUY: 'p-b', STRONG_BUY: 'p-sb' };
  var TYPE_NAME = { foizsiz: 'Foizsiz', foizli: 'Foizli' };

  /* ---------- yordamchilar ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fi(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fd(n, d) { var p = n.toFixed(d).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join('.'); }
  function nf(v, d) {
    if (v == null || isNaN(v)) return '—';
    var a = Math.abs(v), dd = d != null ? d : (a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : a >= 0.01 ? 4 : 8), s = v.toFixed(dd);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join('.');
  }
  function fx() { return (D && D.settings.fx && D.settings.fx.USD) || 0; }
  function money(u) { return (ST.cur === 'USD' && fx() > 0) ? fd(u / fx(), 2) + ' USD' : fi(u) + ' so’m'; }
  function pct(n, d) { return n.toFixed(d == null ? 1 : d) + '%'; }
  function sgn(n, d) { return (n > 0 ? '+' : '') + n.toFixed(d == null ? 1 : d) + '%'; }
  function two(n) { return String(n).padStart(2, '0'); }
  function fdt(ms) { if (!ms) return '—'; var d = new Date(ms); return two(d.getDate()) + '.' + two(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()); }
  function ago(ms) { var m = Math.round((Date.now() - ms) / 60000); if (m < 2) return 'hozir'; if (m < 60) return m + ' daqiqa oldin'; var h = Math.round(m / 60); if (h < 24) return h + ' soat oldin'; return fdt(ms); }
  function qtyStr(a, q) { if (q == null) return '—'; if (a.group === 'milliy') return fi(q); if (a.group === 'naqd') return nf(q, a.curr === 'UZS' ? 0 : 4); var s = q.toFixed(Math.max(2, Math.min(GROUPS[a.group].dec, 8))); return s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, ''); }
  function pxStr(a, p) { if (p == null) return '—'; var s = p >= 100 ? fd(p, 0) : nf(p, p < 10 ? (p < 0.01 ? 6 : 4) : 2); return s + (a.curr === 'USD' ? ' USD' : ' so’m'); }
  function gcol(k) { return 'var(--c-' + k + ')'; }
  function pill(st) { return st ? '<span class="pill ' + SCLS[st] + '">' + STATUS[st] + '</span>' : ''; }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 3200); }
  function bind(name, extra) { var v = ST.f[name]; return ' data-bind="' + name + '" value="' + esc(v == null ? '' : v) + '"' + (extra || ''); }
  function sel(name, opts, cur) { var v = ST.f[name] != null ? ST.f[name] : cur; return '<select data-bind="' + name + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function fld(label, inner) { return '<div class="field"><label>' + label + '</label>' + inner + '</div>'; }
  function empty(t, s) { return '<div class="empty"><b>' + t + '</b>' + (s || '') + '</div>'; }
  Object.assign(B, { $: $, esc: esc, fi: fi, fd: fd, nf: nf, money: money, pct: pct, sgn: sgn, fdt: fdt, ago: ago, qtyStr: qtyStr, pxStr: pxStr, gcol: gcol, pill: pill, toast: toast, bind: bind, sel: sel, fld: fld, empty: empty, fx: fx, TYPE_NAME: TYPE_NAME, SCLS: SCLS });

  /* ---------- ikonlar ---------- */
  var ICON = {
    bosh: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>', portfel: '<path d="M12 3v9h9a9 9 0 1 1-9-9z"/>', tranz: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    savdo: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', profil: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6"/>',
    funds: '<path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>', sozlama: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    aktiv: '<path d="M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/>', hisobot: '<path d="M5 3h10l4 4v14H5zM15 3v4h4M9 13h6M9 17h6"/>', chat: '<path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5"/>', hujjat: '<path d="M4 4h9l3 3v13H4zM13 4v3h3M7 12h6M7 16h6M17 10h3v10h-9"/>', chart: '<path d="M4 19V9M9 19V5M14 19v-8M19 19V7"/><path d="M2 21h20"/>', jurnal: '<path d="M12 8v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/>'
  };
  var GICON = {
    kripto: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 8h3.5a2 2 0 0 1 0 4H9.5zM9.5 12h4a2 2 0 0 1 0 4H9.5zM9.5 8v8"/>',
    xalqaro: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    milliy: '<path d="M4 21V9l8-5 8 5v12M2 21h20M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01"/>', metall: '<path d="M3 18l3-6h12l3 6zM8.5 12L10 8h4l1.5 4"/>',
    omonat: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 9v1M12 14v1M9 12h1M14 12h1"/>',
    obligatsiya: '<path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6"/>', naqd: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
    foizsiz: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', foizli: '<path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>'
  };
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function ico(k, col, sz) { sz = sz || 36; return '<span class="ico" style="width:' + sz + 'px;height:' + sz + 'px;color:' + col + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + GICON[k] + '</svg></span>'; }
  function logo(x, sz) {
    sz = sz || 28; var col = gcol(x.group);
    if (x.group === 'omonat' || x.group === 'obligatsiya' || x.group === 'naqd') return '<span class="lg" style="width:' + sz + 'px;height:' + sz + 'px;color:' + col + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + GICON[x.group] + '</svg></span>';
    var t = x.sym.replace(/on$/, '').slice(0, 5), fs = sz * (t.length <= 3 ? 0.34 : (t.length === 4 ? 0.29 : 0.25));
    return '<span class="lg" style="width:' + sz + 'px;height:' + sz + 'px;color:' + col + ';font-size:' + fs.toFixed(1) + 'px" aria-hidden="true">' + esc(t) + '</span>';
  }
  /* Jett uslubidagi aktiv katagi: logo, nomi, pastida "SIMVOL | TURI"; dir = 'buy' | 'sell' | 'inc' (chap chiziq rangi) */
  var GCODE = { kripto: 'CRYPTO', xalqaro: 'INT', milliy: 'STK', metall: 'METAL', omonat: 'DEP', obligatsiya: 'BND', naqd: 'CASH' };
  function assetCell(x, sz, dir) { return '<div class="asset-cell">' + (dir ? '<span class="dbar ' + dir + '"></span>' : '') + logo(x, sz || 34) + '<div><b>' + esc(x.name || x.sym) + '</b><small>' + esc(x.sym) + ' | ' + (GCODE[x.group] || '') + '</small></div></div>'; }
  Object.assign(B, { ICON: ICON, GICON: GICON, CHEV: CHEV, ico: ico, logo: logo, assetCell: assetCell, GCODE: GCODE });

  /* ---------- API ---------- */
  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('Xato ' + r.status)); e.status = r.status; e.data = j; throw e; } return j; });
    });
  }
  B.api = api;
  function reload() {
    return api('GET', '/api/state').then(function (s) {
      D = s; B.Dv = s; if (B.onState) { try { B.onState(s); } catch (e) { } } Core.SET.nBase = s.settings.nBase; Core.SET.nHold = s.settings.nHold; Core.SET.nSell = s.settings.nSell; Core.BENCHC.rate = s.settings.benchRate != null ? s.settings.benchRate : 25; Core.BENCHC.pay = s.settings.benchPay || 'none'; cacheS = null; vcache = {};
      return s;
    });
  }
  /* amalni bajarib, holatni qayta yuklaydi */
  function run(p, okMsg) {
    return p.then(function (r) { if (okMsg) toast(okMsg); return reload().then(function () { render(); return r; }); }).catch(function (e) { if (e.status === 401) { D = null; render(); return; } toast(e.message); throw e; });
  }
  B.run = run; B.reload = reload;

  /* ---------- hisoblash keshi ---------- */
  var cacheS = null, vcache = {};
  function S() { if (!cacheS) cacheS = { fx: D.settings.fx, assets: D.assets, accounts: D.accounts, tx: D.tx, stoch: D.stoch || {} }; return cacheS; }
  function view(acc) { if (!vcache[acc.id]) vcache[acc.id] = Core.view(S(), acc); return vcache[acc.id]; }
  function isStaff() { return D && (D.me.role === 'admin' || D.me.role === 'operator'); }
  function isAdmin() { return D && D.me.role === 'admin'; }
  function curAcc() { var l = D.accounts.filter(function (a) { return !a.archived; }); var a = l.filter(function (x) { return x.id === ST.accId; })[0]; return a || (isStaff() ? null : l[0]) || null; }
  Object.assign(B, { S: S, view: view, isStaff: isStaff, isAdmin: isAdmin, curAcc: curAcc, render: function () { render(); } });

  /* ---------- sozlamalar (til, mavzu) ---------- */
  function loadPrefs() { try { var p = JSON.parse(localStorage.getItem('barlos.prefs') || '{}'); if (p.lang && window.I18N[p.lang] !== undefined) ST.lang = p.lang; if (p.theme) ST.theme = p.theme; if (p.cur) ST.cur = p.cur; } catch (e) { } }
  B.savePrefs = function () { try { localStorage.setItem('barlos.prefs', JSON.stringify({ lang: ST.lang, theme: ST.theme, cur: ST.cur })); } catch (e) { } };
  function applyTheme() { var r = document.documentElement; if (ST.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', ST.theme); }
  B.applyTheme = applyTheme;
  function applyLang() {
    var d = window.I18N[ST.lang]; document.documentElement.setAttribute('lang', ST.lang); if (!d) return;
    ['.side', '.main', '.auth'].forEach(function (sel) {
      var root = $(sel); if (!root) return;
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
      while ((n = w.nextNode())) list.push(n);
      list.forEach(function (n) { var s = n.nodeValue, k = s.trim(); if (k && d[k] !== undefined) n.nodeValue = s.replace(k, function () { return d[k]; }); });
      root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(function (el) { ['placeholder', 'aria-label', 'title'].forEach(function (at) { var v = el.getAttribute(at); if (v && d[v] !== undefined) el.setAttribute(at, d[v]); }); });
    });
  }


  /* ---------- shartnoma bandlari ---------- */
  function ctrItems(c) { return '<div class="ctr" tabindex="0" aria-label="Shartnoma bandlari">' + c.items.map(function (x) { return '<p><b>' + esc(x.id) + '-band.</b> ' + esc(x.text) + '<small>' + esc(x.sec) + '</small></p>'; }).join('') + '</div>' +
    '<details class="ctr-full"><summary>Shartnomaning to‘liq matni</summary><div class="ctr">' + c.full.map(function (sec) { return '<h4>' + esc(sec.n.charAt(0) === 'A' ? sec.title : sec.n + '. ' + sec.title) + '</h4>' + sec.cl.map(function (x) { return '<p>' + (x.id ? '<b>' + esc(x.id) + '.</b> ' : '') + esc(x.text) + '</p>'; }).join(''); }).join('') + '</div></details>'; }
  function loadCtr() { if (ST.ctr || ST.ctrBusy) return; ST.ctrBusy = 1; api('GET', '/api/contract').then(function (c) { ST.ctr = c; ST.ctrBusy = 0; if (!D) render(); }).catch(function () { ST.ctrBusy = 0; }); }
  function consentView() {
    var c = D.contract || ST.ctr; if (!c) { loadCtr(); return '<div class="auth"><div class="card"><p class="sub">Yuklanmoqda…</p></div></div>'; }
    return '<div class="auth wide"><div class="card stack"><div class="brand">' + LOGO + '<b>BARLOS</b></div><h1>Shartnoma bandlari</h1><p class="sub">Davom etishdan oldin ishonchli boshqarish shartnomasining quyidagi bandlari bilan tanishib, roziligingizni tasdiqlang. Tasdiqlash vaqti va qurilmangiz saqlanadi.</p>' + (ST.err ? '<div class="err" role="alert">' + esc(ST.err) + '</div>' : '') + ctrItems(c) +
      '<label class="switch"><input type="checkbox" data-bind="agree"' + (ST.f.agree ? ' checked' : '') + '> Shartnoma bandlari bilan tanishdim va roziman</label><div class="row sb"><button class="btn" data-act="consentok"' + (ST.f.agree ? '' : ' disabled') + '>Tasdiqlash</button><button class="link" data-act="logout">Chiqish</button></div></div></div>';
  }
  B.acts.consentok = function () { var c = D.contract || ST.ctr; return api('POST', '/api/consent', { agree: !!ST.f.agree, ver: c.ver }).then(function () { ST.f.agree = false; ST.err = ''; return reload(); }).then(render).catch(function (e) { ST.err = e.message; render(); }); };

  /* ---------- kirish ekranlari ---------- */
  var LOGO = '<img class="logo" src="logo.jpg" width="44" height="44" alt="BARLOS">';
  function authView() {
    var m = ST.auth, h = '<div class="auth"><form class="card" data-form="' + m + '" novalidate><div class="brand">' + LOGO + '<b>BARLOS</b></div>';
    if (ST.err) h += '<div class="err" role="alert">' + esc(ST.err) + '</div>';
    if (ST.msg) h += '<div class="okm">' + esc(ST.msg) + '</div>';
    if (m === 'login') {
      h += '<h1>Kirish</h1>' + fld('Email', '<input type="email" autocomplete="username"' + bind('email') + '>') + fld('Parol', '<input type="password" autocomplete="current-password"' + bind('password') + '>') +
        '<button class="btn" type="submit"' + (ST.busy ? ' disabled' : '') + '>Kirish</button><div class="row sb"><button type="button" class="link" data-act="authmode" data-v="register">Hisob ochish</button><button type="button" class="link" data-act="authmode" data-v="forgot">Parolni unutdim</button></div>';
    } else if (m === 'register') {
      h += '<h1>Hisob ochish</h1>' + fld('F.I.O.', '<input type="text" autocomplete="name"' + bind('name') + '>') + fld('Email', '<input type="email" autocomplete="username"' + bind('email') + '>') + fld('Parol (kamida 8 belgi)', '<input type="password" autocomplete="new-password"' + bind('password') + '>') + (ST.ctr ? '<h2 style="margin-top:6px">Shartnoma bandlari</h2>' + ctrItems(ST.ctr) : (loadCtr(), '<p class="sub">Shartnoma bandlari yuklanmoqda…</p>')) + '<label class="switch"><input type="checkbox" data-bind="agree"' + (ST.f.agree ? ' checked' : '') + '> Shartnoma bandlari bilan tanishdim va roziman</label>' +
        '<button class="btn" type="submit"' + (ST.busy || !ST.f.agree ? ' disabled' : '') + '>Ro‘yxatdan o‘tish</button><div class="row"><button type="button" class="link" data-act="authmode" data-v="login">Hisobim bor, kirish</button></div>';
    } else if (m === 'verify') {
      h += '<h1>Emailni tasdiqlash</h1><p class="sub" style="text-align:center">' + esc(ST.f.email) + ' manziliga 6 xonali kod yuborildi.</p>' + fld('Kod', '<input type="text" inputmode="numeric" autocomplete="one-time-code"' + bind('code') + '>') +
        '<button class="btn" type="submit">Tasdiqlash</button><div class="row"><button type="button" class="link" data-act="authmode" data-v="login">Orqaga</button></div>';
    } else if (m === 'forgot') {
      h += '<h1>Parolni tiklash</h1>' + (ST.cfg && ST.cfg.smtp ? '<p class="sub">Emailingizni kiriting, tiklash kodi yuboriladi.</p>' + fld('Email', '<input type="email"' + bind('email') + '>') + '<button class="btn" type="submit">Kod yuborish</button>' :
        '<p class="sub">Bu serverda email yuborish yoqilmagan. Parolni tiklash uchun administratorga murojaat qiling: u sizga vaqtinchalik parol o‘rnatadi.</p>') + '<div class="row"><button type="button" class="link" data-act="authmode" data-v="login">Orqaga</button></div>';
    } else if (m === 'reset') {
      h += '<h1>Yangi parol</h1>' + fld('Kod', '<input type="text" inputmode="numeric"' + bind('code') + '>') + fld('Yangi parol', '<input type="password" autocomplete="new-password"' + bind('password') + '>') + '<button class="btn" type="submit">Saqlash</button><div class="row"><button type="button" class="link" data-act="authmode" data-v="login">Orqaga</button></div>';
    }
    return h + '</form></div>';
  }
  var AF = {
    login: function () { return api('POST', '/api/login', { email: ST.f.email, password: ST.f.password }).then(afterAuth).catch(function (e) { if (e.data && e.data.needVerify) { ST.auth = 'verify'; ST.err = ''; ST.msg = ''; render(); } else throw e; }); },
    register: function () { return api('POST', '/api/register', { email: ST.f.email, password: ST.f.password, name: ST.f.name, agree: !!ST.f.agree, cver: ST.ctr ? ST.ctr.ver : undefined }).then(function (r) { if (r.needVerify) { ST.auth = 'verify'; ST.err = ''; ST.msg = ''; render(); } else afterAuth(); }); },
    verify: function () { return api('POST', '/api/verify', { email: ST.f.email, code: ST.f.code }).then(afterAuth); },
    forgot: function () { return api('POST', '/api/forgot', { email: ST.f.email }).then(function () { ST.auth = 'reset'; ST.err = ''; ST.msg = 'Agar bu email ro‘yxatdan o‘tgan bo‘lsa, kod yuborildi.'; render(); }); },
    reset: function () { return api('POST', '/api/reset', { email: ST.f.email, code: ST.f.code, password: ST.f.password }).then(function () { ST.auth = 'login'; ST.err = ''; ST.msg = 'Parol yangilandi. Endi kiring.'; ST.f.password = ''; render(); }); }
  };
  function afterAuth() { ST.f = {}; ST.err = ''; ST.msg = ''; ST.page = 'bosh'; ST.accId = null; return reload().then(function () { location.hash = '#/bosh'; render(); }); }

  /* ---------- qobiq ---------- */
  function pageList() {
    var r = D.me.role;
    if (r === 'admin') return [['bosh', 'Bosh sahifa', 'Bosh'], ['aktiv', 'Aktivlar', 'Aktiv'], ['chart', 'Chart', 'Chart'], ['tranz', 'Tranzaksiyalar', 'Tranz.'], ['savdo', 'Avto savdo', 'Savdo'], ['hisobot', 'Hisobotlar', 'Hisobot'], ['jurnal', 'Jurnal', 'Jurnal'], ['chat', 'Chat', 'Chat'], ['funds', 'Mablag’lar', 'Pul'], ['profil', 'Profil', 'Profil'], ['sozlama', 'Sozlamalar', 'Sozlama']];
    if (r === 'operator') return [['bosh', 'Bosh sahifa', 'Bosh'], ['chart', 'Chart', 'Chart'], ['tranz', 'Tranzaksiyalar', 'Tranz.'], ['savdo', 'Avto savdo', 'Savdo'], ['hisobot', 'Hisobotlar', 'Hisobot'], ['chat', 'Chat', 'Chat'], ['funds', 'Mablag’lar', 'Pul'], ['profil', 'Profil', 'Profil'], ['sozlama', 'Sozlamalar', 'Sozlama']];
    return [['bosh', 'Bosh sahifa', 'Bosh'], ['portfel', 'Portfel', 'Portfel'], ['chart', 'Chart', 'Chart'], ['tranz', 'Tranzaksiyalar', 'Tranz.'], ['hisobot', 'Hisobotlar', 'Hisobot'], ['chat', 'Chat', 'Chat'], ['funds', 'Mablag’lar', 'Pul'], ['profil', 'Profil', 'Profil'], ['sozlama', 'Sozlamalar', 'Sozlama']];
  }
  function titleOf(p) { var l = pageList().filter(function (x) { return x[0] === p; })[0]; return l ? l[1] : ''; }
  var SUBS = { chat: 'Shaxsiy yozishma, guruh, kanal va muhokama', hisobot: 'PDF hisobotlar, hujjatlar va jadval hisobotlari', chart: 'Aktivlar narxi, indikatorlar va chizish asboblari', bosh: 'Hisob holati va aktivlar ulushi', portfel: 'Aktivlar, statuslar va maqsadli ulushlar', tranz: 'Har bir bitimning miqdori, narxi va vaqti', savdo: 'TradingView signalidan bitimgacha', profil: 'Egasi haqida ma’lumot va sozlamalar', funds: 'Depozit, yechish va ichki o‘tkazmalar', sozlama: 'Til va tizim ko’rinishi', aktiv: 'Aktivlar katalogi va narx manbalari', hujjat: 'Avtomatik tayyorlangan PDF hisobotlar va shartnoma', jurnal: 'Barcha harakatlar: vaqt, IP, qurilma, foydalanuvchi' };
  function shell() {
    var pl = pageList(); if (!pl.some(function (p) { return p[0] === ST.page; })) ST.page = 'bosh';
    var nav = pl.map(function (p) { return '<button data-act="nav" data-v="' + p[0] + '"' + (ST.page === p[0] ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[p[0]] + '</svg><span class="lbl-full">' + p[1] + '</span><span class="lbl-short">' + p[2] + '</span></button>'; }).join('');
    var body = '';
    try { body = (B.pages[ST.page] || function () { return ''; })(); } catch (e) { console.error(e); body = '<div class="err">Sahifani chizishda xato: ' + esc(e.message) + '</div>'; }
    var roleName = { admin: 'Admin', operator: 'Operator', client: 'Mijoz' }[D.me.role];
    return '<div class="app"><aside class="side"><div class="brand">' + LOGO.replace('44', '38').replace('44', '38') + '<b>BARLOS</b></div><div class="mbrand">' + LOGO.replace('44', '30').replace('44', '30') + '<b>BARLOS</b></div><nav class="nav" aria-label="Asosiy">' + nav + '</nav><div class="demo-note">' + esc(D.me.name || D.me.email) + ' · ' + roleName + '<br><button class="link" style="background:none;border:0;color:var(--accent);padding:0;text-decoration:underline" data-act="logout">Chiqish</button></div></aside>' +
      '<main class="main"><header class="top"><div><h1>' + titleOf(ST.page) + '</h1><p class="sub">' + (SUBS[ST.page] || '') + '</p></div><div class="ctl">' + (ST.page !== 'sozlama' && fx() > 0 ? '<div class="seg" role="group" aria-label="Valyuta"><button data-act="cur" data-v="UZS" aria-pressed="' + (ST.cur === 'UZS') + '">So’m</button><button data-act="cur" data-v="USD" aria-pressed="' + (ST.cur === 'USD') + '">USD</button></div>' : '') + '</div></header>' + (fx() > 0 ? '' : (isAdmin() ? '<div class="notice" style="margin-bottom:14px">Dollar kursi kiritilmagan. Sozlamalar sahifasida kursni kiriting yoki avtomatik (CBU) rejimni yoqing.</div>' : '')) + body + '</main></div>';
  }
  var editing = false, dirty = false;
  function render() {
    var root = $('#root'), y = window.scrollY;
    if (!D) { root.innerHTML = authView(); applyLang(); return; }
    if (D.me.role === 'client' && D.me.consent && !D.me.consent.ok) { root.innerHTML = consentView(); applyLang(); return; }
    var mb = document.querySelector('.mdl-bg'), my = mb ? mb.scrollTop : 0, cm = document.getElementById('cmsgs'), cy = cm ? cm.scrollTop : 0;
    root.innerHTML = shell() + (B.modalHtml ? B.modalHtml() : ''); applyLang(); window.scrollTo(0, y); dirty = false;
    var mb2 = document.querySelector('.mdl-bg'); if (mb2 && mb) mb2.scrollTop = my;
    (B.hooks || []).forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    if (B.after) { try { B.after(); } catch (e) { console.error(e); } }
  }
  B.hooks = []; B.onbind = B.onbind || {};
  B.rerender = render;

  /* ---------- hodisalar ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'); if (el.tagName === 'A') e.preventDefault();
    if (a === 'authmode') { ST.auth = el.getAttribute('data-v'); ST.err = ''; ST.msg = ''; render(); return; }
    if (a === 'nav') { ST.page = el.getAttribute('data-v'); if (ST.page === 'bosh' && isStaff()) ST.accId = null; location.hash = '#/' + ST.page; render(); window.scrollTo(0, 0); return; }
    if (a === 'cur') { ST.cur = el.getAttribute('data-v'); B.savePrefs(); render(); return; }
    if (a === 'logout') { api('POST', '/api/logout', {}).finally(function () { D = null; ST.f = {}; ST.auth = 'login'; render(); }); return; }
    if (a === 'tog') { var k = el.getAttribute('data-v'); ST.open[k] = !ST.open[k]; render(); return; }
    var h = B.acts[a]; if (h) { e.stopPropagation(); var r; try { r = h(el, e); } catch (x) { toast(x.message); return; } if (r && r.catch) r.catch(function () { }); else if (r !== false) render(); }
  });
  function refocus(name, pos) { render(); var n = document.querySelector('[data-bind="' + name + '"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }
  document.addEventListener('input', function (e) {
    var t = e.target, b = t.getAttribute && t.getAttribute('data-bind'); if (!b) return;
    ST.f[b] = t.type === 'checkbox' ? t.checked : t.value; dirty = true;
    if (t.getAttribute('data-live')) refocus(b, t.selectionStart);
  });
  document.addEventListener('change', function (e) {
    var t = e.target, b = t.getAttribute && t.getAttribute('data-bind'); if (!b) return;
    if (t.tagName !== 'SELECT' && t.type !== 'checkbox' && t.type !== 'date') return;
    ST.f[b] = t.type === 'checkbox' ? t.checked : t.value;
    var h = B.onbind[b]; if (h) h(b, t); else render();
  });
  B.onbind = {};
  document.addEventListener('focusin', function (e) { editing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName); });
  document.addEventListener('focusout', function () { editing = false; });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
    var k = f.getAttribute('data-form'); ST.err = ''; ST.msg = '';
    if (AF[k]) { ST.busy = true; AF[k]().catch(function (x) { ST.err = x.message; }).then(function () { ST.busy = false; if (!D) render(); }); return; }
    var h = B.forms[k]; if (h) { var r = h(f); if (r && r.catch) r.catch(function () { }); }
  });
  B.forms = {};

  /* ---------- ishga tushirish ---------- */
  function route() { var m = (location.hash || '').match(/^#\/(\w+)/); if (m && D) { ST.page = m[1] === 'hujjat' ? 'hisobot' : m[1]; } }
  window.addEventListener('hashchange', function () { route(); if (D) render(); });
  function poll() {
    if (!D) return;
    api('GET', '/api/version').then(function (v) {
      if (v.rev !== D.rev) { if (editing) return; reload().then(function () { render(); }); }
    }).catch(function (e) { if (e.status === 401) { D = null; render(); } });
  }
  B.start = function () {
    loadPrefs(); applyTheme();
    api('GET', '/api/config').then(function (c) { ST.cfg = c; }).catch(function () { });
    reload().then(function () { route(); render(); }).catch(function () { D = null; render(); });
    setInterval(poll, 6000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  };
  return B;
})();
