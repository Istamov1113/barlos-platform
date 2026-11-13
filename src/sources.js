'use strict';
/* Narx va aktiv ma'lumotlari manbalari: Bitget, CoinMarketCap (kalit bilan) / CoinGecko, Finviz, uzse.uz, CBU (dollar kursi).
   Har bir manba: search(q) -> [{ref,sym,name,group,curr,price}], quote(ref) -> {price,curr,name?}. */
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/* ---- Tarmoq: xato sharhi, so'rovlar oralig'i (throttle), 429 da kutib qayta urinish, ixtiyoriy proksi ---- */
const GAP = { 'uzse.uz': 1200, 'finviz.com': 900, 'api.coingecko.com': 1500, 'api.bitget.com': 350, 'data-api.binance.vision': 150, 'api.binance.com': 150, 'query1.finance.yahoo.com': 1200, 'query2.finance.yahoo.com': 1200 }, gate = {}, blocked = {}, down = {};
const NETDOWN = /UND_ERR_CONNECT_TIMEOUT|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|Vaqt tugadi/;
function resetNet() { Object.keys(down).forEach(k => delete down[k]); Object.keys(blocked).forEach(k => delete blocked[k]); bgCache = { t: 0, m: null }; bnCache = { t: 0, m: null }; fbCache = { t: 0, m: null }; }
function explain(e, url) {
  const host = (() => { try { return new URL(url).host; } catch (x) { return ''; } })(), c = e && e.cause, code = (c && (c.code || c.message)) || '';
  if (e && e.name === 'TimeoutError') return 'Vaqt tugadi (' + host + ')';
  if (e && /fetch failed/i.test(e.message || '')) return 'Tarmoq xatosi (' + host + (code ? ': ' + code : '') + '): sayt bu kompyuterdan ochilmayapti (internet, DNS, VPN yoki provayder cheklovi)';
  return (e && e.message) || String(e);
}
let proxyAgent;
function dispatcher() {
  if (proxyAgent !== undefined) return proxyAgent;
  proxyAgent = null; const u = process.env.BARLOS_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy;
  if (u) { try { const { ProxyAgent } = require('undici'); proxyAgent = new ProxyAgent(u); } catch (e) { console.error('Proksi sozlangan, lekin "undici" o‘rnatilmagan: npm i undici'); } }
  return proxyAgent;
}
/* Bitget shaxsiy API kaliti (.env: BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE). Bitget so'rovlari imzolanadi: ACCESS-SIGN = base64(HMAC-SHA256(secret, timestamp + METHOD + yo'l + ?so'rov)) */
function bitgetAuth(url) {
  const k = process.env.BITGET_API_KEY, sec = process.env.BITGET_API_SECRET, pw = process.env.BITGET_API_PASSPHRASE; if (!k || !sec || !pw) return {};
  let u; try { u = new URL(url); } catch (e) { return {}; } if (u.host !== 'api.bitget.com') return {};
  const ts = String(Date.now()), sig = require('crypto').createHmac('sha256', sec).update(ts + 'GET' + u.pathname + u.search).digest('base64');
  return { 'ACCESS-KEY': k, 'ACCESS-SIGN': sig, 'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': pw, 'Content-Type': 'application/json', locale: 'en-US' };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function slot(host) {
  const g = GAP[host]; if (!g) return;
  const prev = gate[host] || Promise.resolve(); let rel; gate[host] = new Promise(r => { rel = r; });
  await prev; setTimeout(rel, g);
}
/* ---- O'tkazgich (Google Apps Script): provayder bevosita yo'lni to'ssa, so'rovni Google serveri yuboradi. .env: RELAY_URL, RELAY_KEY ---- */
const RELAYH = new Set(['api.bitget.com', 'api.binance.com', 'data-api.binance.vision', 'query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'stooq.com', 'api.coingecko.com']);
const relayCfg = () => process.env.RELAY_URL && process.env.RELAY_KEY ? { url: process.env.RELAY_URL.trim(), key: process.env.RELAY_KEY.trim() } : null;
async function relayFetch(url, opt, rl) {
  const host = new URL(url).host;
  if (down.__relay && down.__relay > Date.now() && !opt.probe) throw new Error('O‘tkazgich vaqtincha ishlamayapti');
  await slot(host); let r;
  try {
    const init = { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(Math.max(opt.timeout || 0, 25000)), redirect: 'follow' }, d = dispatcher(); if (d) init.dispatcher = d;
    r = await fetch(rl.url + (rl.url.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(rl.key) + '&url=' + encodeURIComponent(url), init);
  } catch (e) { if (NETDOWN.test(explain(e, rl.url) + ((e.cause && e.cause.code) || '') + (e.name || ''))) down.__relay = Date.now() + 3 * 60e3; throw new Error('O‘tkazgich: ' + explain(e, rl.url)); }
  const txt = await r.text();
  if (!r.ok) { const e = new Error('O‘tkazgich HTTP ' + r.status + ': havola yoki kalit noto‘g‘ri bo‘lishi mumkin'); e.http = r.status; throw e; }
  const m = /^RELAYERR (\d{3})/.exec(txt);
  if (m) { const code = +m[1], e = new Error(code === 403 ? 'O‘tkazgich: kalit (RELAY_KEY) noto‘g‘ri' : 'HTTP ' + code + ' (' + host + ' · o‘tkazgich orqali)'); e.http = code; if (code === 429) blocked[host] = Date.now() + 60000; throw e; }
  if (/^\s*<(!doctype|html)/i.test(txt)) { const e = new Error('O‘tkazgich HTML qaytardi: Apps Script Deploy da "Who has access: Anyone" tanlanganini va oxirgi versiya joylanganini tekshiring'); e.http = 502; throw e; }
  return new Response(txt, { status: 200 });
}
async function request(url, opt = {}) {
  const rl = relayCfg(), hh = new URL(url).host;
  if (rl && RELAYH.has(hh) && !opt.direct) { try { return await relayFetch(url, opt, rl); } catch (e) { if (e.http) throw e; /* o'tkazgich ishlamasa: bevosita urinib ko'ramiz */ } }
  return request0(url, opt);
}
async function request0(url, opt = {}) {
  const host = new URL(url).host, tries = opt.tries || 2; let lastErr;
  if (down[host] && down[host] > Date.now() && !opt.probe) throw new Error('Tarmoq (' + host + '): yaqinda ulanib bo‘lmadi, ' + Math.ceil((down[host] - Date.now()) / 60000) + ' daqiqadan keyin qayta uriniladi (sayt bu kompyuterdan ochilmayapti: internet, DNS, VPN yoki provayder cheklovi)');
  for (let i = 0; i < tries; i++) {
    if (blocked[host] && blocked[host] > Date.now() + 15000) throw new Error('HTTP 429 (' + host + '): sayt so‘rovlarni vaqtincha cheklagan, ' + Math.ceil((blocked[host] - Date.now()) / 60000) + ' daqiqadan keyin avtomatik qayta uriniladi');
    if (blocked[host] && blocked[host] > Date.now()) await sleep(blocked[host] - Date.now());
    await slot(host);
    try {
      const init = { headers: Object.assign({ 'user-agent': UA, accept: opt.json ? 'application/json' : 'text/html,*/*', 'accept-language': 'en,uz;q=0.8' }, opt.headers || {}), signal: AbortSignal.timeout(opt.timeout || 12000), redirect: 'follow' }, d = dispatcher(); if (d) init.dispatcher = d;
      Object.assign(init.headers, bitgetAuth(url));
      const r = await fetch(url, init);
      if (r.status === 429 || r.status === 503) { const ra = parseInt(r.headers.get('retry-after'), 10); blocked[host] = Date.now() + (ra > 0 ? Math.min(ra, 600) * 1000 : 45000 * (i + 1)); lastErr = new Error('HTTP ' + r.status + ' (' + host + ')'); continue; }
      if (!r.ok) { const e = new Error('HTTP ' + r.status + ' (' + host + ')'); e.http = r.status; throw e; }
      return r;
    } catch (e) { if (e.http) throw e; lastErr = new Error(explain(e, url)); if (NETDOWN.test(lastErr.message + ' ' + ((e.cause && e.cause.code) || '') + (e.name || ''))) { down[host] = Date.now() + 3 * 60e3; break; } if (i < tries - 1) await sleep(800 * (i + 1)); }
  }
  throw lastErr;
}
async function http(url, opt = {}) { const r = await request(url, opt); return opt.json ? r.json() : r.text(); }
async function httpBuf(url, opt = {}) { const r = await request(url, opt); return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' }; }
/* Bir nechta manzildan (zaxira hostlar) birinchi ishlaganini olish */
async function firstOf(urls, opt) { const errs = []; for (const u of urls) { try { return await http(u, Object.assign({ tries: 2 }, opt)); } catch (e) { errs.push(e.message); } } throw new Error(errs.join(' | ')); }
function num(s) {
  if (s == null) return NaN;
  s = String(s).replace(/[\s  ]/g, '').replace(/[^\d.,\-]/g, '');
  if (!s) return NaN;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c >= 0 && d >= 0) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  return parseFloat(s);
}
function text(html) {
  return String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '|').replace(/&nbsp;|&#160;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').replace(/(\|\s*)+/g, '|');
}

/* ---------- Binance (asosiy: narx va tarix) + Bitget (Binancedan topilmaganlar: tokenlashgan aksiyalar, XAUT...) ---------- */
const BN = () => (process.env.BINANCE_HOSTS ? process.env.BINANCE_HOSTS.split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean) : ['https://data-api.binance.vision', 'https://api.binance.com']);
const BG = ['https://api.bitget.com'];
let bgCache = { t: 0, m: null }, bnCache = { t: 0, m: null }, fbCache = { t: 0, m: null };
async function binanceAll() {
  if (bnCache.m && Date.now() - bnCache.t < 60000) return bnCache.m;
  const j = await firstOf(BN().map(h => h + '/api/v3/ticker/price'), { json: true });
  if (!Array.isArray(j)) throw new Error('Binance javobi kutilganidek emas');
  const m = {}; j.forEach(r => { const p = parseFloat(r.price); if (r.symbol && p > 0) m[r.symbol] = p; });
  bnCache = { t: Date.now(), m }; return m;
}
async function bitgetAll() {
  if (bgCache.m && Date.now() - bgCache.t < 60000) return bgCache.m;
  const j = await firstOf(BG.map(h => h + '/api/v2/spot/market/tickers'), { json: true });
  if (!j || !Array.isArray(j.data)) throw new Error('Bitget javobi kutilganidek emas');
  const m = {}; j.data.forEach(r => { const p = parseFloat(r.lastPr); if (r.symbol && p > 0) m[r.symbol] = p; });
  bgCache = { t: Date.now(), m }; return m;
}
/* Oxirgi zaxira: OKX (faqat oddiy kripto juftliklar) */
async function fallbackAll() {
  if (fbCache.m && Date.now() - fbCache.t < 15000) return fbCache.m;
  const m = {};
  const j = await http('https://www.okx.com/api/v5/market/tickers?instType=SPOT', { json: true, tries: 2 });
  ((j && j.data) || []).forEach(r => { const p = parseFloat(r.last), k = String(r.instId || '').replace('-', ''); if (k && p > 0) m[k] = p; });
  if (!Object.keys(m).length) throw new Error('OKX javob bermadi');
  fbCache = { t: Date.now(), m }; return m;
}
function bitgetGuess(sym) {
  const base = sym.replace(/USDT$/, '');
  if (/^[A-Z0-9]{3,8}ON$/.test(base) && base.length > 4) return { sym: base.slice(0, -2) + 'on', group: 'xalqaro' };
  if (/^(XAUT|PAXG)$/.test(base)) return { sym: base, group: 'metall' };
  if (/^R?SLV$/i.test(base)) return { sym: base, group: 'metall' };
  return { sym: base, group: 'kripto' };
}
const bitget = {
  async quote(ref) { const r = (await bitget.bulk([ref]))[ref]; if (r.error) throw new Error(r.error); return r; },
  async search(q) {
    const Q = String(q).toUpperCase().replace(/USDT$/, ''); let m = {}, errs = [];
    try { Object.assign(m, await bitgetAll()); } catch (e) { errs.push('Bitget: ' + e.message); }
    try { Object.assign(m, await binanceAll()); } catch (e) { errs.push('Binance: ' + e.message); }
    if (!Object.keys(m).length) throw new Error(errs.join(' | '));
    return Object.keys(m).filter(s => s.endsWith('USDT') && s.replace(/USDT$/, '').indexOf(Q) === 0).sort((a, b) => a.length - b.length).slice(0, 12)
      .map(s => Object.assign({ ref: s, name: s.replace(/USDT$/, ''), curr: 'USD', price: m[s] }, bitgetGuess(s)));
  },
  /* Narx: avval Binance (har 5 daqiqada bitta umumiy so'rov); Binancedan topilmaganlar uchun Bitget; undan ham bo'lmasa OKX */
  async bulk(refs) {
    const key = r => { const k = String(r).toUpperCase(); return /USDT$/.test(k) ? k : k + 'USDT'; }, o = {};
    let bn = {}, bnErr = null, bg = {}, bgErr = null, fb = null, fbErr = null;
    try { bn = await binanceAll(); } catch (e) { bnErr = e.message; }
    let need = refs.filter(r => !bn[key(r)]);
    if (need.length) { try { bg = await bitgetAll(); } catch (e) { bgErr = e.message; } }
    need = refs.filter(r => !bn[key(r)] && !bg[key(r)]);
    if (need.length && (bnErr || bgErr)) { try { fb = await fallbackAll(); } catch (e) { fbErr = e.message; } }
    refs.forEach(r => {
      const k = key(r);
      if (bn[k]) o[r] = { price: bn[k], curr: 'USD', via: 'Binance' };
      else if (bg[k]) o[r] = { price: bg[k], curr: 'USD', via: 'Bitget' };
      else if (fb && fb[k]) o[r] = { price: fb[k], curr: 'USD', via: 'zaxira manba (OKX)' };
      else if (bnErr || bgErr) o[r] = { error: [bnErr && 'Binance: ' + bnErr, bgErr && 'Bitget: ' + bgErr, fbErr && 'zaxira: ' + fbErr].filter(Boolean).join(' | ') };
      else o[r] = { error: '"' + r + '" juftligi Binance va Bitgetda topilmadi' };
    });
    return o;
  }
};

/* ---------- CoinMarketCap (kalit .env da) yoki CoinGecko (kalitsiz) ---------- */
const cmc = {
  hasKey: () => !!process.env.CMC_API_KEY,
  async quote(ref) {
    if (process.env.CMC_API_KEY) {
      const byId = /^id:/.test(ref), q = byId ? 'id=' + ref.slice(3) : 'symbol=' + encodeURIComponent(ref);
      const j = await http('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?convert=USD&' + q, { json: true, headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } });
      let d = j.data && Object.values(j.data)[0]; if (Array.isArray(d)) d = d[0];
      if (!d || !d.quote || !d.quote.USD) throw new Error('CoinMarketCap: "' + ref + '" topilmadi');
      return { price: d.quote.USD.price, curr: 'USD', name: d.name };
    }
    const j = await http('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=' + encodeURIComponent(ref), { json: true });
    if (!j[ref] || j[ref].usd == null) throw new Error('CoinGecko: "' + ref + '" topilmadi');
    return { price: j[ref].usd, curr: 'USD' };
  },
  async search(q) {
    if (process.env.CMC_API_KEY) {
      const j = await http('https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=15&sort=cmc_rank&symbol=' + encodeURIComponent(String(q).toUpperCase()), { json: true, headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } }).catch(() => ({ data: [] }));
      let list = j.data || [];
      if (!list.length) { const k = await http('https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=200&sort=cmc_rank', { json: true, headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } }); const Q = String(q).toLowerCase(); list = (k.data || []).filter(c => c.name.toLowerCase().includes(Q) || c.symbol.toLowerCase() === Q).slice(0, 10); }
      const out = [];
      for (const c of list.slice(0, 6)) { try { const p = await cmc.quote('id:' + c.id); out.push({ ref: 'id:' + c.id, sym: c.symbol, name: c.name, group: 'kripto', curr: 'USD', price: p.price }); } catch (e) { out.push({ ref: 'id:' + c.id, sym: c.symbol, name: c.name, group: 'kripto', curr: 'USD', price: null }); } }
      return out;
    }
    const j = await http('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(q), { json: true });
    const coins = (j.coins || []).slice(0, 6); if (!coins.length) return [];
    const pr = await http('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=' + coins.map(c => c.id).join(','), { json: true }).catch(() => ({}));
    return coins.map(c => ({ ref: c.id, sym: c.symbol.toUpperCase(), name: c.name, group: 'kripto', curr: 'USD', price: pr[c.id] ? pr[c.id].usd : null }));
  }
};

/* ---------- Finviz (AQSh aksiyalari va ETF) ---------- */
function finvizParse(html, t) {
  const tx = text(html); let price = NaN;
  const pats = [/quote-price_wrapper_price[^>]*>\s*([\d.,]+)/i, /data-testid="quote-price"[^>]*>\s*([\d.,]+)/i];
  for (const p of pats) { const m = html.match(p); if (m) { price = num(m[1]); break; } }
  if (!(price > 0)) { const m = tx.match(/\|Price\|([\d.,]+)\|/); if (m) price = num(m[1]); }
  if (!(price > 0)) { const m = tx.match(/\|Prev Close\|([\d.,]+)\|/); if (m) price = num(m[1]); }
  if (!(price > 0)) throw new Error('Finviz sahifasidan narx topilmadi (sahifa tuzilishi o‘zgargan yoki bloklangan)');
  let name = ''; const ti = html.match(/<title>([^<]*)<\/title>/i);
  if (ti) { const m = ti[1].match(/^\s*[A-Z0-9.\-]+\s+(?:Stock Quote[^|]*\|\s*)?([^|]+?)(?:\s+Stock|\s*\||$)/); name = m ? m[1].trim() : ''; }
  const nm2 = html.match(/class="quote-header_ticker-wrapper_company"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+)/i); if (nm2) name = nm2[1].trim();
  return { price, curr: 'USD', name: name || t };
}
const finviz = {
  async quote(ref) { const t = String(ref).toUpperCase().replace(/[^A-Z0-9.\-]/g, ''); return finvizParse(await http('https://finviz.com/quote.ashx?t=' + t + '&p=d'), t); },
  async search(q) {
    const t = String(q).toUpperCase().replace(/[^A-Z0-9.\-]/g, ''); if (!t) return [];
    const r = await finviz.quote(t);
    return [{ ref: t, sym: t + 'on', name: r.name, group: 'xalqaro', curr: 'USD', price: r.price }];
  }
};

