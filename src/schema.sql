-- Askwell Q and A Forum schema.
-- Applied idempotently on every boot (CREATE ... IF NOT EXISTS), so a fresh
-- clone self-heals even when install.sh was skipped.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  display_name  TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  reputation    INTEGER NOT NULL DEFAULT 0,
  role          TEXT    NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator')),
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT    NOT NULL,
  body               TEXT    NOT NULL,
  accepted_answer_id INTEGER REFERENCES answers(id) ON DELETE SET NULL,
  duplicate_of_id    INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  closed_at          TEXT,
  closed_reason      TEXT,
  closed_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL UNIQUE,
  slug           TEXT    NOT NULL UNIQUE,
  description    TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS question_tags (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

CREATE TABLE IF NOT EXISTS tag_follows (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  PRIMARY KEY (user_id, tag_id)
);

CREATE TABLE IF NOT EXISTS votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT    NOT NULL CHECK (target_type IN ('question', 'answer')),
  target_id   INTEGER NOT NULL,
  value       INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at  TEXT    NOT NULL,
  UNIQUE (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL,
  icon        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id   INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TEXT    NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL,
  reason      TEXT    NOT NULL,
  target_type TEXT,
  target_id   INTEGER,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT    PRIMARY KEY,
  expires INTEGER NOT NULL,
  sess    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_questions_author      ON questions(author_id);
CREATE INDEX IF NOT EXISTS ix_questions_created     ON questions(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_answers_question      ON answers(question_id);
CREATE INDEX IF NOT EXISTS ix_answers_author        ON answers(author_id);
CREATE INDEX IF NOT EXISTS ix_question_tags_tag     ON question_tags(tag_id);
CREATE INDEX IF NOT EXISTS ix_tag_follows_tag       ON tag_follows(tag_id);
CREATE INDEX IF NOT EXISTS ix_votes_target          ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS ix_reputation_user       ON reputation_events(user_id);
CREATE INDEX IF NOT EXISTS ix_sessions_expires      ON sessions(expires);
