'use strict';

const { db } = require('../db');
const badges = require('./badges');
const reputation = require('./reputation');
const { forbidden, notFound, badRequest } = require('../lib/http-error');

const selectAnswer = db.prepare(
  `SELECT a.id, a.question_id, a.body, a.created_at, a.updated_at,
          u.id AS author_id, u.display_name AS author_name, u.reputation AS author_reputation,
          (SELECT COALESCE(SUM(v.value), 0) FROM votes v
            WHERE v.target_type = 'answer' AND v.target_id = a.id) AS score
     FROM answers a JOIN users u ON u.id = a.author_id
    WHERE a.id = ?`
);

const insertAnswer = db.prepare(
  'INSERT INTO answers (question_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
);

function getById(id) {
  const answerId = Number(id);
  if (!Number.isInteger(answerId) || answerId <= 0) return null;
  return selectAnswer.get(answerId) || null;
}

function validateBody(body) {
  const clean = String(body || '').trim();
  if (clean.length < 10) return { error: 'Write at least 10 characters — a sentence or two helps.', body: clean };
  if (clean.length > 8000) return { error: 'Keep answers under 8,000 characters.', body: clean };
  return { error: null, body: clean };
}

function createAnswer({ questionId, authorId, body }) {
  const question = db.prepare('SELECT id, closed_at FROM questions WHERE id = ?').get(Number(questionId));
  if (!question) throw notFound('That question no longer exists.');
  if (question.closed_at) throw badRequest('This question is closed — new answers are disabled.');

  const now = new Date().toISOString();
  const info = insertAnswer.run(question.id, Number(authorId), body, now, now);
  badges.award(authorId, 'first-answer');
  return getById(info.lastInsertRowid);
}

function updateOwnAnswer({ answerId, actingUser, body }) {
  const answer = getById(answerId);
  if (!answer) throw notFound('That answer no longer exists.');
  if (answer.author_id !== actingUser.id) throw forbidden('Only the author can edit this answer.');
  db.prepare('UPDATE answers SET body = ?, updated_at = ? WHERE id = ?')
    .run(body, new Date().toISOString(), answer.id);
  return getById(answer.id);
}

function deleteAnswer({ answerId, actingUser }) {
  const answer = getById(answerId);
  if (!answer) throw notFound('That answer no longer exists.');
  if (answer.author_id !== actingUser.id && actingUser.role !== 'moderator') {
    throw forbidden('Only the author or a moderator can delete this answer.');
  }

  const run = db.transaction(() => {
    const question = db.prepare('SELECT accepted_answer_id, author_id FROM questions WHERE id = ?').get(answer.question_id);
    if (question && question.accepted_answer_id === answer.id) {
      db.prepare('UPDATE questions SET accepted_answer_id = NULL WHERE id = ?').run(answer.question_id);
      reputation.applyEvent({
        userId: answer.author_id,
        delta: -reputation.ACCEPTED_ANSWER_DELTA,
        reason: 'accepted_answer_revoked',
        targetType: 'answer',
        targetId: answer.id,
      });
    }
    db.prepare("DELETE FROM votes WHERE target_type = 'answer' AND target_id = ?").run(answer.id);
    db.prepare('DELETE FROM answers WHERE id = ?').run(answer.id);
  });
  run();
  return answer.question_id;
}

/** Accept the given answer for a question (author or moderator), toggling off. */
function toggleAccept({ questionId, answerId, actingUser }) {
  const question = db.prepare('SELECT id, author_id, accepted_answer_id FROM questions WHERE id = ?')
    .get(Number(questionId));
  if (!question) throw notFound('That question no longer exists.');

  const answer = getById(answerId);
  if (!answer || answer.question_id !== question.id) throw notFound('That answer is not on this question.');

  if (question.author_id !== actingUser.id && actingUser.role !== 'moderator') {
    throw forbidden('Only the question author or a moderator can accept an answer.');
  }

  const run = db.transaction(() => {
    if (question.accepted_answer_id === answer.id) {
      db.prepare('UPDATE questions SET accepted_answer_id = NULL WHERE id = ?').run(question.id);
      reputation.applyEvent({
        userId: answer.author_id,
        delta: -reputation.ACCEPTED_ANSWER_DELTA,
        reason: 'accepted_answer_unaccepted',
        targetType: 'answer',
        targetId: answer.id,
      });
      return false;
    }

    if (question.accepted_answer_id) {
      const previous = getById(question.accepted_answer_id);
      if (previous) {
        reputation.applyEvent({
          userId: previous.author_id,
          delta: -reputation.ACCEPTED_ANSWER_DELTA,
          reason: 'accepted_answer_replaced',
          targetType: 'answer',
          targetId: previous.id,
        });
      }
    }

    db.prepare('UPDATE questions SET accepted_answer_id = ? WHERE id = ?').run(answer.id, question.id);
    if (answer.author_id !== actingUser.id) {
      reputation.applyEvent({
        userId: answer.author_id,
        delta: reputation.ACCEPTED_ANSWER_DELTA,
        reason: 'answer_accepted',
        targetType: 'answer',
        targetId: answer.id,
      });
    }
    badges.award(answer.author_id, 'accepted');
    return true;
  });

  const accepted = run();
  return { accepted, answer };
}

function answersByAuthor(authorId) {
  return db.prepare(
    `SELECT a.id, a.body, a.created_at, a.question_id, q.title AS question_title, q.closed_at,
            (SELECT COALESCE(SUM(v.value), 0) FROM votes v
              WHERE v.target_type = 'answer' AND v.target_id = a.id) AS score,
            CASE WHEN q.accepted_answer_id = a.id THEN 1 ELSE 0 END AS accepted
       FROM answers a JOIN questions q ON q.id = a.question_id
      WHERE a.author_id = ?
      ORDER BY a.created_at DESC`
  ).all(Number(authorId));
}

module.exports = {
  getById,
  validateBody,
  createAnswer,
  updateOwnAnswer,
  deleteAnswer,
  toggleAccept,
  answersByAuthor,
};
