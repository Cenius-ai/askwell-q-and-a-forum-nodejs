'use strict';

/**
 * Idempotent demo seed. Runs from `npm run seed` and again on the normal boot
 * path, so a fresh clone is never empty. Content is only inserted when the
 * question table is empty; users, tags, badges and follows are ensured every run.
 */

const { db } = require('./db');
const usersService = require('./services/users');
const tagsService = require('./services/tags');
const badgesService = require('./services/badges');
const questionsService = require('./services/questions');
const answersService = require('./services/answers');
const votesService = require('./services/votes');
const moderationService = require('./services/moderation');
const { DEMO_ACCOUNT } = require('./config');

const MEMBER_PASSWORD = 'askwell-demo-pass';

const SEED_USERS = [
  { email: DEMO_ACCOUNT.email, displayName: DEMO_ACCOUNT.displayName, password: DEMO_ACCOUNT.password, role: 'moderator' },
  { email: 'maya@askwell.dev', displayName: 'Maya Okonkwo', password: MEMBER_PASSWORD, role: 'member' },
  { email: 'priya@askwell.dev', displayName: 'Priya Raghavan', password: MEMBER_PASSWORD, role: 'member' },
  { email: 'tomas@askwell.dev', displayName: 'Tomas Lindqvist', password: MEMBER_PASSWORD, role: 'member' },
  { email: 'halima@askwell.dev', displayName: 'Halima Yusuf', password: MEMBER_PASSWORD, role: 'member' },
  { email: 'jun@askwell.dev', displayName: 'Jun Park', password: MEMBER_PASSWORD, role: 'member' },
];

const SEED_TAGS = [
  { name: 'javascript', description: 'The language the forum itself is written in.' },
  { name: 'nodejs', description: 'Server-side JavaScript: the runtime, streams and the event loop.' },
  { name: 'express', description: 'Routing, middleware and request handling with Express.' },
  { name: 'sqlite', description: 'Embedded persistence, transactions and file-backed durability.' },
  { name: 'ejs', description: 'Server-rendered templates and safe interpolation.' },
  { name: 'security', description: 'Sessions, CSRF, escaping and other things that must not be wrong.' },
  { name: 'sessions', description: 'Keeping a member signed in across requests.' },
  { name: 'css', description: 'Layout, responsive behaviour and long-text handling.' },
  { name: 'self-hosting', description: 'Running your own community instance without a platform team.' },
  { name: 'moderation', description: 'Duplicates, closures and keeping answers findable.' },
];

const QUESTION_VOTES = {
  'sqlite-concurrency': [
    { by: 'maya@askwell.dev', value: 1 },
    { by: 'priya@askwell.dev', value: 1 },
    { by: 'jun@askwell.dev', value: 1 },
    { by: 'halima@askwell.dev', value: 1 },
    { by: DEMO_ACCOUNT.email, value: 1 },
  ],
  'session-disappears': [
    { by: 'priya@askwell.dev', value: 1 },
    { by: 'halima@askwell.dev', value: 1 },
    { by: 'jun@askwell.dev', value: 1 },
  ],
  'ejs-escaping': [
    { by: 'priya@askwell.dev', value: 1 },
    { by: 'tomas@askwell.dev', value: 1 },
    { by: DEMO_ACCOUNT.email, value: 1 },
  ],
  'postgres-vs-sqlite': [
    { by: 'halima@askwell.dev', value: 1 },
    { by: 'maya@askwell.dev', value: 1 },
  ],
  'tag-follow-counts': [
    { by: DEMO_ACCOUNT.email, value: 1 },
    { by: 'maya@askwell.dev', value: 1 },
    { by: 'halima@askwell.dev', value: 1 },
  ],
  'csrf-without-framework': [
    { by: 'priya@askwell.dev', value: 1 },
    { by: 'jun@askwell.dev', value: 1 },
    { by: 'halima@askwell.dev', value: 1 },
    { by: 'tomas@askwell.dev', value: 1 },
  ],
  'responsive-question-titles': [
    { by: 'halima@askwell.dev', value: 1 },
    { by: 'tomas@askwell.dev', value: 1 },
    { by: 'priya@askwell.dev', value: -1 },
  ],
  'duplicate-questions': [
    { by: 'tomas@askwell.dev', value: 1 },
    { by: 'maya@askwell.dev', value: 1 },
  ],
};

