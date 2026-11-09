'use strict';

const session = require('express-session');

/**
 * Server-side session store backed by the app's SQLite database.
 * Keeps sessions durable across restarts without the in-memory store's
 * "all users logged out on deploy" behaviour and without any external service.
 */
class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.selectStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
    this.upsertStmt = db.prepare(
      `INSERT INTO sessions (sid, expires, sess) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, sess = excluded.sess`
    );
    this.deleteStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.pruneStmt = db.prepare('DELETE FROM sessions WHERE expires <= ?');

    this.pruner = setInterval(() => {
      try {
        this.pruneStmt.run(Date.now());
      } catch (error) {
        console.error('session prune failed:', error.message);
      }
    }, 15 * 60 * 1000);
    this.pruner.unref();
  }

  expiryOf(sess) {
    const ttl = sess && sess.cookie && sess.cookie.expires;
    if (ttl) return new Date(ttl).getTime();
    const maxAge = sess && sess.cookie && sess.cookie.maxAge;
    return Date.now() + (typeof maxAge === 'number' ? maxAge : 7 * 24 * 60 * 60 * 1000);
  }

  get(sid, callback) {
    try {
      const row = this.selectStmt.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      this.upsertStmt.run(sid, this.expiryOf(sess), JSON.stringify(sess));
      if (callback) callback(null);
    } catch (error) {
      if (callback) callback(error);
      else console.error('session write failed:', error.message);
    }
  }

  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }

  destroy(sid, callback) {
    try {
      this.deleteStmt.run(sid);
      if (callback) callback(null);
    } catch (error) {
      if (callback) callback(error);
    }
  }
}

module.exports = { SqliteSessionStore };
