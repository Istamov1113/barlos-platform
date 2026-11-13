'use strict';
/* Jadval fayllarini o'qish (kutubxonasiz): .xlsx, .csv, HTML jadval. Natija: kunlik shamlar [{t,o,h,l,c,v}] */
const zlib = require('zlib');

function unzip(buf) {
  let e = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65600); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Bu .xlsx fayl emas (zip topilmadi)');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const files = {};
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csz = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8'), ln = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), ds = lo + 30 + ln + lx;
    files[name] = { method, data: buf.slice(ds, ds + csz) }; p += 46 + nl + xl + cl;
  }
  return name => { const f = files[name]; if (!f) return null; return (f.method === 0 ? f.data : zlib.inflateRawSync(f.data)).toString('utf8'); };
}
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
function colIdx(ref) { const m = /^([A-Z]+)/.exec(ref)[1]; let n = 0; for (const ch of m) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function readXlsx(buf) {
  const rd = unzip(buf); let ss = [];
  const sst = rd('xl/sharedStrings.xml'); if (sst) ss = (sst.match(/<si[ >][\s\S]*?<\/si>|<si\/>/g) || []).map(si => unesc((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')));
  let sheet = rd('xl/worksheets/sheet1.xml'); if (!sheet) { for (let i = 2; i < 9 && !sheet; i++) sheet = rd('xl/worksheets/sheet' + i + '.xml'); }
  if (!sheet) throw new Error('Varaq topilmadi');
  const rows = [];
  (sheet.match(/<row[ >][\s\S]*?<\/row>/g) || []).forEach(r => {
    const row = [];
    (r.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).forEach(c => {
      const ref = (/r="([A-Z]+\d+)"/.exec(c) || [])[1]; if (!ref) return; const t = (/ t="(\w+)"/.exec(c) || [])[1], v = (/<v>([\s\S]*?)<\/v>/.exec(c) || [])[1];
      let val = null;
      if (t === 's') val = v != null ? ss[+v] : null; else if (t === 'inlineStr') val = unesc(((c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(x => x.replace(/<[^>]+>/g, ''))).join('')); else if (t === 'str' || t === 'e') val = v != null ? unesc(v) : null; else if (v != null) val = parseFloat(v);
      row[colIdx(ref)] = val;
    });
    rows.push(row);
  });
  return rows;
}
function readCsv(text) {
  text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/, 1)[0], d = [';', '\t', ','].map(x => [x, first.split(x).length]).sort((a, b) => b[1] - a[1])[0][0], rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === d) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); if (row.some(x => x !== '')) rows.push(row); row = []; cur = ''; } else cur += ch;
  }
  row.push(cur); if (row.some(x => x !== '')) rows.push(row); return rows;
}
function readHtml(html) {
  const cheerio = require('cheerio'), $ = cheerio.load(html); let best = [];
  $('table').each((i, t) => { const rows = []; $(t).find('tr').each((j, tr) => { const c = []; $(tr).find('th,td').each((k, td) => c.push($(td).text().replace(/\s+/g, ' ').trim())); if (c.length) rows.push(c); }); if (rows.length > best.length) best = rows; });
  return best;
}
function readAny(buf, name) {
  if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) return readXlsx(buf);
  const txt = buf.toString('utf8');
  if (/<table[\s>]/i.test(txt)) return readHtml(txt);
  if (/\.xlsx?$/i.test(name || '') && !/[,;\t]/.test(txt.slice(0, 200))) throw new Error('Fayl formati tanilmadi');
  return readCsv(txt);
}

function numv(v) {
  if (typeof v === 'number') return v; if (v == null) return NaN;
  let s = String(v).replace(/[\s ]/g, '').replace(/[^\d.,\-]/g, ''); if (!s) return NaN;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c >= 0 && d >= 0) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (c >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  return parseFloat(s);
}
/* sana -> UTC yarim tun (soniya) */
function dateT(v) {
  if (typeof v === 'number') { if (v > 20000 && v < 80000) return Math.round((v - 25569) * 86400); return NaN; }
  const s = String(v == null ? '' : v).trim(); let m;
  if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 1000;
  if ((m = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000;
  return NaN;
}
/* Sarlavhalar bo'yicha ustunlarni topish. "Translation missing: ...opened" kabi tarjimasiz sarlavhalar ham tanib olinadi. */
function toCandles(rows) {
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) if ((rows[i] || []).some(x => /^(sana|date|дата|data)\b/i.test(String(x == null ? '' : x).trim()))) { hi = i; break; }
  const head = hi >= 0 ? rows[hi].map(x => String(x == null ? '' : x).toLowerCase()) : [], col = {};
  const RX = { d: /^(sana|date|дата)/, c: /(yopilish|yopish|\bclose|закры|закр)/, o: /(opened|\bopen|ochilish|откр)/, h: /(high|yuqori|макс)/, l: /(\blow|quyi|мин)/, v: /(savdo hajmi|volume|hajm|объ[её]м|quantity)/, val: /(trading_value|turnover|summa|qiymati|оборот)/ };
  head.forEach((h, i) => { Object.keys(RX).forEach(k => { if (col[k] == null && RX[k].test(h) && !(k === 'v' && /value/.test(h))) col[k] = i; }); });
  if (col.d == null) { col.d = 0; if (col.c == null) col.c = 1; }
  if (col.c == null) throw new Error('"Yopilish narxi" ustuni topilmadi');
  if (col.o == null && col.h == null && head.length >= 8 && /dona|hajm/.test(head[3] || '')) { col.v = 3; col.val = 4; col.o = 5; col.h = 6; col.l = 7; }
  const out = [];
  rows.slice(hi + 1).forEach(r => {
    if (!r) return; const t = dateT(r[col.d]), c = numv(r[col.c]); if (!(t > 0) || !(c > 0)) return;
    let o = col.o != null ? numv(r[col.o]) : NaN, h = col.h != null ? numv(r[col.h]) : NaN, l = col.l != null ? numv(r[col.l]) : NaN;
    if (!(o > 0)) o = c; if (!(h > 0)) h = Math.max(o, c); if (!(l > 0)) l = Math.min(o, c);
    h = Math.max(h, o, c); l = Math.min(l, o, c);
    const v = col.v != null ? numv(r[col.v]) : 0; out.push({ t, o, h, l, c, v: v > 0 ? v : 0 });
  });
  const m = new Map(); out.forEach(x => m.set(x.t, x)); return [...m.values()].sort((a, b) => a.t - b.t);
}
module.exports = { readAny, readXlsx, readCsv, readHtml, toCandles, dateT };
