'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, db, csrfFrom, csrfFor, loginAs } = require('./setup');

const DEMO = { email: 'cenius@cenius.ai', password: 'cenius' };

test('login page renders the demo credentials and the demo sign-in control', async () => {
  const response = await request(app).get('/login');
  assert.equal(response.status, 200);
  assert.match(response.text, /Demo: <code>cenius@cenius\.ai<\/code> \/ <code>cenius<\/code>/);
  assert.match(response.text, /action="\/login\/demo"/);
  assert.match(response.text, /data-toggle-password="password"/);
});

test('wrong password shows one non-enumerating message and does not sign in', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/login');
  const token = csrfFrom(page.text);

  const response = await agent
    .post('/login')
    .type('form')
    .send({ email: DEMO.email, password: 'wrong-password', _csrf: token });

  assert.equal(response.status, 200);
  assert.match(response.text, /Email or password is incorrect\./);
  assert.doesNotMatch(response.text, /no account|user not found/i);

  const dashboard = await agent.get('/dashboard');
  assert.equal(dashboard.status, 302);
  assert.match(dashboard.headers.location, /^\/login/);
});

test('demo credentials sign in and the session survives the next request', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/login');
  const token = csrfFrom(page.text);

  const response = await agent
    .post('/login')
    .type('form')
    .send({ email: DEMO.email, password: DEMO.password, _csrf: token });
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/dashboard');

  const dashboard = await agent.get('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, /Cenius Demo/);
  assert.match(dashboard.text, /Reputation/);
});

test('one-click demo sign-in works', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/login');
  const token = csrfFrom(page.text);

  const response = await agent
    .post('/login/demo')
    .type('form')
    .send({ _csrf: token, next: '/dashboard' });
  assert.equal(response.status, 302);

  const dashboard = await agent.get('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, /Cenius Demo/);
});

test('anonymous visitors are redirected away from the ask form', async () => {
  const response = await request(app).get('/questions/new');
  assert.equal(response.status, 302);
  assert.match(response.headers.location, /^\/login\?next=/);
});

test('signup validates input and creates no user on failure', async () => {
  const before = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const agent = request.agent(app);
  const page = await agent.get('/signup');
  const token = csrfFrom(page.text);

  const response = await agent.post('/signup').type('form').send({
    _csrf: token,
    displayName: 'A',
    email: 'not-an-email',
    password: 'short',
    confirmPassword: 'different',
  });

  assert.equal(response.status, 422);
  assert.match(response.text, /Use at least 2 characters/);
  assert.match(response.text, /Enter a valid email address/);
  assert.match(response.text, /The two passwords do not match/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count, before);
});

test('signup creates a member, signs them in, and logout ends the session', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/signup');
  const token = csrfFrom(page.text);

  const created = await agent.post('/signup').type('form').send({
    _csrf: token,
    displayName: 'Ada Lovelace',
    email: 'ada@askwell.dev',
    password: 'correct-horse-9',
    confirmPassword: 'correct-horse-9',
  });
  assert.equal(created.status, 302);
  assert.equal(created.headers.location, '/dashboard');

  const stored = db.prepare('SELECT * FROM users WHERE email = ?').get('ada@askwell.dev');
  assert.ok(stored, 'user row should exist');
  assert.notEqual(stored.password_hash, 'correct-horse-9');
  assert.equal(stored.role, 'member');

  const dashboard = await agent.get('/dashboard');
  assert.equal(dashboard.status, 200);

  const logoutToken = csrfFrom(dashboard.text);
  const loggedOut = await agent.post('/logout').type('form').send({ _csrf: logoutToken });
  assert.equal(loggedOut.status, 302);
  assert.equal(loggedOut.headers.location, '/');

  const afterLogout = await agent.get('/dashboard');
  assert.equal(afterLogout.status, 302);
});

test('state-changing requests without a CSRF token are rejected', async () => {
  const agent = request.agent(app);
  await loginAs(agent);

  const response = await agent.post('/tags/1/follow').type('form').send({});
  assert.equal(response.status, 403);
  assert.match(response.text, /Security check failed/);
});

test('a signed-out form post is redirected to sign in, not silently accepted', async () => {
  const agent = request.agent(app);
  await agent.get('/login');

  const response = await agent.post('/tags/1/follow').type('form').send({ _csrf: 'stale-token' });
  assert.equal(response.status, 302);
  assert.match(response.headers.location, /^\/login\?next=/);
});

test('follow requires an authenticated session', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/login');
  const token = csrfFrom(page.text);

  const response = await agent.post('/tags/1/follow').type('form').send({ _csrf: token });
  assert.equal(response.status, 302);
  assert.match(response.headers.location, /^\/login/);
});

test('csrf helper can be fetched from an authenticated page', async () => {
  const agent = request.agent(app);
  await loginAs(agent);
  const token = await csrfFor(agent, '/dashboard');
  assert.equal(token.length, 64);
});
