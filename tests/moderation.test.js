'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, db, csrfFrom, loginAs } = require('./setup');

async function memberAgent(email) {
  const agent = request.agent(app);
  await loginAs(agent, email, 'askwell-demo-pass');
  return agent;
}

test('members cannot close a question', async () => {
  const maya = await memberAgent('maya@askwell.dev');
  const token = csrfFrom((await maya.get('/questions/4')).text);

  const response = await maya
    .post('/questions/4/close')
    .type('form')
    .send({ _csrf: token, reason: 'Off-topic for this community' });

  assert.equal(response.status, 403);
  const question = db.prepare('SELECT closed_at FROM questions WHERE id = 4').get();
  assert.equal(question.closed_at, null);
});

test('a moderator can close a question with a reason, disabling answers', async () => {
  const moderator = request.agent(app);
  await loginAs(moderator);
  const token = csrfFrom((await moderator.get('/questions/4')).text);
  const beforeAnswers = db.prepare('SELECT COUNT(*) AS n FROM answers WHERE question_id = 4').get().n;

  const close = await moderator
    .post('/questions/4/close')
    .type('form')
    .send({ _csrf: token, reason: 'Needs details or clarity' });
  assert.equal(close.status, 302);

  const detail = await request(app).get('/questions/4');
  assert.match(detail.text, /Needs details or clarity/);
  assert.match(detail.text, /Answers are closed/);
  assert.doesNotMatch(detail.text, /id="answer-body"/);

  // The token must come from the moderator's own session, not the anonymous view.
  const answerToken = csrfFrom((await moderator.get('/questions/4')).text);
  const attempt = await moderator
    .post('/questions/4/answers')
    .type('form')
    .send({ _csrf: answerToken, body: 'This answer must not be accepted while the question is closed.' });
  assert.equal(attempt.status, 302);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM answers WHERE question_id = 4').get().n, beforeAnswers);
});

test('a moderator can mark a question as a duplicate and link the canonical page', async () => {
  const moderator = request.agent(app);
  await loginAs(moderator);
  const token = csrfFrom((await moderator.get('/questions/7')).text);

  const response = await moderator
    .post('/questions/7/close')
    .type('form')
    .send({
      _csrf: token,
      reason: 'Answered by an existing question',
      duplicateOfId: '1',
    });
  assert.equal(response.status, 302);

  const stored = db.prepare('SELECT duplicate_of_id, closed_at FROM questions WHERE id = 7').get();
  assert.equal(stored.duplicate_of_id, 1);
  assert.ok(stored.closed_at);

  const detail = await request(app).get('/questions/7');
  assert.match(detail.text, /Duplicate of/);
  assert.match(detail.text, /href="\/questions\/1"/);

  const canonical = await request(app).get('/questions/1');
  assert.equal(canonical.status, 200);
});

test('a moderator can reopen a closed question', async () => {
  const moderator = request.agent(app);
  await loginAs(moderator);
  const token = csrfFrom((await moderator.get('/questions/7')).text);

  const response = await moderator.post('/questions/7/reopen').type('form').send({ _csrf: token });
  assert.equal(response.status, 302);

  const stored = db.prepare('SELECT duplicate_of_id, closed_at FROM questions WHERE id = 7').get();
  assert.equal(stored.closed_at, null);
  assert.equal(stored.duplicate_of_id, null);

  const detail = await moderator.get('/questions/7');
  assert.match(detail.text, /id="answer-body"/);
  assert.doesNotMatch(detail.text, /Answers are closed/);
});

test('closing with a nonsense duplicate id is rejected with a message', async () => {
  const moderator = request.agent(app);
  await loginAs(moderator);
  const token = csrfFrom((await moderator.get('/questions/6')).text);

  const response = await moderator
    .post('/questions/6/close')
    .type('form')
    .send({ _csrf: token, reason: 'Needs details or clarity', duplicateOfId: '99999' });
  assert.equal(response.status, 302);

  const stored = db.prepare('SELECT closed_at FROM questions WHERE id = 6').get();
  assert.equal(stored.closed_at, null);

  const detail = await moderator.get('/questions/6');
  assert.match(detail.text, /No question exists with id 99999/);
});
