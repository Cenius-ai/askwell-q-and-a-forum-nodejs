'use strict';

/**
 * Runtime configuration. Every value has a working development default so the
 * app boots from a fresh clone with no .env present.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.ASKWELL_DB
  ? path.resolve(ROOT_DIR, process.env.ASKWELL_DB)
  : path.join(DATA_DIR, 'askwell.db');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Session secret resolution:
 *   1. SESSION_SECRET from the environment (production / deploy config).
 *   2. A random secret generated once and persisted next to the database, so a
 *      fresh clone is bootable without any configuration and sessions survive
 *      restarts without a hard-coded signing key living in the source tree.
 */
function resolveSessionSecret() {
  const fromEnv = (process.env.SESSION_SECRET || '').trim();
  if (fromEnv) return fromEnv;

  const secretFile = path.join(path.dirname(DB_PATH), '.session-secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  return generated;
}

/** The seeded demo account. Rendered on the login card and used by /login/demo. */
const DEMO_ACCOUNT = Object.freeze({
  email: 'cenius@cenius.ai',
  username: 'cenius',
  password: 'cenius',
  displayName: 'Cenius Demo',
});

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  DB_PATH,
  PORT,
  HOST,
  SESSION_SECRET: resolveSessionSecret(),
  DEMO_ACCOUNT,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};
