/* Kichik .xlsx yozuvchi (kutubxonasiz): zip "store" usulida. Filtr, qotirilgan sarlavha, ustun kengligi, sana va son formatlari. */
(function (root) {
  'use strict';
  var T = new Uint32Array(256);
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  function crc(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  var enc = new TextEncoder();
  function u16(v) { return [v & 255, (v >>> 8) & 255]; }
  function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  function zip(files) {
    var parts = [], cen = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), c = crc(data);
      var h = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(h), name, data);
      cen.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += h.length + name.length + data.length;
    });
    var cl = 0; cen.forEach(function (p) { cl += p.length; });
    parts = parts.concat(cen); parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cl), u32(off), u16(0))));
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  /* Excel sanasi: 1899-12-30 dan beri kunlar (mahalliy vaqt) */
  function serial(ms) { var d = new Date(ms); return (ms - d.getTimezoneOffset() * 60000) / 864e5 + 25569; }
  /* sheet: {name, cols:[{h,w,t}], rows:[[...]]}; t: 's' matn, 'n' son (butun), 'f' son (kasr), 'p' foiz-son, 'd' sana (ms) */
  function sheetXml(sh) {
    var fmt = { n: 2, f: 3, p: 4, d: 5, s: 0 }, nc = sh.cols.length, x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>';
    sh.cols.forEach(function (c, i) { x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.w || 14) + '" customWidth="1"/>'; });
    x += '</cols><sheetData><row r="1">';
    sh.cols.forEach(function (c, i) { x += '<c r="' + col(i) + '1" s="1" t="inlineStr"><is><t>' + esc(c.h) + '</t></is></c>'; });
    x += '</row>';
    sh.rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 2) + '">';
      sh.cols.forEach(function (c, i) {
        var v = r[i], ref = col(i) + (ri + 2), t = c.t || 's';
        if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return;
        if (t === 's') x += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
        else if (t === 'd') x += '<c r="' + ref + '" s="' + fmt.d + '"><v>' + serial(v) + '</v></c>';
        else x += '<c r="' + ref + '" s="' + fmt[t] + '"><v>' + v + '</v></c>';
      });
      x += '</row>';
    });
    x += '</sheetData><autoFilter ref="A1:' + col(nc - 1) + (sh.rows.length + 1) + '"/></worksheet>';
    return x;
  }
  function build(sheets) {
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    sheets.forEach(function (s, i) { ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; });
    ct += '</Types>';
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    sheets.forEach(function (s, i) { wb += '<sheet name="' + esc(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; });
    wb += '</sheets></workbook>';
    var rel = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    sheets.forEach(function (s, i) { rel += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; });
    rel += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/><numFmt numFmtId="166" formatCode="dd.mm.yyyy\\ hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1C2F55"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    var files = [{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: rel }, { name: 'xl/styles.xml', data: styles }];
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }); });
    return zip(files);
  }
  var X = { build: build, zip: zip, serial: serial };
  if (typeof module !== 'undefined' && module.exports) module.exports = X; else root.Xlsx = X;
})(typeof self !== 'undefined' ? self : this);
