'use strict';

const { db } = require('../db');

/** Reputation rules (single source of truth for votes + acceptance). */
const VOTE_DELTAS = {
  question: { up: 5, down: -2 },
  answer: { up: 10, down: -2 },
};
const ACCEPTED_ANSWER_DELTA = 15;

const insertEvent = db.prepare(
  `INSERT INTO reputation_events (user_id, delta, reason, target_type, target_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const bumpUser = db.prepare('UPDATE users SET reputation = reputation + ? WHERE id = ?');

/**
 * Persist a reputation event and roll the member's total forward in one
 * transaction so the ledger and the visible score never diverge.
 */
function applyEvent({ userId, delta, reason, targetType = null, targetId = null }) {
  if (!userId || !delta) return;
  const run = db.transaction(() => {
    insertEvent.run(Number(userId), delta, reason, targetType, targetId, new Date().toISOString());
    bumpUser.run(delta, Number(userId));
  });
  run();
}

function voteDelta(targetType, value) {
  if (targetType === 'question') return value === 1 ? VOTE_DELTAS.question.up : VOTE_DELTAS.question.down;
  return value === 1 ? VOTE_DELTAS.answer.up : VOTE_DELTAS.answer.down;
}

function voteReason(targetType, value, reversed = false) {
  const direction = value === 1 ? 'upvote' : 'downvote';
  return `${targetType}_${direction}${reversed ? '_reversed' : ''}`;
}

module.exports = {
  VOTE_DELTAS,
  ACCEPTED_ANSWER_DELTA,
  applyEvent,
  voteDelta,
  voteReason,
};
