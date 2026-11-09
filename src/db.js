'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const { DB_PATH } = require('./config');

/**
 * Single shared better-sqlite3 connection. Synchronous and file-backed, so
 * schema creation + seeding can run before the first request is served.
 */
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

/** Create missing tables/indexes. Safe to run on every boot. */
function applySchema() {
  db.exec(schemaSql);
}

applySchema();

module.exports = { db, applySchema };
