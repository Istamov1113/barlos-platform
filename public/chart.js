/* BARLOS superchart: TradingView uslubidagi chart (lightweight-charts asosida).
   - shamlar server orqali aktivning narx manbasidan (Bitget / Yahoo / Stooq / uzse.uz tarixi / o'z narx tarixi)
   - indikatorlar: EMA, SMA, Bollinger, RSI, MACD, Stoch RSI, Volume, admin uchun "BB (AlgoAlpha copy)" va Custom (JS);
     har biri uchun Inputs / Style / Visibility / Source code oynasi, yashirish, o'chirish
   - chizish asboblari, alertlar (server tekshiradi, signal Avto savdoga boradi), seans yopilishigacha hisoblagich
   - hammasi foydalanuvchi akkauntida saqlanadi */
(function () {
  'use strict';
  var B = window.B, LW = window.LightweightCharts, Ind = window.Ind;
  if (!B || !LW || !Ind) return;
  var TZ = -new Date().getTimezoneOffset() * 60;
  function toD(t) { return t + TZ; } function fromD(t) { return t - TZ; }
  var TFL = ['1m', '5m', '15m', '1h', '4h', 'D', 'W', 'M'], TFSEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, 'D': 86400, 'W': 604800, 'M': 2592000 };
  var esc = B.esc;
  var SRC = [['close', 'Close'], ['open', 'Open'], ['high', 'High'], ['low', 'Low'], ['hl2', 'HL2'], ['hlc3', 'HLC3'], ['ohlc4', 'OHLC4']];
  var PINE = {
    ema: '//@version=5\nindicator("EMA", overlay=true)\nlen = input.int(20, "Uzunlik")\nsrc = input(close, "Manba")\nplot(ta.ema(src, len), "EMA", color=#f5a623, linewidth=2)',
    sma: '//@version=5\nindicator("SMA", overlay=true)\nlen = input.int(50, "Uzunlik")\nsrc = input(close, "Manba")\nplot(ta.sma(src, len), "SMA", color=#2962ff)',
    bb: '//@version=5\nindicator("Bollinger Bands", overlay=true)\nlen = input.int(20, "Uzunlik")\nmult = input.float(2.0, "Ko‘paytirgich")\nsrc = input(close, "Manba")\nbasis = ta.sma(src, len)\ndev = mult * ta.stdev(src, len)\nplot(basis, "Asos", color=#ff6d00)\nu = plot(basis + dev, "Yuqori", color=#2962ff)\nl = plot(basis - dev, "Quyi", color=#2962ff)\nfill(u, l, color=color.new(#2962ff, 91))',
    rsi: '//@version=5\nindicator("RSI")\nlen = input.int(14, "Uzunlik")\nsrc = input(close, "Manba")\nplot(ta.rsi(src, len), "RSI", color=#7e57c2)\nhline(70)\nhline(50)\nhline(30)',
    macd: '//@version=5\nindicator("MACD")\nfast = input.int(12)\nslow = input.int(26)\nsig = input.int(9)\nsrc = input(close)\n[m, s, h] = ta.macd(src, fast, slow, sig)\nplot(h, "Gistogramma", style=plot.style_columns)\nplot(m, "MACD", color=#2962ff)\nplot(s, "Signal", color=#ff6d00)',
    stochrsi: '//@version=5\nindicator("Stochastic RSI")\nrl = input.int(14, "RSI uzunligi")\nsl = input.int(14, "Stoch uzunligi")\nkk = input.int(3, "K")\ndd = input.int(3, "D")\nr = ta.rsi(close, rl)\nk = ta.sma(ta.stoch(r, r, r, sl), kk)\nd = ta.sma(k, dd)\nplot(k, "%K", color=#2962ff)\nplot(d, "%D", color=#ff6d00)\nhline(80)\nhline(20)',
    vol: '//@version=5\nindicator("Volume")\nplot(volume, style=plot.style_columns, color=close >= open ? color.teal : color.red)',
    algobb: '//@version=5\nindicator("BB (AlgoAlpha copy)", overlay=true)\n\n//====================\n// INPUTS\n//====================\nlength = input.int(20,"BB Length")\nsrc = input(close,"Source")\n\nmultSignal = 2.0\nmultZone   = 3.0\n\n// EMA inputs\nema1_len = input.int(14,  "EMA 1 Length")\nema2_len = input.int(20,  "EMA 2 Length")\nema3_len = input.int(50,  "EMA 3 Length")\nema4_len = input.int(200, "EMA 4 Length")\n\n// EMA visual settings\nshowFill      = input.bool(true, "Show EMA Fill")\nbullColor     = input.color(color.new(color.green, 80), "Bullish Fill Color")\nbearColor     = input.color(color.new(color.red, 80), "Bearish Fill Color")\n\nemaBullColor  = input.color(color.green, "EMA Bull Color")\nemaBearColor  = input.color(color.red,   "EMA Bear Color")\n\n//====================\n// BOLLINGER\n//====================\nbasis = ta.sma(src,length)\ndev   = ta.stdev(src,length)\n\nupper2 = basis + multSignal * dev\nlower2 = basis - multSignal * dev\n\nupper25 = basis + multZone * dev\nlower25 = basis - multZone * dev\n\nupper1 = close + 0.05 * close\nlower1 = close - 0.05 * close\n\nstdL = close > lower1\nstdS = close < upper1\n\nbbpct = 100 * (src - lower2) / (upper2 - lower2)\n\nbuySignal  = ta.crossover(bbpct,0)  and stdL\nsellSignal = ta.crossunder(bbpct,100) and stdS\n\n//====================\n// EMA CALCULATION\n//====================\nema1 = ta.ema(close, ema1_len)\nema2 = ta.ema(close, ema2_len)\nema3 = ta.ema(close, ema3_len)\nema4 = ta.ema(close, ema4_len)\n\n//====================\n// TREND LOGIC\n//====================\nemaTrendUp = ema1 > ema2\n\nemaColor = emaTrendUp ? emaBullColor : emaBearColor\nfillColor = emaTrendUp ? bullColor : bearColor\n\n//====================\n// PLOTS\n//====================\n\n// Invisible 2x bands\nu2 = plot(upper2,color=color.new(color.red,100))\nl2 = plot(lower2,color=color.new(color.yellow,100))\n\n// Visible 2.5x bands\nu25 = plot(upper25,color=color.red)\nl25 = plot(lower25,color=color.yellow)\n\n// Fill zones\nfill(u2,u25,color.new(color.red,85))\nfill(l2,l25,color.new(color.yellow,85))\n\n// EMA plots\np1 = plot(ema1, color=emaColor, title="EMA 1", linewidth=2)\np2 = plot(ema2, color=emaColor, title="EMA 2", linewidth=2)\n\n// EMA Fill\nfill(p1, p2, color = showFill ? fillColor : na)\n\n// Other EMAs\nplot(ema3, color=color.yellow, title="EMA 3")\nplot(ema4, color=color.green, title="EMA 4")\n\n// Signals\nplotshape(buySignal, location=location.belowbar, style=shape.triangleup, size=size.small, color=color.yellow, title="Buy")\nplotshape(sellSignal, location=location.abovebar, style=shape.triangledown, size=size.small, color=color.red, title="Sell")'
  };
  var LEVEL = function (k, label, c) { return { k: k, label: label, c: c || '#787b86', w: 1, ls: 2 }; };
  var CAT = {
    ema: { name: 'EMA', def: { len: 20, src: 'close' }, inputs: [['len', 'Uzunlik', 'n'], ['src', 'Manba', 's']], lines: [{ k: 'l', label: 'EMA', c: '#f5a623', w: 2 }] },
    sma: { name: 'SMA', def: { len: 50, src: 'close' }, inputs: [['len', 'Uzunlik', 'n'], ['src', 'Manba', 's']], lines: [{ k: 'l', label: 'SMA', c: '#2962ff', w: 2 }] },
    bb: { name: 'Bollinger Bands', def: { len: 20, mult: 2, src: 'close' }, inputs: [['len', 'Uzunlik', 'n'], ['mult', 'Ko‘paytirgich (StdDev)', 'n'], ['src', 'Manba', 's']], lines: [{ k: 'basis', label: 'Asos', c: '#ff6d00', w: 1 }, { k: 'upper', label: 'Yuqori', c: '#2962ff', w: 1 }, { k: 'lower', label: 'Quyi', c: '#2962ff', w: 1 }, { k: 'fill', label: 'Fon', c: '#2962ff', a: 0.09, fill: true }] },
    rsi: { name: 'RSI', def: { len: 14, ob: 70, os: 30, src: 'close' }, inputs: [['len', 'Uzunlik', 'n'], ['ob', 'Yuqori chiziq', 'n'], ['os', 'Quyi chiziq', 'n'], ['src', 'Manba', 's']], lines: [{ k: 'l', label: 'RSI', c: '#7e57c2', w: 1.5 }, LEVEL('hi', 'Yuqori chiziq'), LEVEL('mid', 'O‘rta (50)', '#4a4e5a'), LEVEL('lo', 'Quyi chiziq')] },
    macd: { name: 'MACD', def: { fast: 12, slow: 26, sig: 9, src: 'close' }, inputs: [['fast', 'Tez uzunlik', 'n'], ['slow', 'Sekin uzunlik', 'n'], ['sig', 'Signal uzunligi', 'n'], ['src', 'Manba', 's']], lines: [{ k: 'hist', label: 'Gistogramma', c: '#26a69a', w: 1 }, { k: 'macd', label: 'MACD', c: '#2962ff', w: 1.5 }, { k: 'signal', label: 'Signal', c: '#ff6d00', w: 1.5 }] },
    stochrsi: { name: 'Stoch RSI', def: { rl: 14, sl: 14, k: 3, d: 3, src: 'close' }, inputs: [['rl', 'RSI uzunligi', 'n'], ['sl', 'Stoch uzunligi', 'n'], ['k', 'K silliqlash', 'n'], ['d', 'D silliqlash', 'n'], ['src', 'Manba', 's']], lines: [{ k: 'k', label: '%K', c: '#2962ff', w: 1.5 }, { k: 'd', label: '%D', c: '#ff6d00', w: 1.5 }, LEVEL('hi', 'Yuqori (80)'), LEVEL('lo', 'Quyi (20)')] },
    vol: { name: 'Hajm (Volume)', def: {}, inputs: [], lines: [{ k: 'up', label: 'O‘suvchi', c: '#26a69a', w: 1 }, { k: 'dn', label: 'Tushuvchi', c: '#ef5350', w: 1 }], single: true },
    algobb: { name: 'BB (AlgoAlpha copy)', admin: true, single: true, def: { len: 20, e1: 14, e2: 20, e3: 50, e4: 200, fill: true }, inputs: [['len', 'BB uzunligi', 'n'], ['e1', 'EMA 1', 'n'], ['e2', 'EMA 2', 'n'], ['e3', 'EMA 3', 'n'], ['e4', 'EMA 4', 'n'], ['fill', 'EMA to‘ldirish', 'b']],
      lines: [{ k: 'u3', label: 'Yuqori chiziq (3σ)', c: '#ff0000', w: 1 }, { k: 'l3', label: 'Quyi chiziq (3σ)', c: '#ffeb3b', w: 1 }, { k: 'bull', label: 'EMA 1/2 (o‘sish)', c: '#26a69a', w: 2 }, { k: 'bear', label: 'EMA 1/2 (tushish)', c: '#ef5350', w: 2 }, { k: 'e3', label: 'EMA 3', c: '#ffeb3b', w: 1.2 }, { k: 'e4', label: 'EMA 4', c: '#4caf50', w: 1.2 },
        { k: 'zu', label: 'Yuqori zona fon', c: '#ff0000', a: 0.16, fill: true }, { k: 'zl', label: 'Quyi zona fon', c: '#ffeb3b', a: 0.16, fill: true }, { k: 'buy', label: 'BUY belgisi', c: '#ffeb3b', mark: true }, { k: 'sell', label: 'SELL belgisi', c: '#ef5350', mark: true }] },
    custom: { name: 'Custom (JS)', admin: true, def: { code: '' }, inputs: [], lines: [], custom: true }
  };
  var CUSTOM_TPL = '// c.time, c.open, c.high, c.low, c.close, c.volume (massivlar). H: sma, ema, rsi, stdev, bb, macd, stochrsi, srcArr\n// Qaytaring: [{ name, color, width, pane: 0 (chart ustida) yoki 1 (alohida panel), data: [..] }]\nvar f = H.ema(c.close, 9), s = H.ema(c.close, 21);\nreturn [\n  { name: \'EMA 9\', color: \'#00e5ff\', width: 2, pane: 0, data: f },\n  { name: \'EMA 21\', color: \'#ff4081\', width: 2, pane: 0, data: s }\n];';
  var COLORS = ['#2962ff', '#f23645', '#089981', '#ff9800', '#9c27b0', '#e0e0e0'];
  var TOOLS = [['cursor', 'Kursor', '<path d="M5 3l14 7-6 2-2 6z"/>'], ['trend', 'Trend chizig‘i', '<path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/>'],
    ['ray', 'Nur', '<path d="M4 17L21 6"/><circle cx="4" cy="17" r="1.6"/><path d="M17 5l4 1-2 3"/>'], ['hline', 'Gorizontal chiziq', '<path d="M3 12h18"/><circle cx="12" cy="12" r="1.6"/>'],
    ['vline', 'Vertikal chiziq', '<path d="M12 3v18"/><circle cx="12" cy="12" r="1.6"/>'], ['rect', 'To‘rtburchak', '<rect x="5" y="7" width="14" height="10" rx="1"/>'],
    ['fib', 'Fibonachchi', '<path d="M3 5h18M3 10h18M3 15h18M3 20h18"/>'], ['text', 'Matn', '<path d="M6 6h12M12 6v13M9 19h6"/>']];
  var NPTS = { trend: 2, ray: 2, hline: 1, vline: 1, rect: 2, fib: 2, text: 1 };
  var FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  var CH = { aid: null, tf: 'D', ind: [], draw: [], tool: 'cursor', sel: null, theme: 'dark', log: false, magnet: false, hide: false, color: '#2962ff', data: [], disp: [], tmap: {}, live: [], series: [], prims: [], root: null, chart: null, candle: null, vol: null, pend: null, mouse: null, vr: null, loaded: false, busy: false, drag: null, popOpen: false, meta: null, uid: 1, modal: null, alerts: [], alog: [], rule: null, cerr: {}, vals: [] };
  B.CH = CH;
  var CS0 = { type: 'candles', body: true, bord: true, wick: true, cu: '#26a69a', cd: '#ef5350', bu: '#26a69a', bd: '#ef5350', wu: '#26a69a', wd: '#ef5350', prec: 'auto', tz: 'local',
    st: { title: true, ohlc: true, chg: true, sess: true, ind: true, vals: true }, sc: { mode: 'normal', auto: true, inv: false, last: true, lline: true, prev: false, cd: true, top: 8, bot: 8 },
    gv: true, gh: true, cm: 'normal', cl: 0, cc: '', bg: '', tx: '', gc: '', wm: false };
  var TZV = { utc: 0, tash: 18000, msk: 10800, dxb: 14400, bj: 28800 }, TZN = [['local', 'Kompyuter vaqti'], ['tash', 'Toshkent (UTC+5)'], ['utc', 'UTC'], ['msk', 'Moskva (UTC+3)'], ['dxb', 'Dubay (UTC+4)'], ['bj', 'Pekin (UTC+8)']];
  function dmerge(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k] && typeof a[k] === 'object' ? dmerge(a[k], b && typeof b[k] === 'object' ? b[k] : {}) : (b && b[k] !== undefined ? b[k] : a[k]); }); return o; }
  CH.cs = dmerge(CS0, {}); CH.undo = []; CH.redo = [];
  function setTZ() { TZ = CH.cs.tz === 'local' || TZV[CH.cs.tz] == null ? -new Date().getTimezoneOffset() * 60 : TZV[CH.cs.tz]; }
  function setPath(o, path, v) { var a = path.split('.'), q = o; for (var i = 0; i < a.length - 1; i++) q = q[a[i]]; q[a[a.length - 1]] = v; }
  var NONE = 'rgba(0,0,0,0)';
  function themeOpts(t) {
    var d = t !== 'light';
    return { bg: d ? '#0b0d10' : '#ffffff', tx: d ? '#aab0bd' : '#434651', grid: d ? '#171a20' : '#eef0f3', bd: d ? '#2a2e39' : '#d6dae0' };
  }
  var tmo = {};
  function debounce(k, fn, ms) { clearTimeout(tmo[k]); tmo[k] = setTimeout(fn, ms || 700); }
  function savePref() { debounce('pref', function () { B.api('POST', '/api/chart', { pref: { ind: CH.ind, tf: CH.tf, theme: CH.theme, log: CH.log, magnet: CH.magnet, aid: CH.aid, cs: CH.cs } }).catch(function () { }); }); }
  function saveDraw() { var aid = CH.aid, d = CH.draw; debounce('draw', function () { if (aid) B.api('POST', '/api/chart', { aid: aid, draw: d }).catch(function () { }); }); }
  function curAsset() { return B.D().assets.filter(function (a) { return a.id === CH.aid; })[0] || null; }
  function chartAssets() { return B.D().assets.filter(function (a) { return !a.archived && a.group !== 'naqd'; }); }
  function nid() { return 'i' + Date.now().toString(36) + (CH.uid++); }
  function fmt(v) { if (v == null || isNaN(v)) return '—'; var a = Math.abs(v); return v.toFixed(a >= 1000 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 5 : 8).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1'); }
  function p2(n) { return String(n).padStart(2, '0'); }

  /* ---------- koordinatalar: vaqt <-> mantiqiy indeks (kelajakka ham) ---------- */
  function step() { return TFSEC[CH.tf] || 86400; }
  function t2l(t) {
    var d = CH.disp, n = d.length; if (!n) return null;
    if (t <= d[0]) return (t - d[0]) / step(); if (t >= d[n - 1]) return n - 1 + (t - d[n - 1]) / step();
    var lo = 0, hi = n - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (d[m] <= t) lo = m; else hi = m; }
    return lo + (t - d[lo]) / (d[hi] - d[lo]);
  }
  function l2t(l) {
    var d = CH.disp, n = d.length; if (!n) return 0;
    if (l <= 0) return d[0] + l * step(); if (l >= n - 1) return d[n - 1] + (l - (n - 1)) * step();
    var i = Math.floor(l); return d[i] + (l - i) * (d[i + 1] - d[i]);
  }
  function pt2px(p) { var l = t2l(toD(p.t)); if (l == null) return null; var x = CH.chart.timeScale().logicalToCoordinate(l), y = CH.candle.priceToCoordinate(p.p); return (x == null || y == null) ? null : { x: x, y: y }; }
  function px2pt(x, y) {
    var l = CH.chart.timeScale().coordinateToLogical(x), p = CH.candle.coordinateToPrice(y); if (l == null || p == null) return null;
    if (CH.magnet && CH.data.length) {
      var i = Math.max(0, Math.min(CH.data.length - 1, Math.round(l))), c = CH.data[i], best = null, bd = 1e18;
      [c.open, c.high, c.low, c.close].forEach(function (v) { var yy = CH.candle.priceToCoordinate(v); if (yy != null && Math.abs(yy - y) < bd) { bd = Math.abs(yy - y); best = v; } });
      if (best != null && bd < 40) { p = best; l = i; }
    }
    return { t: fromD(l2t(l)), p: p };
  }

  /* ---------- ikki chiziq orasini bo'yovchi primitiv (BB zonalar, EMA to'ldirish) ---------- */
  function FillPrim() { var me = this; this.pts = []; this.req = function () { }; this.view = { zOrder: function () { return 'bottom'; }, renderer: function () { return { draw: function (target) { me.draw(target); } }; } }; }
  FillPrim.prototype.attached = function (p) { this.chart = p.chart; this.series = p.series; this.req = p.requestUpdate; };
  FillPrim.prototype.detached = function () { };
  FillPrim.prototype.updateAllViews = function () { };
  FillPrim.prototype.paneViews = function () { return [this.view]; };
  FillPrim.prototype.set = function (pts) { this.pts = pts; this.req(); };
  FillPrim.prototype.draw = function (target) {
    var me = this, ts = this.chart.timeScale(), s = this.series, pts = this.pts; if (pts.length < 2) return;
    target.useBitmapCoordinateSpace(function (sc) {
      var ctx = sc.context, hr = sc.horizontalPixelRatio, vr = sc.verticalPixelRatio, i, run = [], col = null;
      function flush() {
        if (run.length < 2) { run = []; return; }
        ctx.beginPath(); run.forEach(function (q, k) { if (k) ctx.lineTo(q.x * hr, q.a * vr); else ctx.moveTo(q.x * hr, q.a * vr); });
        for (var k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k].x * hr, run[k].b * vr);
        ctx.closePath(); ctx.fillStyle = col; ctx.fill(); run = [];
      }
      for (i = 0; i < pts.length; i++) {
        var q = pts[i], x = ts.timeToCoordinate(q.time), ya = s.priceToCoordinate(q.a), yb = s.priceToCoordinate(q.b);
        if (x == null || ya == null || yb == null) { flush(); continue; }
        if (col !== q.col && run.length) { run.push({ x: x, a: ya, b: yb }); flush(); }
        col = q.col; run.push({ x: x, a: ya, b: yb });
      }
      flush();
    });
  };

  /* ---------- chizmalar primitivi ---------- */
  function DrawPrim() { var me = this; this.req = function () { }; this.view = { zOrder: function () { return 'top'; }, renderer: function () { return { draw: function (target) { me.draw(target); } }; } }; }
  DrawPrim.prototype.attached = function (p) { this.req = p.requestUpdate; };
  DrawPrim.prototype.detached = function () { };
  DrawPrim.prototype.updateAllViews = function () { };
  DrawPrim.prototype.paneViews = function () { return [this.view]; };
  function shapePx(d) { var a = d.pts.map(pt2px); return a.some(function (p) { return !p; }) ? null : a; }
  DrawPrim.prototype.draw = function (target) {
    if (CH._dtSel !== CH.sel) setTimeout(updDT, 0);
    target.useBitmapCoordinateSpace(function (sc) {
      var ctx = sc.context, W = sc.mediaSize.width, H = sc.mediaSize.height;
      ctx.save(); ctx.scale(sc.horizontalPixelRatio, sc.verticalPixelRatio); ctx.font = '12px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
      if (!CH.hide) CH.draw.forEach(function (d) { paint(ctx, d, W, H, d.id === CH.sel, false); });
      if (CH.pend && CH.mouse) { var pr = { k: CH.pend.k, c: CH.color, pts: CH.pend.pts.concat([CH.mouse]).slice(0, NPTS[CH.pend.k]) }; if (pr.pts.length === NPTS[pr.k]) paint(ctx, pr, W, H, false, true); }
      ctx.restore();
    });
  };
  function hexA(c, a) { var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
  function handle(ctx, p, c) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 6.2832); ctx.fillStyle = CH.theme === 'light' ? '#fff' : '#0b0d10'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke(); }
  function label(ctx, txt, x, y, c, right) {
    var w = ctx.measureText(txt).width + 10; ctx.fillStyle = c; ctx.fillRect(right ? x - w : x, y - 9, w, 18); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(txt, (right ? x - w : x) + 5, y + 1);
  }
  function dash(ls) { return ls === 1 ? [2, 4] : ls === 2 ? [8, 5] : []; }
  var FIBL = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  function fibLv(d) { return d.lv && d.lv.length ? d.lv : FIBL.map(function (v) { return { v: v, on: true }; }); }
  function visible(d) { return !(d.hid || (d.h || []).indexOf(CH.tf) >= 0); }
  function extLine(a, b, W, l, r) {
    if (a.x === b.x) return [a, b]; var sl = (b.y - a.y) / (b.x - a.x), f = function (x) { return { x: x, y: a.y + sl * (x - a.x) }; }, lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x), A = a.x <= b.x ? a : b, Bp = a.x <= b.x ? b : a;
    return [l ? f(-60) : A, r ? f(W + 60) : Bp];
  }
  function paint(ctx, d, W, H, sel, prev) {
    if (!prev && !visible(d)) return;
    var P = shapePx(d); if (!P) return; var c = d.c || '#2962ff', fs = d.fs || 13, fa = (d.fa == null ? 12 : d.fa) / 100; ctx.lineWidth = (d.w || 1.6) + (sel ? 0.8 : 0); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.setLineDash(prev ? [5, 4] : dash(d.ls)); ctx.textAlign = 'left';
    if (d.k === 'trend' || d.k === 'ray') {
      var e = extLine(P[0], P[1], W, !!d.extL, d.k === 'ray' || !!d.extR); if (d.k === 'ray' && P[1].x < P[0].x) e = extLine(P[0], P[1], W, true, false);
      ctx.beginPath(); ctx.moveTo(e[0].x, e[0].y); ctx.lineTo(e[1].x, e[1].y); ctx.stroke();
      if (d.info && d.pts[0] && d.pts[1]) { var dp = d.pts[1].p - d.pts[0].p, pc = d.pts[0].p ? dp / d.pts[0].p * 100 : 0, nb = Math.round((d.pts[1].t - d.pts[0].t) / step()); ctx.setLineDash([]); label(ctx, (dp >= 0 ? '+' : '') + fmt(dp) + ' (' + (pc >= 0 ? '+' : '') + pc.toFixed(2) + '%) · ' + nb + ' sham', P[1].x + 8, P[1].y - 14, hexA(c, 0.85)); }
    } else if (d.k === 'hline') {
      ctx.beginPath(); ctx.moveTo(0, P[0].y); ctx.lineTo(W, P[0].y); ctx.stroke(); ctx.setLineDash([]); if (d.lab !== false) label(ctx, fmt(d.pts[0].p), W - 4, P[0].y, c, true);
    } else if (d.k === 'vline') { ctx.beginPath(); ctx.moveTo(P[0].x, 0); ctx.lineTo(P[0].x, H); ctx.stroke(); }
    else if (d.k === 'rect') { var x0 = Math.min(P[0].x, P[1].x), y0 = Math.min(P[0].y, P[1].y), rw = Math.abs(P[1].x - P[0].x), rh = Math.abs(P[1].y - P[0].y); if (d.fill !== false) { ctx.fillStyle = hexA(c, fa); ctx.fillRect(x0, y0, rw, rh); } ctx.strokeRect(x0, y0, rw, rh); }
    else if (d.k === 'fib') {
      var xa = Math.min(P[0].x, P[1].x), xb = d.extR ? W : Math.max(P[0].x, P[1].x), p0 = d.pts[d.rev ? 1 : 0].p, p1 = d.pts[d.rev ? 0 : 1].p, prevY = null, lv = fibLv(d).filter(function (q) { return q.on !== false; });
      lv.forEach(function (q, i) {
        var pr = p1 + (p0 - p1) * q.v, y = CH.candle.priceToCoordinate(pr); if (y == null) return; var lc = q.c || c;
        if (prevY != null && d.fill !== false) { ctx.fillStyle = hexA(lc, fa * (i % 2 ? 0.5 : 1)); ctx.fillRect(xa, Math.min(y, prevY), xb - xa, Math.abs(y - prevY)); } prevY = y;
        ctx.strokeStyle = lc; ctx.lineWidth = Math.max(1, (d.w || 1.6) - 0.6); ctx.setLineDash(dash(d.ls)); ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = lc; ctx.fillText(q.v + (d.showP === false ? '' : '  (' + fmt(pr) + ')'), xa + 4, y - 7);
      });
      ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[1].x, P[1].y); ctx.stroke();
    } else if (d.k === 'text') {
      ctx.font = (d.bd === false ? '' : '600 ') + fs + 'px Inter, system-ui, sans-serif'; var tw = ctx.measureText(d.tx || '').width; if (d.bg) { ctx.fillStyle = hexA(c, 0.18); ctx.fillRect(P[0].x + 3, P[0].y - fs * 0.8, tw + 8, fs * 1.6); }
      ctx.fillStyle = c; ctx.fillText(d.tx || '', P[0].x + 6, P[0].y); ctx.font = '12px Inter, system-ui, sans-serif'; ctx.beginPath(); ctx.arc(P[0].x, P[0].y, 2.5, 0, 6.2832); ctx.fill();
    }
    ctx.setLineDash([]);
    if (sel) P.forEach(function (p) { handle(ctx, p, c); });
  }
  function dseg(px, py, a, b) { var dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l)) : 0, x = a.x + t * dx, y = a.y + t * dy; return Math.hypot(px - x, py - y); }
  function hit(x, y) {
    if (CH.hide) return null; var i, W = CH.root.querySelector('.ch-chart').clientWidth;
    if (CH.sel) { var sd = CH.draw.filter(function (d) { return d.id === CH.sel && visible(d); })[0], sp = sd && shapePx(sd); if (sp) for (i = 0; i < sp.length; i++) if (Math.hypot(x - sp[i].x, y - sp[i].y) < 9) return { id: sd.id, h: i }; }
    for (i = CH.draw.length - 1; i >= 0; i--) {
      var d = CH.draw[i]; if (!visible(d)) continue; var P = shapePx(d); if (!P) continue; var ok = false;
      if (d.k === 'trend') { var ee = extLine(P[0], P[1], W, !!d.extL, !!d.extR); ok = dseg(x, y, ee[0], ee[1]) < 7; }
      else if (d.k === 'ray') ok = dseg(x, y, P[0], { x: P[0].x + (P[1].x - P[0].x) * 1e3, y: P[0].y + (P[1].y - P[0].y) * 1e3 }) < 7 && (P[1].x >= P[0].x ? x >= P[0].x - 7 : x <= P[0].x + 7);
      else if (d.k === 'hline') ok = Math.abs(y - P[0].y) < 7; else if (d.k === 'vline') ok = Math.abs(x - P[0].x) < 7;
      else if (d.k === 'rect' || d.k === 'fib') ok = x >= Math.min(P[0].x, P[1].x) - 5 && x <= Math.max(P[0].x, P[1].x) + 5 && y >= Math.min(P[0].y, P[1].y) - 5 && y <= Math.max(P[0].y, P[1].y) + 5;
      else if (d.k === 'text') ok = Math.abs(y - P[0].y) < 11 && x >= P[0].x - 6 && x <= P[0].x + 8 + (d.tx || '').length * 7.5;
      if (ok) return { id: d.id, h: -1 };
    }
    return null;
  }

  /* ---------- indikatorlarni qurish ---------- */
  function sty(it, k) {
    var d = (CAT[it.k].lines || []).filter(function (l) { return l.k === k; })[0] || {}, o = (it.s && it.s[k]) || {};
    return { c: o.c || d.c || '#2962ff', w: o.w || d.w || 1.5, ls: o.ls != null ? o.ls : (d.ls || 0), v: o.v !== false, a: d.a, def: d };
  }
  function pOf(it) { return Object.assign({}, CAT[it.k].def, it.p); }
  function hexA(c, a) { var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
  function mapLine(arr, colors) { var o = []; for (var i = 0; i < arr.length; i++) if (arr[i] === arr[i] && arr[i] != null && isFinite(arr[i])) { var q = { time: CH.disp[i], value: arr[i] }; if (colors) q.color = colors[i]; o.push(q); } return o; }
  function lineS(pane, st, extra) {
    var s = CH.chart.addSeries(LW.LineSeries, Object.assign({ color: st.c, lineWidth: st.w, lineStyle: st.ls, visible: st.v, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, extra || {}), pane); CH.series.push(s); return s;
  }
  function fillP() { var p = new FillPrim(); CH.candle.attachPrimitive(p); CH.prims.push(p); return p; }
  function clearInd() {
    CH.live = []; CH.series.forEach(function (s) { try { CH.chart.removeSeries(s); } catch (e) { } }); CH.series = [];
    CH.prims.forEach(function (p) { try { CH.candle.detachPrimitive(p); } catch (e) { } }); CH.prims = [];
    if (CH.vol) { try { CH.chart.removeSeries(CH.vol); } catch (e) { } CH.vol = null; }
    if (CH.markers) { try { CH.markers.setMarkers([]); } catch (e) { } }
    CH.vals = [];
  }
  var PCOL = { up: '#26a69a', dn: '#ef5350' };
  function hiddenAt(it) { return (it.h || []).indexOf(CH.tf) >= 0; }
  function cArr() { var d = CH.data; return { time: CH.disp.slice(), open: d.map(function (x) { return x.open; }), high: d.map(function (x) { return x.high; }), low: d.map(function (x) { return x.low; }), close: d.map(function (x) { return x.close; }), volume: d.map(function (x) { return x.volume; }) }; }
  function range01(lo, hi) { return function () { return { priceRange: { minValue: lo, maxValue: hi } }; }; }
  function lvl(s, v, st) { if (st.v) s.createPriceLine({ price: v, color: st.c, lineWidth: st.w, lineStyle: st.ls, axisLabelVisible: false, title: '' }); }

  function buildInd() {
    clearInd(); if (!CH.chart) return; var pane = 1, subs = [], needMk = false;
    CH.ind.forEach(function (it) {
      if (!CAT[it.k]) return;
      var L = { id: it.id, name: CAT[it.k].name, lines: [], dim: false, k: it.k };
      if (!it.on || hiddenAt(it)) { L.dim = true; L.hid = !it.on ? 'yashirin' : 'bu vaqt oralig‘ida yashirin'; CH.vals.push(L); return; }
      var P = pOf(it);
      function reg(a) { L.lines = a; }
      if (it.k === 'ema' || it.k === 'sma') {
        var st = sty(it, 'l'), s = lineS(0, st); L.name = (it.k === 'ema' ? 'EMA ' : 'SMA ') + P.len + ' ' + P.src;
        CH.live.push(function () { var a = (it.k === 'ema' ? Ind.ema : Ind.sma)(Ind.srcArr(CH.data, P.src), Math.max(1, P.len | 0)); s.setData(mapLine(a)); reg([{ label: '', col: st.c, arr: a }]); });
      } else if (it.k === 'bb') {
        var sb = sty(it, 'basis'), su = sty(it, 'upper'), sl = sty(it, 'lower'), sf = sty(it, 'fill'), lb = lineS(0, sb), lu = lineS(0, su), ll = lineS(0, sl), fp = fillP(); L.name = 'BB ' + P.len + ' ' + P.mult + ' ' + P.src;
        CH.live.push(function () {
          var r = Ind.bb(Ind.srcArr(CH.data, P.src), Math.max(2, P.len | 0), P.mult || 2); lb.setData(mapLine(r.basis)); lu.setData(mapLine(r.upper)); ll.setData(mapLine(r.lower));
          fp.set(sf.v ? CH.disp.map(function (t, i) { return { time: t, a: r.upper[i], b: r.lower[i], col: hexA(sf.c, sf.a) }; }).filter(function (q) { return q.a === q.a && q.b === q.b; }) : []);
          reg([{ label: 'Asos', col: sb.c, arr: r.basis }, { label: 'Yuqori', col: su.c, arr: r.upper }, { label: 'Quyi', col: sl.c, arr: r.lower }]);
        });
      } else if (it.k === 'vol') {
        var su2 = sty(it, 'up'), sd2 = sty(it, 'dn'); CH.vol = CH.chart.addSeries(LW.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '', lastValueVisible: false, priceLineVisible: false }, 0);
        CH.vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } }); L.name = 'Hajm';
        CH.live.push(function () { CH.vol.setData(CH.data.map(function (c, i) { return { time: CH.disp[i], value: c.volume || 0, color: hexA(c.close >= c.open ? su2.c : sd2.c, 0.45) }; })); reg([{ label: '', col: su2.c, arr: CH.data.map(function (c) { return c.volume || 0; }) }]); });
      } else if (it.k === 'rsi') {
        var pi = pane++, s0 = sty(it, 'l'), sr = lineS(pi, s0, { autoscaleInfoProvider: range01(0, 100) }); L.name = 'RSI ' + P.len + ' ' + P.src; subs.push(pi);
        lvl(sr, P.ob, sty(it, 'hi')); lvl(sr, 50, sty(it, 'mid')); lvl(sr, P.os, sty(it, 'lo'));
        CH.live.push(function () { var a = Ind.rsi(Ind.srcArr(CH.data, P.src), Math.max(2, P.len | 0)); sr.setData(mapLine(a)); reg([{ label: '', col: s0.c, arr: a }]); });
      } else if (it.k === 'macd') {
        var pm = pane++, shs = sty(it, 'hist'), sms = sty(it, 'macd'), sgs = sty(it, 'signal'), sh = CH.chart.addSeries(LW.HistogramSeries, { priceLineVisible: false, lastValueVisible: false, visible: shs.v }, pm); CH.series.push(sh);
        var sm = lineS(pm, sms), sg = lineS(pm, sgs); L.name = 'MACD ' + P.fast + ' ' + P.slow + ' ' + P.sig; subs.push(pm);
        CH.live.push(function () {
          var r = Ind.macd(Ind.srcArr(CH.data, P.src), Math.max(1, P.fast | 0), Math.max(2, P.slow | 0), Math.max(1, P.sig | 0));
          sh.setData(r.hist.map(function (v, i) { if (v !== v) return null; var pv = r.hist[i - 1] || 0; return { time: CH.disp[i], value: v, color: v >= 0 ? (v >= pv ? shs.c : hexA(shs.c, 0.4)) : (v <= pv ? '#ff5252' : '#ffcdd2') }; }).filter(Boolean));
          sm.setData(mapLine(r.macd)); sg.setData(mapLine(r.signal));
          reg([{ label: 'Gist', col: shs.c, arr: r.hist }, { label: 'MACD', col: sms.c, arr: r.macd }, { label: 'Signal', col: sgs.c, arr: r.signal }]);
        });
      } else if (it.k === 'stochrsi') {
        var ps = pane++, ks = sty(it, 'k'), ds = sty(it, 'd'), sk = lineS(ps, ks, { autoscaleInfoProvider: range01(0, 100) }), sd = lineS(ps, ds); L.name = 'Stoch RSI ' + P.rl + ' ' + P.sl + ' ' + P.k + ' ' + P.d; subs.push(ps);
        lvl(sk, 80, sty(it, 'hi')); lvl(sk, 20, sty(it, 'lo'));
        CH.live.push(function () { var r = Ind.stochrsi(Ind.srcArr(CH.data, P.src), Math.max(2, P.rl | 0), Math.max(2, P.sl | 0), Math.max(1, P.k | 0), Math.max(1, P.d | 0)); sk.setData(mapLine(r.k)); sd.setData(mapLine(r.d)); reg([{ label: '%K', col: ks.c, arr: r.k }, { label: '%D', col: ds.c, arr: r.d }]); });
      } else if (it.k === 'algobb') {
        var a3 = sty(it, 'u3'), b3 = sty(it, 'l3'), bu = sty(it, 'bull'), be = sty(it, 'bear'), c3 = sty(it, 'e3'), c4 = sty(it, 'e4'), zu = sty(it, 'zu'), zl = sty(it, 'zl'), mb = sty(it, 'buy'), ms = sty(it, 'sell');
        var u3 = lineS(0, a3, { lastValueVisible: true }), l3 = lineS(0, b3, { lastValueVisible: true }), s1 = lineS(0, bu, { color: bu.c }), s2 = lineS(0, bu), s3 = lineS(0, c3), s4 = lineS(0, c4), fu = fillP(), fl = fillP(), fe = fillP(); L.name = 'BB (AlgoAlpha copy)'; needMk = true;
        if (!CH.markers) CH.markers = LW.createSeriesMarkers(CH.candle, []);
        CH.live.push(function () {
          var r = Ind.algobb(CH.data.map(function (x) { return x.close; }), P), bull = r.e1.map(function (v, i) { return v > r.e2[i]; }), col = bull.map(function (b) { return b ? bu.c : be.c; });
          u3.setData(mapLine(r.u3)); l3.setData(mapLine(r.l3)); s1.setData(mapLine(r.e1, col)); s2.setData(mapLine(r.e2, col)); s3.setData(mapLine(r.e3)); s4.setData(mapLine(r.e4));
          function pts(a, b, cf) { return CH.disp.map(function (t, i) { return { time: t, a: a[i], b: b[i], col: cf(i) }; }).filter(function (q) { return q.a === q.a && q.b === q.b; }); }
          fu.set(zu.v ? pts(r.u2, r.u3, function () { return hexA(zu.c, zu.a); }) : []); fl.set(zl.v ? pts(r.l2, r.l3, function () { return hexA(zl.c, zl.a); }) : []);
          fe.set(P.fill === false ? [] : pts(r.e1, r.e2, function (i) { return hexA(bull[i] ? bu.c : be.c, 0.22); }));
          CH.mk = r.signals.filter(function (s) { return s.side === 'BUY' ? mb.v : ms.v; }).map(function (s) { return s.side === 'BUY' ? { time: CH.disp[s.i], position: 'belowBar', shape: 'arrowUp', color: mb.c, text: '' } : { time: CH.disp[s.i], position: 'aboveBar', shape: 'arrowDown', color: ms.c, text: '' }; });
          reg([{ label: 'EMA ' + P.e1, col: bu.c, arr: r.e1 }, { label: 'EMA ' + P.e2, col: bu.c, arr: r.e2 }, { label: 'EMA ' + P.e3, col: c3.c, arr: r.e3 }, { label: 'EMA ' + P.e4, col: c4.c, arr: r.e4 }, { label: '3σ+', col: a3.c, arr: r.u3 }, { label: '3σ−', col: b3.c, arr: r.l3 }]);
        });
      } else if (it.k === 'custom') {
        var ser = [], subP = null;
        CH.live.push(function () {
          CH.cerr[it.id] = ''; var out = [];
          try { out = new Function('c', 'H', pOf(it).code || 'return [];')(cArr(), Ind) || []; } catch (e) { CH.cerr[it.id] = e.message; out = []; }
          ser.forEach(function (x) { try { CH.chart.removeSeries(x); CH.series = CH.series.filter(function (q) { return q !== x; }); } catch (e) { } }); ser = [];
          var hasSub = out.some(function (o) { return o && +o.pane === 1; }), pidx = 0;
          if (hasSub) { pidx = CH.chart.panes().length; }
          L.lines = [];
          out.slice(0, 12).forEach(function (o) {
            if (!o || !o.data) return; var s = lineS(+o.pane === 1 ? pidx : 0, { c: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#00e5ff', w: Math.max(1, Math.min(4, +o.width || 1.5)), ls: 0, v: true });
            s.setData(mapLine(o.data)); ser.push(s); L.lines.push({ label: o.name || '', col: o.color || '#00e5ff', arr: o.data });
          });
          if (hasSub) { try { CH.chart.panes()[pidx].setHeight(130); } catch (e) { } }
        });
      }
      CH.vals.push(L);
    });
    if (!needMk && CH.markers) { try { CH.markers.setMarkers([]); } catch (e) { } }
    fillInd(); subs.forEach(function (pi) { try { CH.chart.panes()[pi].setHeight(130); } catch (e) { } }); legend();
  }
  function fillInd() { CH.mk = null; CH.live.forEach(function (f) { f(); }); if (CH.markers && CH.mk) { try { CH.markers.setMarkers(CH.mk); } catch (e) { } } }

  /* ---------- ma'lumot yuklash ---------- */
  function showStatus(t, bad) { var el = CH.root.querySelector('.ch-status'); if (el) { el.textContent = t || ''; el.className = 'ch-status' + (bad ? ' bad' : ''); } }
  function intra() { return ['D', 'W', 'M'].indexOf(CH.tf) < 0; }
  function applyTimeFmt() {
    var intr = intra();
    CH.chart.applyOptions({ timeScale: { timeVisible: intr, secondsVisible: false }, localization: { timeFormatter: function (t) { var d = new Date(t * 1000); return p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + (intr ? ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) : ''); } } });
  }
  function setData(r, first) {
    var cs = r.candles.map(function (c) { return { time: toD(c.t), open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v }; });
    CH.meta = r; CH.rule = r.rule || null; CH.data = cs; CH.disp = cs.map(function (c) { return c.time; }); CH.tmap = {}; CH.disp.forEach(function (t, i) { CH.tmap[t] = i; });
    var ap = r.curr === 'UZS' ? 2 : (cs.length && cs[cs.length - 1].close < 1 ? 6 : 2);
    if (CH.cs.prec !== 'auto' && +CH.cs.prec >= 0) ap = +CH.cs.prec;
    CH.candle.applyOptions({ priceFormat: { type: 'price', precision: ap, minMove: Math.pow(10, -ap) } }); if (CH.alt) CH.alt.applyOptions({ priceFormat: { type: 'price', precision: ap, minMove: Math.pow(10, -ap) } });
    showSeries(); applyTimeFmt(); fillInd(); updWM();
    if (first && cs.length) { var n = cs.length; CH.chart.timeScale().setVisibleLogicalRange({ from: Math.max(-3, n - 110), to: n + 8 }); }
    var warn = CH.root.querySelector('.ch-warn');
    if (warn) { warn.hidden = !r.warn; warn.textContent = r.warn || ''; }
    showStatus(cs.length ? 'Manba: ' + r.source + ' · ' + cs.length + ' sham' : 'Manba: ' + r.source + ' — sham yo‘q', !cs.length); legend(); tick();
  }
  function load(first, quiet) {
    if (!CH.aid || CH.busy) return Promise.resolve(); CH.busy = true; var aid = CH.aid, tf = CH.tf; if (!quiet) showStatus('Yuklanmoqda…');
    return B.api('GET', '/api/candles?aid=' + encodeURIComponent(aid) + '&tf=' + tf).then(function (r) { if (aid === CH.aid && tf === CH.tf) setData(r, first); })
      .catch(function (e) { if (!quiet) { showStatus(e.message, true); CH.data = []; CH.disp = []; CH.candle.setData([]); } }).then(function () { CH.busy = false; });
  }
  function loadLayout() {
    return B.api('GET', '/api/chart?aid=' + encodeURIComponent(CH.aid)).then(function (r) { CH.draw = r.draw || []; CH.sel = null; CH.pend = null; CH.undo = []; CH.redo = []; if (CH.prim) CH.prim.req(); updDT(); refTools(); });
  }

  /* ---------- seans yopilishigacha hisoblagich (narx belgisi ostida) ---------- */
  function tick() {
    var el = CH.root && CH.root.querySelector('.ch-cd'); if (!el) return;
    if (!document.body.contains(CH.root) || !CH.data.length || !CH.rule || !CH.cs.sc.cd) { el.hidden = true; return; }
    var last = CH.data[CH.data.length - 1], y = CH.candle.priceToCoordinate(last.close), w = CH.chart.priceScale('right').width(); if (!CH.cs.sc.last) { el.hidden = true; return; }
    if (y == null) { el.hidden = true; return; }
    var nc = Ind.nextClose(Date.now(), CH.rule, CH.tf), s = Math.max(0, Math.floor((nc - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    el.textContent = (d ? d + 'k ' : '') + p2(h) + ':' + p2(m) + ':' + p2(ss); el.style.width = w + 'px'; el.style.top = (y + 11) + 'px'; el.hidden = false;
    el.style.background = last.close >= last.open ? PCOL.up : PCOL.dn;
    var ct = nc ? new Date(nc + TZ * 1000 - 0) : null; el.title = 'Sham yopilishi: ' + (ct ? p2(ct.getUTCDate()) + '.' + p2(ct.getUTCMonth() + 1) + ' ' + p2(ct.getUTCHours()) + ':' + p2(ct.getUTCMinutes()) + ' (Toshkent)' : '');
  }
  function sessLabel() {
    var r = CH.rule; if (!r) return ''; var t = Ind.zoned(2026, 1, 15, r.h, r.m, r.tz), d = new Date(t + 5 * 3600e3);
    return 'Seans yopilishi: ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ' Toshkent' + (r.wd ? ' (ish kunlari)' : ' (24/7)');
  }

  /* ---------- sarlavha va indikator qatorlari ---------- */
  function lgBtns(id, on) { return '<span class="lg-btns"><button type="button" data-ch="indset" data-id="' + id + '" title="Sozlamalar">⚙</button><button type="button" data-ch="indoff" data-id="' + id + '" title="' + (on ? 'Yashirish' : 'Ko‘rsatish') + '">' + (on ? '👁' : '🚫') + '</button><button type="button" data-ch="indsrc" data-id="' + id + '" title="Manba kodi">&lt;/&gt;</button><button type="button" data-ch="inddel" data-id="' + id + '" title="O‘chirish">✕</button></span>'; }
  function legend() {
    var el = CH.root && CH.root.querySelector('.ch-legend'); if (!el || !CH.meta) return; var a = curAsset(), i = CH.hoverI != null ? CH.hoverI : CH.data.length - 1, c = CH.data[i], pv = CH.data[i - 1];
    var S = CH.cs.st, h = '<div class="lg-main">' + (S.title ? '<b>' + esc(a ? a.name : CH.meta.name) + '</b><span class="lg-dim"> · ' + CH.tf + ' · ' + esc((CH.meta.source || '').split(' · ')[0]) + '</span>' : '');
    if (c && S.ohlc) { var ch = pv ? c.close - pv.close : 0, up = c.close >= c.open; h += ' <span class="lg-ohlc ' + (up ? 'up' : 'dn') + '">O <b>' + fmt(c.open) + '</b> H <b>' + fmt(c.high) + '</b> L <b>' + fmt(c.low) + '</b> C <b>' + fmt(c.close) + '</b>' + (pv && S.chg ? ' ' + (ch >= 0 ? '+' : '') + fmt(ch) + ' (' + (ch >= 0 ? '+' : '') + (ch / pv.close * 100).toFixed(2) + '%)' : '') + '</span>'; }
    h += '</div>' + (S.sess ? '<div class="lg-sess">' + esc(sessLabel()) + '</div>' : '');
    (CH.vals || []).forEach(function (L) {
      if (L.dim) { h += '<div class="lg-row dim">' + lgBtns(L.id, false) + '<span>' + esc(L.name) + ' (' + L.hid + ')</span></div>'; return; }
      if (!S.ind) return;
      h += '<div class="lg-row">' + lgBtns(L.id, true) + '<span>' + esc(L.name) + '</span>' + (S.vals ? L.lines : []).map(function (q) { var v = q.arr[i]; return '<span style="color:' + q.col + '">' + (q.label ? esc(q.label) + ' ' : '') + (v === v && v != null ? fmt(v) : '—') + '</span>'; }).join('') + (CH.cerr[L.id] ? '<span class="bad">⚠ ' + esc(CH.cerr[L.id]) + '</span>' : '') + '</div>';
    });
    el.innerHTML = h;
  }

  /* ---------- indikatorlar ro'yxati paneli ---------- */
  function popHtml() {
    var adm = B.isAdmin(), h = '<div class="pop-h"><b>Indikatorlar</b><button type="button" data-ch="popclose">✕</button></div><div class="pop-add">';
    Object.keys(CAT).forEach(function (k) { if (CAT[k].admin && !adm) return; var has = CAT[k].single && CH.ind.some(function (x) { return x.k === k; }); h += '<button type="button" class="chip" data-ch="indadd" data-k="' + k + '"' + (has ? ' disabled' : '') + '>+ ' + esc(CAT[k].name) + '</button>'; });
    h += '</div><div class="pop-list">';
    if (!CH.ind.length) h += '<p class="muted" style="margin:6px 0">Hozircha indikator yo‘q.</p>';
    CH.ind.forEach(function (it) { h += '<div class="pop-it"><b>' + esc(CAT[it.k] ? CAT[it.k].name : it.k) + '</b>' + lgBtns(it.id, it.on !== false) + '</div>'; });
    return h + '</div>';
  }
  function renderPop() { var p = CH.root.querySelector('.ch-pop'); p.hidden = !CH.popOpen; if (CH.popOpen) p.innerHTML = popHtml(); }

  /* ---------- indikator sozlamalari oynasi: Inputs / Style / Visibility / Source code ---------- */
  function modalIndHtml() {
    var m = CH.modal, it = CH.ind.filter(function (x) { return x.id === m.id; })[0]; if (!it) return '';
    var C = CAT[it.k], P = pOf(it), tab = m.tab || 'in', h = '<div class="md-h"><b>' + esc(C.name) + '</b><button type="button" data-ch="mclose">✕</button></div><div class="md-tabs">' +
      [['in', 'Inputs'], ['st', 'Style'], ['vis', 'Visibility'], ['src', 'Source code']].map(function (t) { return '<button type="button" class="' + (tab === t[0] ? 'on' : '') + '" data-ch="mtab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="md-b">';
    if (tab === 'in') {
      if (C.custom) h += '<p class="muted">Kod “Source code” bo‘limida.</p>';
      else if (!C.inputs.length) h += '<p class="muted">Bu indikatorda sozlanadigan kirish qiymatlari yo‘q.</p>';
      C.inputs.forEach(function (f) {
        var v = P[f[0]], ctl = f[2] === 's' ? '<select data-ch="mp" data-id="' + it.id + '" data-p="' + f[0] + '">' + SRC.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' : f[2] === 'b' ? '<input type="checkbox" data-ch="mp" data-id="' + it.id + '" data-p="' + f[0] + '"' + (v !== false ? ' checked' : '') + '>' : '<input type="number" step="any" min="0" data-ch="mp" data-id="' + it.id + '" data-p="' + f[0] + '" value="' + v + '">';
        h += '<label class="md-r"><span>' + f[1] + '</span>' + ctl + '</label>';
      });
    } else if (tab === 'st') {
      if (!C.lines.length) h += '<p class="muted">Custom indikator ranglarini kodda belgilaysiz.</p>';
      C.lines.forEach(function (l) {
        var s = sty(it, l.k);
        h += '<div class="md-r"><label class="chk"><input type="checkbox" data-ch="ms" data-id="' + it.id + '" data-l="' + l.k + '" data-f="v"' + (s.v ? ' checked' : '') + '> ' + esc(l.label) + '</label><span class="md-st"><input type="color" data-ch="ms" data-id="' + it.id + '" data-l="' + l.k + '" data-f="c" value="' + s.c + '">' +
          (l.fill || l.mark ? '' : '<select data-ch="ms" data-id="' + it.id + '" data-l="' + l.k + '" data-f="w">' + [1, 1.5, 2, 3, 4].map(function (w) { return '<option value="' + w + '"' + (w === s.w ? ' selected' : '') + '>' + w + ' px</option>'; }).join('') + '</select><select data-ch="ms" data-id="' + it.id + '" data-l="' + l.k + '" data-f="ls">' + [[0, 'Uzluksiz'], [2, 'Shtrix'], [1, 'Nuqta']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === s.ls ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') + '</span></div>';
      });
    } else if (tab === 'vis') {
      h += '<p class="muted">Indikator ko‘rinadigan vaqt oralig‘lari:</p><div class="md-tf">' + TFL.map(function (t) { return '<label class="chk"><input type="checkbox" data-ch="mv" data-id="' + it.id + '" data-tf="' + t + '"' + ((it.h || []).indexOf(t) < 0 ? ' checked' : '') + '> ' + t + '</label>'; }).join('') + '</div>';
    } else {
      if (C.custom) h += '<p class="muted">JavaScript (faqat admin). <code>c</code> — shamlar massivlari, <code>H</code> — yordamchilar (sma, ema, rsi, bb, macd, stochrsi, stdev). Massiv qaytaring.</p><textarea class="md-code" spellcheck="false" data-ch="mcode" data-id="' + it.id + '">' + esc(P.code || CUSTOM_TPL) + '</textarea><div class="row"><button type="button" class="btn small" data-ch="mrun" data-id="' + it.id + '">Ishga tushirish</button><span class="bad">' + esc(CH.cerr[it.id] || '') + '</span></div>';
      else h += '<p class="muted">Pine Script v5 ko‘rinishidagi ekvivalent (faqat o‘qish uchun). Chart xuddi shu mantiq bo‘yicha hisoblaydi.</p><pre class="md-pre">' + esc(PINE[it.k] || '') + '</pre><button type="button" class="btn ghost small" data-ch="mcopy" data-id="' + it.id + '">Nusxa olish</button>';
    }
    return h + '</div><div class="md-f"><button type="button" class="btn ghost small" data-ch="mreset" data-id="' + it.id + '">Standart sozlamaga qaytarish</button><button type="button" class="btn small" data-ch="mclose">Yopish</button></div>';
  }


  /* ---------- chizmalar: tanlanganda suzuvchi panel, sozlamalar oynasi, bekor qilish/qaytarish ---------- */
  var DNAME = { trend: 'Trend chizig‘i', ray: 'Nur', hline: 'Gorizontal chiziq', vline: 'Vertikal chiziq', rect: 'To‘rtburchak', fib: 'Fibonachchi', text: 'Matn' };
  function jd() { return JSON.stringify(CH.draw); }
  function selD() { return CH.sel ? CH.draw.filter(function (q) { return q.id === CH.sel; })[0] || null : null; }
  function drawById(id) { return CH.draw.filter(function (q) { return q.id === id; })[0] || null; }
  function pushUndo(js) { CH.undo.push(js); if (CH.undo.length > 60) CH.undo.shift(); CH.redo = []; refTools(); }
  function refTools() { var el = CH.root && CH.root.querySelector('.ch-tools'); if (el) el.innerHTML = toolsHtml(); }
  function undo() { if (!CH.undo.length) return; CH.redo.push(jd()); CH.draw = JSON.parse(CH.undo.pop()); if (!selD()) CH.sel = null; CH.prim.req(); saveDraw(); updDT(); refTools(); if (CH.modal && CH.modal.type === 'draw') renderModal(); }
  function redo() { if (!CH.redo.length) return; CH.undo.push(jd()); CH.draw = JSON.parse(CH.redo.pop()); if (!selD()) CH.sel = null; CH.prim.req(); saveDraw(); updDT(); refTools(); if (CH.modal && CH.modal.type === 'draw') renderModal(); }
  function mut(fn) { var d = selD(); if (!d) return; pushUndo(jd()); fn(d); saveDraw(); CH.prim.req(); updDT(); }
  function editStart() { if (CH.editSnap == null) CH.editSnap = jd(); clearTimeout(tmo.es); tmo.es = setTimeout(function () { if (CH.editSnap != null && CH.editSnap !== jd()) pushUndo(CH.editSnap); CH.editSnap = null; }, 900); }
  function cloneSel() {
    var d = selD(); if (!d) return; pushUndo(jd()); var n = JSON.parse(JSON.stringify(d)); n.id = nid(); n.lock = false;
    n.pts = d.pts.map(function (q) { var pp = pt2px(q), m = pp ? px2pt(pp.x + 24, pp.y + 24) : null; return m || q; }); CH.draw.push(n); CH.sel = n.id; saveDraw(); CH.prim.req(); updDT(); if (CH.modal && CH.modal.type === 'draw') { CH.modal.id = n.id; renderModal(); }
  }
  function dtHtml() {
    var d = selD(); if (!d) return '';
    return '<input type="color" class="dt-col" data-ch="dtcolor" value="' + (d.c || '#2962ff') + '" title="Rang"><select data-ch="dtw" title="Qalinlik">' + [1, 1.6, 2, 3, 4, 6].map(function (w) { return '<option value="' + w + '"' + (Math.abs((d.w || 1.6) - w) < 0.05 ? ' selected' : '') + '>' + w + ' px</option>'; }).join('') + '</select>' +
      '<select data-ch="dtls" title="Chiziq uslubi">' + [[0, '———'], [1, '· · · ·'], [2, '– – – –']].map(function (o) { return '<option value="' + o[0] + '"' + ((d.ls || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><span class="dt-sep"></span>' +
      '<button type="button" data-ch="dtset" title="Sozlamalar (ikki marta bosish)">⚙</button><button type="button" data-ch="dtlock" title="' + (d.lock ? 'Qulfdan chiqarish' : 'Qulflash') + '">' + (d.lock ? '🔒' : '🔓') + '</button><button type="button" data-ch="dthid" title="Yashirish">' + (d.hid ? '🚫' : '👁') + '</button><button type="button" data-ch="dtclone" title="Nusxa">⧉</button>' +
      (d.k === 'hline' ? '<button type="button" data-ch="dtalert" title="Shu narxda alert qo‘yish">🔔</button>' : '') + '<button type="button" data-ch="dtdel" title="O‘chirish">🗑</button>';
  }
  function updDT() { var el = CH.root && CH.root.querySelector('.ch-dt'); if (!el) return; CH._dtSel = CH.sel; var h = dtHtml(); el.hidden = !h; el.innerHTML = h; }
  function tIn(t) { return new Date(toD(t) * 1000).toISOString().slice(0, 16); }
  function tOut(v) { var ms = Date.parse(v + ':00Z'); return isFinite(ms) ? fromD(ms / 1000) : null; }
  function dchk(d, p, lab, def) { return '<label class="md-r"><span>' + lab + '</span><input type="checkbox" data-ch="dp" data-p="' + p + '"' + ((d[p] === undefined ? def : d[p]) ? ' checked' : '') + '></label>'; }
  function modalDrawHtml() {
    var m = CH.modal, d = drawById(m.id); if (!d) return ''; var tab = m.tab || 'sty';
    var h = '<div class="md-h"><b>' + esc(DNAME[d.k] || d.k) + '</b><button type="button" data-ch="mclose">✕</button></div><div class="md-tabs">' + [['sty', 'Style'], ['crd', 'Coordinates'], ['vis', 'Visibility']].map(function (t) { return '<button type="button" class="' + (tab === t[0] ? 'on' : '') + '" data-ch="mtab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="md-b">';
    if (tab === 'sty') {
      h += '<label class="md-r"><span>Rang</span><input type="color" data-ch="dp" data-p="c" value="' + (d.c || '#2962ff') + '"></label>';
      if (d.k !== 'text') h += '<label class="md-r"><span>Qalinlik</span><select data-ch="dp" data-p="w" data-num="1">' + [1, 1.6, 2, 3, 4, 6].map(function (w) { return '<option value="' + w + '"' + (Math.abs((d.w || 1.6) - w) < 0.05 ? ' selected' : '') + '>' + w + ' px</option>'; }).join('') + '</select></label><label class="md-r"><span>Chiziq uslubi</span><select data-ch="dp" data-p="ls" data-num="1">' + [[0, 'Uzluksiz'], [1, 'Nuqta'], [2, 'Shtrix']].map(function (o) { return '<option value="' + o[0] + '"' + ((d.ls || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
      if (d.k === 'trend') h += dchk(d, 'extL', 'Chapga davom ettirish', false) + dchk(d, 'extR', 'O‘ngga davom ettirish', false);
      if (d.k === 'trend' || d.k === 'ray') h += dchk(d, 'info', 'Narx o‘zgarishi va shamlar sonini ko‘rsatish', false);
      if (d.k === 'hline') h += dchk(d, 'lab', 'Narx yorlig‘ini ko‘rsatish', true);
      if (d.k === 'rect' || d.k === 'fib') h += dchk(d, 'fill', 'To‘ldirish', true) + '<label class="md-r"><span>Shaffoflik (to‘ldirish kuchi)</span><input type="number" min="0" max="100" step="2" data-ch="dp" data-p="fa" data-num="1" value="' + (d.fa == null ? (d.k === 'fib' ? 10 : 12) : d.fa) + '"></label>';
      if (d.k === 'fib') {
        h += dchk(d, 'extR', 'O‘ngga chart chetigacha uzaytirish', false) + dchk(d, 'showP', 'Narxlarni ko‘rsatish', true) + dchk(d, 'rev', 'Teskari yo‘nalish', false) + '<p class="muted" style="margin:4px 0">Darajalar:</p>';
        fibLv(d).forEach(function (q, i) { h += '<div class="md-r"><label class="chk"><input type="checkbox" data-ch="dlv" data-i="' + i + '" data-f="on"' + (q.on !== false ? ' checked' : '') + '> daraja</label><span class="md-st"><input type="number" step="0.001" data-ch="dlv" data-i="' + i + '" data-f="v" value="' + q.v + '"><input type="color" data-ch="dlv" data-i="' + i + '" data-f="c" value="' + (q.c || d.c || '#2962ff') + '"></span></div>'; });
        h += '<div class="row"><button type="button" class="btn ghost small" data-ch="dlvadd">+ Daraja qo‘shish</button><button type="button" class="btn ghost small" data-ch="dlvreset">Standart darajalar</button></div>';
      }
      if (d.k === 'text') h += '<label class="md-r" style="align-items:flex-start"><span>Matn</span><textarea class="md-code" style="min-height:70px" data-ch="dp" data-p="tx">' + esc(d.tx || '') + '</textarea></label><label class="md-r"><span>Shrift o‘lchami</span><select data-ch="dp" data-p="fs" data-num="1">' + [10, 12, 13, 14, 16, 18, 22, 28, 36].map(function (n) { return '<option value="' + n + '"' + ((d.fs || 13) === n ? ' selected' : '') + '>' + n + ' px</option>'; }).join('') + '</select></label>' + dchk(d, 'bd', 'Qalin shrift', true) + dchk(d, 'bg', 'Orqa fon', false);
    } else if (tab === 'crd') {
      h += '<p class="muted">Nuqtalar koordinatalari (narx va vaqt, tanlangan soat zonasida):</p>';
      d.pts.forEach(function (q, i) { h += '<div class="md-r"><span>' + (i + 1) + '-nuqta</span><span class="md-st"><input type="number" step="any" data-ch="dpt" data-i="' + i + '" data-f="p" value="' + q.p + '"><input type="datetime-local" data-ch="dpt" data-i="' + i + '" data-f="t" value="' + tIn(q.t) + '"></span></div>'; });
    } else {
      h += '<p class="muted">Chizma ko‘rinadigan vaqt oralig‘lari:</p><div class="md-tf">' + TFL.map(function (t) { return '<label class="chk"><input type="checkbox" data-ch="dv" data-tf="' + t + '"' + ((d.h || []).indexOf(t) < 0 ? ' checked' : '') + '> ' + t + '</label>'; }).join('') + '</div>';
    }
    return h + '</div><div class="md-f"><span class="md-st"><button type="button" class="btn ghost small" data-ch="dtclone">Nusxa</button><button type="button" class="btn ghost small" data-ch="dtdel">O‘chirish</button></span><button type="button" class="btn small" data-ch="mclose">Yopish</button></div>';
  }

  /* ---------- chart sozlamalari oynasi (TradingView "Settings" ga o'xshash): Symbol / Status line / Scales and lines / Canvas ---------- */
  function sopt(list, v) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }
  function csB(path, lab, v) { return '<label class="md-r"><span>' + lab + '</span><input type="checkbox" data-ch="cs" data-k="' + path + '" data-t="b"' + (v ? ' checked' : '') + '></label>'; }
  function csS(path, lab, list, v) { return '<label class="md-r"><span>' + lab + '</span><select data-ch="cs" data-k="' + path + '" data-t="s">' + sopt(list, v) + '</select></label>'; }
  function csC(path, lab, v, def) { return '<label class="md-r"><span>' + lab + '</span><span class="md-st"><input type="color" data-ch="cs" data-k="' + path + '" data-t="c" value="' + (v || def) + '">' + (v !== undefined && path.indexOf('.') < 0 && def === '' ? '' : '') + '</span></label>'; }
  function csOv(path, lab, v, def) { return '<div class="md-r"><span>' + lab + '</span><span class="md-st"><input type="color" data-ch="cs" data-k="' + path + '" data-t="c" value="' + (v || def) + '"><button type="button" class="btn ghost small" data-ch="csreset" data-k="' + path + '">Standart</button></span></div>'; }
  function csPair(lbl, chk, cu, cd) { return '<div class="md-r"><label class="chk"><input type="checkbox" data-ch="cs" data-k="' + chk + '" data-t="b"' + (CH.cs[chk] ? ' checked' : '') + '> ' + lbl + '</label><span class="md-st"><input type="color" data-ch="cs" data-k="' + cu + '" data-t="c" value="' + CH.cs[cu] + '"><input type="color" data-ch="cs" data-k="' + cd + '" data-t="c" value="' + CH.cs[cd] + '"></span></div>'; }
  function modalChartHtml() {
    var m = CH.modal, tab = m.tab || 'sym', c = CH.cs, o = themeOpts(CH.theme);
    var h = '<div class="md-h"><b>Chart sozlamalari</b><button type="button" data-ch="mclose">✕</button></div><div class="md-tabs">' + [['sym', 'Symbol'], ['stat', 'Status line'], ['scale', 'Scales and lines'], ['canvas', 'Canvas']].map(function (t) { return '<button type="button" class="' + (tab === t[0] ? 'on' : '') + '" data-ch="mtab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="md-b">';
    if (tab === 'sym') {
      h += csS('type', 'Chart turi', [['candles', 'Shamlar'], ['hollow', 'Bo‘sh shamlar'], ['heikin', 'Heikin Ashi'], ['line', 'Chiziq'], ['area', 'Maydon']], c.type);
      h += '<p class="muted" style="margin:2px 0">Sham ranglari (o‘sish / tushish):</p>' + csPair('Tana', 'body', 'cu', 'cd') + csPair('Chegara', 'bord', 'bu', 'bd') + csPair('Soya (wick)', 'wick', 'wu', 'wd');
      h += csS('prec', 'Narx aniqligi', [['auto', 'Avtomatik'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8']], c.prec) + csS('tz', 'Vaqt zonasi', TZN, c.tz);
    } else if (tab === 'stat') {
      h += csB('st.title', 'Aktiv nomi, vaqt oralig‘i va manba', c.st.title) + csB('st.ohlc', 'OHLC qiymatlari', c.st.ohlc) + csB('st.chg', 'O‘zgarish (%)', c.st.chg) + csB('st.sess', 'Seans yopilish vaqti', c.st.sess) + csB('st.ind', 'Indikator nomlari', c.st.ind) + csB('st.vals', 'Indikator qiymatlari', c.st.vals);
    } else if (tab === 'scale') {
      h += csS('sc.mode', 'Narx shkalasi turi', [['normal', 'Oddiy'], ['log', 'Logarifmik'], ['pct', 'Foiz (%)'], ['idx', '100 ga keltirilgan']], CH.log ? 'log' : c.sc.mode) + csB('sc.auto', 'Avtomatik masshtab', c.sc.auto) + csB('sc.inv', 'Shkalani teskari qilish', c.sc.inv) + csB('sc.last', 'Oxirgi narx yorlig‘i va seans hisoblagichi', c.sc.last) + csB('sc.lline', 'Oxirgi narx chizig‘i', c.sc.lline) + csB('sc.prev', 'Oldingi yopilish chizig‘i', c.sc.prev) + csB('sc.cd', 'Yopilishgacha qolgan vaqt', c.sc.cd);
      h += '<label class="md-r"><span>Yuqori chekka (%)</span><input type="number" min="0" max="45" step="1" data-ch="cs" data-k="sc.top" data-t="n" value="' + c.sc.top + '"></label><label class="md-r"><span>Pastki chekka (%)</span><input type="number" min="0" max="45" step="1" data-ch="cs" data-k="sc.bot" data-t="n" value="' + c.sc.bot + '"></label>';
      h += csB('gv', 'Vertikal to‘r chiziqlari', c.gv) + csB('gh', 'Gorizontal to‘r chiziqlari', c.gh) + csS('cm', 'Kursor rejimi', [['normal', 'Erkin'], ['magnet', 'Magnit (OHLC)']], c.cm) + csS('cl', 'Kursor chiziq uslubi', [[0, 'Uzluksiz'], [1, 'Nuqta'], [2, 'Shtrix'], [3, 'Uzun shtrix']], c.cl);
    } else {
      h += csS('theme', 'Mavzu', [['dark', 'Qorong‘i'], ['light', 'Yorug‘']], CH.theme) + csOv('bg', 'Orqa fon', c.bg, o.bg) + csOv('tx', 'Matn rangi', c.tx, o.tx) + csOv('gc', 'To‘r rangi', c.gc, o.grid) + csOv('cc', 'Kursor rangi', c.cc, '#787b86') + csB('wm', 'Fon yozuvi (aktiv nomi)', c.wm);
    }
    return h + '</div><div class="md-f"><button type="button" class="btn ghost small" data-ch="csdef">Standart sozlamaga qaytarish</button><button type="button" class="btn small" data-ch="mclose">Yopish</button></div>';
  }
  function csChanged(k) {
    if (k === 'theme') return;
    if (['type', 'prec'].indexOf(k) >= 0 || k === 'sc.prev') { applyCS(); if (CH.meta) setData(CH.meta, false); }
    else if (k === 'tz') { setTZ(); load(true).then(function () { buildInd(); if (CH.prim) CH.prim.req(); }); applyCS(); }
    else { applyCS(); }
    legend(); tick(); savePref();
  }

  /* ---------- alertlar oynasi ---------- */
  var REFS = [['price', 'Narx'], ['rsi', 'RSI'], ['ema', 'EMA'], ['sma', 'SMA'], ['macd', 'MACD'], ['stochrsi', 'Stoch RSI'], ['bb', 'Bollinger'], ['algobb', 'BB (AlgoAlpha copy)'], ['value', 'Qiymat']];
  var LINES = { bb: [['basis', 'Asos'], ['upper', 'Yuqori'], ['lower', 'Quyi']], macd: [['macd', 'MACD'], ['signal', 'Signal'], ['hist', 'Gistogramma']], stochrsi: [['k', '%K'], ['d', '%D']], algobb: [['buy', 'BUY signali'], ['sell', 'SELL signali'], ['e1', 'EMA 1'], ['e2', 'EMA 2'], ['e3', 'EMA 3'], ['e4', 'EMA 4'], ['u3', 'Yuqori 3σ'], ['l3', 'Quyi 3σ']] };
  var OPSL = [['crossover', 'ustidan kesib o‘tdi (↑)'], ['crossunder', 'ostidan kesib o‘tdi (↓)'], ['gt', '>  katta'], ['lt', '<  kichik'], ['ge', '≥'], ['le', '≤'], ['true', 'sodir bo‘ldi (signal)']];
  function mkRef(k) {
    var r = { k: k }; if (k === 'price') r.f = 'close'; else if (k === 'value') r.v = 0; else { r.p = Object.assign({}, CAT[k] ? CAT[k].def : { len: 14 }); delete r.p.src; delete r.p.ob; delete r.p.os; delete r.p.fill; if (k === 'algobb') r.p = { len: 20, e1: 14, e2: 20, e3: 50, e4: 200 }; if (LINES[k]) r.line = LINES[k][0][0]; }
    return r;
  }
  function PRE() {
    var o = [['rsi_ob', 'RSI 70 dan yuqoriga o‘tdi', { k: 'rsi', p: { len: 14 } }, 'crossover', { k: 'value', v: 70 }, 'none'], ['rsi_os', 'RSI 30 dan pastga tushdi', { k: 'rsi', p: { len: 14 } }, 'crossunder', { k: 'value', v: 30 }, 'none'],
      ['macd_up', 'MACD signalni pastdan yuqoriga kesdi', { k: 'macd', line: 'macd', p: { fast: 12, slow: 26, sig: 9 } }, 'crossover', { k: 'macd', line: 'signal', p: { fast: 12, slow: 26, sig: 9 } }, 'none'], ['macd_dn', 'MACD signalni yuqoridan pastga kesdi', { k: 'macd', line: 'macd', p: { fast: 12, slow: 26, sig: 9 } }, 'crossunder', { k: 'macd', line: 'signal', p: { fast: 12, slow: 26, sig: 9 } }, 'none'],
      ['st_up', 'Stoch RSI %K %D ni yuqoriga kesdi', { k: 'stochrsi', line: 'k', p: { rl: 14, sl: 14, k: 3, d: 3 } }, 'crossover', { k: 'stochrsi', line: 'd', p: { rl: 14, sl: 14, k: 3, d: 3 } }, 'none'],
      ['px_ema', 'Narx EMA 50 ustidan o‘tdi', { k: 'price', f: 'close' }, 'crossover', { k: 'ema', p: { len: 50 } }, 'none'], ['px_bbu', 'Narx BB yuqori chegarasidan o‘tdi', { k: 'price', f: 'close' }, 'crossover', { k: 'bb', line: 'upper', p: { len: 20, mult: 2 } }, 'none'],
      ['px_bbl', 'Narx BB quyi chegarasidan pastga tushdi', { k: 'price', f: 'close' }, 'crossunder', { k: 'bb', line: 'lower', p: { len: 20, mult: 2 } }, 'none'], ['ema_x', 'EMA 14 EMA 50 ni yuqoriga kesdi', { k: 'ema', p: { len: 14 } }, 'crossover', { k: 'ema', p: { len: 50 } }, 'none']];
    if (B.isAdmin()) { o.unshift(['ab_sell', 'BB (AlgoAlpha copy): SELL signali → Avto savdo', { k: 'algobb', line: 'sell', p: { len: 20, e1: 14, e2: 20, e3: 50, e4: 200 } }, 'true', null, 'auto']); o.unshift(['ab_buy', 'BB (AlgoAlpha copy): BUY signali → Avto savdo', { k: 'algobb', line: 'buy', p: { len: 20, e1: 14, e2: 20, e3: 50, e4: 200 } }, 'true', null, 'auto']); }
    return o;
  }
  function newAlert(pre) {
    var a = { name: '', tf: CH.tf, a: mkRef('rsi'), op: 'crossover', b: { k: 'value', v: 70 }, on: 'close', act: 'none', once: false, email: false, msg: '' };
    if (pre) { var q = PRE().filter(function (x) { return x[0] === pre; })[0]; if (q) { a.a = JSON.parse(JSON.stringify(q[2])); a.op = q[3]; a.b = q[4] ? JSON.parse(JSON.stringify(q[4])) : null; a.act = q[5]; a.name = q[1].split(':')[0]; } }
    return a;
  }
  function refHtml(w, r) {
    var h = '<div class="al-ref"><select data-ch="alref" data-w="' + w + '">' + REFS.filter(function (x) { return x[0] !== 'algobb' || B.isAdmin(); }).map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === r.k ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>';
    if (r.k === 'price') h += '<select data-ch="alf" data-w="' + w + '" data-f="f">' + ['close', 'open', 'high', 'low'].map(function (f) { return '<option' + (f === r.f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select>';
    else if (r.k === 'value') h += '<input type="number" step="any" data-ch="alv" data-w="' + w + '" value="' + r.v + '">';
    else {
      if (LINES[r.k]) h += '<select data-ch="alf" data-w="' + w + '" data-f="line">' + LINES[r.k].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === r.line ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>';
      Object.keys(r.p || {}).forEach(function (k) { h += '<label class="al-p">' + k + '<input type="number" step="any" min="1" data-ch="alp" data-w="' + w + '" data-k="' + k + '" value="' + r.p[k] + '"></label>'; });
    }
    return h + '</div>';
  }
  function modalAlertHtml() {
    var m = CH.modal, F = m.form, adm = B.isAdmin(), as = chartAssets(), nameOf = function (id) { var a = as.filter(function (x) { return x.id === id; })[0]; return a ? a.sym : id; };
    var h = '<div class="md-h"><b>🔔 Alertlar</b><button type="button" data-ch="mclose">✕</button></div><div class="md-b">';
    h += '<div class="al-list">' + (CH.alerts.length ? CH.alerts.map(function (a) {
      return '<div class="al-it' + (a.active ? '' : ' off') + '"><div><b>' + esc(a.name) + '</b> <span class="lg-dim">' + esc(nameOf(a.aid)) + ' · ' + a.tf + ' · ' + (a.on === 'live' ? 'tik' : 'sham yopilganda') + '</span><br><small>' + esc(condTxt(a.cond)) + (a.act && a.act !== 'none' ? ' → <b>Avto savdo: ' + (a.act === 'auto' ? 'AUTO' : a.act) + '</b>' : '') + ' · ishga tushgan: ' + (a.count || 0) + '</small></div><div class="al-b"><button type="button" class="btn ghost small" data-ch="altoggle" data-id="' + a.id + '">' + (a.active ? 'To‘xtatish' : 'Yoqish') + '</button><button type="button" class="btn ghost small" data-ch="aldel" data-id="' + a.id + '">✕</button></div></div>';
    }).join('') : '<p class="muted" style="margin:4px 0 10px">Hozircha alert yo‘q.</p>') + '</div>';
    h += '<div class="al-form"><b>Yangi alert</b><label class="md-r"><span>Tayyor shablon</span><select data-ch="alpre"><option value="">— tanlang —</option>' + PRE().map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="md-r"><span>Nomi</span><input type="text" data-ch="alname" value="' + esc(F.name) + '" placeholder="masalan: BTC RSI"></label><label class="md-r"><span>Vaqt oralig‘i</span><select data-ch="altf">' + TFL.map(function (t) { return '<option' + (t === F.tf ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
      '<div class="md-r"><span>Shart</span><div class="al-cond">' + refHtml('a', F.a) + '<select data-ch="alop">' + OPSL.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === F.op ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' + (F.op === 'true' ? '' : refHtml('b', F.b || { k: 'value', v: 0 })) + '</div></div>' +
      '<label class="md-r"><span>Qachon tekshiriladi</span><select data-ch="alon"><option value="close"' + (F.on === 'close' ? ' selected' : '') + '>Sham yopilganda (tavsiya)</option><option value="live"' + (F.on === 'live' ? ' selected' : '') + '>Joriy shamda (har shamda bir marta)</option></select></label>' +
      (adm ? '<label class="md-r"><span>Avto savdoga signal</span><select data-ch="alact">' + [['none', 'Yuborilmasin (faqat xabar)'], ['auto', 'AUTO (BB AlgoAlpha BUY/SELL ga mos)'], ['BUY', 'Har doim BUY signal'], ['SELL', 'Har doim SELL signal']].map(function (o) { return '<option value="' + o[0] + '"' + (F.act === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="md-r"><span>Xabar (ixtiyoriy)</span><input type="text" data-ch="almsg" value="' + esc(F.msg) + '"></label><div class="md-r"><label class="chk"><input type="checkbox" data-ch="alonce"' + (F.once ? ' checked' : '') + '> Bir marta ishlasin</label><label class="chk"><input type="checkbox" data-ch="alemail"' + (F.email ? ' checked' : '') + '> Emailga ham yuborilsin</label></div>' +
      '<div class="row"><button type="button" class="btn small" data-ch="alsave">Alertni saqlash</button><span class="muted">Alertni server tekshiradi: brauzer yopiq bo‘lsa ham ishlaydi.</span></div></div>';
    h += '<div class="al-log"><b>Oxirgi ishga tushishlar</b>' + (CH.alog.length ? CH.alog.slice(0, 12).map(function (g) { return '<div class="al-lg"><span class="lg-dim">' + B.fdt(g.t) + '</span> ' + esc(g.text) + (g.signal ? ' <b>· ' + esc(g.signal) + '</b>' : '') + '</div>'; }).join('') : '<p class="muted" style="margin:4px 0">Hali ishga tushmagan.</p>') + '</div>';
    return h + '</div>';
  }
  function condTxt(c) {
    var nm = function (r) { return !r ? '' : r.k === 'price' ? 'Narx(' + (r.f || 'close') + ')' : r.k === 'value' ? r.v : (r.k === 'algobb' ? 'AlgoAlpha' : r.k.toUpperCase()) + (r.p ? '(' + Object.keys(r.p).map(function (k) { return r.p[k]; }).join(',') + ')' : '') + (r.line ? '.' + r.line : ''); };
    var o = OPSL.filter(function (x) { return x[0] === c.op; })[0]; return nm(c.a) + ' ' + (o ? o[1] : c.op) + ' ' + (c.op === 'true' ? '' : nm(c.b));
  }
  function renderModal() {
    var el = CH.root.querySelector('.ch-modal'); if (!CH.modal) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false; el.innerHTML = '<div class="md-card">' + (CH.modal.type === 'alert' ? modalAlertHtml() : CH.modal.type === 'draw' ? modalDrawHtml() : CH.modal.type === 'chart' ? modalChartHtml() : modalIndHtml()) + '</div>';
  }
  function loadAlerts() { return B.api('GET', '/api/alerts').then(function (r) { CH.alerts = r.alerts || []; CH.alog = r.log || []; if (CH.modal && CH.modal.type === 'alert') renderModal(); }).catch(function () { }); }

  /* ---------- yuqori qator va asboblar paneli ---------- */
  function topHtml() {
    var as = chartAssets(), adm = B.isAdmin();
    return '<select class="ch-asset" data-ch="asset">' + as.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === CH.aid ? ' selected' : '') + '>' + esc(a.sym) + ' — ' + esc(a.name) + '</option>'; }).join('') + '</select><span class="ch-sep"></span>' +
      TFL.map(function (t) { return '<button type="button" class="ch-b' + (t === CH.tf ? ' on' : '') + '" data-ch="tf" data-v="' + t + '">' + t + '</button>'; }).join('') + '<span class="ch-sep"></span>' +
      '<button type="button" class="ch-b wide" data-ch="pop">ƒx Indikatorlar</button><button type="button" class="ch-b wide" data-ch="alerts">🔔 Alert' + (CH.alerts.filter(function (a) { return a.active; }).length ? ' (' + CH.alerts.filter(function (a) { return a.active; }).length + ')' : '') + '</button><button type="button" class="ch-b' + (CH.log ? ' on' : '') + '" data-ch="log" title="Logarifmik shkala">log</button>' +
      (adm ? '<button type="button" class="ch-b wide" data-ch="upl" title="Excel/CSV dan kunlik tarix yuklash">⬆ Tarix</button>' : '') +
      '<span class="ch-sp"></span><span class="ch-status"></span><button type="button" class="ch-b" data-ch="cset" title="Chart sozlamalari">⚙</button><button type="button" class="ch-b" data-ch="theme" title="Mavzu">◐</button><button type="button" class="ch-b" data-ch="shot" title="Rasmga olish">📷</button><button type="button" class="ch-b" data-ch="full" title="To‘liq ekran">⛶</button>';
  }
  function toolsHtml() {
    var h = TOOLS.map(function (t) { return '<button type="button" class="ch-t' + (CH.tool === t[0] ? ' on' : '') + '" data-ch="tool" data-v="' + t[0] + '" title="' + t[1] + '"><svg viewBox="0 0 24 24">' + t[2] + '</svg></button>'; }).join('');
    h += '<span class="ch-hr"></span><button type="button" class="ch-t" data-ch="undo" title="Bekor qilish (Ctrl+Z)"' + (CH.undo.length ? '' : ' disabled') + '><svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12"/></svg></button><button type="button" class="ch-t" data-ch="redo" title="Qaytarish (Ctrl+Y)"' + (CH.redo.length ? '' : ' disabled') + '><svg viewBox="0 0 24 24"><path d="M15 7l5 5-5 5M20 12H10a6 6 0 0 0 0 12"/></svg></button><span class="ch-hr"></span><button type="button" class="ch-t' + (CH.magnet ? ' on' : '') + '" data-ch="magnet" title="Magnit (OHLC ga yopishish)"><svg viewBox="0 0 24 24"><path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3zM6 7h4M14 7h4"/></svg></button>' +
      '<button type="button" class="ch-t' + (CH.hide ? ' on' : '') + '" data-ch="hide" title="Chizmalarni yashirish"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
      '<button type="button" class="ch-t" data-ch="deldraw" title="Tanlanganini o‘chirish"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>' +
      '<button type="button" class="ch-t" data-ch="clrdraw" title="Barcha chizmalarni tozalash"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
      '<span class="ch-hr"></span><div class="ch-cols">' + COLORS.map(function (c) { return '<button type="button" class="ch-c' + (CH.color === c ? ' on' : '') + '" data-ch="color" data-v="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div>';
    return h;
  }
  function refreshBars() { CH.root.querySelector('.ch-top').innerHTML = topHtml(); CH.root.querySelector('.ch-tools').innerHTML = toolsHtml(); showStatus(CH.meta ? 'Manba: ' + CH.meta.source : ''); }
  function applyTheme() { CH.root.setAttribute('data-ct', CH.theme); applyCS(); }
  var PSM = { normal: 0, log: 1, pct: 2, idx: 3 };
  function applyScale() { applyCS(); }
  function applyCS() {
    if (!CH.chart) return; var c = CH.cs, o = themeOpts(CH.theme), T = c.type, line = T === 'line' || T === 'area', hol = T === 'hollow', bg = c.bg || o.bg, tx = c.tx || o.tx, gc = c.gc || o.grid;
    CH.chart.applyOptions({ layout: { background: { type: LW.ColorType.Solid, color: bg }, textColor: tx, panes: { separatorColor: o.bd } }, grid: { vertLines: { visible: !!c.gv, color: gc }, horzLines: { visible: !!c.gh, color: gc } },
      crosshair: { mode: c.cm === 'magnet' ? LW.CrosshairMode.MagnetOHLC : LW.CrosshairMode.Normal, vertLine: { style: c.cl, labelBackgroundColor: c.cc || undefined, color: c.cc || undefined }, horzLine: { style: c.cl, labelBackgroundColor: c.cc || undefined, color: c.cc || undefined } },
      rightPriceScale: { borderColor: o.bd, mode: CH.log ? 1 : (PSM[c.sc.mode] || 0), autoScale: !!c.sc.auto, invertScale: !!c.sc.inv, scaleMargins: { top: Math.min(0.45, c.sc.top / 100), bottom: Math.min(0.45, c.sc.bot / 100) } }, timeScale: { borderColor: o.bd } });
    CH.candle.applyOptions({
      upColor: line || hol || !c.body ? NONE : c.cu, downColor: line || !c.body ? NONE : c.cd, borderUpColor: line ? NONE : (c.bord || hol ? c.bu : NONE), borderDownColor: line ? NONE : (c.bord || hol ? c.bd : NONE), wickUpColor: line ? NONE : (c.wick ? c.wu : NONE), wickDownColor: line ? NONE : (c.wick ? c.wd : NONE),
      lastValueVisible: !line && !!c.sc.last, priceLineVisible: !line && !!c.sc.lline
    });
    PCOL.up = c.cu; PCOL.dn = c.cd; syncAlt(); if (CH.alt) CH.alt.applyOptions({ lastValueVisible: !!c.sc.last, priceLineVisible: !!c.sc.lline });
    var el = CH.root.querySelector('.ch-stage'); if (el) el.style.setProperty('--ch-bg', bg);
    updWM(); tick();
  }
  function syncAlt() {
    var T = CH.cs.type, want = T === 'area' ? 'area' : T === 'line' ? 'line' : '';
    if (CH.alt && CH.altT !== want) { try { CH.chart.removeSeries(CH.alt); } catch (e) { } CH.alt = null; CH.altT = ''; }
    if (want && !CH.alt) { var col = CH.cs.cu; CH.alt = CH.chart.addSeries(want === 'area' ? LW.AreaSeries : LW.LineSeries, want === 'area' ? { lineColor: col, topColor: hexA(col, 0.35), bottomColor: hexA(col, 0.02), lineWidth: 2, priceLineVisible: true } : { color: col, lineWidth: 2, priceLineVisible: true }, 0); CH.altT = want; if (CH.data.length) CH.alt.setData(CH.data.map(function (x) { return { time: x.time, value: x.close }; })); }
    else if (CH.alt) { var cl = CH.cs.cu; CH.alt.applyOptions(want === 'area' ? { lineColor: cl, topColor: hexA(cl, 0.35), bottomColor: hexA(cl, 0.02) } : { color: cl }); }
  }
  function heik(cs) { var o = [], pO = 0, pC = 0; cs.forEach(function (c, i) { var hc = (c.open + c.high + c.low + c.close) / 4, ho = i ? (pO + pC) / 2 : (c.open + c.close) / 2; o.push({ time: c.time, open: ho, high: Math.max(c.high, ho, hc), low: Math.min(c.low, ho, hc), close: hc }); pO = ho; pC = hc; }); return o; }
  function showSeries() {
    var cs = CH.data; CH.candle.setData(CH.cs.type === 'heikin' ? heik(cs) : cs); syncAlt();
    if (CH.alt) CH.alt.setData(cs.map(function (x) { return { time: x.time, value: x.close }; }));
    if (CH.pcl) { try { CH.candle.removePriceLine(CH.pcl); } catch (e) { } CH.pcl = null; }
    if (CH.cs.sc.prev && cs.length > 1) CH.pcl = CH.candle.createPriceLine({ price: cs[cs.length - 2].close, color: '#787b86', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Oldingi' });
  }
  function updWM() {
    if (CH.wmP) { try { CH.wmP.detach(); } catch (e) { } CH.wmP = null; }
    if (!CH.cs.wm || !LW.createTextWatermark) return; var a = curAsset();
    try { CH.wmP = LW.createTextWatermark(CH.chart.panes()[0], { horzAlign: 'center', vertAlign: 'center', lines: [{ text: (a ? a.sym : '') + ' · ' + CH.tf, color: CH.theme === 'light' ? 'rgba(80,80,90,0.12)' : 'rgba(170,176,189,0.10)', fontSize: 56 }] }); } catch (e) { }
  }

  function setTool(t) { CH.tool = t; CH.pend = null; CH.root.querySelector('.ch-chart').style.cursor = t === 'cursor' ? '' : 'crosshair'; CH.root.querySelector('.ch-tools').innerHTML = toolsHtml(); if (CH.prim) CH.prim.req(); }
  function delSel() { var d = selD(); if (!d) return; if (d.lock) { B.toast('Chizma qulflangan'); return; } pushUndo(jd()); CH.draw = CH.draw.filter(function (q) { return q.id !== d.id; }); CH.sel = null; if (CH.modal && CH.modal.type === 'draw') { CH.modal = null; renderModal(); } CH.prim.req(); saveDraw(); updDT(); }
  function onClick(p) {
    if (!p || !p.point) return; var x = p.point.x, y = p.point.y;
    if (CH.tool === 'cursor') { var h = hit(x, y); CH.sel = h ? h.id : null; CH.prim.req(); updDT(); return; }
    var pt = px2pt(x, y); if (!pt) return;
    if (!CH.pend) CH.pend = { k: CH.tool, pts: [] };
    CH.pend.pts.push(pt);
    if (CH.pend.pts.length >= NPTS[CH.pend.k]) {
      var d = { id: nid(), k: CH.pend.k, pts: CH.pend.pts, c: CH.color };
      if (d.k === 'text') { var tx = window.prompt('Matn:', ''); if (!tx) { CH.pend = null; return; } d.tx = tx.slice(0, 200); d.fs = 13; }
      if (d.k === 'fib') { d.lv = FIBL.map(function (v) { return { v: v, on: true }; }); d.fa = 10; }
      pushUndo(jd()); CH.draw.push(d); CH.sel = d.id; CH.pend = null; saveDraw(); setTool('cursor'); updDT();
    }
    CH.prim.req();
  }
  function onMove(p) {
    CH.hoverI = p && p.time != null && CH.tmap[p.time] != null ? CH.tmap[p.time] : null; legend();
    if (p && p.point) { CH.mouse = CH.pend ? px2pt(p.point.x, p.point.y) : null; if (CH.pend) CH.prim.req(); }
  }
  function startDrag(e) {
    if (CH.tool !== 'cursor' || e.button !== 0) return; var r = CH.root.querySelector('.ch-chart').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, h = hit(x, y); if (!h) return;
    var d = CH.draw.filter(function (q) { return q.id === h.id; })[0]; CH.sel = d.id; updDT(); if (d.lock) { CH.prim.req(); return; } CH.drag = { snap: jd(), id: d.id, h: h.h, x: x, y: y, orig: d.pts.map(function (q) { return { t: q.t, p: q.p }; }), moved: false };
    e.stopPropagation(); e.preventDefault(); CH.prim.req();
  }
  window.addEventListener('mousemove', function (e) {
    var g = CH.drag; if (!g || !CH.root) return; var r = CH.root.querySelector('.ch-chart').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, d = CH.draw.filter(function (q) { return q.id === g.id; })[0]; if (!d) return;
    g.moved = true;
    if (g.h >= 0) { var pt = px2pt(x, y); if (pt) d.pts[g.h] = pt; }
    else { var dx = x - g.x, dy = y - g.y; d.pts = g.orig.map(function (q) { var pp = pt2px(q); if (!pp) return q; var n = px2pt(pp.x + dx, pp.y + dy); return n || q; }); }
    CH.prim.req();
  });
  window.addEventListener('mouseup', function () { if (CH.drag) { if (CH.drag.moved) { pushUndo(CH.drag.snap); saveDraw(); if (CH.modal && CH.modal.type === 'draw') renderModal(); } CH.drag = null; } });
  window.addEventListener('keydown', function (e) {
    if (!CH.root || !document.body.contains(CH.root) || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName)) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.shiftKey ? redo() : undo(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { redo(); e.preventDefault(); return; }
    if (e.key === 'Escape') { CH.pend = null; if (CH.tool !== 'cursor') setTool('cursor'); CH.sel = null; CH.prim.req(); updDT(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && CH.sel) { delSel(); e.preventDefault(); }
  });

  function indById(id) { return CH.ind.filter(function (x) { return x.id === id; })[0]; }
  function rebuildSoon() { debounce('rebuild', function () { buildInd(); savePref(); }, 250); }
  function upload() {
    var inp = CH.root.querySelector('.ch-file'); inp.value = ''; inp.click();
  }
  function doUpload(files) {
    if (!files || !files.length) return; showStatus('Yuklanmoqda…'); var list = [], n = 0;
    Array.prototype.forEach.call(files, function (f) {
      var r = new FileReader(); r.onload = function () { var b = r.result, i = b.indexOf(','); list.push({ name: f.name, data: b.slice(i + 1) }); if (++n === files.length) send(); }; r.readAsDataURL(f);
    });
    function send() {
      B.api('POST', '/api/history/import', { aid: CH.aid, files: list }).then(function (r) {
        var ok = r.files.filter(function (x) { return !x.error; }), bad = r.files.filter(function (x) { return x.error; });
        B.toast(ok.length ? ok.map(function (x) { return x.sym + ': +' + x.added + ' yangi, ' + x.changed + ' yangilandi (jami ' + x.total + ')'; }).join('; ') : (bad[0] ? bad[0].error : 'Hech narsa yuklanmadi')); return load(true);
      }).catch(function (e) { B.toast(e.message); showStatus(e.message, true); });
    }
  }
  function onAct(el) {
    var a = el.getAttribute('data-ch'), v = el.getAttribute('data-v'), id = el.getAttribute('data-id');
    if (a === 'tf') { CH.tf = v; refreshBars(); CH.hoverI = null; savePref(); load(true).then(function () { buildInd(); }); }
    else if (a === 'tool') setTool(v);
    else if (a === 'magnet') { CH.magnet = !CH.magnet; refreshBars(); savePref(); }
    else if (a === 'hide') { CH.hide = !CH.hide; refreshBars(); CH.prim.req(); }
    else if (a === 'deldraw') delSel();
    else if (a === 'clrdraw') { if (CH.draw.length && confirm('Bu aktivdagi barcha chizmalar o‘chirilsinmi?')) { pushUndo(jd()); CH.draw = CH.draw.filter(function (q) { return q.lock; }); CH.sel = null; CH.prim.req(); saveDraw(); updDT(); } }
    else if (a === 'color') { CH.color = v; var d = selD(); if (d && !d.lock) { pushUndo(jd()); d.c = v; saveDraw(); CH.prim.req(); updDT(); } refreshBars(); }
    else if (a === 'log') { CH.log = !CH.log; CH.cs.sc.mode = CH.log ? 'log' : 'normal'; applyScale(); refreshBars(); savePref(); }
    else if (a === 'pop') { CH.popOpen = !CH.popOpen; renderPop(); }
    else if (a === 'popclose') { CH.popOpen = false; renderPop(); }
    else if (a === 'indadd') { var k = el.getAttribute('data-k'), it = { id: nid(), k: k, on: true, p: Object.assign({}, CAT[k].def) }; if (k === 'custom') it.p.code = CUSTOM_TPL; CH.ind.push(it); buildInd(); renderPop(); savePref(); if (k === 'custom') { CH.modal = { type: 'ind', id: it.id, tab: 'src' }; renderModal(); } }
    else if (a === 'inddel') { CH.ind = CH.ind.filter(function (x) { return x.id !== id; }); if (CH.modal && CH.modal.id === id) CH.modal = null; buildInd(); renderPop(); renderModal(); savePref(); }
    else if (a === 'indoff') { var x = indById(id); if (x) x.on = !x.on; buildInd(); renderPop(); savePref(); }
    else if (a === 'indset') { CH.modal = { type: 'ind', id: id, tab: 'in' }; CH.popOpen = false; renderPop(); renderModal(); }
    else if (a === 'indsrc') { CH.modal = { type: 'ind', id: id, tab: 'src' }; CH.popOpen = false; renderPop(); renderModal(); }
    else if (a === 'mclose') { CH.modal = null; renderModal(); }
    else if (a === 'cset') { CH.modal = { type: 'chart', tab: 'sym' }; CH.popOpen = false; renderPop(); renderModal(); }
    else if (a === 'undo') undo(); else if (a === 'redo') redo();
    else if (a === 'dtset') { if (CH.sel) { CH.modal = { type: 'draw', id: CH.sel, tab: 'sty' }; renderModal(); } }
    else if (a === 'dtlock') mut(function (d) { d.lock = !d.lock; });
    else if (a === 'dthid') mut(function (d) { d.hid = !d.hid; });
    else if (a === 'dtclone') cloneSel();
    else if (a === 'dtdel') delSel();
    else if (a === 'dtalert') { var hd = selD(), as = curAsset(); if (hd && as) { var f = newAlert(); f.a = mkRef('price'); f.op = 'crossover'; f.b = { k: 'value', v: +(+hd.pts[0].p).toFixed(8) }; f.name = as.sym + ' ' + fmt(hd.pts[0].p) + ' dan o‘tdi'; CH.modal = { type: 'alert', form: f }; renderModal(); loadAlerts(); } }
    else if (a === 'dlvadd') { var d1 = drawById(CH.modal && CH.modal.id); if (d1) { editStart(); d1.lv = fibLv(d1).slice(); d1.lv.push({ v: 1.272, on: true }); saveDraw(); CH.prim.req(); renderModal(); } }
    else if (a === 'dlvreset') { var d2 = drawById(CH.modal && CH.modal.id); if (d2) { editStart(); d2.lv = FIBL.map(function (v) { return { v: v, on: true }; }); saveDraw(); CH.prim.req(); renderModal(); } }
    else if (a === 'csreset') { var kk = el.getAttribute('data-k'); setPath(CH.cs, kk, ''); applyCS(); renderModal(); savePref(); }
    else if (a === 'csdef') { CH.cs = dmerge(CS0, {}); CH.log = false; setTZ(); applyCS(); if (CH.meta) setData(CH.meta, false); load(true).then(function () { buildInd(); }); renderModal(); legend(); savePref(); }
    else if (a === 'mtab') { CH.modal.tab = v; renderModal(); }
    else if (a === 'mreset') { var y = indById(id); if (y) { y.p = Object.assign({}, CAT[y.k].def, y.k === 'custom' ? { code: CUSTOM_TPL } : {}); y.s = {}; y.h = []; buildInd(); renderModal(); savePref(); } }
    else if (a === 'mrun') { var z = indById(id), ta = CH.root.querySelector('.md-code'); if (z && ta) { z.p = z.p || {}; z.p.code = ta.value; buildInd(); renderModal(); savePref(); } }
    else if (a === 'mcopy') { var w = indById(id); try { navigator.clipboard.writeText(PINE[w.k] || ''); B.toast('Nusxa olindi'); } catch (e) { B.toast('Nusxa olib bo‘lmadi'); } }
    else if (a === 'theme') { CH.theme = CH.theme === 'dark' ? 'light' : 'dark'; applyTheme(); refreshBars(); savePref(); }
    else if (a === 'full') { var r = CH.root; if (document.fullscreenElement) document.exitFullscreen(); else if (r.requestFullscreen) r.requestFullscreen(); }
    else if (a === 'shot') { var cv = CH.chart.takeScreenshot(), l = document.createElement('a'); l.download = 'barlos-' + (curAsset() ? curAsset().sym : 'chart') + '-' + CH.tf + '.png'; l.href = cv.toDataURL('image/png'); l.click(); }
    else if (a === 'upl') upload();
    else if (a === 'alerts') { CH.modal = { type: 'alert', form: newAlert() }; CH.popOpen = false; renderPop(); renderModal(); loadAlerts(); }
    else if (a === 'altoggle') B.api('POST', '/api/alerts/' + id + '/toggle', {}).then(loadAlerts).then(refreshBars);
    else if (a === 'aldel') { if (confirm('Alert o‘chirilsinmi?')) B.api('POST', '/api/alerts/' + id + '/del', {}).then(loadAlerts).then(refreshBars); }
    else if (a === 'alsave') {
      var F = CH.modal.form, body = { aid: CH.aid, tf: F.tf, name: F.name || (curAsset().sym + ' ' + F.tf), cond: { a: F.a, op: F.op, b: F.op === 'true' ? null : F.b }, on: F.on, act: F.act, once: F.once, email: F.email, msg: F.msg };
      B.api('POST', '/api/alerts', body).then(function () { B.toast('Alert saqlandi'); CH.modal.form = newAlert(); return loadAlerts(); }).then(refreshBars).catch(function (e) { B.toast(e.message); });
    }
  }
  function onField(t) {
    var a = t.getAttribute('data-ch'), id = t.getAttribute('data-id'), F = CH.modal && CH.modal.form, dd;
    if (a === 'dtcolor' || a === 'dtw' || a === 'dtls') { dd = selD(); if (dd) { editStart(); if (a === 'dtcolor') dd.c = t.value; else if (a === 'dtw') dd.w = +t.value; else dd.ls = +t.value; saveDraw(); CH.prim.req(); } return; }
    if (a === 'dp' || a === 'dpt' || a === 'dlv' || a === 'dv') {
      dd = drawById(CH.modal && CH.modal.id); if (!dd) return; editStart();
      if (a === 'dp') { var pn = t.getAttribute('data-p'); dd[pn] = t.type === 'checkbox' ? t.checked : (t.type === 'number' || t.getAttribute('data-num')) ? (isFinite(+t.value) ? +t.value : 0) : (pn === 'tx' ? t.value.slice(0, 200) : t.value); if (pn === 'c') updDT(); }
      else if (a === 'dpt') { var pi = +t.getAttribute('data-i'), pf = t.getAttribute('data-f'); if (pf === 'p') { if (isFinite(+t.value) && t.value !== '') dd.pts[pi].p = +t.value; } else { var tv = tOut(t.value); if (tv != null) dd.pts[pi].t = tv; } }
      else if (a === 'dlv') { dd.lv = fibLv(dd).map(function (q) { return Object.assign({}, q); }); var q = dd.lv[+t.getAttribute('data-i')], lf = t.getAttribute('data-f'); if (q) { if (lf === 'on') q.on = t.checked; else if (lf === 'v') q.v = Math.max(-10, Math.min(20, +t.value || 0)); else q.c = t.value; } }
      else { var tf0 = t.getAttribute('data-tf'); dd.h = (dd.h || []).filter(function (x) { return x !== tf0; }); if (!t.checked) dd.h.push(tf0); }
      saveDraw(); CH.prim.req(); return;
    }
    if (a === 'cs') {
      var ck = t.getAttribute('data-k'), cty = t.getAttribute('data-t'), cv = cty === 'b' ? t.checked : cty === 'n' ? Math.max(0, Math.min(45, +t.value || 0)) : t.value; if (ck === 'cl') cv = +cv;
      if (ck === 'theme') { CH.theme = cv === 'light' ? 'light' : 'dark'; applyTheme(); refreshBars(); renderModal(); savePref(); return; }
      if (ck === 'sc.mode') CH.log = cv === 'log';
      setPath(CH.cs, ck, cv); csChanged(ck); if (ck === 'type' || ck === 'sc.mode') refreshBars(); return;
    }
    if (a === 'mp') { var it = indById(id); it.p = it.p || {}; it.p[t.getAttribute('data-p')] = t.type === 'checkbox' ? t.checked : (t.tagName === 'SELECT' ? t.value : Math.max(0, +t.value || 0)); rebuildSoon(); }
    else if (a === 'ms') { var i2 = indById(id), l = t.getAttribute('data-l'), f = t.getAttribute('data-f'); i2.s = i2.s || {}; i2.s[l] = i2.s[l] || {}; i2.s[l][f] = f === 'v' ? t.checked : (f === 'c' ? t.value : +t.value); rebuildSoon(); }
    else if (a === 'mv') { var i3 = indById(id), tf = t.getAttribute('data-tf'); i3.h = (i3.h || []).filter(function (x) { return x !== tf; }); if (!t.checked) i3.h.push(tf); rebuildSoon(); }
    else if (a === 'alpre') { if (t.value) { CH.modal.form = newAlert(t.value); renderModal(); } }
    else if (a === 'alname') F.name = t.value; else if (a === 'altf') F.tf = t.value; else if (a === 'alon') F.on = t.value; else if (a === 'alact') F.act = t.value; else if (a === 'almsg') F.msg = t.value;
    else if (a === 'alonce') F.once = t.checked; else if (a === 'alemail') F.email = t.checked;
    else if (a === 'alop') { F.op = t.value; if (t.value !== 'true' && !F.b) F.b = { k: 'value', v: 0 }; renderModal(); }
    else if (a === 'alref') { var w = t.getAttribute('data-w'); F[w] = mkRef(t.value); if (w === 'a' && F.op === 'true' && t.value !== 'algobb') F.op = 'crossover'; renderModal(); }
    else if (a === 'alf') F[t.getAttribute('data-w')][t.getAttribute('data-f')] = t.value;
    else if (a === 'alv') F[t.getAttribute('data-w')].v = +t.value;
    else if (a === 'alp') F[t.getAttribute('data-w')].p[t.getAttribute('data-k')] = +t.value;
  }

  /* ---------- yaratish ---------- */
  function build() {
    var root = document.createElement('div'); root.className = 'ch';
    root.innerHTML = '<div class="ch-top"></div><div class="ch-body"><div class="ch-tools"></div><div class="ch-stage"><div class="ch-chart"></div><div class="ch-cd" hidden></div><div class="ch-dt" hidden></div><div class="ch-legend"></div><div class="ch-warn" hidden></div><div class="ch-pop" hidden></div><div class="ch-modal" hidden></div></div></div><input type="file" class="ch-file" accept=".xlsx,.xls,.csv,.txt,.html" multiple hidden>';
    CH.root = root; var o = themeOpts(CH.theme);
    CH.chart = LW.createChart(root.querySelector('.ch-chart'), {
      autoSize: true, layout: { background: { type: LW.ColorType.Solid, color: o.bg }, textColor: o.tx, fontFamily: 'Inter, system-ui, sans-serif', panes: { separatorColor: o.bd } }, grid: { vertLines: { color: o.grid }, horzLines: { color: o.grid } },
      crosshair: { mode: LW.CrosshairMode.Normal }, rightPriceScale: { borderColor: o.bd, scaleMargins: { top: 0.08, bottom: 0.08 } }, timeScale: { borderColor: o.bd, timeVisible: false, secondsVisible: false, rightOffset: 8, barSpacing: 8 }
    });
    CH.candle = CH.chart.addSeries(LW.CandlestickSeries, { upColor: PCOL.up, downColor: PCOL.dn, borderUpColor: PCOL.up, borderDownColor: PCOL.dn, wickUpColor: PCOL.up, wickDownColor: PCOL.dn });
    CH.prim = new DrawPrim(); CH.candle.attachPrimitive(CH.prim);
    CH.chart.subscribeCrosshairMove(onMove);
    CH.chart.timeScale().subscribeVisibleLogicalRangeChange(function (r) { if (r && document.body.contains(CH.root) && CH.root.clientWidth > 100) CH.vr = r; tick(); });
    root.addEventListener('mousedown', function (e) { CH.down = e.target.closest('.ch-chart') && e.button === 0 ? { x: e.clientX, y: e.clientY } : null; startDrag(e); }, true);
    window.addEventListener('mouseup', function (e) {
      var d = CH.down; CH.down = null; if (!d || !CH.root || CH.drag && CH.drag.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
      var el = CH.root.querySelector('.ch-chart'), r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x > el.clientWidth - CH.chart.priceScale('right').width() || y > el.clientHeight - CH.chart.timeScale().height()) return;
      onClick({ point: { x: x, y: y } });
    });
    root.addEventListener('dblclick', function (e) {
      if (!e.target.closest('.ch-chart') || CH.tool !== 'cursor') return; var el = CH.root.querySelector('.ch-chart'), r = el.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      if (h) { CH.sel = h.id; updDT(); CH.modal = { type: 'draw', id: h.id, tab: 'sty' }; renderModal(); }
    });
    root.addEventListener('click', function (e) { var el = e.target.closest('[data-ch]'); if (el && /^(BUTTON|SPAN|DIV|SVG|PATH)$/i.test(el.tagName) && el.tagName !== 'SELECT') onAct(el); });
    root.addEventListener('change', function (e) {
      var t = e.target, a = t.getAttribute('data-ch'); if (!a) return;
      if (a === 'asset') { CH.aid = t.value; try { localStorage.setItem('barlos.chart.aid', CH.aid); } catch (x) { } CH.hoverI = null; savePref(); loadLayout().then(function () { return load(true); }); }
      else if (a === 'indp') onField(t); else if (t.tagName === 'INPUT' && t.type === 'file') doUpload(t.files); else onField(t);
    });
    root.addEventListener('input', function (e) { var t = e.target, a = t.getAttribute('data-ch'); if (a === 'alname' || a === 'almsg' || a === 'alv' || a === 'alp' || a === 'mp' && t.type === 'number' || a === 'dtcolor' || a === 'dpt' && t.type === 'number' || a === 'dlv' && t.type !== 'checkbox' || a === 'dp' && t.type !== 'checkbox' && t.tagName !== 'SELECT' || a === 'cs' && (t.type === 'number' || t.type === 'color')) onField(t); });
    setInterval(function () { if (CH.root && document.body.contains(CH.root) && !document.hidden) load(false, true).then(function () { }); }, 30000);
    setInterval(tick, 1000);
  }
  function defaults() { var d = [{ id: nid(), k: 'vol', on: true, p: {} }]; if (B.isAdmin()) d.unshift({ id: nid(), k: 'algobb', on: true, p: Object.assign({}, CAT.algobb.def) }); return d; }
  function init() {
    if (CH.loaded || CH.initing) return; CH.initing = true; build(); var as = chartAssets(), saved = null; try { saved = localStorage.getItem('barlos.chart.aid'); } catch (e) { }
    B.api('GET', '/api/chart').then(function (r) {
      var p = r.pref;
      if (p) { CH.ind = (p.ind || []).filter(function (x) { return CAT[x.k] && (!CAT[x.k].admin || B.isAdmin()); }); CH.tf = p.tf || 'D'; CH.theme = p.theme || 'dark'; CH.log = !!p.log; CH.magnet = !!p.magnet; CH.cs = dmerge(CS0, p.cs || {}); setTZ(); if (p.aid) saved = saved || p.aid; } else CH.ind = defaults();
      CH.aid = (as.filter(function (a) { return a.id === saved; })[0] || as[0] || {}).id; applyTheme(); applyScale(); applyTimeFmt(); refreshBars();
      return loadLayout();
    }).then(function () { buildInd(); loadAlerts().then(function () { if (CH.root) refreshBars(); }); return load(true); }).then(function () { CH.loaded = true; CH.initing = false; buildInd(); }).catch(function (e) { CH.initing = false; showStatus(e.message, true); });
  }
  B.pages.chart = function () {
    var as = chartAssets(); if (!as.length) return B.empty('Chart uchun aktiv yo‘q', 'Administrator aktiv qo‘shgandan so‘ng bu yerda chart paydo bo‘ladi.');
    return '<div id="chartHost" class="ch-host"></div>';
  };
  B.after = function () {
    var host = document.getElementById('chartHost'); if (!host) return;
    if (!CH.root) init();
    host.appendChild(CH.root);
    var as = chartAssets(); if (CH.aid && !as.some(function (a) { return a.id === CH.aid; }) && as.length) { CH.aid = as[0].id; loadLayout().then(function () { load(true); }); }
    var sel = CH.root.querySelector('.ch-asset'); if (sel && CH.loaded && sel.options.length !== as.length) CH.root.querySelector('.ch-top').innerHTML = topHtml();
    requestAnimationFrame(function () { try { CH.chart.resize(CH.root.querySelector('.ch-chart').clientWidth, CH.root.querySelector('.ch-chart').clientHeight); if (CH.vr) CH.chart.timeScale().setVisibleLogicalRange(CH.vr); tick(); } catch (e) { } });
  };
  /* Alert ishga tushganda istalgan sahifada xabar */
  var seenLog = null;
  B.onState = function (s) {
    var log = s.alog || []; CH.alerts = s.alerts || CH.alerts;
    if (seenLog === null) { seenLog = {}; log.forEach(function (g) { seenLog[g.id] = 1; }); return; }
    log.slice().reverse().forEach(function (g) { if (!seenLog[g.id]) { seenLog[g.id] = 1; B.toast('🔔 ' + g.text + (g.signal ? ' · ' + g.signal : '')); CH.alog = log; } });
  };
})();
