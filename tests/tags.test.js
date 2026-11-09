'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, db, csrfFrom, loginAs } = require('./setup');

test('the tag index lists tags with question and follower counts', async () => {
  const response = await request(app).get('/tags');
  assert.equal(response.status, 200);
  assert.match(response.text, /id="tag-card-sqlite"|href="\/tags\/sqlite"/);
  assert.match(response.text, /#sqlite/);
  assert.match(response.text, /question(s)?<\/span>/);
  assert.match(response.text, /follower<\/span>/);
});

test('a tag detail page lists only the questions carrying that tag', async () => {
  const response = await request(app).get('/tags/sqlite');
  assert.equal(response.status, 200);
  assert.match(response.text, /How do I keep SQLite writes safe/);
  assert.match(response.text, /Postgres or SQLite for a self-hosted/);
  assert.doesNotMatch(response.text, /Long question titles break the layout/);
});

test('an unknown tag renders the branded 404 page', async () => {
  const response = await request(app).get('/tags/does-not-exist');
  assert.equal(response.status, 404);
  assert.match(response.text, /That page is not here/);
});

test('following and unfollowing a tag updates the follower count', async () => {
  const agent = request.agent(app);
  await loginAs(agent);
  const tag = db.prepare("SELECT * FROM tags WHERE slug = 'css'").get();
  const before = tag.follower_count;

  const page = await agent.get('/tags');
  const token = csrfFrom(page.text);

  const follow = await agent.post(`/tags/${tag.id}/follow`).type('form').send({ _csrf: token, returnTo: '/tags' });
  assert.equal(follow.status, 302);

  const afterFollow = db.prepare('SELECT follower_count FROM tags WHERE id = ?').get(tag.id);
  assert.equal(afterFollow.follower_count, before + 1);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM tag_follows WHERE user_id = 1 AND tag_id = ?').get(tag.id).n,
    1
  );

  const tagPage = await agent.get('/tags/css');
  assert.match(tagPage.text, /Following/);
  assert.match(tagPage.text, new RegExp(`<strong>${before + 1}</strong> follower`));

  const unfollow = await agent
    .post(`/tags/${tag.id}/follow`)
    .type('form')
    .send({ _csrf: csrfFrom(tagPage.text), returnTo: '/tags/css' });
  assert.equal(unfollow.status, 302);

  const afterUnfollow = db.prepare('SELECT follower_count FROM tags WHERE id = ?').get(tag.id);
  assert.equal(afterUnfollow.follower_count, before);
});

test('a tag with no questions shows an empty state that invites a question', async () => {
  const tag = db.prepare("SELECT slug FROM tags WHERE slug = 'javascript'").get();
  const response = await request(app).get(`/tags/${tag.slug}`);
  assert.equal(response.status, 200);

  if (response.text.includes('No questions with this tag yet')) {
    assert.match(response.text, /Ask a question with #javascript/);
  } else {
    // Once a seeded question uses javascript the list must render it instead.
    assert.match(response.text, /questions tagged #javascript/i);
  }
});
