'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, db, csrfFrom, loginAs } = require('./setup');

test('home page lists the seeded questions with scores and answer counts', async () => {
  const response = await request(app).get('/');
  assert.equal(response.status, 200);
  assert.match(response.text, /Newest questions/);
  assert.match(response.text, /How do I keep SQLite writes safe when requests arrive in parallel\?/);
  assert.match(response.text, /Why does my Express session disappear on the second request\?/);
  // Six stat cells / tags rendered from the seed.
  assert.match(response.text, /Popular tags/);
  assert.match(response.text, /<span class="stat-cell__label">score<\/span>/);
});

test('question detail renders title, body, author reputation and tags', async () => {
  const response = await request(app).get('/questions/1');
  assert.equal(response.status, 200);
  assert.match(response.text, /How do I keep SQLite writes safe/);
  assert.match(response.text, /WAL mode is already on/);
  assert.match(response.text, /Tomas Lindqvist/);
  assert.match(response.text, /href="\/tags\/sqlite"/);
  assert.match(response.text, /class="rep" title="(Author )?[Rr]eputation"/);
  assert.match(response.text, /Accepted answer/);
});

test('an unknown question id renders the branded 404 page', async () => {
  const response = await request(app).get('/questions/99999');
  assert.equal(response.status, 404);
  assert.match(response.text, /That page is not here/);
  assert.match(response.text, /Back to questions/);
});

test('signed-in members can ask a question with existing and new tags', async () => {
  const agent = request.agent(app);
  await loginAs(agent);

  const form = await agent.get('/questions/new');
  assert.equal(form.status, 200);
  const token = csrfFrom(form.text);

  const created = await agent.post('/questions').type('form').send({
    _csrf: token,
    title: 'How do I stream a large CSV into SQLite without loading it all?',
    body: 'I have a 2GB CSV export and better-sqlite3 in a single process. Loading it with readFileSync blows up memory, so what is the right streaming pattern for bulk inserts?',
    tags: 'nodejs, SQLite,  Bulk-Load ',
  });

  assert.equal(created.status, 302);
  const questionId = Number(created.headers.location.split('/')[2]);
  assert.ok(questionId > 0);

  const stored = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  assert.equal(stored.author_id, 1);

  const tagSlugs = db
    .prepare(
      `SELECT t.slug FROM question_tags qt JOIN tags t ON t.id = qt.tag_id
        WHERE qt.question_id = ? ORDER BY t.slug`
    )
    .all(questionId)
    .map((row) => row.slug);
  assert.deepEqual(tagSlugs, ['bulk-load', 'nodejs', 'sqlite']);

  const detail = await agent.get(`/questions/${questionId}`);
  assert.match(detail.text, /stream a large CSV into SQLite/);
  assert.match(detail.text, /href="\/tags\/bulk-load"/);

  const home = await agent.get('/');
  assert.match(home.text, /stream a large CSV into SQLite/);
});

test('a blank title is rejected with an inline error and persists nothing', async () => {
  const agent = request.agent(app);
  await loginAs(agent);
  const token = csrfFrom((await agent.get('/questions/new')).text);
  const before = db.prepare('SELECT COUNT(*) AS count FROM questions').get().count;

  const response = await agent.post('/questions').type('form').send({
    _csrf: token,
    title: '   ',
    body: 'short',
    tags: '',
  });

  assert.equal(response.status, 422);
  assert.match(response.text, /title of at least 8 characters/);
  assert.match(response.text, /at least 20 characters/);
  assert.match(response.text, /Add at least one tag/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM questions').get().count, before);
});

test('only the author can edit or delete a question', async () => {
  const authorAgent = request.agent(app);
  await loginAs(authorAgent);
  const token = csrfFrom((await authorAgent.get('/questions/new')).text);
  const created = await authorAgent.post('/questions').type('form').send({
    _csrf: token,
    title: 'Should I enable WAL mode on a read-mostly instance?',
    body: 'Our Q&A instance is read-heavy with occasional writes. Is WAL mode still worth the extra -wal and -shm files?',
    tags: 'sqlite',
  });
  const questionId = Number(created.headers.location.split('/')[2]);

  const otherAgent = request.agent(app);
  await loginAs(otherAgent, 'maya@askwell.dev', 'askwell-demo-pass');
  const otherToken = csrfFrom((await otherAgent.get('/')).text);

  const forbiddenEdit = await otherAgent.post(`/questions/${questionId}`).type('form').send({
    _csrf: otherToken,
    title: 'Hijacked title that should never be saved',
    body: 'An edit attempt from a member who does not own this question at all.',
    tags: 'sqlite',
  });
  assert.equal(forbiddenEdit.status, 403);

  const unchanged = db.prepare('SELECT title FROM questions WHERE id = ?').get(questionId);
  assert.equal(unchanged.title, 'Should I enable WAL mode on a read-mostly instance?');

  const forbiddenDeletePage = await otherAgent.get(`/questions/${questionId}/edit`);
  assert.equal(forbiddenDeletePage.status, 403);

  const authorToken = csrfFrom((await authorAgent.get(`/questions/${questionId}/edit`)).text);
  const updated = await authorAgent.post(`/questions/${questionId}`).type('form').send({
    _csrf: authorToken,
    title: 'Should I enable WAL mode on a read-mostly Q&A instance?',
    body: 'Our Q&A instance is read-heavy with occasional writes. Is WAL mode still worth the extra wal/shm files?',
    tags: 'sqlite, nodejs',
  });
  assert.equal(updated.status, 302);

  const detail = await authorAgent.get(`/questions/${questionId}`);
  assert.match(detail.text, /read-mostly Q&amp;A instance/);

  const deleteToken = csrfFrom(detail.text);
  const deleted = await authorAgent
    .post(`/questions/${questionId}/delete`)
    .type('form')
    .send({ _csrf: deleteToken });
  assert.equal(deleted.status, 302);
  assert.equal(deleted.headers.location, '/');

  const gone = await request(app).get(`/questions/${questionId}`);
  assert.equal(gone.status, 404);
});

test('the seeded closed duplicate shows a banner and links to the canonical question', async () => {
  const response = await request(app).get('/questions/9');
  assert.equal(response.status, 200);
  assert.match(response.text, /Closed/);
  assert.match(response.text, /Answered by an existing question/);
  assert.match(response.text, /href="\/questions\/8"/);
  assert.match(response.text, /Answers are closed/);
});