const SEED_QUESTIONS = [
  {
    key: 'sqlite-concurrency',
    author: 'tomas@askwell.dev',
    daysAgo: 12,
    title: 'How do I keep SQLite writes safe when requests arrive in parallel?',
    tags: ['sqlite', 'nodejs'],
    body:
      'We run a small self-hosted Q&A on a single Node process with better-sqlite3. Everything is fine until two answers are posted at the same moment: one occasionally fails with SQLITE_BUSY and the browser gets a 500 page instead of the new answer.\n\nWAL mode is already on. What is the recommended way to serialise writes without wrapping every route in a global mutex? Are transactions enough on their own, or do I need to set a busy_timeout as well?',
    answers: [
      {
        author: 'priya@askwell.dev',
        daysAgo: 11,
        accepted: true,
        votes: [
          { by: 'maya@askwell.dev', value: 1 },
          { by: 'jun@askwell.dev', value: 1 },
          { by: 'halima@askwell.dev', value: 1 },
          { by: 'tomas@askwell.dev', value: 1 },
          { by: DEMO_ACCOUNT.email, value: 1 },
        ],
        body:
          'WAL plus a busy timeout is usually all you need on one process. Set PRAGMA busy_timeout = 5000 when the connection opens, then wrap every multi-statement write in db.transaction(...). better-sqlite3 runs transactions synchronously, so two transactions from the same process can never interleave.\n\nThe remaining failure mode is a second process writing while the server is up — a seed script or a sqlite3 shell. The timeout covers that case, and you avoid holding a mutex around the whole request.',
      },
      {
        author: 'jun@askwell.dev',
        daysAgo: 10,
        votes: [{ by: 'maya@askwell.dev', value: 1 }],
        body:
          'Before adding locking, check whether the write can become one statement. Most of the SQLITE_BUSY reports I have debugged came from code that read a row, did work in JavaScript, then wrote it back outside a transaction. Doing the read and the write inside one transaction removes almost all of the contention.',
      },
    ],
  },
  {
    key: 'session-disappears',
    author: 'maya@askwell.dev',
    daysAgo: 9,
    title: 'Why does my Express session disappear on the second request?',
    tags: ['sessions', 'express', 'nodejs'],
    body:
      'Login works. The redirect lands on the dashboard and the member name is in the header. The next click takes me straight back to the login page, even though the browser shows the cookie in devtools.\n\nI am using express-session with the default store while I prototype. What should I check before I start rewriting the auth code?',
    answers: [
      {
        author: 'priya@askwell.dev',
        daysAgo: 9,
        accepted: true,
        votes: [
          { by: DEMO_ACCOUNT.email, value: 1 },
          { by: 'jun@askwell.dev', value: 1 },
          { by: 'halima@askwell.dev', value: 1 },
        ],
        body:
          'Check the cookie flags first. When cookie.secure is true the browser silently drops the cookie on plain HTTP, so the session is created on the POST and lost on the very next GET. Keep secure false locally and switch it on only behind HTTPS.\n\nSecond check: is express.urlencoded() registered before the routes? Without a body parser the login handler sees undefined, never writes to req.session, and saveUninitialized: false means no cookie is issued at all.',
      },
      {
        author: 'tomas@askwell.dev',
        daysAgo: 8,
        votes: [{ by: 'maya@askwell.dev', value: 1 }],
        body:
          'Also worth knowing: the default memory store discards every session when the process restarts. If nodemon restarts on every file save, your "session bug" repeats exactly every time you edit a template.',
      },
      {
        author: 'jun@askwell.dev',
        daysAgo: 7,
        votes: [],
        body:
          'If you register a custom store, check its callback. A store that never invokes the callback (or errors quietly) leaves the session written nowhere while the login route still redirects cheerfully.',
      },
    ],
  },
  {
    key: 'ejs-escaping',
    author: 'halima@askwell.dev',
    daysAgo: 7,
    title: 'EJS: when should I use <%- versus <%= %>?',
    tags: ['ejs', 'security', 'nodejs'],
    body:
      'I render a question body that comes straight from the database. With <%= %> the line breaks disappear. With <%- %> the paragraphs render correctly, but I want to be sure I am not opening the classic XSS hole in a community where anyone can post.\n\nWhat is the safe way to display multi-line plain text?',
    answers: [
      {
        author: 'tomas@askwell.dev',
        daysAgo: 6,
        accepted: true,
        votes: [
          { by: DEMO_ACCOUNT.email, value: 1 },
          { by: 'priya@askwell.dev', value: 1 },
          { by: 'maya@askwell.dev', value: 1 },
        ],
        body:
          'Keep <%= %> — it HTML-escapes the value — and let CSS handle the line breaks with white-space: pre-wrap on the container. You get plain-text rendering with working paragraphs and no injection sink.\n\n<%- %> outputs the raw string. That is only acceptable for HTML you generated yourself, such as the layout body, never for a value that came from a member.',
      },
      {
        author: 'priya@askwell.dev',
        daysAgo: 6,
        votes: [{ by: 'halima@askwell.dev', value: 1 }],
        body:
          'If you ever do need a subset of HTML, sanitise first with an allowlist library and only then output it raw. A regex "strip the dangerous tags" pass is bypassed in minutes, so do not build one.',
      },
    ],
  },
  {
    key: 'postgres-vs-sqlite',
    author: 'jun@askwell.dev',
    daysAgo: 6,
    title: 'Postgres or SQLite for a self-hosted Q&A with a few thousand members?',
    tags: ['self-hosting', 'sqlite'],
    body:
      'We are deploying Askwell for a 4,000 member engineering community. The ops team would love SQLite because there is nothing to operate; I worry we will regret it when the community grows.\n\nFor a read-heavy forum with occasional write bursts, where does SQLite actually stop being the right answer?',
    answers: [
      {
        author: 'halima@askwell.dev',
        daysAgo: 5,
        votes: [
          { by: 'tomas@askwell.dev', value: 1 },
          { by: 'maya@askwell.dev', value: 1 },
        ],
        body:
          'A forum at that size is an excellent SQLite fit: one process, WAL mode, and reads that never block the writer. The honest limit is not member count, it is write concurrency from multiple app servers — SQLite wants one writer.\n\nKeep the SQL portable (no vendor-only syntax), keep a nightly backup of the file, and you can migrate later if you ever outgrow it. Starting on Postgres "for safety" costs you a database to operate on day one.',
      },
    ],
  },
  {
    key: 'tag-follow-counts',
    author: 'priya@askwell.dev',
    daysAgo: 5,
    title: 'How do I model tag followers without the counts drifting?',
    tags: ['sqlite', 'nodejs'],
    body:
      'Tag pages show a follower count. I started with an increment on the tags table, but after a few rapid follow/unfollow clicks the number stopped matching the join rows.\n\nWhat is the cleanest way to keep a denormalised count honest without recounting on every page view?',
    answers: [
      {
        author: DEMO_ACCOUNT.email,
        daysAgo: 4,
        accepted: true,
        votes: [{ by: 'maya@askwell.dev', value: 1 }],
        body:
          'Derive the count in the same transaction as the follow write: delete or insert the join row, then UPDATE tags SET follower_count = (SELECT COUNT(*) FROM tag_follows WHERE tag_id = ?). One statement, a single source of truth, and double clicks cannot drift it.\n\nIf the table ever gets big, keep the derived column but rebuild it from the join table in a maintenance query instead of trusting increments.',
      },
      {
        author: 'tomas@askwell.dev',
        daysAgo: 4,
        votes: [{ by: 'priya@askwell.dev', value: 1 }],
        body:
          'Do not forget a UNIQUE (user_id, tag_id) key on the join table. Two rapid requests otherwise create two rows and the follower looks like two people.',
      },
    ],
  },
  {
    key: 'csrf-without-framework',
    author: DEMO_ACCOUNT.email,
    daysAgo: 4,
    title: 'What is the smallest correct CSRF protection for plain form posts?',
    tags: ['security', 'express', 'sessions'],
    body:
      'Our app is server-rendered with ordinary HTML forms, no SPA, no fetch wrapper. I would like CSRF protection that is small enough to audit in one sitting and does not pull in another dependency.\n\nWhat does the minimal correct implementation actually need?',
    answers: [
      {
        author: 'priya@askwell.dev',
        daysAgo: 3,
        votes: [
          { by: 'maya@askwell.dev', value: 1 },
          { by: 'jun@askwell.dev', value: 1 },
          { by: 'halima@askwell.dev', value: 1 },
          { by: 'tomas@askwell.dev', value: 1 },
        ],
        body:
          'Generate a random token per session, render it as a hidden _csrf field in every form, and on every state-changing request compare it with the session value using a constant-time comparison. Reject with 403 when it is missing or wrong.\n\nTwo details people miss: the token belongs to the session, so it survives navigation without being stored in a cookie; and session.regenerate() on login must re-issue the token, otherwise the first form after login fails.',
      },
      {
        author: 'jun@askwell.dev',
        daysAgo: 3,
        votes: [{ by: DEMO_ACCOUNT.email, value: 1 }],
        body:
          'SameSite=lax on the session cookie already blocks most cross-site form posts, but treat it as defence in depth rather than a replacement — the token check is what makes the guarantee explicit and testable.',
      },
    ],
  },
  {
    key: 'responsive-question-titles',
    author: 'maya@askwell.dev',
    daysAgo: 3,
    title: 'Long question titles break the layout at 375px — what am I missing?',
    tags: ['css'],
    body:
      'On desktop the question list looks tidy. On a 375px phone any question with a long unbroken word (a stack trace, a package name) pushes the whole page sideways and I get a horizontal scrollbar.\n\nI set max-width: 100% on the list. What else is needed?',
    answers: [
      {
        author: DEMO_ACCOUNT.email,
        daysAgo: 2,
        votes: [
          { by: 'halima@askwell.dev', value: 1 },
          { by: 'tomas@askwell.dev', value: 1 },
          { by: 'priya@askwell.dev', value: -1 },
        ],
        body:
          'max-width does nothing for a word wider than its container. Add overflow-wrap: anywhere (or break-word) to the title itself, set min-width: 0 on the flex children that hold it, and make sure the grid children are allowed to shrink.\n\nOne horizontal-scroll bug is usually three properties: box-sizing: border-box globally, min-width: 0 on flex/grid items, and overflow-wrap on the text node that can be unbreakable.',
      },
    ],
  },
  {
    key: 'duplicate-questions',
    author: DEMO_ACCOUNT.email,
    daysAgo: 2,
    title: 'How should moderators link duplicate questions without losing the answers?',
    tags: ['moderation', 'self-hosting'],
    body:
      'We get the same "why is my session empty" question twice a week. Deleting the duplicate throws away any useful answers; leaving it alone splits the answers across two pages.\n\nWhat is a sane moderator workflow for duplicates in a small community?',
    answers: [
      {
        author: 'tomas@askwell.dev',
        daysAgo: 1,
        votes: [
          { by: 'maya@askwell.dev', value: 1 },
          { by: 'priya@askwell.dev', value: 1 },
        ],
        body:
          'Close the newer question with a reason and a pointer to the canonical one, and keep it readable. New answers are disabled on the closed question, so the canonical page becomes the place people answer, while the closed page still shows up in search with a clear "already answered here" link at the top.\n\nReserve deletion for spam and abuse. A closed duplicate is documentation; a deleted one is a dead search result.',
      },
    ],
  },
  {
    key: 'votes-on-closed',
    author: 'tomas@askwell.dev',
    daysAgo: 1,
    title: 'Should voting stay open on closed questions?',
    tags: ['moderation'],
    body:
      'We close a question as a duplicate, then someone finds it through a search engine a month later and wants to say the linked answer was useful.\n\nIs there a downside to leaving votes available on closed questions while new answers are disabled?',
    answers: [],
  },
];

