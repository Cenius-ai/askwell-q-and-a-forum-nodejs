'use strict';

const { db } = require('../db');
const { slugify, normaliseTagName } = require('../helpers');

const selectAllTags = db.prepare(
  `SELECT t.*,
          (SELECT COUNT(*) FROM question_tags qt WHERE qt.tag_id = t.id) AS question_count,
          (SELECT COUNT(*) FROM tag_follows tf WHERE tf.tag_id = t.id)  AS followers
     FROM tags t
    ORDER BY question_count DESC, t.name ASC`
);

function listAll() {
  return selectAllTags.all();
}

function popular(limit = 12) {
  return selectAllTags.all().slice(0, limit);
}

function getBySlug(slug) {
  return db.prepare(
    `SELECT t.*,
            (SELECT COUNT(*) FROM question_tags qt WHERE qt.tag_id = t.id) AS question_count,
            (SELECT COUNT(*) FROM tag_follows tf WHERE tf.tag_id = t.id)  AS followers
       FROM tags t WHERE t.slug = ?`
  ).get(String(slug || '')) || null;
}

function getById(id) {
  return db.prepare(
    `SELECT t.*,
            (SELECT COUNT(*) FROM question_tags qt WHERE qt.tag_id = t.id) AS question_count,
            (SELECT COUNT(*) FROM tag_follows tf WHERE tf.tag_id = t.id)  AS followers
       FROM tags t WHERE t.id = ?`
  ).get(Number(id)) || null;
}

const insertTag = db.prepare(
  'INSERT INTO tags (name, slug, description, follower_count, created_at) VALUES (?, ?, ?, 0, ?)'
);
const selectTagBySlug = db.prepare('SELECT * FROM tags WHERE slug = ?');

/** Ensure a tag exists for each name and return its id (normalised slug). */
function ensureTags(names) {
  const ids = [];
  const now = new Date().toISOString();
  for (const rawName of names) {
    const name = normaliseTagName(rawName);
    const slug = slugify(name);
    if (!slug) continue;
    let tag = selectTagBySlug.get(slug);
    if (!tag) {
      const info = insertTag.run(name.slice(0, 40), slug, null, now);
      tag = { id: Number(info.lastInsertRowid) };
    }
    ids.push(tag.id);
  }
  return [...new Set(ids)];
}

const deleteQuestionTags = db.prepare('DELETE FROM question_tags WHERE question_id = ?');
const insertQuestionTag = db.prepare('INSERT OR IGNORE INTO question_tags (question_id, tag_id) VALUES (?, ?)');

function setQuestionTags(questionId, tagIds) {
  const apply = db.transaction((qid, ids) => {
    deleteQuestionTags.run(qid);
    for (const tagId of ids) insertQuestionTag.run(qid, tagId);
  });
  apply(Number(questionId), tagIds);
}

/** Tags for a set of question ids, grouped in one query (avoids N+1). */
function tagsForQuestions(questionIds) {
  const grouped = new Map();
  if (!questionIds.length) return grouped;
  const placeholders = questionIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT qt.question_id, t.id, t.name, t.slug
       FROM question_tags qt JOIN tags t ON t.id = qt.tag_id
      WHERE qt.question_id IN (${placeholders})
      ORDER BY t.name ASC`
  ).all(...questionIds);
  for (const row of rows) {
    if (!grouped.has(row.question_id)) grouped.set(row.question_id, []);
    grouped.get(row.question_id).push({ id: row.id, name: row.name, slug: row.slug });
  }
  return grouped;
}

function isFollowing(userId, tagId) {
  if (!userId) return false;
  return Boolean(
    db.prepare('SELECT 1 FROM tag_follows WHERE user_id = ? AND tag_id = ?').get(Number(userId), Number(tagId))
  );
}

/** Follow/unfollow is one transaction; follower_count is derived, never drifting. */
function toggleFollow(userId, tagId) {
  const run = db.transaction((uid, tid) => {
    const existing = db.prepare('SELECT 1 FROM tag_follows WHERE user_id = ? AND tag_id = ?').get(uid, tid);
    if (existing) {
      db.prepare('DELETE FROM tag_follows WHERE user_id = ? AND tag_id = ?').run(uid, tid);
    } else {
      db.prepare('INSERT INTO tag_follows (user_id, tag_id, created_at) VALUES (?, ?, ?)').run(
        uid,
        tid,
        new Date().toISOString()
      );
    }
    db.prepare(
      'UPDATE tags SET follower_count = (SELECT COUNT(*) FROM tag_follows WHERE tag_id = ?) WHERE id = ?'
    ).run(tid, tid);
    return !existing;
  });
  const nowFollowing = run(Number(userId), Number(tagId));
  const tag = getById(tagId);
  return { following: nowFollowing, followerCount: tag ? tag.followers : 0 };
}

function followedTags(userId) {
  return db.prepare(
    `SELECT t.*,
            (SELECT COUNT(*) FROM question_tags qt WHERE qt.tag_id = t.id) AS question_count,
            (SELECT COUNT(*) FROM tag_follows tf WHERE tf.tag_id = t.id)  AS followers
       FROM tags t
       JOIN tag_follows tf ON tf.tag_id = t.id AND tf.user_id = ?
      ORDER BY t.name ASC`
  ).all(Number(userId));
}

module.exports = {
  listAll,
  popular,
  getBySlug,
  getById,
  ensureTags,
  setQuestionTags,
  tagsForQuestions,
  isFollowing,
  toggleFollow,
  followedTags,
};
