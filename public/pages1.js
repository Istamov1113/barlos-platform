/* Sahifalar 1: bosh, hisob, portfel, tranzaksiyalar, maqsadli ulushlar */
(function (B) {
  'use strict';
  var Core = B.Core, GROUPS = B.GROUPS, GKEYS = B.GKEYS, ST = B.ST, esc = B.esc, money = B.money, pct = B.pct, sgn = B.sgn, fdt = B.fdt, nf = B.nf, pill = B.pill, gcol = B.gcol, fld = B.fld, bind = B.bind, sel = B.sel, empty = B.empty;
  var TYPE_NAME = B.TYPE_NAME;
  function D() { return B.D(); }
  function tcol(t) { return 'var(--c-' + t + ')'; }
  function myAccs() { return D().accounts.filter(function (a) { return !a.archived; }); }

  /* ----- hisob yig'indisi ----- */
  function summary(acc) {
    var V = B.view(acc), T = V.T, dep = Core.netDep(V), bn = Core.bench(V), q = Core.quarter(V);
    return { V: V, T: T, dep: dep, bn: bn, ratio: bn > 0 ? T / bn : null, pl: T - dep, q: q };
  }
  B.summary = summary;

  /* ----- diagramma ----- */
  function polar(cx, cy, r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  function arcPath(cx, cy, r0, r1, a0, a1) {
    if (a1 - a0 >= Math.PI * 2 - 1e-4) a1 = a0 + Math.PI * 2 - 1e-4;
    var lg = a1 - a0 > Math.PI ? 1 : 0, p0 = polar(cx, cy, r1, a0), p1 = polar(cx, cy, r1, a1), p2 = polar(cx, cy, r0, a1), p3 = polar(cx, cy, r0, a0);
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + 'A' + r1 + ' ' + r1 + ' 0 ' + lg + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + 'L' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2) + 'A' + r0 + ' ' + r0 + ' 0 ' + lg + ' 0 ' + p3[0].toFixed(2) + ' ' + p3[1].toFixed(2) + 'Z';
  }
  /* Portfel taqsimoti: 3 halqali diagramma. Ichkaridan tashqariga: foizli/foizsiz -> guruhlar -> aktivlar.
     Har daraja kattasidan kichigiga (Z→A) tartiblanadi, ichki bo'laklar o'z ota-bo'lagi ichida turadi.
     Rang: faqat ikki asosiy rang (foizli = tilla, foizsiz = ko'k-kulrang), ichkilari shu rangning tuslari.
     Yozuv bo'lak ichida yo'q: bo'lakka yaqinlashganda (sichqoncha, bosish, Tab) nom, ulush va miqdor chiqadi. */
  var SB = { foizli: { h: 41, s: 78 }, foizsiz: { h: 214, s: 42 } };
  function sbCol(t, l) { return 'hsl(' + SB[t].h + ',' + SB[t].s + '%,' + l + '%)'; }
  function sbData(V) {
    var T = V.T, tm = {};
    V.items.forEach(function (i) { if (!(i.val > 0)) return; var g = i.x.group, t = B.GROUPS[g].type, ty = tm[t] || (tm[t] = { key: t, sum: 0, gm: {} }), gr = ty.gm[g] || (ty.gm[g] = { key: g, name: B.GROUPS[g].name, sum: 0, as: [] }); ty.sum += i.val; gr.sum += i.val; gr.as.push(i); });
    var byV = function (x, y) { return y.sum - x.sum || (x.key < y.key ? -1 : 1); };
    return Object.keys(tm).map(function (k) { var ty = tm[k]; ty.gs = Object.keys(ty.gm).map(function (g) { var gr = ty.gm[g]; gr.as.sort(function (x, y) { return y.val - x.val || (x.x.sym < y.x.sym ? -1 : 1); }); return gr; }).sort(byV); return ty; }).sort(byV);
  }
  function donut(V) {
    var T = V.T, data = sbData(V), svg = '<svg class="sb" viewBox="0 0 300 300" role="group" aria-label="Portfel taqsimoti: foizli va foizsiz, guruhlar, aktivlar">', a1 = -Math.PI / 2, a2 = a1, a3 = a1, n = 0;
    var R = [[60, 88], [92, 120], [124, 148]];
    function slice(r, a0, a1_, fill, key, anc, tip) { return '<path tabindex="0" d="' + arcPath(150, 150, R[r][0], R[r][1], a0, a1_) + '" fill="' + fill + '" data-k="' + key + '" data-anc="' + anc + '" data-tip="' + esc(tip) + '"/>'; }
    function tip(nm, sub, sum, of) { return nm + '|' + sub + '|' + pct(sum / T * 100, 2) + '|' + money(sum) + '|' + (of ? of : ''); }
    data.forEach(function (ty) {
      var da = ty.sum / T * Math.PI * 2, tk = 't:' + ty.key;
      svg += slice(0, a1, a1 + da, sbCol(ty.key, 52), tk, tk, tip(TYPE_NAME[ty.key], 'Tur', ty.sum)); a1 += da;
      ty.gs.forEach(function (g, gi) {
        var dg = g.sum / T * Math.PI * 2, gk = 'g:' + g.key, an = tk + ' ' + gk;
        svg += slice(1, a2, a2 + dg, sbCol(ty.key, gi % 2 ? 62 : 47), gk, an, tip(g.name, TYPE_NAME[ty.key], g.sum, pct(g.sum / ty.sum * 100, 1) + ' ' + TYPE_NAME[ty.key].toLowerCase() + ' ichida')); a2 += dg;
        g.as.forEach(function (i, ai) {
          var d3 = i.val / T * Math.PI * 2, L = [47, 59, 71][(gi + ai) % 3];
          svg += slice(2, a3, a3 + d3, sbCol(ty.key, L), 'a:' + (n++), an + ' a:' + (n - 1), tip(i.x.sym, i.x.name + ' · ' + g.name, i.val, pct(i.val / g.sum * 100, 1) + ' ' + g.name.toLowerCase() + ' ichida')); a3 += d3;
        });
      });
    });
    svg += '</svg><div class="sbtip" hidden></div>';
    return { svg: svg, legend: '<div class="legend">' + data.map(function (ty) { return '<span><i class="dot" style="background:' + sbCol(ty.key, 50) + '"></i>' + TYPE_NAME[ty.key] + ' <b class="num">' + pct(ty.sum / T * 100) + '</b></span>'; }).join('') + '</div>' };
  }
  (function sbEvents() {
    var cur = null;
    function wrapOf(el) { return el && el.closest ? el.closest('.ratio-wrap') : null; }
    function lineage(w, p) {
      var k = p ? p.getAttribute('data-k') : null;
      w.querySelectorAll('.sb path').forEach(function (q) { var on = !k || q === p || (q.getAttribute('data-anc') + ' ').indexOf(k + ' ') >= 0 || (' ' + p.getAttribute('data-anc') + ' ').indexOf(' ' + q.getAttribute('data-k') + ' ') >= 0; q.classList.toggle('dim', !on); q.classList.toggle('on', q === p); });
    }
    function show(p, x, y) {
      var w = wrapOf(p); if (!w) return; var t = w.querySelector('.sbtip'); if (!t) return;
      var f = p.getAttribute('data-tip').split('|');
      t.innerHTML = '<b>' + f[0] + '</b><small>' + f[1] + '</small><span class="num">' + f[2] + '</span><span class="num">' + f[3] + '</span>' + (f[4] ? '<small>' + f[4] + '</small>' : '');
      t.hidden = false; lineage(w, p); cur = p;
      var r = w.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight, px = x - r.left + 14, py = y - r.top + 14;
      if (px + tw > r.width) px = x - r.left - tw - 14; if (px < 0) px = 0; if (py + th > r.height) py = y - r.top - th - 14; if (py < 0) py = 0;
      t.style.left = px + 'px'; t.style.top = py + 'px';
    }
    function hide() { if (!cur) return; var w = wrapOf(cur); cur = null; if (!w) return; var t = w.querySelector('.sbtip'); if (t) t.hidden = true; lineage(w, null); }
    function slc(e) { var t = e.target; return t && t.closest ? t.closest('.sb path') : null; }
    document.addEventListener('pointermove', function (e) { var p = slc(e); if (p) show(p, e.clientX, e.clientY); else hide(); });
    document.addEventListener('pointerdown', function (e) { var p = slc(e); if (p) show(p, e.clientX, e.clientY); else hide(); });
    document.addEventListener('focusin', function (e) { var p = slc(e); if (p) { var r = p.getBoundingClientRect(); show(p, r.left + r.width / 2, r.top + r.height / 2); } });
    document.addEventListener('focusout', function (e) { if (slc(e)) hide(); });
    document.addEventListener('pointerleave', hide, true);
  })();
  function groupItems(V, k) { return V.items.filter(function (i) { return i.x.group === k && i.val > 0; }).sort(function (x, y) { return y.val - x.val; }); }
  function assetRow(i, T, acc) { return '<div class="arow link" role="button" tabindex="0" data-act="assetopen" data-v="' + esc(i.x.id) + '" data-acc="' + esc(acc || 'all') + '">' + B.logo(i.x, 32) + '<span class="acc-t"><b>' + esc(i.x.sym) + '</b><small>' + esc(i.x.name) + '</small></span><span class="acc-n"><b class="num">' + pct(i.val / T * 100) + '</b><small>' + money(i.val) + '</small></span></div>'; }
  function groupBlock(V, g, T, pre) {
    var key = pre + 'g:' + g.key, open = !!ST.open[key], col = gcol(g.key), as = groupItems(V, g.key);
    var h = '<button class="acc-h sm" data-act="tog" data-v="' + key + '" aria-expanded="' + open + '">' + B.ico(g.key, col, 38) + '<span class="acc-t"><b>' + g.name + '</b><small>' + as.length + ' ta aktiv</small><span class="bar"><i style="width:' + Math.min(100, g.share).toFixed(1) + '%;background:' + col + '"></i></span></span><span class="acc-n"><b class="num">' + pct(g.share) + '</b><small>' + money(g.sum) + '</small></span>' + B.CHEV + '</button>';
    if (open) h += '<div class="acc-b">' + as.map(function (i) { return assetRow(i, T, V.acc && V.acc.id); }).join('') + '</div>';
    return h;
  }
  function typeCard(V, t, pre) {
    var T = V.T, gs = Core.groupSums(B.S(), V).filter(function (g) { return g.type === t; }).sort(function (x, y) { return y.sum - x.sum; }), sum = gs.reduce(function (s, g) { return s + g.sum; }, 0);
    if (!(sum > 0)) return '';
    var key = pre + 't:' + t, open = !!ST.open[key], col = tcol(t);
    var h = '<section class="card acc"><button class="acc-h" data-act="tog" data-v="' + key + '" aria-expanded="' + open + '">' + B.ico(t, col, 46) + '<span class="acc-t"><b>' + TYPE_NAME[t] + '</b><small>' + (t === 'foizli' ? 'Daromadi foiz ko’rinishida' : 'Daromadi narx o’zgarishidan') + '</small><span class="bar"><i style="width:' + (sum / T * 100).toFixed(1) + '%;background:' + col + '"></i></span></span><span class="acc-n"><b class="num">' + pct(sum / T * 100) + '</b><small>' + money(sum) + '</small></span>' + B.CHEV + '</button>';
    if (open) h += '<div class="acc-b">' + gs.map(function (g) { return groupBlock(V, g, T, pre); }).join('') + '</div>';
    return h + '</section>';
  }

  /* ----- hisob umumiy ko'rinishi ----- */
  function accOverview(acc) {
    var s = summary(acc), V = s.V, h = '<div class="stack">';
    h += '<div class="grid2 hm"><section class="card stack"><h2>Hisob holati</h2><div class="stats">' +
      '<div class="stat"><small>Joriy qiymat</small><b>' + money(s.T) + '</b></div><div class="stat"><small>Kiritilgan sof mablag’</small><b>' + money(s.dep) + '</b></div>' +
      '<div class="stat"><small>Foyda</small><b class="' + (s.pl >= 0 ? 'good' : 'bad') + '">' + (s.pl >= 0 ? '+' : '') + money(s.pl) + '</b></div>' +
      '<div class="stat"><small>Omonat bo’lganda qiymat (yillik ' + Core.BENCHC.rate + '%)</small><b>' + money(s.bn) + '</b></div>' +
      '<div class="stat"><small>' + s.q.label + ' foydasi</small><b class="' + (s.q.profit >= 0 ? 'good' : 'bad') + '">' + (s.q.profit >= 0 ? '+' : '') + money(s.q.profit) + '</b></div>' +
      '<div class="stat"><small>Hisob turi</small><b style="font-family:var(--f-body);font-size:16px">' + esc(acc.name) + '</b></div></div>';
    if (s.ratio != null) { var df = (s.ratio - 1) * 100; h += '<p class="muted" style="margin:0">Koeffitsient = joriy qiymat ÷ kiritilgan va yechilgan pullar yillik ' + Core.BENCHC.rate + '% bilan omonatdagidek kunlik hisoblanganda bo’ladigan qiymat (foiz kiritilgan kundan keyingi kundan, yechilgan kun uchun yo’q). ' + s.ratio.toFixed(3) + ' degani portfel omonatdan ' + pct(Math.abs(df)) + (df >= 0 ? ' oldinda.' : ' orqada.') + '</p>'; }
    h += '<div class="lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Tranzaksiyalar o’chirilmaydi: faqat sabab ko’rsatib bekor qilinadi</div></section>';
    if (s.T > 0) { var d = donut(V); h += '<section class="card"><h2>Portfel taqsimoti</h2><p class="sub">Ichkaridan tashqariga: foizli/foizsiz, guruhlar, aktivlar. Ma’lumot uchun bo’lakka yaqinlashing yoki bosing.</p><div style="margin-top:10px" class="ratio-wrap">' + d.svg + '<div class="ratio-c"><b class="num">' + (s.ratio != null ? s.ratio.toFixed(3) : '—') + '</b><span>Portfel koeffitsienti</span></div></div>' + d.legend + '</section></div>'; }
    else h += '<section class="card">' + empty('Hisob hali bo‘sh', 'Depozit kiritilgach, portfel taqsimoti shu yerda ko‘rinadi.') + '</section></div>';
    if (s.T > 0) h += '<div><h2>Portfel tarkibi</h2><p class="sub">Foizsiz va foizli ulushlar. Guruhlari va aktivlarini ko’rish uchun bosing.</p></div><div class="grid2 tc">' + typeCard(V, 'foizsiz', acc.id) + typeCard(V, 'foizli', acc.id) + '</div>';
    return h + '</div>';
  }

  function accSwitch() {
    var l = myAccs(); if (l.length < 2) return '';
    return '<div class="seg" role="group" style="margin-bottom:14px">' + l.map(function (a) { return '<button data-act="pickacc" data-v="' + a.id + '" aria-pressed="' + (B.curAcc() && B.curAcc().id === a.id) + '">' + esc(a.name) + '</button>'; }).join('') + '</div>';
  }
  B.acts.pickacc = function (el) { ST.accId = el.getAttribute('data-v'); };

  /* ----- admin bosh sahifasi: barcha mijozlar va hisoblar ----- */
  function adminHome() {
    var accs = D().accounts.filter(function (a) { return !a.archived; }), rows = accs.map(function (a) { var s = summary(a), u = (D().users || []).filter(function (x) { return x.id === a.uid; })[0]; return { a: a, s: s, u: u }; });
    var tot = rows.reduce(function (t, r) { t.T += r.s.T; t.dep += r.s.dep; return t; }, { T: 0, dep: 0 });
    var h = '<div class="stack"><section class="card"><div class="stats"><div class="stat"><small>Jami boshqaruvdagi mablag‘</small><b>' + money(tot.T) + '</b></div><div class="stat"><small>Jami kiritilgan</small><b>' + money(tot.dep) + '</b></div><div class="stat"><small>Jami foyda</small><b class="' + (tot.T - tot.dep >= 0 ? 'good' : 'bad') + '">' + money(tot.T - tot.dep) + '</b></div><div class="stat"><small>Hisoblar soni</small><b>' + accs.length + '</b></div></div></section>';
    h += '<section class="card"><div class="row sb"><h2>Mijozlar va hisoblar</h2><span class="muted">Qatorni bosing: hisobni ochish</span></div>';
    if (!rows.length) return h + empty('Hali mijozlar yo‘q', 'Mijoz o‘zi “Hisob ochish” orqali ro‘yxatdan o‘tadi. Ular shu yerda paydo bo‘ladi.') + '</section></div>';
    rows.sort(function (x, y) { return y.s.T - x.s.T; });
    h += '<div class="tw"><table><thead><tr><th>Mijoz</th><th>Hisob turi</th><th class="n">Kiritilgan summa</th><th class="n">Joriy qiymat</th><th class="n">Foyda</th><th class="n">Foyda %</th><th class="n">Koeff.</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var pp = r.s.dep > 0 ? r.s.pl / r.s.dep * 100 : null;
      h += '<tr class="rowlink" data-act="openacc" data-v="' + r.a.id + '"><td><b>' + esc(r.a.owner) + '</b><div class="muted mini">' + esc(r.u ? r.u.email : '') + '</div></td><td>' + esc(r.a.name) + '</td><td class="n">' + money(r.s.dep) + '</td><td class="n">' + money(r.s.T) + '</td><td class="n ' + (r.s.pl >= 0 ? 'good' : 'bad') + '">' + (r.s.pl >= 0 ? '+' : '') + money(r.s.pl) + '</td><td class="n ' + (pp == null ? '' : pp >= 0 ? 'good' : 'bad') + '">' + (pp == null ? '—' : sgn(pp, 2)) + '</td><td class="n">' + (r.s.ratio != null ? r.s.ratio.toFixed(3) : '—') + '</td></tr>';
    });
    h += '<tr><td><b>Jami</b></td><td></td><td class="n"><b>' + money(tot.dep) + '</b></td><td class="n"><b>' + money(tot.T) + '</b></td><td class="n"><b>' + money(tot.T - tot.dep) + '</b></td><td></td><td></td></tr>';
    return h + '</tbody></table></div></section></div>';
  }
  B.acts.openacc = function (el) { ST.accId = el.getAttribute('data-v'); ST.tab.acc = 'umumiy'; ST.page = 'bosh'; window.scrollTo(0, 0); };
  B.acts.backacc = function () { ST.accId = null; };

  /* ----- hisob sahifasi (admin/operator) ----- */
  function accPage(acc) {
    var tabs = [['umumiy', 'Umumiy'], ['portfel', 'Portfel'], ['tranz', 'Tranzaksiyalar'], ['ulush', 'Maqsadli ulushlar'], ['kirit', 'Bitim kiritish']], cur = ST.tab.acc || 'umumiy';
    if (B.isAdmin()) tabs.push(['hsoz', 'Hisob sozlamalari']);
    var h = '<div class="stack"><div class="row sb"><div class="row"><button class="btn ghost small" data-act="backacc">← Barcha mijozlar</button><h2>' + esc(acc.owner) + ' · ' + esc(acc.name) + '</h2></div></div>';
    h += '<div class="seg tabs" role="tablist">' + tabs.map(function (t) { return '<button data-act="acctab" data-v="' + t[0] + '" aria-pressed="' + (cur === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (cur === 'umumiy') h += accOverview(acc);
    else if (cur === 'portfel') h += portfelTable(acc);
    else if (cur === 'tranz') h += txTable([acc], true);
    else if (cur === 'ulush') h += targetsView(acc, B.isAdmin());
    else if (cur === 'kirit') h += txForm(acc);
    else if (cur === 'hsoz') h += accSettings(acc);
    return h + '</div>';
  }
  B.acts.acctab = function (el) { ST.tab.acc = el.getAttribute('data-v'); };

  function pageBosh() {
    if (B.isStaff()) { var a = B.curAcc(), bn = B.depBanner ? B.depBanner() : ''; return bn + (a ? accPage(a) : adminHome()); }
    var acc = B.curAcc(); if (!acc) return '<div class="card">' + empty('Hisob topilmadi') + '</div>';
    return accSwitch() + accOverview(acc);
  }

  /* ----- portfel jadvali ----- */
  function portfelTable(acc) {
    var V = B.view(acc), S = B.S(), an = Core.analyze(S, V), T = V.T || 1;
    var h = '<section class="card"><div class="row sb"><h2>Aktivlar</h2><div class="row" role="group">';
    var HELD = V.items.filter(function (i) { return Math.abs(i.qty) > 1e-12; });
    var groups = GKEYS.filter(function (k) { return HELD.some(function (i) { return i.x.group === k; }); });
    h += '<button class="chip" data-act="grp" data-v="all" aria-pressed="' + (!ST.pfGroup || ST.pfGroup === 'all') + '">Hammasi</button>' + groups.map(function (k) { return '<button class="chip" data-act="grp" data-v="' + k + '" aria-pressed="' + (ST.pfGroup === k) + '"><i class="dot" style="background:' + gcol(k) + '"></i>' + GROUPS[k].name + '</button>'; }).join('') + '</div></div>';
    var list = HELD.filter(function (i) { return !ST.pfGroup || ST.pfGroup === 'all' || i.x.group === ST.pfGroup; }).sort(function (x, y) { return y.val - x.val; });
    if (!list.length) return h + empty('Portfel bo‘sh', 'Bu hisobda hali aktiv yo‘q.') + '</section>';
    h += '<div class="tw" style="margin-top:8px"><table><thead><tr><th>Aktiv</th><th class="n">Miqdor</th><th class="n">Narx</th><th class="n">O’rt. olish narxi</th><th class="n">Qiymat</th><th class="n">Ulush</th><th class="n">Maqsad</th><th>Status</th><th class="n">Daromad</th></tr></thead><tbody>';
    list.forEach(function (i) {
      var x = i.x, r = an.assets[x.id], pn = (i.avg && x.price != null) ? (x.price / i.avg - 1) * 100 : null;
      var inc = pn != null ? '<span class="' + (pn >= 0 ? 'good' : 'bad') + '">' + sgn(pn) + '</span>' : (x.rate != null ? '<span>' + pct(x.rate) + ' yillik</span>' : '<span class="muted">—</span>');
      h += '<tr class="rowlink" data-act="assetopen" data-v="' + esc(x.id) + '" data-acc="' + esc(acc.id) + '"><td>' + B.assetCell(x, 34) + '</td><td class="n">' + B.qtyStr(x, i.qty) + '</td><td class="n">' + (x.price == null ? '<span class="bad">narxsiz</span>' : B.pxStr(x, x.price)) + '</td><td class="n">' + (i.avg ? B.pxStr(x, i.avg) : '—') + '</td><td class="n">' + money(i.val) + (i.acr > 0 ? '<div class="muted mini" title="Hali to‘lanmagan, kunlik hisoblangan foiz">shu jumladan foiz ' + B.nf(i.acr, 8) + (ST.cur === 'USD' ? '' : ' so‘m') + '</div>' : '') + '</td><td class="n">' + pct(i.val / T * 100, 2) + '</td><td class="n">' + (r && r.d > 0 ? pct(r.d, 2) + '<div class="muted mini">normal ' + pct(r.n, 1) + '</div>' : '<span class="muted">—</span>') + '</td><td>' + (r && r.status ? pill(r.status) : '') + '</td><td class="n">' + inc + '</td></tr>';
    });
    var tv = 0, ts = 0, td = 0; list.forEach(function (i) { var r = an.assets[i.x.id]; tv += i.val; ts += r ? r.share : 0; td += r ? r.d : 0; });
    h += '</tbody><tfoot><tr><td colspan="4">Jami</td><td class="n">' + money(tv) + '</td><td class="n">' + sumCell(ts) + '</td><td class="n">' + sumCell(td, true) + '</td><td colspan="2"></td></tr></tfoot></table></div>';
    if (ST.pfGroup && ST.pfGroup !== 'all') h += '<p class="muted mini" style="margin:8px 0 0">Tanlangan guruh bo‘yicha yig‘indi. Butun portfel ulushlari jami 100% bo‘ladi.</p>';
    return h + '</section>';
  }
  /* yig'indi katagi: 100% bo'lsa yashil belgi, bo'lmasa farq ko'rsatiladi */
  function sumCell(v, soft) { var ok = Math.abs(v - 100) < 0.005; return '<b class="num">' + pct(v, 2) + '</b>' + (ok ? ' <span class="st good" title="Yig‘indi 100%">✓</span>' : (soft ? '' : ' <span class="muted mini" title="Yig‘indi 100% dan farq">(' + (v - 100 >= 0 ? '+' : '') + (v - 100).toFixed(2) + ')</span>')); }
  B.acts.grp = function (el) { ST.pfGroup = el.getAttribute('data-v'); };
  function pagePortfel() { var acc = B.curAcc(); if (!acc) return ''; return accSwitch() + '<div class="stack">' + portfelTable(acc) + levelCard(acc) + '</div>'; }

  /* ----- guruh va tur darajasidagi statuslar ----- */
  function levelCard(acc) {
    var V = B.view(acc), an = Core.analyze(B.S(), V), rows = [];
    var heldG = {}; V.items.forEach(function (i) { if (Math.abs(i.qty) > 1e-12) heldG[i.x.group] = 1; });
    GKEYS.forEach(function (k) { if (an.groups[k] && an.groups[k].d > 0 && (B.isStaff() || heldG[k])) rows.push({ name: GROUPS[k].name, tag: TYPE_NAME[GROUPS[k].type], col: gcol(k), ic: k, g: an.groups[k] }); });
    ['foizsiz', 'foizli'].forEach(function (t) { if (an.types[t] && an.types[t].d > 0 && (B.isStaff() || GKEYS.some(function (k) { return heldG[k] && GROUPS[k].type === t; }))) rows.push({ name: TYPE_NAME[t], tag: 'Tur', col: tcol(t), ic: t, g: an.types[t] }); });
    if (!rows.length) return '';
    var h = '<section class="card"><h2>Guruhlar va turlar</h2><div class="tw" style="margin-top:8px"><table style="min-width:560px"><thead><tr><th>Nomi</th><th class="n">Ulush</th><th class="n">Normal</th><th class="n" title="Asosiy aktivning 1 haftalik Stoch RSI (K) qiymati">1W Stoch RSI</th><th class="n">Joriy maqsad</th><th class="n">Farq</th><th>Status</th></tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><td><div class="asset-cell">' + B.ico(r.ic, r.col, 32) + '<div><b>' + r.name + '</b><small class="tag">' + r.tag + '</small></div></div></td><td class="n">' + pct(r.g.share, 2) + '</td><td class="n">' + pct(r.g.n, 2) + '</td><td class="n">' + (r.g.m != null ? nf(r.g.m, 2) : (r.g.noStoch ? '<span class="muted" title="Stoch RSI olinmadi: maqsad normalga teng (M=50)">—</span>' : '')) + '</td><td class="n">' + pct(r.g.d, 2) + '</td><td class="n">' + sgn(r.g.farq) + '</td><td>' + pill(r.g.status) + '</td></tr>'; });
    var sd = 0, sn = 0; GKEYS.forEach(function (k) { if (an.groups[k] && (B.isStaff() || heldG[k])) { sd += an.groups[k].d; sn += an.groups[k].n; } });
    return h + '</tbody></table></div><p class="muted mini" style="margin:8px 0 0">Turlar: d = F − (F/3)·SIGN(s)·|s|^1.316, s = (Stoch RSI − 50)/50. Foizli guruhlar: (100 − foizsiz d yig‘indisi) × guruh normali ÷ foizli normallar yig‘indisi.</p></section>';
  }

  /* ----- maqsadli ulushlar ----- */
  function targetsView(acc, editable) {
    var V = B.view(acc), an = Core.analyze(B.S(), V), assets = D().assets.filter(function (x) { return !x.archived && x.group !== 'naqd' || (!x.archived && x.group === 'naqd'); });
    var h = '<div class="stack"><section class="card"><div class="row sb"><h2>Maqsadli ulushlar: aktivlar</h2>' + (editable ? '<button class="btn small" data-act="savetargets" data-v="' + acc.id + '">Saqlash</button>' : '<span class="lock">Faqat admin o‘zgartiradi</span>') + '</div>';
    if (!assets.length) return h + empty('Aktivlar yo‘q', 'Avval Aktivlar sahifasida aktiv qo‘shing.') + '</section></div>';
    h += '<p class="sub">Normal ulush: aktivning odatdagi maqsadli ulushi. “Joriy maqsad”: turning joriy maqsadi (asosiy aktivning 1W Stoch RSI qiymatiga ko‘ra) × aktivning normal ulushi ÷ turning normal ulushi. Pastda har ustun yig‘indisi ko‘rsatiladi (100% bo‘lishi kerak).</p><div class="tw"><table><thead><tr><th>Aktiv</th><th class="n">Standart %</th><th class="n">Bu hisob uchun normal %</th><th class="n">Hozirgi ulush %</th><th class="n">Joriy maqsad %</th><th>Status</th></tr></thead><tbody>';
    assets.forEach(function (x) {
      var r = an.assets[x.id], own = acc.targets && acc.targets[x.id] != null ? acc.targets[x.id] : '', key = 'tg_' + x.id, cur = ST.f[key] != null ? ST.f[key] : own;
      h += '<tr><td>' + B.assetCell(x, 32) + '</td><td class="n">' + nf(x.target || 0, 2) + '</td><td class="n">' + (editable ? '<input type="number" step="0.01" min="0" max="100" style="width:90px" placeholder="' + nf(x.target || 0, 2) + '" data-bind="' + key + '" value="' + esc(cur) + '">' : nf(Core.targetOf(acc, x), 2)) + '</td><td class="n">' + (r ? pct(r.share, 2) : '0%') + '</td><td class="n">' + (r && r.d > 0 ? pct(r.d, 2) : '—') + '</td><td>' + (r && r.status ? pill(r.status) : '') + '</td></tr>';
    });
    var sS = 0, sN = 0, sH = 0, sD = 0;
    assets.forEach(function (x) { var r = an.assets[x.id], own = acc.targets && acc.targets[x.id] != null ? acc.targets[x.id] : '', cur = ST.f['tg_' + x.id] != null ? ST.f['tg_' + x.id] : own, nv = cur !== '' && isFinite(+cur) ? +cur : (x.target || 0); sS += x.target || 0; sN += nv; sH += r ? r.share : 0; sD += r ? r.d : 0; });
    h += '</tbody><tfoot><tr><td>Jami</td><td class="n">' + sumCell(sS) + '</td><td class="n">' + sumCell(sN) + '</td><td class="n">' + sumCell(sH) + '</td><td class="n">' + sumCell(sD) + '</td><td></td></tr></tfoot></table></div></section>' + levelCard(acc) + '</div>';
    return h;
  }
  B.acts.savetargets = function (el) {
    var id = el.getAttribute('data-v'), t = {};
    D().assets.forEach(function (x) { var v = ST.f['tg_' + x.id]; if (v !== undefined) t[x.id] = v; });
    var acc = D().accounts.filter(function (a) { return a.id === id; })[0], merged = Object.assign({}, acc.targets || {}, t);
    Object.keys(t).forEach(function (k) { delete ST.f['tg_' + k]; });
    return B.run(B.api('POST', '/api/accounts/' + id, { targets: merged }), 'Ulushlar saqlandi');
  };
  function accSettings(acc) {
    var s = summary(acc);
    return '<section class="card stack"><h2>Hisob sozlamalari</h2><p class="sub">Xizmat haqi: har chorak foydasining 10%. Foyda = chorak oxiridagi balans − (chorak ichida kiritilgan pul + oldingi chorak oxiridagi balans).</p>' +
      '<div class="stats"><div class="stat"><small>' + s.q.label + ' kiritilgan</small><b>' + money(s.q.inv) + '</b></div><div class="stat"><small>Oldingi chorak oxiri</small><b>' + money(s.q.prev) + '</b></div><div class="stat"><small>Joriy balans</small><b>' + money(s.T) + '</b></div><div class="stat"><small>Chorak foydasi</small><b>' + money(s.q.profit) + '</b></div><div class="stat"><small>Xizmat haqi (10%)</small><b>' + money(s.q.fee) + '</b></div></div>' +
      '<div class="form-grid">' + fld('Oldingi chorak oxiridagi balans (so‘m)', '<input type="number" min="0" data-bind="prevQ_' + acc.id + '" value="' + esc(ST.f['prevQ_' + acc.id] != null ? ST.f['prevQ_' + acc.id] : (acc.prevQ || 0)) + '">') + '</div>' +
      '<div class="row"><button class="btn" data-act="saveprevq" data-v="' + acc.id + '">Saqlash</button></div></section>';
  }
  B.acts.saveprevq = function (el) { var id = el.getAttribute('data-v'); var v = ST.f['prevQ_' + id]; return B.run(B.api('POST', '/api/accounts/' + id, { prevQ: v }), 'Saqlandi'); };

  /* ----- tranzaksiyalar ----- */
  var TLAB = { BUY: 'Xarid', SELL: 'Sotish', DEPOZIT: 'Kiritish', WITHDRAW: 'Yechish', FOIZ: 'Foiz', DIVIDEND: 'Dividend', KUPON: 'Kupon', TRANSFER: 'O‘tkazma' };
  B.TLAB = TLAB;
  function txRow(t, am, showOwner, accOf) {
    var x = am[t.aid]; if (!x) return '';
    var total = (t.type === 'BUY' || t.type === 'SELL' || t.type === 'DEPOZIT' || t.type === 'WITHDRAW' || t.type === 'KUPON') ? t.amount * (t.price || (t.type === 'KUPON' ? 1 : 0)) : null;
    var voided = t.status !== 'Bajarildi', to = t.to ? am[t.to] : null;
    var tot = t.type === 'TRANSFER' ? '→ ' + nf(t.toAmount) + ' ' + esc(to ? to.sym : '') + (t.fee ? ' <small class="muted">· kom. ' + nf(t.fee) + ' ' + esc(x.sym) + '</small>' : '') : (total != null ? nf(total) + ' ' + x.curr : '—');
    var st = Core.settleAsset(B.S(), x, t), sx = (t.type === 'BUY' || t.type === 'SELL') && t.cash !== false && st ? st.sym : '';
    return '<tr' + (voided ? ' style="opacity:.55"' : '') + '><td class="mono">' + t.id + '</td>' + (showOwner ? '<td>' + esc(accOf[t.acc] ? accOf[t.acc].owner : '') + '</td>' : '') + '<td>' + B.assetCell(x, 32, t.type === 'BUY' ? 'buy' : t.type === 'SELL' ? 'sell' : (t.type === 'FOIZ' || t.type === 'KUPON' || t.type === 'DIVIDEND') ? 'inc' : '') + '</td><td class="nowrap">' + fdt(t.t) + '</td><td><span class="ty ' + (t.type === 'BUY' ? 'buy' : t.type === 'SELL' ? 'sell' : (t.type === 'FOIZ' || t.type === 'KUPON' || t.type === 'DIVIDEND') ? 'inc' : '') + '"><b>' + (TLAB[t.type] || t.type) + '</b></span></td><td class="n">' + (t.price != null ? nf(t.price) : '—') + '</td><td class="n">' + B.qtyStr(x, t.amount) + '</td><td class="n">' + tot + (sx ? '<div class="muted mini">' + esc(sx) + ' hisobiga</div>' : (t.cash === false && (t.type === 'BUY' || t.type === 'SELL') ? '<div class="muted mini">naqdga ta’sirsiz</div>' : '')) + '</td><td class="n">' + (t.fee ? nf(t.fee) : '—') + '</td><td>' + esc(t.feeAsset || '') + '</td><td>' + esc(t.ex || '') + '</td><td>' + esc(t.chan || '') + '</td><td>' + esc(t.by || '') + '</td><td>' + (voided ? '<span class="st no" title="' + esc(t.voidReason || '') + '">Bekor qilingan</span>' : '<span class="st ok">Bajarildi</span>') + (t.edits ? ' <span class="badge" title="' + esc(t.edits.map(function (e) { return fdt(e.t) + ' ' + e.by + ': ' + e.reason; }).join('\n')) + '">tahrirlangan</span>' : '') + (t.note ? '<div class="muted mini">' + esc(t.note) + '</div>' : '') + '</td>' +
      (B.isAdmin() ? '<td class="nowrap">' + (voided ? '' : '<button class="btn ghost small" data-act="edittx" data-v="' + t.id + '">Tahrirlash</button> <button class="btn ghost small" data-act="voidtx" data-v="' + t.id + '">Bekor qilish</button>') + '</td>' : '') + '</tr>';
  }
  function localInput(ms) { var d = new Date(ms), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  B.acts.edittx = function (el) {
    var t = D().tx.filter(function (x) { return x.id === el.getAttribute('data-v'); })[0]; ST.editTx = t.id;
    Object.keys(ST.f).forEach(function (k) { if (k.indexOf('ed_') === 0) delete ST.f[k]; });
    Object.assign(ST.f, { ed_t: localInput(t.t), ed_amount: t.amount, ed_price: t.price, ed_fee: t.fee || '', ed_feeAsset: t.feeAsset || '', ed_ex: t.ex || '', ed_note: t.note || '', ed_toAmount: t.toAmount || '', ed_nocash: t.cash === false, ed_settle: t.settle || '' });
    window.scrollTo(0, 0);
  };
  B.acts.canceledit = function () { ST.editTx = null; };
  function editBox() {
    var id = ST.editTx; if (!id || !B.isAdmin()) return '';
    var t = D().tx.filter(function (x) { return x.id === id; })[0]; if (!t) return '';
    var x = Core.assetMap(B.S())[t.aid], f = ST.f, naqd = D().assets.filter(function (a) { return a.group === 'naqd' && !a.archived; });
    return '<section class="card stack" style="border-color:var(--accent)"><h2>Tranzaksiyani tahrirlash: ' + t.id + ' · ' + esc(x ? x.sym : '') + ' ' + (TLAB[t.type] || t.type) + '</h2><p class="sub">Eski qiymatlar saqlanib qoladi va jurnalga yoziladi. Tur, aktiv va hisobni o‘zgartirib bo‘lmaydi: bunday holda tranzaksiyani bekor qilib, yangisini kiriting.</p><form data-form="txedit" class="stack"><div class="form-grid">' +
      fld('Sana va vaqt', '<input type="datetime-local"' + bind('ed_t', '') + '>') + fld('Miqdor', '<input type="number" step="any" min="0"' + bind('ed_amount') + '>') + fld('Narx', '<input type="number" step="any" min="0"' + bind('ed_price') + '>') +
      (t.type === 'TRANSFER' ? fld('Qabul qilingan miqdor', '<input type="number" step="any" min="0"' + bind('ed_toAmount') + '>') : '') + fld('Komissiya', '<input type="number" step="any" min="0"' + bind('ed_fee') + '>') + fld('Komissiya aktivi', '<input type="text"' + bind('ed_feeAsset') + '>') + fld('Exchange', '<input type="text"' + bind('ed_ex') + '>') + fld('Izoh', '<input type="text"' + bind('ed_note') + '>') +
      ((t.type === 'BUY' || t.type === 'SELL' || t.type === 'KUPON') ? fld('Hisob-kitob aktivi', sel('ed_settle', [['', 'Avto (qoida bo‘yicha)']].concat(naqd.map(function (a) { return [a.id, a.sym]; })), '')) : '') +
      fld('O‘zgartirish sababi (majburiy)', '<input type="text"' + bind('ed_reason') + '>') + '</div>' +
      ((t.type === 'BUY' || t.type === 'SELL') ? '<label class="switch"><input type="checkbox" data-bind="ed_nocash"' + (f.ed_nocash ? ' checked' : '') + '> Naqd aktivga ta’sir qilmasin</label>' : '') +
      '<div class="row"><button class="btn" type="submit">Saqlash</button><button type="button" class="btn ghost" data-act="canceledit">Bekor</button></div></form></section>';
  }
  B.forms.txedit = function () {
    var f = ST.f, id = ST.editTx, t = D().tx.filter(function (x) { return x.id === id; })[0];
    var body = { t: f.ed_t ? new Date(f.ed_t).getTime() : t.t, amount: f.ed_amount, price: f.ed_price, fee: f.ed_fee, feeAsset: f.ed_feeAsset, ex: f.ed_ex, note: f.ed_note, reason: f.ed_reason, settle: f.ed_settle || '', cash: f.ed_nocash ? false : true };
    if (t.type === 'TRANSFER') body.toAmount = f.ed_toAmount;
    return B.run(B.api('POST', '/api/tx/' + id + '/edit', body), 'Tranzaksiya yangilandi').then(function () { ST.editTx = null; B.rerender(); });
  };
  function txTable(accs, showOwner) {
    var ids = {}, accOf = {}; accs.forEach(function (a) { ids[a.id] = 1; accOf[a.id] = a; });
    var am = Core.assetMap(B.S()), f = ST.f, q = (f.txq || '').toLowerCase(), ty = f.txtype || 'all';
    var list = D().tx.filter(function (t) { return ids[t.acc] && (ty === 'all' || t.type === ty) && (!q || (t.id + ' ' + (am[t.aid] ? am[t.aid].sym : '') + ' ' + (t.by || '') + ' ' + (t.ex || '') + ' ' + (t.note || '')).toLowerCase().indexOf(q) >= 0); }).sort(function (a, b) { return b.t - a.t; });
    var h = editBox() + '<section class="card"><div class="row sb"><h2>Tranzaksiyalar tarixi</h2><div class="row"><input type="text" placeholder="Qidirish: ID, aktiv, birja…"' + bind('txq', ' data-live="1"') + ' style="width:220px">' + sel('txtype', [['all', 'Barcha turlar']].concat(Core.TYPES.map(function (x) { return [x, TLAB[x]]; })), 'all') + '</div></div>';
    if (!list.length) return h + empty('Tranzaksiya yo‘q', D().tx.length ? 'Filtrga mos yozuv topilmadi.' : 'Depozit yoki bitim kiritilgach shu yerda ko‘rinadi.') + '</section>';
    h += '<div class="tw" style="margin-top:8px"><table style="min-width:1100px"><thead><tr><th>ID</th>' + (showOwner ? '<th>Mijoz</th>' : '') + '<th>Aktiv</th><th>Sana</th><th>Tur</th><th class="n">Price</th><th class="n">Amount</th><th class="n">Total</th><th class="n">Fee</th><th>Fee aktiv</th><th>Exchange</th><th>Kanal</th><th>Bajaruvchi</th><th>Holat</th>' + (B.isAdmin() ? '<th></th>' : '') + '</tr></thead><tbody>';
    list.slice(0, 300).forEach(function (t) { h += txRow(t, am, showOwner, accOf); });
    return h + '</tbody></table></div>' + (list.length > 300 ? '<p class="muted">Eng so‘nggi 300 ta yozuv ko‘rsatildi (jami ' + list.length + '). To‘liq ro‘yxat uchun Hisobotlar sahifasidan xlsx yuklab oling.</p>' : '') + '</section>';
  }
  B.acts.voidtx = function (el) {
    var id = el.getAttribute('data-v'), r = prompt('Tranzaksiyani bekor qilish sababi (o‘chirilmaydi, "Bekor qilingan" deb belgilanadi):'); if (!r) return false;
    return B.run(B.api('POST', '/api/tx/' + id + '/void', { reason: r }), 'Bekor qilindi');
  };

  /* umumiy bitimlar (admin): bir xil bitim barcha mijozlardagi yozuvlari bilan */
  function blocks() {
    var m = {}, list = [];
    D().tx.forEach(function (t) { if (t.type === 'DEPOZIT' || t.type === 'WITHDRAW') return; var b = m[t.blk]; if (!b) { b = m[t.blk] = { id: t.blk, aid: t.aid, type: t.type, t: t.t, price: t.price, ex: t.ex, chan: t.chan, by: t.by, status: t.status, feeAsset: t.feeAsset, amount: 0, fee: 0, legs: [] }; list.push(b); } if (t.status === 'Bajarildi') { b.amount += t.amount; b.fee += t.fee || 0; } b.legs.push(t); });
    return list.sort(function (x, y) { return y.t - x.t; });
  }
  function pageTranzAdmin() {
    var am = Core.assetMap(B.S()), accOf = {}; D().accounts.forEach(function (a) { accOf[a.id] = a; });
    var q = (ST.f.txq || '').toLowerCase(), ty = ST.f.txtype || 'all';
    var list = blocks().filter(function (b) { var x = am[b.aid]; return (ty === 'all' || b.type === ty) && (!q || (b.id + ' ' + (x ? x.sym : '') + ' ' + (b.by || '') + ' ' + (b.ex || '')).toLowerCase().indexOf(q) >= 0); });
    var h = '<div class="stack"><section class="card"><div class="row sb"><h2>Umumiy bitimlar</h2><div class="row"><input type="text" placeholder="Qidirish…"' + bind('txq', ' data-live="1"') + ' style="width:200px">' + sel('txtype', [['all', 'Barcha turlar']].concat(['BUY', 'SELL', 'FOIZ', 'DIVIDEND', 'KUPON', 'TRANSFER'].map(function (x) { return [x, TLAB[x]]; })), 'all') + '</div></div><p class="sub">Bitta bitim barcha mijozlardagi yozuvlari bilan birga. Qatorni bosib, mijozlar bo‘yicha taqsimotni ko‘ring. Depozit va yechishlar Mijozlar → hisob → Tranzaksiyalarda.</p>';
    if (!list.length) return h + empty('Bitimlar yo‘q', 'Avto savdo orderi bajarilganda yoki bitim kiritilganda shu yerda ko‘rinadi.') + '</section></div>';
    h += '<div class="tw"><table style="min-width:900px"><thead><tr><th></th><th>Bitim ID</th><th>Aktiv</th><th>Sana</th><th>Tur</th><th class="n">Price</th><th class="n">Amount</th><th class="n">Fee</th><th>Exchange</th><th>Kanal</th><th>Bajaruvchi</th><th>Holat</th></tr></thead><tbody>';
    list.slice(0, 200).forEach(function (b) {
      var x = am[b.aid]; if (!x) return; var open = !!ST.open['blk' + b.id];
      h += '<tr data-act="tog" data-v="blk' + b.id + '" class="rowlink"><td>' + B.CHEV.replace('class="chev"', 'class="chev" style="transform:rotate(' + (open ? 180 : 0) + 'deg)"') + '</td><td class="mono">' + b.id + '</td><td>' + B.assetCell(x, 32, b.type === 'BUY' ? 'buy' : b.type === 'SELL' ? 'sell' : '') + '</td><td class="nowrap">' + fdt(b.t) + '</td><td><span class="ty ' + (b.type === 'BUY' ? 'buy' : b.type === 'SELL' ? 'sell' : '') + '"><b>' + TLAB[b.type] + '</b></span></td><td class="n">' + nf(b.price) + '</td><td class="n">' + B.qtyStr(x, b.amount) + '</td><td class="n">' + (b.fee ? nf(b.fee) + ' ' + esc(b.feeAsset || '') : '—') + '</td><td>' + esc(b.ex) + '</td><td>' + esc(b.chan) + '</td><td>' + esc(b.by) + '</td><td>' + b.legs.length + ' ta hisob</td></tr>';
      if (open) {
        h += '<tr class="det"><td colspan="12"><table style="min-width:600px"><thead><tr><th>Mijoz</th><th>ID</th><th class="n">Amount</th><th class="n">Fee</th><th>Holat</th><th></th></tr></thead><tbody>';
        b.legs.forEach(function (t) { h += '<tr><td>' + esc(accOf[t.acc] ? accOf[t.acc].owner : '') + '</td><td class="mono">' + t.id + '</td><td class="n">' + B.qtyStr(x, t.amount) + '</td><td class="n">' + (t.fee ? nf(t.fee) : '—') + '</td><td>' + (t.status === 'Bajarildi' ? '<span class="st ok">Bajarildi</span>' : '<span class="st no">Bekor qilingan</span>') + '</td><td>' + (t.status === 'Bajarildi' ? '<button class="btn ghost small" data-act="voidtx" data-v="' + t.id + '">Bekor qilish</button>' : '') + '</td></tr>'; });
        h += '</tbody></table></td></tr>';
      }
    });
    return h + '</tbody></table></div></section></div>';
  }
  function pageTranz() {
    if (B.isAdmin()) return pageTranzAdmin();
    if (B.isStaff()) { var all = D().accounts; return '<div class="stack">' + txTable(all, true) + '</div>'; }
    var acc = B.curAcc(); if (!acc) return '';
    return accSwitch() + txTable([acc], false);
  }

  /* ----- bitim kiritish (admin/operator) ----- */
  function txAssets() { return D().assets.filter(function (x) { return !x.archived; }).sort(function (a, b) { return (b.group === 'naqd') - (a.group === 'naqd'); }); }
  function defAid(type) { var l = txAssets(), c = Core.cashAsset(B.S()); if ((type === 'DEPOZIT' || type === 'WITHDRAW') && c) return c.id; var nc = l.filter(function (a) { return a.group !== 'naqd'; })[0]; return (nc || l[0]).id; }
  function txForm(acc) {
    var assets = txAssets();
    if (!assets.length) return '<section class="card">' + empty('Aktivlar yo‘q', 'Avval “Aktivlar” sahifasida aktiv qo‘shing (masalan, naqd so‘m UZS).') + '</section>';
    var k = 'tx_', type = ST.f[k + 'type'] || 'DEPOZIT', aid = ST.f[k + 'aid'] || defAid(type), x = assets.filter(function (a) { return a.id === aid; })[0] || assets[0];
    var pr = ST.f[k + 'price'] != null ? ST.f[k + 'price'] : (x.price != null ? x.price : '');
    var hint = type === 'DEPOZIT' ? 'Mijoz hisobiga pul kiritish: aktiv sifatida naqd so‘m (UZS) ni tanlang, miqdorni so‘mda yozing, narx 1.' : type === 'BUY' ? 'Aktiv sotib olish. Pul savdo juftligi aktividan ayriladi (masalan BTC/USDT bo‘lsa USDT dan). Komissiya bo‘sh qolsa avtomatik hisoblanadi.' : type === 'SELL' ? 'Aktiv sotish. Tushum savdo juftligi aktiviga qo‘shiladi (masalan USDT).' : type === 'WITHDRAW' ? 'Hisobdan pul chiqarish.' : 'Foiz, dividend yoki kupon: miqdorni kiriting.';
    return '<section class="card stack"><h2>Bitim kiritish: ' + esc(acc.owner) + ' · ' + esc(acc.name) + '</h2><p class="sub">' + hint + '</p><form data-form="txadd" class="stack"><div class="form-grid">' +
      fld('Aktiv', sel(k + 'aid', assets.map(function (a) { return [a.id, a.sym + ' — ' + a.name]; }), aid)) + fld('Tur', sel(k + 'type', Core.TYPES.filter(function (t) { return t !== 'TRANSFER'; }).map(function (t) { return [t, TLAB[t]]; }), type)) +
      fld('Sana va vaqt', '<input type="datetime-local"' + bind(k + 't', '') + '>') + fld('Miqdor (' + esc(x.sym) + ')', '<input type="number" step="any" min="0"' + bind(k + 'amount') + '>') +
      fld('Narx (' + x.curr + ')', '<input type="number" step="any" min="0" data-bind="' + k + 'price" value="' + esc(pr) + '">') + fld('Komissiya (bo‘sh = avto)', '<input type="number" step="any" min="0"' + bind(k + 'fee') + '>') +
      fld('Komissiya aktivi', '<input type="text" placeholder="USDT, UZS…"' + bind(k + 'feeAsset') + '>') + fld('Izoh', '<input type="text"' + bind(k + 'note') + '>') +
      ((type === 'BUY' || type === 'SELL' || type === 'KUPON') ? fld('Hisob-kitob aktivi (qaysi naqddan ayriladi / qo‘shiladi)', sel(k + 'settle', [['', 'Avto: ' + ((Core.settleAsset(B.S(), x, null) || {}).sym || 'yo‘q')]].concat(D().assets.filter(function (a) { return a.group === 'naqd' && !a.archived; }).map(function (a) { return [a.id, a.sym]; })), '')) : '') +
      '</div><label class="switch"><input type="checkbox" data-bind="' + k + 'nocash"' + (ST.f[k + 'nocash'] ? ' checked' : '') + '> Naqd aktivga ta’sir qilmasin (BUY/SELL)</label><div class="row"><button class="btn" type="submit">Qo‘shish</button><span class="muted">Yozuv keyin o‘chirilmaydi, faqat sabab bilan bekor qilinadi.</span></div></form></section>';
  }
  B.onbind['tx_aid'] = function () { delete ST.f.tx_price; B.rerender(); };
  B.onbind['tx_type'] = function () { delete ST.f.tx_aid; delete ST.f.tx_price; B.rerender(); };
  B.forms.txadd = function () {
    var f = ST.f, acc = B.curAcc(); if (!acc) return;
    var t = f.tx_t ? new Date(f.tx_t).getTime() : Date.now(), assets = D().assets, aid = f.tx_aid || defAid(f.tx_type || 'DEPOZIT'), x = assets.filter(function (a) { return a.id === aid; })[0];
    var price = f.tx_price != null && f.tx_price !== '' ? f.tx_price : (x.price != null ? x.price : '');
    var body = { acc: acc.id, aid: aid, type: f.tx_type || 'DEPOZIT', t: t, amount: f.tx_amount, price: price, fee: f.tx_fee, feeAsset: f.tx_feeAsset, note: f.tx_note, cash: f.tx_nocash ? false : undefined, settle: f.tx_settle || undefined };
    return B.run(B.api('POST', '/api/tx', body), 'Tranzaksiya qo‘shildi').then(function () { ['amount', 'fee', 'feeAsset', 'note', 't', 'price', 'settle'].forEach(function (k) { delete ST.f['tx_' + k]; }); B.rerender(); });
  };

  Object.assign(B.pages, { bosh: pageBosh, portfel: pagePortfel, tranz: pageTranz });
  B.targetsView = targetsView; B.levelCard = levelCard;
})(window.B);
