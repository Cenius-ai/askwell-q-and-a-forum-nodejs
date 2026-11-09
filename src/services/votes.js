'use strict';

const { db } = require('../db');
const badges = require('./badges');
const reputation = require('./reputation');
const { badRequest, notFound } = require('../lib/http-error');

const TARGET_TABLES = { question: 'questions', answer: 'answers' };

const selectVote = db.prepare(
  'SELECT * FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?'
);
const selectScore = db.prepare(
  'SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE target_type = ? AND target_id = ?'
);

function scoreOf(targetType, targetId) {
  const row = selectScore.get(targetType, Number(targetId));
  return row ? row.score : 0;
}

function myVote(userId, targetType, targetId) {
  if (!userId) return 0;
  const row = selectVote.get(Number(userId), targetType, Number(targetId));
  return row ? row.value : 0;
}

function targetRow(targetType, targetId) {
  const table = TARGET_TABLES[targetType];
  if (!table) throw badRequest('Unknown vote target.');
  if (targetType === 'question') {
    return db.prepare('SELECT id, author_id FROM questions WHERE id = ?').get(Number(targetId)) || null;
  }
  return db.prepare('SELECT id, author_id FROM answers WHERE id = ?').get(Number(targetId)) || null;
}

/**
 * Cast / toggle / switch a vote. One vote per member per target is enforced by
 * the UNIQUE(user_id, target_type, target_id) constraint and this transaction.
 */
function castVote({ userId, targetType, targetId, value }) {
  if (!['question', 'answer'].includes(targetType)) throw badRequest('Unknown vote target.');
  const numericValue = value === 'up' || value === 1 ? 1 : value === 'down' || value === -1 ? -1 : 0;
  if (!numericValue) throw badRequest('Vote must be an upvote or a downvote.');

  const target = targetRow(targetType, targetId);
  if (!target) throw notFound('That post no longer exists.');
  if (target.author_id === Number(userId)) throw badRequest('You cannot vote on your own post.');

  const run = db.transaction(() => {
    const existing = selectVote.get(Number(userId), targetType, target.id);
    if (existing && existing.value === numericValue) {
      // Clicking the same control removes the vote and reverses its reputation.
      db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
      reputation.applyEvent({
        userId: target.author_id,
        delta: -reputation.voteDelta(targetType, existing.value),
        reason: reputation.voteReason(targetType, existing.value, true),
        targetType,
        targetId: target.id,
      });
      return { myVote: 0 };
    }

    if (existing) {
      db.prepare('UPDATE votes SET value = ?, created_at = ? WHERE id = ?')
        .run(numericValue, new Date().toISOString(), existing.id);
      reputation.applyEvent({
        userId: target.author_id,
        delta: -reputation.voteDelta(targetType, existing.value),
        reason: reputation.voteReason(targetType, existing.value, true),
        targetType,
        targetId: target.id,
      });
    } else {
      db.prepare('INSERT INTO votes (user_id, target_type, target_id, value, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(Number(userId), targetType, target.id, numericValue, new Date().toISOString());
    }

    reputation.applyEvent({
      userId: target.author_id,
      delta: reputation.voteDelta(targetType, numericValue),
      reason: reputation.voteReason(targetType, numericValue),
      targetType,
      targetId: target.id,
    });

    return { myVote: numericValue };
  });

  const result = run();
  const score = scoreOf(targetType, target.id);

  if (numericValue === 1 && score >= 5) {
    badges.award(target.author_id, targetType === 'question' ? 'good-question' : 'good-answer');
  }

  return { score, myVote: result.myVote };
}

module.exports = { castVote, scoreOf, myVote };