/* ---------- uzse.uz (milliy aksiya va obligatsiyalar) ----------
   Sahifa tuzilishi (sinalgan matn): "UZNF UZ7058980010 <NOMI>" qatoridan keyin katta narx "6.76 UZS", so'ng
   "Цена на дату последней сделки" va "Дата последней сделки". Narx matndagi birinchi "<son> UZS" dan olinadi,
   shuning uchun til (uz/ru/en) farqi xalaqit bermaydi. Zaxira: "Цена закрытия", "Closing price" va natijalar jadvali. */
const UZ_HEADERS = { 'accept-language': 'ru,en;q=0.8,uz;q=0.6', referer: 'https://uzse.uz/' };
const uzTyp = {}; /* ISIN -> STK|BND (topilgach eslab qolinadi: ortiqcha so'rov va 429 bo'lmasligi uchun) */
function uzseUrls(ref, a) {
  ref = String(ref).trim();
  if (/^https?:\/\//i.test(ref)) return [ref];
  const isin = ref.toUpperCase(), first = uzTyp[isin] || (a && a.group === 'obligatsiya' ? 'BND' : 'STK'), second = first === 'STK' ? 'BND' : 'STK';
  return uzTyp[isin] ? [first, second].slice(0, 1).map(t => 'https://uzse.uz/isu_infos/' + t + '?isu_cd=' + isin) : [first, second].map(t => 'https://uzse.uz/isu_infos/' + t + '?isu_cd=' + isin);
}
const NUMRE = '(\\d[\\d\\s\\u00a0.,]*)';
function uzseParse(html, wantIsin) {
  const tx = text(html); let price = NaN, how = '';
  let sym = '', name = '', isin = wantIsin || '';
  const head = tx.match(/([A-Z][A-Z0-9]{2,9})[\s|]*(UZ[A-Z0-9]{10})[\s|]*<?([^|]{3,160})/);
  if (head && (!wantIsin || head[2] === wantIsin.toUpperCase())) { sym = head[1]; isin = head[2]; name = head[3].replace(/^[<\s]+|[>\s]+$/g, '').replace(/>\s*(?=\S)/, ' ').trim(); }
  /* 1) ISIN dan keyingi birinchi "<son> UZS" */
  const at = isin ? tx.indexOf(isin) : 0, seg = tx.slice(at < 0 ? 0 : at, (at < 0 ? 0 : at) + 700);
  let m = seg.match(new RegExp(NUMRE + '[\\s|]*(?:UZS|so.m|сум)', 'i'));
  if (m && num(m[1]) > 0) { price = num(m[1]); how = 'UZS belgisi'; }
  /* 2) yorliqlar */
  if (!(price > 0)) {
    for (const l of ['Цена закрытия', 'Closing price', 'Close price', 'Yopilish narxi', 'Oxirgi narx', 'Last price', 'Цена последней сделки']) {
      const r = seg.replace(/\d{2}\.\d{2}\.\d{4}/g, '§').match(new RegExp(l + '[^0-9\\-§]{0,20}?' + NUMRE, 'i')); if (r && num(r[1]) > 0) { price = num(r[1]); how = l; break; }
    }
  }
  /* 3) natijalar jadvalining birinchi qatori: sana | narx */
  if (!(price > 0)) { const r = seg.match(/\d{2}\.\d{2}\.\d{4}[\s|]+([\d.,]+)/); if (r && num(r[1]) > 0) { price = num(r[1]); how = 'jadval'; } }
  if (!(price > 0)) throw new Error('uzse.uz sahifasidan narx topilmadi. Sahifa matni: ' + tx.slice(0, 300));
  const dt = tx.match(/(?:последней сделки|last trade|oxirgi bitim)[^0-9]{0,12}(\d{2}\.\d{2}\.\d{4})/i);
  return { price, curr: 'UZS', name: name || (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '', sym, isin, how, date: dt ? dt[1] : '' };
}
let uzMap = { t: 0, m: null };
async function uzseTickers() {
  if (uzMap.m && Date.now() - uzMap.t < 3600e3) return uzMap.m;
  const m = {};
  for (const u of ['https://uzse.uz/', 'https://uzse.uz/isu_infos/STK?isu_cd=UZ7058980010']) {
    let html; try { html = await http(u, { headers: UZ_HEADERS }); } catch (e) { continue; }
    const re = /<a[^>]*isu_cd=(UZ[A-Z0-9]{10})[^>]*>([\s\S]{0,200}?)<\/a>/gi; let r;
    while ((r = re.exec(html))) { const t = text(r[2]).replace(/\|/g, ' ').trim().split(/\s+/)[0]; if (t && /^[A-Z0-9]{2,10}$/i.test(t)) m[t.toUpperCase()] = r[1].toUpperCase(); }
    const re2 = /isu_cd=(UZ[A-Z0-9]{10})/gi;
    while ((r = re2.exec(html))) { const ctx = text(html.slice(Math.max(0, r.index - 200), r.index + 120)); const t = ctx.match(/([A-Z][A-Z0-9]{2,9})[\s|]*$/) ; if (t && !m[t[1]]) m[t[1]] = r[1].toUpperCase(); }
  }
  if (Object.keys(m).length) uzMap = { t: Date.now(), m };
  return m;
}
const uzse = {
  async quote(ref, a) {
    const errs = [];
    for (const u of uzseUrls(ref, a)) {
      try { const wi = (u.match(/isu_cd=(UZ[A-Z0-9]{10})/i) || [])[1], r = uzseParse(await http(u, { headers: UZ_HEADERS }), wi); const tp = /isu_infos\/(STK|BND)/i.exec(u); if (wi && tp) uzTyp[wi.toUpperCase()] = tp[1].toUpperCase(); return r; } catch (e) { errs.push(e.message); if (/429|Tarmoq|Vaqt tugadi/.test(e.message)) break; }
    }
    throw new Error(errs.filter(e => !/404/.test(e))[0] || errs[0]);
  },
  async search(q) {
    const Q = String(q).trim();
    let ref = Q;
    if (!/^UZ[A-Z0-9]{10}$/i.test(Q) && !/^https?:/i.test(Q)) {
      const m = await uzseTickers(), isin = m[Q.toUpperCase()];
      if (!isin) throw new Error('"' + Q + '" tikeri uzse.uz bosh sahifasidan topilmadi. ISIN kodini (UZ… bilan boshlanadigan 12 belgi) yoki sahifa havolasini kiriting.');
      ref = isin;
    }
    const r = await uzse.quote(ref), isBond = uzTyp[String(ref).toUpperCase()] === 'BND' || /BND/i.test(ref);
    return [{ ref: /^https?:/i.test(ref) ? ref : ref.toUpperCase(), sym: r.sym || (/^UZ/i.test(Q) ? Q : Q.toUpperCase()), name: r.name, group: isBond ? 'obligatsiya' : 'milliy', curr: 'UZS', price: r.price }];
  }
};

/* ---------- Umumiy veb-sahifa: havola + CSS selektor (Google Sheets IMPORTXML ga o'xshash) ----------
   ref formati:  https://sayt.uz/sahifa  ||  .narx-sinfi   (|| dan keyin brauzerdan "Copy selector" bilan olingan selektor) */
const web = {
  async quote(ref) {
    const [url, sel] = String(ref).split('||').map(x => x && x.trim());
    if (!/^https?:\/\//i.test(url || '') || !sel) throw new Error('Format: https://sayt.uz/sahifa || CSS-selektor');
    const cheerio = require('cheerio'), $ = cheerio.load(await http(url, { headers: UZ_HEADERS })), el = $(sel).first();
    if (!el.length) throw new Error('Selektor bo‘yicha element topilmadi: ' + sel);
    const v = num(el.text()); if (!(v > 0)) throw new Error('Elementdagi matn son emas: "' + el.text().trim().slice(0, 60) + '"');
    return { price: v, curr: null, name: ($('title').first().text() || '').trim() };
  },
  async search(q) { const r = await web.quote(q); return [{ ref: q, sym: '', name: r.name, group: 'milliy', curr: 'UZS', price: r.price }]; }
};

/* ---------- CBU (rasmiy dollar kursi) ---------- */
async function cbuUsd() {
  const j = await http('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/', { json: true });
  const r = parseFloat(j && j[0] && j[0].Rate); if (!(r > 0)) throw new Error('CBU kursi o‘qilmadi'); return r;
}

const SRC = { bitget, cmc, finviz, uzse, web };
const NAMES = { bitget: 'Bitget', cmc: 'CoinMarketCap / CoinGecko', finviz: 'Finviz', uzse: 'uzse.uz', web: 'Veb-sahifa (selektor)' };

async function lookup(type, q) { if (!SRC[type]) throw new Error('Noma’lum manba'); return SRC[type].search(q); }

/* Barcha narxli aktivlar uchun narxni yangilash. assets: [{id, src:{type,ref}}]. Qaytaradi: {id: {price}|{error}} */
async function refreshAll(assets) {
  const out = {}, groups = {};
  assets.filter(a => a.src && a.src.type && a.src.ref && SRC[a.src.type]).forEach(a => { (groups[a.src.type] = groups[a.src.type] || []).push(a); });
  /* Har bir manba turi alohida (parallel), ichida ketma-ket va oraliq bilan: bir manbadagi sekinlik boshqalarni to'xtatmaydi */
  await Promise.all(Object.keys(groups).map(async type => {
    const list = groups[type];
    if (type === 'bitget') {
      try { const r = await bitget.bulk(list.map(a => a.src.ref)); list.forEach(a => { out[a.id] = r[a.src.ref]; }); }
      catch (e) { list.forEach(a => { out[a.id] = { error: e.message }; }); }
    } else {
      for (const a of list) { try { out[a.id] = await SRC[type].quote(a.src.ref, a); } catch (e) { out[a.id] = { error: e.message }; } if (type === 'cmc') await sleep(300); }
    }
  }));
  return out;
}

/* Diagnostika: har bir manba ishlayaptimi */
async function selfTest() {
  const cap = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('Vaqt tugadi (' + ms / 1000 + ' s)')), ms))]);
  async function t(name, fn) { const st = Date.now(); try { const v = await cap(fn(), 10000); return { name, ok: true, ms: Date.now() - st, info: v }; } catch (e) { return { name, ok: false, ms: Date.now() - st, info: e.message }; } }
  /* Har bir manba uchun bitta so'rov, hammasi bir vaqtda */
  return Promise.all([
    t('Binance (BTCUSDT)' + (relayCfg() ? ' · o‘tkazgich (Google) orqali' : ' · data-api.binance.vision'), async () => { const j = await firstOf(BN().map(h => h + '/api/v3/ticker/price?symbol=BTCUSDT'), { json: true }); return 'BTC = ' + (+j.price).toFixed(2) + ' USD'; }),
    t('Bitget (BTCUSDT)' + (relayCfg() ? ' · o‘tkazgich (Google) orqali' : process.env.BITGET_API_KEY && process.env.BITGET_API_SECRET && process.env.BITGET_API_PASSPHRASE ? ' · shaxsiy API kalit' : ' · ochiq API'), async () => { const j = await http('https://api.bitget.com/api/v2/spot/market/ticker?symbol=BTCUSDT', { json: true, tries: 1, timeout: 9000, probe: true }); const p = j && j.data && j.data[0] && parseFloat(j.data[0].lastPr); if (!(p > 0)) throw new Error('javob kutilganidek emas'); return 'BTC = ' + p + ' USD'; }),
    t(process.env.CMC_API_KEY ? 'CoinMarketCap (BTC)' : 'CoinGecko (bitcoin) — CMC kaliti yo‘q', async () => 'BTC = ' + (await cmc.quote(process.env.CMC_API_KEY ? 'BTC' : 'bitcoin')).price + ' USD'),
    t('Finviz (AAPL)', async () => { const r = await finviz.quote('AAPL'); return r.name + ' = ' + r.price + ' USD'; }),
    t('uzse.uz (UZNF)', async () => { const r = await uzse.quote('UZ7058980010', { group: 'milliy' }); return (r.sym || 'UZNF') + ' = ' + r.price + ' UZS (' + r.how + ')'; }),
    t('CBU (USD kursi)', async () => 'USD = ' + (await cbuUsd()) + ' so‘m')
  ]);
}
module.exports = { BN, relayCfg, bitgetAuth, resetNet, http, httpBuf, request, explain, firstOf, UA, uzseParse, lookup, refreshAll, selfTest, cbuUsd, NAMES, num, finvizParse, uzseParse };