const FOLLOWS = [
  { email: 'maya@askwell.dev', tag: 'javascript' },
  { email: 'maya@askwell.dev', tag: 'nodejs' },
  { email: 'priya@askwell.dev', tag: 'sqlite' },
  { email: 'priya@askwell.dev', tag: 'self-hosting' },
  { email: DEMO_ACCOUNT.email, tag: 'moderation' },
  { email: DEMO_ACCOUNT.email, tag: 'security' },
  { email: 'tomas@askwell.dev', tag: 'sqlite' },
  { email: 'halima@askwell.dev', tag: 'ejs' },
  { email: 'jun@askwell.dev', tag: 'self-hosting' },
  { email: 'jun@askwell.dev', tag: 'express' },
];

function timeAgoIso(daysAgo, extraHours = 0) {
  const ms = daysAgo * 24 * 60 * 60 * 1000 + extraHours * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

function ensureUsers() {
  const byEmail = new Map();
  for (const seeded of SEED_USERS) {
    let user = usersService.findByEmail(seeded.email);
    if (!user) {
      user = usersService.createUser({
        email: seeded.email,
        displayName: seeded.displayName,
        password: seeded.password,
        role: seeded.role,
      });
    } else if (seeded.role === 'moderator' && user.role !== 'moderator') {
      db.prepare("UPDATE users SET role = 'moderator' WHERE id = ?").run(user.id);
      user.role = 'moderator';
    }
    byEmail.set(seeded.email, user);
  }
  return byEmail;
}

function ensureTags() {
  const now = new Date().toISOString();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO tags (name, slug, description, follower_count, created_at) VALUES (?, ?, ?, 0, ?)'
  );
  for (const tag of SEED_TAGS) {
    const existing = tagsService.getBySlug(tag.name);
    if (existing) {
      if (!existing.description) {
        db.prepare('UPDATE tags SET description = ? WHERE id = ?').run(tag.description, existing.id);
      }
      continue;
    }
    insert.run(tag.name, tag.name, tag.description, now);
  }
}

