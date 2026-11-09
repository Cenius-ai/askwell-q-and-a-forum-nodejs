'use strict';

const bcrypt = require('bcryptjs');
const { db } = require('../db');

const BCRYPT_ROUNDS = 10;

const selectById = db.prepare(
  'SELECT id, email, display_name, reputation, role, created_at FROM users WHERE id = ?'
);
const selectAuthByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)');
const insertUser = db.prepare(
  `INSERT INTO users (email, display_name, password_hash, reputation, role, created_at)
   VALUES (?, ?, ?, 0, ?, ?)`
);

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}

function findByEmail(email) {
  if (!email) return null;
  return selectAuthByEmail.get(String(email).trim()) || null;
}

function findById(id) {
  return selectById.get(Number(id)) || null;
}

/**
 * Create a member account. `role` is never taken from request input — only the
 * seed passes it explicitly.
 */
function createUser({ email, displayName, password, role = 'member' }) {
  const normalisedEmail = String(email || '').trim().toLowerCase();
  const info = insertUser.run(
    normalisedEmail,
    String(displayName || '').trim(),
    hashPassword(password),
    role,
    new Date().toISOString()
  );
  return findById(info.lastInsertRowid);
}

function updateReputationTotal(userId, delta) {
  db.prepare('UPDATE users SET reputation = reputation + ? WHERE id = ?').run(delta, userId);
}

module.exports = {
  hashPassword,
  verifyPassword,
  findByEmail,
  findById,
  createUser,
  updateReputationTotal,
};
