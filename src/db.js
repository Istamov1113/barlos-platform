'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, 'barlos.db'));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, phone TEXT,
  hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client', verified INTEGER NOT NULL DEFAULT 1,
  code TEXT, code_exp INTEGER, code_try INTEGER DEFAULT 0, created INTEGER, last INTEGER, blocked INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(
  id TEXT PRIMARY KEY, uid TEXT NOT NULL, ua TEXT, ip TEXT, created INTEGER, last INTEGER);
CREATE TABLE IF NOT EXISTS docs(
  coll TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated INTEGER, PRIMARY KEY(coll,id));
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
`);

const st = {
  getDoc: db.prepare('SELECT json FROM docs WHERE coll=? AND id=?'),
  allDocs: db.prepare('SELECT json FROM docs WHERE coll=?'),
  putDoc: db.prepare('INSERT INTO docs(coll,id,json,updated) VALUES(?,?,?,?) ON CONFLICT(coll,id) DO UPDATE SET json=excluded.json, updated=excluded.updated'),
  getMeta: db.prepare('SELECT v FROM meta WHERE k=?'),
  putMeta: db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')
};
let rev = +(((st.getMeta.get('rev')) || {}).v || 0);
function bump() { rev++; st.putMeta.run('rev', String(rev)); }
const Q = {
  rev: () => rev, touch: bump,
  get(coll, id) { const r = st.getDoc.get(coll, id); return r ? JSON.parse(r.json) : null; },
  all(coll) { return st.allDocs.all(coll).map(r => JSON.parse(r.json)); },
  put(coll, obj, quiet) { st.putDoc.run(coll, obj.id, JSON.stringify(obj), Date.now()); if (!quiet) bump(); return obj; },
  seq(name) { const n = +((st.getMeta.get('seq_' + name) || {}).v || 0) + 1; st.putMeta.run('seq_' + name, String(n)); return n; },
  tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
  dir,
  /* Ma'lumotlar bazasining to'liq nusxasi (VACUUM INTO: ishlayotgan bazadan ham xavfsiz) */
  backup(dest) { try { fs.unlinkSync(dest); } catch (e) { /* yo'q */ } db.exec("VACUUM INTO '" + String(dest).replace(/'/g, "''") + "'"); return dest; },
  db
};
module.exports = Q;
