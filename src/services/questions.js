'use strict';

const { db } = require('../db');
const tags = require('./tags');
const badges = require('./badges');
const { forbidden, notFound, badRequest } = require('../lib/http-error');

const QUESTION_PROJECTION = `
  SELECT q.id, q.title, q.body, q.created_at, q.updated_at, q.closed_at, q.closed_reason,
         q.duplicate_of_id, q.accepted_answer_id,
         u.id AS author_id, u.display_name AS author_name, u.reputation AS author_reputation,
         (SELECT COALESCE(SUM(v.value), 0) FROM votes v
           WHERE v.target_type = 'question' AND v.target_id = q.id) AS score,
         (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS answer_count,
         (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND a.id = q.accepted_answer_id) AS has_accepted
    FROM questions q
    JOIN users u ON u.id = q.author_id
`;

const selectList = db.prepare(`${QUESTION_PROJECTION} ORDER BY q.created_at DESC LIMIT ?`);
const selectByIdStmt = db.prepare(`${QUESTION_PROJECTION} WHERE q.id = ?`);
const selectByTag = db.prepare(
  `${QUESTION_PROJECTION}
    JOIN question_tags qt ON qt.question_id = q.id AND qt.tag_id = ?
   ORDER BY q.created_at DESC LIMIT ?`
);
const selectByAuthor = db.prepare(`${QUESTION_PROJECTION} WHERE q.author_id = ? ORDER BY q.created_at DESC`);
const insertQuestion = db.prepare(
  `INSERT INTO questions (author_id, title, body, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?)`
);
const updateQuestion = db.prepare(
  'UPDATE questions SET title = ?, body = ?, updated_at = ? WHERE id = ?'
);

function withTags(rows) {
  const grouped = tags.tagsForQuestions(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, tags: grouped.get(row.id) || [] }));
}

function listRecent(limit = 25) {
  return withTags(selectList.all(limit));
}

function listByTag(tagId, limit = 25) {
  return withTags(selectByTag.all(Number(tagId), limit));
}

function listByAuthor(authorId) {
  return withTags(selectByAuthor.all(Number(authorId)));
}

function getById(id) {
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId <= 0) return null;
  const row = selectByIdStmt.get(questionId);
  if (!row) return null;

  const tagRows = db.prepare(
    `SELECT t.id, t.name, t.slug FROM question_tags qt JOIN tags t ON t.id = qt.tag_id
      WHERE qt.question_id = ? ORDER BY t.name ASC`
  ).all(questionId);

  const duplicateOf = row.duplicate_of_id
    ? db.prepare('SELECT id, title FROM questions WHERE id = ?').get(row.duplicate_of_id)
    : null;
  const closedBy = row.closed_at
    ? db.prepare(
        `SELECT u.display_name FROM questions q JOIN users u ON u.id = q.closed_by WHERE q.id = ?`
      ).get(questionId)
    : null;

  const answers = db.prepare(
    `SELECT a.id, a.body, a.created_at, a.updated_at, a.question_id,
            u.id AS author_id, u.display_name AS author_name, u.reputation AS author_reputation,
            (SELECT COALESCE(SUM(v.value), 0) FROM votes v
              WHERE v.target_type = 'answer' AND v.target_id = a.id) AS score
       FROM answers a JOIN users u ON u.id = a.author_id
      WHERE a.question_id = ?
      ORDER BY CASE WHEN a.id = ? THEN 0 ELSE 1 END ASC, score DESC, a.created_at DESC`
  ).all(questionId, row.accepted_answer_id || -1);

  return { ...row, tags: tagRows, duplicateOf, closedBy, answers };
}

function getScore(questionId) {
  const row = db.prepare(
    `SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE target_type = 'question' AND target_id = ?`
  ).get(Number(questionId));
  return row ? row.score : 0;
}

