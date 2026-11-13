'use strict';
/* Qo'lda zaxira nusxa:  npm run backup   ->  data/backups/ papkasiga yoziladi */
const path = require('path'), db = require('../src/db');
const d = new Date(), p = n => String(n).padStart(2, '0');
const dest = path.join(db.dir, 'backups', 'barlos-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '-qolda.db');
require('fs').mkdirSync(path.dirname(dest), { recursive: true });
db.backup(dest); console.log('Zaxira nusxa tayyor:', dest);
