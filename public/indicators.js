/* Texnik indikatorlar (TradingView/Pine v5 bilan mos): SMA, EMA, Bollinger, RSI, MACD, Stoch RSI va admin indikatori "BB (AlgoAlpha copy)". */
(function (root) {
  'use strict';
  var NA = NaN;
  function isn(v) { return v === null || v === undefined || v !== v; }
  function sma(a, n) {
    var o = [], s = 0, c = 0, i;
    for (i = 0; i < a.length; i++) {
      if (isn(a[i])) { o.push(NA); continue; }
      s += a[i]; c++;
      if (i >= n && !isn(a[i - n])) { s -= a[i - n]; c--; }
      o.push(i >= n - 1 && c === n ? s / n : NA);
    }
    return o;
  }
  /* Pine ta.ema: birinchi qiymatdan boshlanadi */
  function ema(a, n) {
    var k = 2 / (n + 1), o = [], p = NA, i;
    for (i = 0; i < a.length; i++) {
      if (isn(a[i])) { o.push(NA); continue; }
      p = isn(p) ? a[i] : k * a[i] + (1 - k) * p; o.push(p);
    }
    return o;
  }
  /* Pine ta.rma (Wilder): boshida SMA */
  function rma(a, n) {
    var o = [], p = NA, s = 0, c = 0, i;
    for (i = 0; i < a.length; i++) {
      if (isn(a[i])) { o.push(NA); continue; }
      if (isn(p)) { s += a[i]; c++; if (c === n) { p = s / n; o.push(p); } else o.push(NA); }
      else { p = (p * (n - 1) + a[i]) / n; o.push(p); }
    }
    return o;
  }
  /* Pine ta.stdev (populyatsiya bo'yicha) */
  function stdev(a, n) {
    var o = [], i, j, m, s;
    for (i = 0; i < a.length; i++) {
      if (i < n - 1) { o.push(NA); continue; }
      m = 0; for (j = i - n + 1; j <= i; j++) m += a[j]; m /= n;
      s = 0; for (j = i - n + 1; j <= i; j++) s += (a[j] - m) * (a[j] - m);
      o.push(Math.sqrt(s / n));
    }
    return o;
  }
  function bb(c, n, mult) {
    var b = sma(c, n), d = stdev(c, n);
    return { basis: b, upper: b.map(function (v, i) { return v + mult * d[i]; }), lower: b.map(function (v, i) { return v - mult * d[i]; }) };
  }
  function rsi(c, n) {
    var up = [NA], dn = [NA], i, ch;
    for (i = 1; i < c.length; i++) { ch = c[i] - c[i - 1]; up.push(Math.max(ch, 0)); dn.push(Math.max(-ch, 0)); }
    var u = rma(up, n), d = rma(dn, n);
    return c.map(function (_, i) { if (isn(u[i]) || isn(d[i])) return NA; return d[i] === 0 ? 100 : (u[i] === 0 ? 0 : 100 - 100 / (1 + u[i] / d[i])); });
  }
  function macd(c, f, s, g) {
    var ef = ema(c, f), es = ema(c, s), m = c.map(function (_, i) { return ef[i] - es[i]; }), sg = ema(m, g);
    return { macd: m, signal: sg, hist: m.map(function (v, i) { return v - sg[i]; }) };
  }
  /* TradingView "Stochastic RSI": K = sma(stoch(rsi), smoothK), D = sma(K, smoothD) */
  function stochrsi(c, rl, sl, kk, dd) {
    var r = rsi(c, rl), st = r.map(function (_, i) {
      if (i < sl - 1 || isn(r[i])) return NA;
      var hi = -Infinity, lo = Infinity, j, ok = true;
      for (j = i - sl + 1; j <= i; j++) { if (isn(r[j])) { ok = false; break; } hi = Math.max(hi, r[j]); lo = Math.min(lo, r[j]); }
      if (!ok) return NA; return hi === lo ? 0 : 100 * (r[i] - lo) / (hi - lo);
    }), k = sma(st, kk);
    return { k: k, d: sma(k, dd) };
  }
  /* "BB (AlgoAlpha copy)": Pine kodidagi mantiq. 2σ va 3σ zonalar, 4 ta EMA, BUY/SELL belgilari */
  function algobb(c, p) {
    p = p || {};
    var n = p.len || 20, b = bb(c, n, 3), b2 = bb(c, n, 2), e1 = ema(c, p.e1 || 14), e2 = ema(c, p.e2 || 20), e3 = ema(c, p.e3 || 50), e4 = ema(c, p.e4 || 200), sig = [], i, pct = [];
    for (i = 0; i < c.length; i++) pct.push(isn(b2.upper[i]) ? NA : 100 * (c[i] - b2.lower[i]) / (b2.upper[i] - b2.lower[i]));
    for (i = 1; i < c.length; i++) {
      if (isn(pct[i]) || isn(pct[i - 1])) continue;
      if (pct[i - 1] <= 0 && pct[i] > 0) sig.push({ i: i, side: 'BUY' });
      if (pct[i - 1] >= 100 && pct[i] < 100) sig.push({ i: i, side: 'SELL' });
    }
    return { u2: b2.upper, l2: b2.lower, u3: b.upper, l3: b.lower, e1: e1, e2: e2, e3: e3, e4: e4, signals: sig };
  }

  /* ---- manba (close/open/hl2/...) va alert uchun "ref" qatorlari ---- */
  function gv(x, k) { var m = { open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v' }; return x[k] != null ? x[k] : x[m[k]]; }
  function srcArr(cs, s) {
    return cs.map(function (x) {
      var o = gv(x, 'open'), h = gv(x, 'high'), l = gv(x, 'low'), c = gv(x, 'close');
      switch (s) { case 'open': return o; case 'high': return h; case 'low': return l; case 'hl2': return (h + l) / 2; case 'hlc3': return (h + l + c) / 3; case 'ohlc4': return (o + h + l + c) / 4; default: return c; }
    });
  }
  function refSeries(ref, cs) {
    var P = ref.p || {}, src = srcArr(cs, P.src), r;
    switch (ref.k) {
      case 'price': return srcArr(cs, ref.f || 'close');
      case 'value': return cs.map(function () { return +ref.v; });
      case 'ema': return ema(src, P.len || 20);
      case 'sma': return sma(src, P.len || 50);
      case 'bb': r = bb(src, P.len || 20, P.mult || 2); return r[ref.line || 'basis'];
      case 'rsi': return rsi(src, P.len || 14);
      case 'macd': r = macd(src, P.fast || 12, P.slow || 26, P.sig || 9); return r[ref.line || 'macd'];
      case 'stochrsi': r = stochrsi(src, P.rl || 14, P.sl || 14, P.k || 3, P.d || 3); return r[ref.line || 'k'];
      case 'algobb':
        r = algobb(srcArr(cs, 'close'), P);
        if (ref.line === 'buy' || ref.line === 'sell') { var a = cs.map(function () { return 0; }); r.signals.forEach(function (q) { if ((q.side === 'BUY') === (ref.line === 'buy')) a[q.i] = 1; }); return a; }
        return r[ref.line || 'e1'];
    }
    throw new Error('Noma’lum ko‘rsatkich: ' + ref.k);
  }
  /* Alert sharti: oxirgi yopilgan (yoki joriy) sham bo'yicha tekshirish. Qaytaradi {i} yoki null */
  function evalCond(cond, cs, i) {
    var A = refSeries(cond.a, cs), Bv = refSeries(cond.b || { k: 'value', v: 0 }, cs), a = A[i], b = Bv[i], pa = A[i - 1], pb = Bv[i - 1];
    if (isn(a) || isn(b)) return false;
    switch (cond.op) {
      case 'crossover': return !isn(pa) && !isn(pb) && pa <= pb && a > b;
      case 'crossunder': return !isn(pa) && !isn(pb) && pa >= pb && a < b;
      case 'gt': return a > b; case 'lt': return a < b; case 'ge': return a >= b; case 'le': return a <= b;
      case 'true': return a !== 0;
    }
    return false;
  }

  /* ---- Seans yopilishi: qoida {tz,h,m,wd} bo'yicha keyingi yopilish vaqti (ms) ---- */
  var DF = {};
  function dtf(tz) { return DF[tz] || (DF[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' })); }
  function parts(ms, tz) {
    var o = {}; dtf(tz).formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
  }
  function zoned(y, mo, d, h, mi, tz) {
    var g = Date.UTC(y, mo - 1, d, h, mi); if (tz === 'UTC') return g;
    var p = parts(g, tz), off = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - g, r = g - off;
    p = parts(r, tz); off = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - r; return g - off;
  }
  var SEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400 };
  function nextClose(now, rule, tf) {
    if (SEC[tf]) return (Math.floor(now / 1000 / SEC[tf]) + 1) * SEC[tf] * 1000;
    var tz = rule.tz, k, base = parts(now, tz), best = null;
    for (k = 0; k < 40; k++) {
      var dd = new Date(Date.UTC(base.y, base.mo - 1, base.d + k)), y = dd.getUTCFullYear(), mo = dd.getUTCMonth() + 1, d = dd.getUTCDate(), dow = dd.getUTCDay();
      var ms = zoned(y, mo, d, rule.h, rule.m, tz); if (ms <= now) continue;
      if (rule.wd && (dow === 0 || dow === 6)) continue;
      if (tf === 'D') return ms;
      if (tf === 'W') { if (rule.wd ? dow === 5 : dow === 1) return ms; continue; }
      if (tf === 'M') {
        if (rule.wd) { var nx = new Date(Date.UTC(y, mo - 1, d + 1)), nd = nx.getUTCDay(); if (nd === 6) nx = new Date(Date.UTC(y, mo - 1, d + 3)); else if (nd === 0) nx = new Date(Date.UTC(y, mo - 1, d + 2)); if (nx.getUTCMonth() + 1 !== mo) return ms; }
        else if (d === 1) return ms;
      }
    }
    return best;
  }
  /* Oxirgi sham yopilganmi? t = sham ochilish vaqti (soniya, UTC) */
  function barClosed(bar, tf, rule, now) {
    var t = bar.t;
    if (SEC[tf]) return (t + SEC[tf]) * 1000 <= now;
    if (tf === 'D') {
      var tz = rule.tz, p = parts(t * 1000 + (tz === 'UTC' ? 0 : 12 * 3600e3), tz === 'UTC' ? 'UTC' : 'UTC');
      if (tz === 'UTC') return (t + 86400) * 1000 <= now;
      return zoned(p.y, p.mo, p.d, rule.h, rule.m, tz) <= now;
    }
    return (t + (tf === 'W' ? 7 : 31) * 86400) * 1000 <= now;
  }

  var Ind = { srcArr: srcArr, refSeries: refSeries, evalCond: evalCond, nextClose: nextClose, barClosed: barClosed, zoned: zoned, parts: parts, sma: sma, ema: ema, rma: rma, stdev: stdev, bb: bb, rsi: rsi, macd: macd, stochrsi: stochrsi, algobb: algobb };
  if (typeof module !== 'undefined' && module.exports) module.exports = Ind; else root.Ind = Ind;
})(typeof self !== 'undefined' ? self : this);