function validateQuestionInput({ title, body }) {
  const errors = {};
  const cleanTitle = String(title || '').trim();
  const cleanBody = String(body || '').trim();
  if (cleanTitle.length < 8) errors.title = 'Give your question a title of at least 8 characters.';
  else if (cleanTitle.length > 140) errors.title = 'Keep the title under 140 characters.';
  if (cleanBody.length < 20) errors.body = 'Add at least 20 characters of detail so people can answer.';
  else if (cleanBody.length > 8000) errors.body = 'Keep the question body under 8,000 characters.';
  return { errors, title: cleanTitle, body: cleanBody };
}

function validateTagIds(tagNames) {
  if (!tagNames.length) return { error: 'Add at least one tag so the question can be found.', tagIds: [] };
  if (tagNames.length > 5) return { error: 'Use at most 5 tags.', tagIds: [] };
  const tagIds = tags.ensureTags(tagNames);
  if (!tagIds.length) return { error: 'Add at least one valid tag (letters, numbers, dashes).', tagIds: [] };
  return { error: null, tagIds };
}

function createQuestion({ authorId, title, body, tagIds }) {
  const now = new Date().toISOString();
  const info = insertQuestion.run(Number(authorId), title, body, now, now);
  const questionId = Number(info.lastInsertRowid);
  tags.setQuestionTags(questionId, tagIds);
  badges.award(authorId, 'first-question');
  return getById(questionId);
}

function updateOwnQuestion({ questionId, actingUser, title, body, tagIds }) {
  const question = getById(questionId);
  if (!question) throw notFound('That question no longer exists.');
  if (question.author_id !== actingUser.id) throw forbidden('Only the author can edit this question.');
  updateQuestion.run(title, body, new Date().toISOString(), question.id);
  tags.setQuestionTags(question.id, tagIds);
  return getById(question.id);
}

function deleteQuestion({ questionId, actingUser }) {
  const question = getById(questionId);
  if (!question) throw notFound('That question no longer exists.');
  if (question.author_id !== actingUser.id && actingUser.role !== 'moderator') {
    throw forbidden('Only the author or a moderator can delete this question.');
  }
  const run = db.transaction(() => {
    const answerIds = db.prepare('SELECT id FROM answers WHERE question_id = ?').all(question.id);
    for (const answer of answerIds) {
      db.prepare("DELETE FROM votes WHERE target_type = 'answer' AND target_id = ?").run(answer.id);
    }
    db.prepare("DELETE FROM votes WHERE target_type = 'question' AND target_id = ?").run(question.id);
    db.prepare('DELETE FROM answers WHERE question_id = ?').run(question.id);
    db.prepare('DELETE FROM question_tags WHERE question_id = ?').run(question.id);
    db.prepare('UPDATE questions SET duplicate_of_id = NULL WHERE duplicate_of_id = ?').run(question.id);
    db.prepare('DELETE FROM questions WHERE id = ?').run(question.id);
  });
  run();
}

/** Aggregate counts for the home sidebar. */
function communityStats() {
  return db.prepare(
    `SELECT (SELECT COUNT(*) FROM questions) AS questions,
            (SELECT COUNT(*) FROM answers)   AS answers,
            (SELECT COUNT(*) FROM users)     AS members,
            (SELECT COUNT(*) FROM tags)      AS tags`
  ).get();
}

function topMembers(limit = 5) {
  return db.prepare(
    `SELECT id, display_name, reputation,
            (SELECT COUNT(*) FROM questions q WHERE q.author_id = users.id) AS question_count,
            (SELECT COUNT(*) FROM answers a WHERE a.author_id = users.id) AS answer_count
       FROM users ORDER BY reputation DESC, display_name ASC LIMIT ?`
  ).all(limit);
}

module.exports = {
  listRecent,
  listByTag,
  listByAuthor,
  getById,
  getScore,
  validateQuestionInput,
  validateTagIds,
  createQuestion,
  updateOwnQuestion,
  deleteQuestion,
  communityStats,
  topMembers,
  badRequest,
};
