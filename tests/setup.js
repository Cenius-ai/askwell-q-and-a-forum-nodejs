'use strict';

/**
 * Shared test bootstrap. Each test file runs in its own process and gets its
 * own SQLite file, so parallel runs never share state.
 */
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const fileKey = path
  .basename(process.argv[1] || 'default')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '');

const dbFile = path.join(dataDir, `test-${fileKey}.db`);
process.env.ASKWELL_DB = path.relative(projectRoot, dbFile);
process.env.NODE_ENV = 'test';

for (const suffix of ['', '-shm', '-wal']) {
  try {
    fs.unlinkSync(dbFile + suffix);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const app = require('../src/app');
const { db } = require('../src/db');
const { seed } = require('../src/seed');

seed();

function csrfFrom(html) {
  const match = /name="_csrf" value="([^"]+)"/.exec(html);
  if (!match) throw new Error('response did not contain a CSRF token');
  return match[1];
}

function login(agent, email, password) {
  return agent.post('/login').type('form').send({ email, password });
}

async function loginAs(agent, email = 'cenius@cenius.ai', password = 'cenius') {
  const response = await login(agent, email, password);
  if (response.status !== 302) {
    throw new Error(`login failed for ${email}: ${response.status}`);
  }
  return response;
}

async function csrfFor(agent, url) {
  const response = await agent.get(url);
  return csrfFrom(response.text);
}

module.exports = { app, db, seed, csrfFrom, csrfFor, loginAs, login, dbFile };
