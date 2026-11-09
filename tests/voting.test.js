'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, db, csrfFrom, loginAs } = require('./setup');

function scoreOfQuestion(id) {
  return db
    .prepare("SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE target_type = 'question' AND target_id = ?")
    .get(id).score;
}
function reputationOf(userId) {
  return db.prepare('SELECT reputation FROM users WHERE id = ?').get(userId).reputation;
}

async function memberAgent(email) {
  const agent = request.agent(app);
  await loginAs(agent, email, 'askwell-demo-pass');
  return agent;
}

test('upvoting a question raises its score and the author reputation by 5', async () => {
  const maya = await memberAgent('maya@askwell.dev');
  const token = csrfFrom((await maya.get('/questions/3')).text);
  const beforeScore = scoreOfQuestion(3);
  const beforeReputation = reputationOf(5); // author: Halima

  const response = await maya
    .post('/questions/3/vote')
    .type('form')
    .send({ _csrf: token, value: 'up', returnTo: '/questions/3' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/questions/3?voted=up');
  assert.equal(scoreOfQuestion(3), beforeScore + 1);
  assert.equal(reputationOf(5), beforeReputation + 5);

  const detail = await maya.get('/questions/3');
  assert.match(detail.text, /vote-btn is-on/);
  assert.match(detail.text, /data-flash=""[^>]*>\s*<\/span>|<span class="vote-score/);
});

test('clicking the same vote again removes it and reverses the reputation', async () => {
  const maya = await memberAgent('maya@askwell.dev');
  const token = csrfFrom((await maya.get('/questions/3')).text);
  const beforeScore = scoreOfQuestion(3);
  const beforeReputation = reputationOf(5);

  const response = await maya
    .post('/questions/3/vote')
    .type('form')
    .send({ _csrf: token, value: 'up', returnTo: '/questions/3' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/questions/3?voted=none');
  assert.equal(scoreOfQuestion(3), beforeScore - 1);
  assert.equal(reputationOf(5), beforeReputation - 5);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM votes WHERE user_id = 2 AND target_type = 'question' AND target_id = 3").get().n,
    0
  );
});

test('switching a vote from up to down flips the reputation delta', async () => {
  const maya = await memberAgent('maya@askwell.dev');
  const token = csrfFrom((await maya.get('/questions/3')).text);
  const beforeScore = scoreOfQuestion(3);
  const beforeReputation = reputationOf(5); // author: Halima

  await maya
    .post('/questions/3/vote')
    .type('form')
    .send({ _csrf: token, value: 'up', returnTo: '/questions/3' });
  assert.equal(scoreOfQuestion(3), beforeScore + 1);
  assert.equal(reputationOf(5), beforeReputation + 5);

  const switched = await maya
    .post('/questions/3/vote')
    .type('form')
    .send({ _csrf: token, value: 'down', returnTo: '/questions/3' });
  assert.equal(switched.headers.location, '/questions/3?voted=down');
  assert.equal(scoreOfQuestion(3), beforeScore - 1);
  assert.equal(reputationOf(5), beforeReputation - 2);
  assert.equal(
    db.prepare("SELECT value FROM votes WHERE user_id = 2 AND target_type = 'question' AND target_id = 3").get().value,
    -1
  );
});

test('members cannot vote on their own posts', async () => {
  const tomas = await memberAgent('tomas@askwell.dev');
  const token = csrfFrom((await tomas.get('/questions/1')).text);
  const beforeScore = scoreOfQuestion(1);
  const beforeReputation = reputationOf(4);

  const response = await tomas
    .post('/questions/1/vote')
    .type('form')
    .send({ _csrf: token, value: 'up', returnTo: '/questions/1' });

  assert.equal(response.status, 302);
  assert.equal(scoreOfQuestion(1), beforeScore);
  assert.equal(reputationOf(4), beforeReputation);

  const detail = await tomas.get('/questions/1');
  assert.match(detail.text, /You cannot vote on your own post\./);
});

test('answering a question adds an answer with score 0 and the author name', async () => {
  const jun = await memberAgent('jun@askwell.dev');
  const token = csrfFrom((await jun.get('/questions/4')).text);

  const response = await jun.post('/questions/4/answers').type('form').send({
    _csrf: token,
    body: 'Start on SQLite and keep the SQL portable. The migration, if it ever comes, will be a weekend rather than a rewrite.',
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.location, /^\/questions\/4#answer-\d+$/);

  const detail = await request(app).get('/questions/4');
  assert.match(detail.text, /Start on SQLite and keep the SQL portable/);
  assert.match(detail.text, /Jun Park/);
});

test('a too-short answer is rejected with a visible message and no row', async () => {
  const jun = await memberAgent('jun@askwell.dev');
  const token = csrfFrom((await jun.get('/questions/4')).text);
  const before = db.prepare('SELECT COUNT(*) AS count FROM answers').get().count;

  const response = await jun
    .post('/questions/4/answers')
    .type('form')
    .send({ _csrf: token, body: 'too short' });

  assert.equal(response.status, 302);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM answers').get().count, before);

  const detail = await jun.get('/questions/4');
  assert.match(detail.text, /Write at least 10 characters/);
});

test('only the answer author can edit an answer', async () => {
  const maya = await memberAgent('maya@askwell.dev');
  const token = csrfFrom((await maya.get('/questions/2')).text);

  // Answer 4 belongs to Tomas; Maya must not be able to edit it.
  const forbiddenPage = await maya.get('/answers/4/edit');
  assert.equal(forbiddenPage.status, 403);

  const forbiddenPost = await maya
    .post('/answers/4')
    .type('form')
    .send({ _csrf: token, body: 'A hijacked answer body that must never persist.' });
  assert.equal(forbiddenPost.status, 403);

  const stored = db.prepare('SELECT body FROM answers WHERE id = 4').get();
  assert.doesNotMatch(stored.body, /hijacked/);
});

test('the answer author can edit and the new body renders', async () => {
  const tomas = await memberAgent('tomas@askwell.dev');
  const editPage = await tomas.get('/answers/4/edit');
  assert.equal(editPage.status, 200);
  const token = csrfFrom(editPage.text);

  const response = await tomas.post('/answers/4').type('form').send({
    _csrf: token,
    body: 'Also check that express.urlencoded() is registered before your routes, otherwise the login handler never sees the posted body.',
  });
  assert.equal(response.status, 302);

  const detail = await request(app).get('/questions/2');
  assert.match(detail.text, /express\.urlencoded\(\) is registered before your routes/);
});

test('the question author can accept an answer, pinning it first and awarding 15 reputation', async () => {
  const maya = await memberAgent('maya@askwell.dev'); // author of question 2
  const token = csrfFrom((await maya.get('/questions/2')).text);
  const beforeTomas = reputationOf(4);
  const beforePriya = reputationOf(3);

  const response = await maya.post('/answers/4/accept').type('form').send({ _csrf: token });
  assert.equal(response.status, 302);

  const question = db.prepare('SELECT accepted_answer_id FROM questions WHERE id = 2').get();
  assert.equal(question.accepted_answer_id, 4);
  assert.equal(reputationOf(4), beforeTomas + 15);
  assert.equal(reputationOf(3), beforePriya - 15);

  const detail = await request(app).get('/questions/2');
  assert.ok(
    detail.text.indexOf('id="answer-4"') < detail.text.indexOf('id="answer-3"'),
    'accepted answer must render before the others'
  );
  assert.match(detail.text, /Accepted answer/);
});

test('accepting a different answer moves the pin and the reputation', async () => {
  const maya = await memberAgent('maya@askwell.dev');
  const token = csrfFrom((await maya.get('/questions/2')).text);
  const beforeTomas = reputationOf(4);
  const beforePriya = reputationOf(3);

  await maya.post('/answers/3/accept').type('form').send({ _csrf: token });

  const question = db.prepare('SELECT accepted_answer_id FROM questions WHERE id = 2').get();
  assert.equal(question.accepted_answer_id, 3);
  assert.equal(reputationOf(4), beforeTomas - 15);
  assert.equal(reputationOf(3), beforePriya + 15);

  const accepted = db
    .prepare("SELECT COUNT(*) AS count FROM questions WHERE accepted_answer_id = 3")
    .get().count;
  assert.equal(accepted, 1, 'exactly one accepted answer per question');
});

test('accepting the same answer again unaccepts it', async () => {
  const maya = await memberAgent('maya@askwell.dev');
  const token = csrfFrom((await maya.get('/questions/2')).text);

  await maya.post('/answers/3/accept').type('form').send({ _csrf: token });
  const question = db.prepare('SELECT accepted_answer_id FROM questions WHERE id = 2').get();
  assert.equal(question.accepted_answer_id, null);
});

test('members who do not own the question cannot accept answers', async () => {
  const jun = await memberAgent('jun@askwell.dev');
  const token = csrfFrom((await jun.get('/questions/2')).text);

  const response = await jun.post('/answers/3/accept').type('form').send({ _csrf: token });
  assert.equal(response.status, 302);
  assert.equal(db.prepare('SELECT accepted_answer_id FROM questions WHERE id = 2').get().accepted_answer_id, null);

  const detail = await jun.get('/questions/2');
  assert.match(detail.text, /Only the question author or a moderator can accept an answer\./);
});
