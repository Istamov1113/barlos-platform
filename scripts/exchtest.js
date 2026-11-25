'use strict';
/* Birja adapterlari sinovi: haqiqiy birjalarga ulanmaydi — lokal SOXTA server bilan so'rov shakli, imzo va javoblarni tekshiradi.
   Haqiqiy birja bilan ishlashini faqat sizning kalitlaringiz bilan sinab ko'rish mumkin (Avto savdo -> "Tekshirish" tugmasi).  node scripts/exchtest.js */
const http = require('http'), crypto = require('crypto');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('XATO:', m); } };
const log = [];
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); log.push({ m: req.method, p: u.pathname, q: u.searchParams, h: req.headers, b }); const J = (o, s) => { res.writeHead(s || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const P = u.pathname;
    if (P === '/api/v3/exchangeInfo') return J({ symbols: [{ filters: [{ filterType: 'LOT_SIZE', stepSize: '0.00001000', minQty: '0.00001000' }, { filterType: 'PRICE_FILTER', tickSize: '0.01000000' }, { filterType: 'NOTIONAL', minNotional: '5.00000000' }] }] });
    if (P === '/api/v3/order' && req.method === 'POST') return J({ orderId: 777, status: 'NEW' });
    if (P === '/api/v3/order' && req.method === 'GET') return J({ orderId: 777, status: 'FILLED', executedQty: '0.00500000', cummulativeQuoteQty: '395.50000000' });
    if (P === '/api/v3/myTrades') return J([{ commission: '0.2', commissionAsset: 'USDT' }, { commission: '0.1', commissionAsset: 'USDT' }]);
    if (P === '/api/v3/account') return J({ balances: [] });
    if (P === '/api/v2/spot/public/symbols') return J({ code: '00000', data: [{ quantityPrecision: '6', pricePrecision: '2', minTradeUSDT: '1' }] });
    if (P === '/api/v2/spot/trade/place-order') return J({ code: '00000', data: { orderId: '9001', clientOid: 'O-1' } });
    if (P === '/api/v2/spot/trade/orderInfo') return J({ code: '00000', data: [{ status: 'partially_filled', baseVolume: '0.002', priceAvg: '80000' }] });
    if (P === '/api/v2/spot/trade/fills') return J({ code: '00000', data: [] });
    if (P === '/api/v2/spot/account/assets') return J({ code: '00000', data: [] });
    if (P === '/orders' && req.method === 'POST') return J({ id: 'B-1', pay_url: 'https://bank.test/pay/B-1' });
    if (P === '/orders/B-1') return J({ id: 'B-1', status: 'paid', amount: 25000000 });
    if (P === '/v1/api/iserver/auth/status') return J({ authenticated: true });
    if (P === '/v1/api/iserver/accounts') return J({ accounts: ['U1'] });
    if (P === '/v1/api/iserver/secdef/search') return J([{ conid: 265598, sections: [{ secType: 'STK' }] }]);
    if (P === '/v1/api/iserver/account/U1/orders') return J([{ id: 'reply-1', message: ['Order price exceeds...'] }]);
    if (P === '/v1/api/iserver/reply/reply-1') return J([{ order_id: '555', order_status: 'Submitted' }]);
    if (P === '/v1/api/iserver/account/orders') return J({ orders: [{ orderId: 555, status: 'Filled', filledQuantity: '2', avgPrice: '190.5' }] });
    J({ msg: 'yo‘q: ' + P, code: -1 }, 404);
  });
});
srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  Object.assign(process.env, { BINANCE_API_KEY: 'bk', BINANCE_API_SECRET: 'bs', BINANCE_TRADE_HOST: base, BITGET_API_KEY: 'gk', BITGET_API_SECRET: 'gs', BITGET_API_PASSPHRASE: 'gp', BITGET_HOST: base, IBKR_URL: base + '/v1/api', IBKR_ACCOUNT: 'U1' });
  const ex = require('../src/exchanges');
  try {
    /* Binance */
    const bn = ex.get('Binance'); ok(bn.ready(), 'binance ready');
    let r = await bn.place({ pair: 'BTCUSDT', side: 'BUY', qty: 0.0050049, price: 79000.555, ot: 'LIMIT', cid: 'O-2001' }); ok(r.xid === '777' && Math.abs(r.qty - 0.005) < 1e-12, 'binance place: ' + JSON.stringify(r));
    const po = log.filter(l => l.m === 'POST' && l.p === '/api/v3/order')[0]; ok(po && po.h['x-mbx-apikey'] === 'bk', 'binance kalit sarlavhasi');
    const qs = po.q, sig = qs.get('signature'), raw = po.b ? '' : require('url').parse('http://x' + '').search; const rawq = [...qs.entries()].filter(e => e[0] !== 'signature').map(e => e[0] + '=' + encodeURIComponent(e[1])).join('&');
    ok(sig === crypto.createHmac('sha256', 'bs').update(rawq).digest('hex'), 'binance imzo to‘g‘ri (HMAC-SHA256)');
    ok(qs.get('symbol') === 'BTCUSDT' && qs.get('side') === 'BUY' && qs.get('type') === 'LIMIT' && qs.get('quantity') === '0.005' && qs.get('price') === '79000.55' && qs.get('timeInForce') === 'GTC' && qs.get('newClientOrderId') === 'O-2001', 'binance parametrlar (qadamga yaxlitlangan): ' + rawq);
    r = await bn.place({ pair: 'BTCUSDT', side: 'BUY', qty: 0.00001, price: 79000, ot: 'LIMIT', cid: 'O-2002' }).then(() => 'ok', e => e.message); ok(/minimal/.test(r), 'binance minimal summa tekshiruvi: ' + r);
    r = await bn.status({ id: 'O-2001', xpair: 'BTCUSDT', xid: '777' }); ok(r.state === 'filled' && r.filled === 0.005 && Math.abs(r.avg - 79100) < 1e-9 && Math.abs(r.fee - 0.3) < 1e-9 && r.feeAsset === 'USDT', 'binance status: ' + JSON.stringify(r));
    ok((await bn.ping()).indexOf('ulangan') >= 0, 'binance ping');
    /* Bitget */
    const bg = ex.get('Bitget'); ok(bg.ready(), 'bitget ready');
    r = await bg.place({ pair: 'BTCUSDT', side: 'SELL', qty: 0.0030019, price: 80000, ot: 'LIMIT', cid: 'O-2003' }); ok(r.xid === '9001', 'bitget place: ' + JSON.stringify(r));
    const pb = log.filter(l => l.p === '/api/v2/spot/trade/place-order')[0], body = JSON.parse(pb.b), ts = pb.h['access-timestamp'];
    ok(body.side === 'sell' && body.orderType === 'limit' && body.size === '0.003001' && body.price === '80000' && body.clientOid === 'O-2003' && body.force === 'gtc', 'bitget tana: ' + pb.b);
    ok(pb.h['access-sign'] === crypto.createHmac('sha256', 'gs').update(ts + 'POST' + '/api/v2/spot/trade/place-order' + pb.b).digest('base64') && pb.h['access-passphrase'] === 'gp' && pb.h['access-key'] === 'gk', 'bitget imzo to‘g‘ri');
    r = await bg.status({ xid: '9001' }); ok(r.state === 'partial' && r.filled === 0.002 && r.avg === 80000, 'bitget status: ' + JSON.stringify(r));
    /* IBKR */
    const ib = ex.get('IBKR'); ok(ib.ready(), 'ibkr ready'); ok((await ib.ping()).indexOf('ulangan') >= 0, 'ibkr ping');
    r = await ib.place({ sym: 'AAPL', side: 'BUY', qty: 2, price: 190.5, ot: 'LIMIT', cid: 'O-2004' }); ok(r.xid === '555' && r.xconid === 265598, 'ibkr place (tasdiq savoli bilan): ' + JSON.stringify(r));
    const io = JSON.parse(log.filter(l => l.p === '/v1/api/iserver/account/U1/orders')[0].b).orders[0]; ok(io.conid === 265598 && io.side === 'BUY' && io.orderType === 'LMT' && io.price === 190.5 && io.cOID === 'O-2004' && io.quantity === 2, 'ibkr order tanasi: ' + JSON.stringify(io));
    r = await ib.status({ id: 'O-2004', xid: '555' }); ok(r.state === 'filled' && r.filled === 2 && r.avg === 190.5, 'ibkr status: ' + JSON.stringify(r));
    /* bank ekvayringi (umumiy shablon) */
    Object.assign(process.env, { BANKPAY_API: base, BANKPAY_MERCHANT: 'M1', BANKPAY_SECRET: 'bsec' }); const bk = require('../src/bankpay').get(); ok(bk.ready() && !bk.mock, 'bankpay ready');
    r = await bk.create({ id: 'D1001', amount: 250000 }, { ret: 'https://x/r', cb: 'https://x/cb' }); ok(r.xid === 'B-1' && /bank\.test/.test(r.payUrl), 'bankpay create: ' + JSON.stringify(r));
    const bo = log.filter(l => l.p === '/orders' && l.m === 'POST')[0], bb = JSON.parse(bo.b); ok(bb.amount === 25000000 && bb.order_id === 'D1001' && bb.currency === '860' && bo.h['x-signature'] === crypto.createHmac('sha256', 'bsec').update(bo.b).digest('hex'), 'bankpay so‘rov tanasi va imzosi (tiyinda): ' + bo.b);
    r = await bk.status({ id: 'D1001', xid: 'B-1' }); ok(r.state === 'paid' && r.amount === 250000, 'bankpay status: ' + JSON.stringify(r));
    const cbb = JSON.stringify({ order_id: 'D1001', id: 'B-1', status: 'paid', amount: 25000000 }); r = bk.parseCallback(cbb, { 'x-signature': crypto.createHmac('sha256', 'bsec').update(cbb).digest('hex') }); ok(r.orderId === 'D1001' && r.state === 'paid' && r.amount === 250000, 'bankpay callback o‘qildi');
    ok((() => { try { bk.parseCallback(cbb, { 'x-signature': 'xato' }); return false; } catch (e) { return true; } })(), 'bankpay noto‘g‘ri imzo rad etildi');
    /* kalitsiz */
    delete process.env.BINANCE_API_KEY; ok(!ex.get('Binance').ready(), 'kalitsiz binance tayyor emas'); ok(ex.get('Mock') === null || process.env.EXCH_MOCK === '1', 'Mock faqat EXCH_MOCK=1 da');
    r = await ex.get('IBKR').call.call(Object.assign({}, ib, { base: () => 'http://127.0.0.1:1/x' }), 'GET', '/p').then(() => 'ok', e => e.message); ok(/Tarmoq xatosi/.test(r), 'tarmoq xatosi aniq xabar: ' + r);
  } catch (e) { fail++; console.log('XATO (istisno):', e.stack || e); }
  srv.close(); console.log('Birja adapterlari: ' + pass + ' o‘tdi, ' + fail + ' xato'); process.exit(fail ? 1 : 0);
});
