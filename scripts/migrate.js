'use strict';

/**
 * Create any missing tables/indexes, then report what is in the database.
 * Safe to run on every boot and from install.sh.
 */
const { db, applySchema } = require('../src/db');
const { DB_PATH } = require('../src/config');

applySchema();

const counts = db.prepare(
  `SELECT (SELECT COUNT(*) FROM users)     AS users,
          (SELECT COUNT(*) FROM questions) AS questions,
          (SELECT COUNT(*) FROM answers)   AS answers`
).get();

console.log(`[askwell] schema ready at ${DB_PATH}`);
console.log(`[askwell] users=${counts.users} questions=${counts.questions} answers=${counts.answers}`);
