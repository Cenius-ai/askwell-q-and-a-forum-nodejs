'use strict';

const express = require('express');

const answersService = require('../services/answers');
const votesService = require('../services/votes');
const { requireAuth, safeRedirectTarget } = require('../middleware/auth');
const { HttpError } = require('../lib/http-error');

const router = express.Router();

function withQuery(target, key, value) {
  const url = new URL(target, 'http://askwell.local');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

router.get('/answers/:id/edit', requireAuth, (req, res) => {
  const answer = answersService.getById(req.params.id);
  if (!answer) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Answer not found',
      message: 'That answer may have been deleted.',
    });
  }
  if (answer.author_id !== req.user.id) {
    return res.status(403).renderPage('errors/403', {
      pageTitle: 'Not allowed',
      message: 'Only the author can edit this answer.',
    });
  }
  return res.renderPage('answers/edit', {
    pageTitle: 'Edit your answer',
    answer,
    values: { body: answer.body },
    error: null,
  });
});

router.post('/answers/:id', requireAuth, (req, res, next) => {
  const { error, body } = answersService.validateBody(req.body.body);
  const existing = answersService.getById(req.params.id);
  if (!existing) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Answer not found',
      message: 'That answer no longer exists.',
    });
  }

  if (error) {
    return res.status(422).renderPage('answers/edit', {
      pageTitle: 'Edit your answer',
      answer: existing,
      values: { body: String(req.body.body || '') },
      error,
    });
  }

  try {
    const updated = answersService.updateOwnAnswer({ answerId: existing.id, actingUser: req.user, body });
    req.flash('success', 'Answer updated.');
    return res.redirect(`/questions/${updated.question_id}#answer-${updated.id}`);
  } catch (error_) {
    return next(error_);
  }
});

router.post('/answers/:id/delete', requireAuth, (req, res, next) => {
  let questionId;
  try {
    questionId = answersService.deleteAnswer({ answerId: req.params.id, actingUser: req.user });
  } catch (error) {
    return next(error);
  }
  req.flash('success', 'Answer deleted.');
  return res.redirect(`/questions/${questionId}`);
});

router.post('/answers/:id/vote', requireAuth, (req, res, next) => {
  const answer = answersService.getById(req.params.id);
  if (!answer) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Answer not found',
      message: 'That answer no longer exists.',
    });
  }

  let direction;
  try {
    const result = votesService.castVote({
      userId: req.user.id,
      targetType: 'answer',
      targetId: answer.id,
      value: req.body.value,
    });
    direction = result.myVote === 1 ? 'up' : result.myVote === -1 ? 'down' : 'none';
  } catch (error) {
    if (error instanceof HttpError) {
      req.flash('error', error.message);
      return res.redirect(safeRedirectTarget(req.body.returnTo, `/questions/${answer.question_id}`));
    }
    return next(error);
  }

  const target = safeRedirectTarget(req.body.returnTo, `/questions/${answer.question_id}`);
  return res.redirect(withQuery(target, 'voted', direction));
});

router.post('/answers/:id/accept', requireAuth, (req, res, next) => {
  const answer = answersService.getById(req.params.id);
  if (!answer) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Answer not found',
      message: 'That answer no longer exists.',
    });
  }

  let accepted;
  try {
    const result = answersService.toggleAccept({
      questionId: answer.question_id,
      answerId: answer.id,
      actingUser: req.user,
    });
    accepted = result.accepted;
  } catch (error) {
    if (error instanceof HttpError) {
      req.flash('error', error.message);
      return res.redirect(`/questions/${answer.question_id}`);
    }
    return next(error);
  }

  req.flash('success', accepted ? 'Answer accepted — +15 reputation awarded to the author.' : 'Acceptance removed.');
  return res.redirect(`/questions/${answer.question_id}#answer-${answer.id}`);
});

module.exports = router;
