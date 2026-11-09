'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, loginAs } = require('./setup');

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/tags', '/tags/sqlite', '/questions/1'];

test('every public route returns a complete HTML page with seeded content', async () => {
  for (const route of PUBLIC_ROUTES) {
    const response = await request(app).get(route);
    assert.equal(response.status, 200, `${route} should return 200`);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.match(response.text, /^<!doctype html>/i);
    assert.match(response.text, /<main id="main"/);
    assert.match(response.text, /Askwell/);
    assert.ok(response.text.length > 2000, `${route} should render a full page`);
  }
});

test('the health endpoint answers ok', async () => {
  const response = await request(app).get('/health');
  assert.equal(response.status, 200);
  assert.equal(response.text, 'ok');
});

test('security headers are set on every response', async () => {
  const response = await request(app).get('/');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.match(response.headers['content-security-policy'], /default-src 'self'/);
  assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
});

test('stylesheets and scripts are served from the same origin and parse', async () => {
  const css = await request(app).get('/css/styles.css');
  assert.equal(css.status, 200);
  assert.match(css.headers['content-type'], /text\/css/);
  const opens = (css.text.match(/{/g) || []).length;
  const closes = (css.text.match(/}/g) || []).length;
  assert.equal(opens, closes, 'every CSS block must be closed');
  assert.match(css.text, /--accent: #528a54/);
  assert.match(css.text, /@font-face/);

  const js = await request(app).get('/js/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
});

test('the demo account can reach every gated screen', async () => {
  const agent = request.agent(app);
  await loginAs(agent);

  for (const route of ['/dashboard', '/questions/new', '/questions/6/edit', '/answers/9/edit']) {
    const response = await agent.get(route);
    assert.equal(response.status, 200, `${route} should render for the demo account`);
  }
});

test('unknown routes render the branded 404 inside the app shell', async () => {
  const response = await request(app).get('/definitely-not-a-page');
  assert.equal(response.status, 404);
  assert.match(response.text, /That page is not here/);
  assert.match(response.text, /<header class="site-header">/);
});

test('no raw template output leaks into the rendered pages', async () => {
  for (const route of ['/', '/tags', '/questions/1', '/questions/2', '/questions/9']) {
    const response = await request(app).get(route);
    assert.doesNotMatch(response.text, /<%=|<%-|\[object Object\]/);
  }
});