function seedContent(usersByEmail) {
  const questionIds = new Map();

  for (const seeded of SEED_QUESTIONS) {
    const author = usersByEmail.get(seeded.author);
    const { tagIds } = questionsService.validateTagIds(seeded.tags);
    const question = questionsService.createQuestion({
      authorId: author.id,
      title: seeded.title,
      body: seeded.body,
      tagIds,
    });
    const createdAt = timeAgoIso(seeded.daysAgo, 3);
    db.prepare('UPDATE questions SET created_at = ?, updated_at = ? WHERE id = ?')
      .run(createdAt, createdAt, question.id);
    questionIds.set(seeded.key, { id: question.id, authorEmail: seeded.author, answers: [] });

    for (const seededAnswer of seeded.answers || []) {
      const answerAuthor = usersByEmail.get(seededAnswer.author);
      const answer = answersService.createAnswer({
        questionId: question.id,
        authorId: answerAuthor.id,
        body: seededAnswer.body,
      });
      const answerCreatedAt = timeAgoIso(seededAnswer.daysAgo, 1);
      db.prepare('UPDATE answers SET created_at = ?, updated_at = ? WHERE id = ?')
        .run(answerCreatedAt, answerCreatedAt, answer.id);
      questionIds.get(seeded.key).answers.push({
        id: answer.id,
        authorEmail: seededAnswer.author,
        accepted: Boolean(seededAnswer.accepted),
        votes: seededAnswer.votes || [],
      });
    }
  }

  // Votes go through the real voting service so reputation + badges stay honest.
  for (const seeded of SEED_QUESTIONS) {
    const record = questionIds.get(seeded.key);
    for (const vote of QUESTION_VOTES[seeded.key] || []) {
      votesService.castVote({
        userId: usersByEmail.get(vote.by).id,
        targetType: 'question',
        targetId: record.id,
        value: vote.value,
      });
    }
    for (const answer of record.answers) {
      for (const vote of answer.votes) {
        votesService.castVote({
          userId: usersByEmail.get(vote.by).id,
          targetType: 'answer',
          targetId: answer.id,
          value: vote.value,
        });
      }
    }
  }

  // Accepted answers are set by the question's own author, as in the real flow.
  for (const seeded of SEED_QUESTIONS) {
    const record = questionIds.get(seeded.key);
    const accepted = record.answers.find((answer) => answer.accepted);
    if (!accepted) continue;
    answersService.toggleAccept({
      questionId: record.id,
      answerId: accepted.id,
      actingUser: usersByEmail.get(record.authorEmail),
    });
  }

  // One closed duplicate so moderators' work is visible on first run.
  const duplicate = questionIds.get('votes-on-closed');
  const canonical = questionIds.get('duplicate-questions');
  if (duplicate && canonical) {
    moderationService.closeQuestion({
      questionId: duplicate.id,
      moderator: usersByEmail.get(DEMO_ACCOUNT.email),
      reason: 'Answered by an existing question',
      duplicateOfId: canonical.id,
    });
  }

  return questionIds;
}

function ensureFollows(usersByEmail) {
  for (const follow of FOLLOWS) {
    const user = usersByEmail.get(follow.email);
    const tag = tagsService.getBySlug(follow.tag);
    if (!user || !tag) continue;
    if (!tagsService.isFollowing(user.id, tag.id)) {
      tagsService.toggleFollow(user.id, tag.id);
    }
  }
}

function seed() {
  badgesService.ensureCatalogue();
  const usersByEmail = ensureUsers();
  ensureTags();

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM questions').get();
  if (count === 0) {
    seedContent(usersByEmail);
  }
  ensureFollows(usersByEmail);

  return db.prepare(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM questions) AS questions,
            (SELECT COUNT(*) FROM answers) AS answers,
            (SELECT COUNT(*) FROM tags) AS tags,
            (SELECT COUNT(*) FROM votes) AS votes`
  ).get();
}

module.exports = { seed, SEED_USERS, MEMBER_PASSWORD };
