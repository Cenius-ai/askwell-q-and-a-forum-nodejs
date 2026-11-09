'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, csrfFrom, loginAs } = require('./setup');

async function signUp(agent, { displayName, email, password }) {
  const page = await agent.get('/signup');
  const token = csrfFrom(page.text);
  return agent
    .post('/signup')
    .type('form')
    .send({ _csrf: token, displayName, email, password, confirmPassword: password });
}

test('the demo dashboard shows reputation, badges, questions, answers and followed tags', async () => {
  const agent = request.agent(app);
  await loginAs(agent);

  const response = await agent.get('/dashboard');
  assert.equal(response.status, 200);
  assert.match(response.text, /class="reputation-card__value"/);
  assert.match(response.text, /First Question/);
  assert.match(response.text, /First Answer/);
  assert.match(response.text, /Accepted/);
  assert.match(response.text, /Your questions/);
  assert.match(response.text, /What is the smallest correct CSRF protection/);
  assert.match(response.text, /Your answers/);
  assert.match(response.text, /Tags you follow/);
  assert.match(response.text, /href="\/tags\/moderation"/);
});

test('author reputation renders beside a post on the question page', async () => {
  const response = await request(app).get('/questions/1');
  const reputation = response.text.match(
    /class="rep" title="Reputation">([\d,]+)</
  );
  assert.ok(reputation, 'reputation pill should render');
  assert.equal(reputation[1], '110');
});

test('a brand-new member sees action-oriented empty states', async () => {
  const agent = request.agent(app);
  const created = await signUp(agent, {
    displayName: 'Noor Haddad',
    email: 'noor@askwell.dev',
    password: 'riverstone-7',
  });
  assert.equal(created.status, 302);

  const dashboard = await agent.get('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, /You have not asked anything yet/);
  assert.match(dashboard.text, /No answers yet/);
  assert.match(dashboard.text, /You are not following any tags/);
  assert.match(dashboard.text, /No badges yet/);
});

test('posting a first question awards the First Question badge', async () => {
  const agent = request.agent(app);
  await signUp(agent, {
    displayName: 'Ines Marchetti',
    email: 'ines@askwell.dev',
    password: 'basilica-9',
  });

  const form = await agent.get('/questions/new');
  const token = csrfFrom(form.text);
  const created = await agent.post('/questions').type('form').send({
    _csrf: token,
    title: 'How do I back up a WAL-mode SQLite database safely?',
    body: 'Copying the .db file while the server is writing feels wrong. What is the safe way to take a consistent backup without stopping the app?',
    tags: 'sqlite, self-hosting',
  });
  assert.equal(created.status, 302);

  const dashboard = await agent.get('/dashboard');
  assert.match(dashboard.text, /First Question/);
  assert.match(dashboard.text, /back up a WAL-mode SQLite database/);
});

test('followed tags and followed-tag counts come from the database', async () => {
  const agent = request.agent(app);
  await loginAs(agent, 'maya@askwell.dev', 'askwell-demo-pass');
  const dashboard = await agent.get('/dashboard');
  assert.match(dashboard.text, /href="\/tags\/javascript"/);
  assert.match(dashboard.text, /href="\/tags\/nodejs"/);
});
