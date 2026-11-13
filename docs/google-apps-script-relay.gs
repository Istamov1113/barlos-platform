/*
 * BARLOS o'tkazgichi (Google Apps Script).
 * Binance / Bitget / Yahoo / Stooq / CoinGecko ga so'rovni Google serveri yuboradi.
 * 1) Quyidagi KEY ni o'zingiz o'ylab topgan uzun maxfiy so'zga almashtiring (kamida 24 belgi).
 * 2) Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone.
 * 3) Hosil bo'lgan ".../exec" havolasini va KEY ni BARLOS .env fayliga RELAY_URL va RELAY_KEY sifatida yozing.
 */
var KEY = 'BU_YERGA_UZUN_MAXFIY_SOZ_YOZING';
var ALLOW = ['api.bitget.com', 'api.binance.com', 'data-api.binance.vision', 'query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'stooq.com', 'api.coingecko.com'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!KEY || KEY === 'BU_YERGA_UZUN_MAXFIY_SOZ_YOZING' || p.key !== KEY) return out('RELAYERR 403 kalit notogri');
  var m = /^https:\/\/([^\/?#]+)(\/|\?|$)/.exec(p.url || '');
  if (!m || ALLOW.indexOf(m[1]) < 0) return out('RELAYERR 400 ruxsat etilmagan manzil');
  try {
    var r = UrlFetchApp.fetch(p.url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' } });
    var c = r.getResponseCode();
    return (c >= 200 && c < 300) ? out(r.getContentText()) : out('RELAYERR ' + c + ' ' + r.getContentText().slice(0, 200));
  } catch (err) {
    return out('RELAYERR 502 ' + err);
  }
}
function out(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }
