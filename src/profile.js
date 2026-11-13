'use strict';
/* Profil: o'zgarmas tizim ID (users.id), ixtiyoriy username, rasm (avatar), qisqa tavsif va maxfiylik sozlamalari. */
const db = require('./db');
const auth = require('./auth');

const RESERVED = ['admin', 'administrator', 'barlos', 'support', 'root', 'system', 'operator', 'moderator', 'bot', 'null', 'undefined'];
const prof = id => db.get('profile', id) || { id };
const USERNAME = /^[a-z][a-z0-9_]{3,19}$/;

function pubProfile(u) {
  const p = prof(u.id);
  return { id: u.id, username: p.username || '', bio: p.bio || '', av: p.avT || 0, dm: p.dm || 'all', findable: !!p.findable, avChanged: p.avT || 0 };
}
/* data:image/(jpeg|png|webp);base64,... -> { mime, buf } yoki xato */
function parseImage(s) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || '')); if (!m) return null;
  const buf = Buffer.from(m[2], 'base64'); if (buf.length < 100 || buf.length > 150 * 1024) return null;
  const ok = (m[1] === 'image/jpeg' && buf[0] === 0xFF && buf[1] === 0xD8) || (m[1] === 'image/png' && buf.slice(1, 4).toString() === 'PNG') || (m[1] === 'image/webp' && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
  return ok ? { mime: m[1], buf } : null;
}

function mount(app, h) {
  const { ANY, wrap, bad } = h;
  app.post('/api/me/profile', ANY, wrap((req, res) => {
    const u = req.user, b = req.body || {}, p = prof(u.id);
    if (b.username !== undefined) {
      const un = String(b.username || '').trim().replace(/^@/, '').toLowerCase();
      if (un) {
        if (!USERNAME.test(un)) throw bad('Username lotin harfdan boshlansin, 4–20 ta belgi: a–z, 0–9, pastki chiziq.');
        if (RESERVED.indexOf(un) >= 0 && u.role !== 'admin') throw bad('Bu username band.');
        if (db.all('profile').some(x => x.username === un && x.id !== u.id)) throw bad('Bu username band.');
        if (p.username !== un) { p.unHist = (p.unHist || []).concat([{ t: Date.now(), from: p.username || '', to: un }]).slice(-20); }
        p.username = un;
      } else if (p.username) { p.unHist = (p.unHist || []).concat([{ t: Date.now(), from: p.username, to: '' }]).slice(-20); p.username = ''; }
    }
    if (b.bio !== undefined) p.bio = String(b.bio || '').trim().slice(0, 160);
    if (b.dm !== undefined) p.dm = b.dm === 'staff' ? 'staff' : 'all';
    if (b.findable !== undefined) p.findable = !!b.findable;
    if (b.name !== undefined || b.phone !== undefined) db.db.prepare('UPDATE users SET name=?, phone=? WHERE id=?').run(String(b.name != null ? b.name : u.name || '').trim().slice(0, 80), String(b.phone != null ? b.phone : u.phone || '').trim().slice(0, 30), u.id);
    p.id = u.id; db.put('profile', p); res.json({ ok: true, profile: pubProfile(u) });
  }));
  app.post('/api/me/avatar', ANY, wrap((req, res) => {
    const u = req.user, d = (req.body || {}).data, p = prof(u.id);
    if (d === null || d === '') { delete p.img; delete p.mime; p.avT = 0; }
    else { const im = parseImage(d); if (!im) throw bad('Rasm noto‘g‘ri yoki 150 KB dan katta. JPEG, PNG yoki WebP bo‘lsin.'); p.img = im.buf.toString('base64'); p.mime = im.mime; p.avT = Date.now(); }
    p.id = u.id; db.put('profile', p); res.json({ ok: true, av: p.avT });
  }));
  app.get('/api/avatar/:id', ANY, (req, res) => {
    const p = db.get('profile', String(req.params.id)); if (!p || !p.img) return res.status(404).end();
    const tag = '"' + p.avT + '"'; if (req.headers['if-none-match'] === tag) return res.status(304).end();
    res.setHeader('Content-Type', p.mime || 'image/jpeg'); res.setHeader('ETag', tag); res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(Buffer.from(p.img, 'base64'));
  });
}
module.exports = { mount, pubProfile, parseImage, USERNAME };
