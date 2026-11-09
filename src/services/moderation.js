'use strict';

const { db } = require('../db');
const { forbidden, notFound, badRequest } = require('../lib/http-error');

const CLOSE_REASONS = [
  'Needs details or clarity',
  'Answered by an existing question',
  'Off-topic for this community',
  'Not reproducible',
];

/**
 * Close a question with a reason (moderator only). Optionally link it to a
 * canonical duplicate so readers are routed to the answered version.
 */
function closeQuestion({ questionId, moderator, reason, duplicateOfId }) {
  if (!moderator || moderator.role !== 'moderator') {
    throw forbidden('Only moderators can close questions.');
  }

  const question = db.prepare('SELECT id, author_id FROM questions WHERE id = ?').get(Number(questionId));
  if (!question) throw notFound('That question no longer exists.');

  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 3) throw badRequest('Add a short reason for closing the question.');
  if (cleanReason.length > 200) throw badRequest('Keep the close reason under 200 characters.');

  let duplicateId = null;
  if (duplicateOfId !== undefined && duplicateOfId !== null && String(duplicateOfId).trim() !== '') {
    duplicateId = Number(duplicateOfId);
    if (!Number.isInteger(duplicateId) || duplicateId <= 0) throw badRequest('Duplicate question id must be a number.');
    if (duplicateId === question.id) throw badRequest('A question cannot duplicate itself.');
    const canonical = db.prepare('SELECT id FROM questions WHERE id = ?').get(duplicateId);
    if (!canonical) throw badRequest(`No question exists with id ${duplicateId}.`);
  }

  db.prepare(
    `UPDATE questions
        SET closed_at = ?, closed_reason = ?, closed_by = ?, duplicate_of_id = ?
      WHERE id = ?`
  ).run(new Date().toISOString(), cleanReason, moderator.id, duplicateId, question.id);

  return db.prepare('SELECT * FROM questions WHERE id = ?').get(question.id);
}

/** Reopen (moderator only) — undo an accidental close or duplicate link. */
function reopenQuestion({ questionId, moderator }) {
  if (!moderator || moderator.role !== 'moderator') {
    throw forbidden('Only moderators can reopen questions.');
  }
  const question = db.prepare('SELECT id FROM questions WHERE id = ?').get(Number(questionId));
  if (!question) throw notFound('That question no longer exists.');
  db.prepare(
    `UPDATE questions
        SET closed_at = NULL, closed_reason = NULL, closed_by = NULL, duplicate_of_id = NULL
      WHERE id = ?`
  ).run(question.id);
  return question.id;
}

module.exports = { CLOSE_REASONS, closeQuestion, reopenQuestion };
