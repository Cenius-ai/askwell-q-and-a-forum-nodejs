'use strict';

const { db } = require('../db');

/** Badge catalogue. Seeded idempotently by code; awards are idempotent too. */
const BADGE_DEFINITIONS = [
  {
    code: 'first-question',
    name: 'First Question',
    description: 'Asked their first question on Askwell.',
    icon: 'spark',
  },
  {
    code: 'first-answer',
    name: 'First Answer',
    description: 'Answered a question for the first time.',
    icon: 'reply',
  },
  {
    code: 'accepted',
    name: 'Accepted',
    description: 'Wrote an answer that the asker accepted.',
    icon: 'check',
  },
  {
    code: 'good-question',
    name: 'Good Question',
    description: 'Asked a question that reached a score of 5.',
    icon: 'up',
  },
  {
    code: 'good-answer',
    name: 'Good Answer',
    description: 'Wrote an answer that reached a score of 5.',
    icon: 'star',
  },
];

const selectBadge = db.prepare('SELECT * FROM badges WHERE code = ?');
const insertBadge = db.prepare(
  'INSERT INTO badges (code, name, description, icon, created_at) VALUES (?, ?, ?, ?, ?)'
);
const insertUserBadge = db.prepare(
  'INSERT OR IGNORE INTO user_badges (user_id, badge_id, awarded_at) VALUES (?, ?, ?)'
);

/** Ensure the badge catalogue exists. Safe on every boot. */
function ensureCatalogue() {
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const badge of BADGE_DEFINITIONS) {
      if (!selectBadge.get(badge.code)) {
        insertBadge.run(badge.code, badge.name, badge.description, badge.icon, now);
      }
    }
  });
  run();
}

/** Award by code; duplicate awards are silently ignored. */
function award(userId, code) {
  if (!userId) return false;
  const badge = selectBadge.get(code);
  if (!badge) return false;
  const info = insertUserBadge.run(Number(userId), badge.id, new Date().toISOString());
  return info.changes > 0;
}

function badgesForUser(userId) {
  if (!userId) return [];
  return db.prepare(
    `SELECT b.*, ub.awarded_at
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = ?
      ORDER BY ub.awarded_at ASC`
  ).all(Number(userId));
}

function badgesForUsers(userIds) {
  const grouped = new Map();
  if (!userIds.length) return grouped;
  const placeholders = userIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT ub.user_id, b.code, b.name, b.icon
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id IN (${placeholders})
      ORDER BY ub.awarded_at ASC`
  ).all(...userIds);
  for (const row of rows) {
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
    grouped.get(row.user_id).push(row);
  }
  return grouped;
}

module.exports = { BADGE_DEFINITIONS, ensureCatalogue, award, badgesForUser, badgesForUsers };
