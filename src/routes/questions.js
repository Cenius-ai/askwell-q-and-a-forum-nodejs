'use strict';

const express = require('express');

const questionsService = require('../services/questions');
const answersService = require('../services/answers');
const tagsService = require('../services/tags');
const votesService = require('../services/votes');
const moderationService = require('../services/moderation');
const { parseTagInput } = require('../helpers');
const { requireAuth, isModerator, safeRedirectTarget } = require('../middleware/auth');
const { HttpError } = require('../lib/http-error');

const router = express.Router();

/** Append a query flag used only for the 300ms "value changed" tint. */
function withQuery(target, key, value) {
  const url = new URL(target, 'http://askwell.local');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function redirectBack(req, res, fallback = '/') {
  return res.redirect(safeRedirectTarget(req.body.returnTo || req.body.next, fallback));
}

router.get('/', (req, res) => {
  const questions = questionsService.listRecent(30);
  res.renderPage('home', {
    pageTitle: null,
    questions,
    stats: questionsService.communityStats(),
    popularTags: tagsService.popular(10),
    topMembers: questionsService.topMembers(5),
  });
});

router.get('/questions/new', requireAuth, (req, res) => {
  res.renderPage('questions/new', {
    pageTitle: 'Ask a question',
    values: { title: '', body: '', tags: '' },
    errors: {},
    allTags: tagsService.listAll(),
  });
});

router.post('/questions', requireAuth, (req, res, next) => {
  const values = {
    title: String(req.body.title || '').trim(),
    body: String(req.body.body || '').trim(),
    tags: String(req.body.tags || '').trim(),
  };
  const { errors, title, body } = questionsService.validateQuestionInput(values);
  const tagNames = parseTagInput(values.tags);
  const tagResult = questionsService.validateTagIds(tagNames);
  if (tagResult.error) errors.tags = tagResult.error;

  if (Object.keys(errors).length > 0) {
    return res.status(422).renderPage('questions/new', {
      pageTitle: 'Ask a question',
      values: { ...values, title, body },
      errors,
      allTags: tagsService.listAll(),
    });
  }

  try {
    const question = questionsService.createQuestion({
      authorId: req.user.id,
      title,
      body,
      tagIds: tagResult.tagIds,
    });
    req.flash('success', 'Your question is live — answers will show up here.');
    return res.redirect(`/questions/${question.id}`);
  } catch (error) {
    return next(error);
  }
});

router.get('/questions/:id', (req, res, next) => {
  let question;
  try {
    question = questionsService.getById(req.params.id);
  } catch (error) {
    return next(error);
  }
  if (!question) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Question not found',
      message: 'That question may have been deleted.',
    });
  }

  const answerVotes = {};
  for (const answer of question.answers) {
    answerVotes[answer.id] = votesService.myVote(req.user && req.user.id, 'answer', answer.id);
  }

  return res.renderPage('questions/show', {
    pageTitle: question.title,
    question,
    myQuestionVote: votesService.myVote(req.user && req.user.id, 'question', question.id),
    answerVotes,
    voteFlash: ['up', 'down'].includes(req.query.voted) ? req.query.voted : null,
    closeReasons: moderationService.CLOSE_REASONS,
    isModerator: isModerator(req.user),
    isAuthor: Boolean(req.user && req.user.id === question.author_id),
  });
});

router.get('/questions/:id/edit', requireAuth, (req, res, next) => {
  let question;
  try {
    question = questionsService.getById(req.params.id);
  } catch (error) {
    return next(error);
  }
  if (!question) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Question not found',
      message: 'That question may have been deleted.',
    });
  }
  if (question.author_id !== req.user.id) {
    return res.status(403).renderPage('errors/403', {
      pageTitle: 'Not allowed',
      message: 'Only the author can edit this question.',
    });
  }

  return res.renderPage('questions/edit', {
    pageTitle: `Edit: ${question.title}`,
    question,
    values: {
      title: question.title,
      body: question.body,
      tags: question.tags.map((tag) => tag.name).join(', '),
    },
    errors: {},
    allTags: tagsService.listAll(),
  });
});

router.post('/questions/:id', requireAuth, (req, res, next) => {
  const values = {
    title: String(req.body.title || '').trim(),
    body: String(req.body.body || '').trim(),
    tags: String(req.body.tags || '').trim(),
  };
  const { errors, title, body } = questionsService.validateQuestionInput(values);
  const tagNames = parseTagInput(values.tags);
  const tagResult = questionsService.validateTagIds(tagNames);
  if (tagResult.error) errors.tags = tagResult.error;

  const existing = questionsService.getById(req.params.id);
  if (!existing) {
    return res.status(404).renderPage('errors/404', { pageTitle: 'Question not found', message: 'That question no longer exists.' });
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).renderPage('questions/edit', {
      pageTitle: `Edit: ${existing.title}`,
      question: existing,
      values: { ...values, title, body },
      errors,
      allTags: tagsService.listAll(),
    });
  }

  try {
    const updated = questionsService.updateOwnQuestion({
      questionId: existing.id,
      actingUser: req.user,
      title,
      body,
      tagIds: tagResult.tagIds,
    });
    req.flash('success', 'Question updated.');
    return res.redirect(`/questions/${updated.id}`);
  } catch (error) {
    return next(error);
  }
});

router.post('/questions/:id/delete', requireAuth, (req, res, next) => {
  const questionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Question not found',
      message: 'That question no longer exists.',
    });
  }
  try {
    questionsService.deleteQuestion({ questionId, actingUser: req.user });
  } catch (error) {
    return next(error);
  }
  req.flash('success', 'Question deleted.');
  return res.redirect('/');
});

router.post('/questions/:id/answers', requireAuth, (req, res, next) => {
  const question = questionsService.getById(req.params.id);
  if (!question) {
    return res.status(404).renderPage('errors/404', { pageTitle: 'Question not found', message: 'That question no longer exists.' });
  }

  const { error, body } = answersService.validateBody(req.body.body);
  if (error) {
    req.flash('error', error);
    return res.redirect(`/questions/${question.id}`);
  }

  try {
    const answer = answersService.createAnswer({
      questionId: question.id,
      authorId: req.user.id,
      body,
    });
    req.flash('success', 'Answer posted.');
    return res.redirect(`/questions/${question.id}#answer-${answer.id}`);
  } catch (error_) {
    if (error_ instanceof HttpError && error_.status === 400) {
      req.flash('error', error_.message);
      return res.redirect(`/questions/${question.id}`);
    }
    return next(error_);
  }
});

router.post('/questions/:id/vote', requireAuth, (req, res, next) => {
  const question = questionsService.getById(req.params.id);
  if (!question) {
    return res.status(404).renderPage('errors/404', { pageTitle: 'Question not found', message: 'That question no longer exists.' });
  }

  let direction;
  try {
    const result = votesService.castVote({
      userId: req.user.id,
      targetType: 'question',
      targetId: question.id,
      value: req.body.value,
    });
    direction = result.myVote === 1 ? 'up' : result.myVote === -1 ? 'down' : 'none';
  } catch (error) {
    if (error instanceof HttpError) {
      req.flash('error', error.message);
      return redirectBack(req, res, `/questions/${question.id}`);
    }
    return next(error);
  }

  const target = safeRedirectTarget(req.body.returnTo, `/questions/${question.id}`);
  return res.redirect(withQuery(target, 'voted', direction));
});

router.post('/questions/:id/close', requireAuth, (req, res, next) => {
  const questionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Question not found',
      message: 'That question no longer exists.',
    });
  }

  try {
    moderationService.closeQuestion({
      questionId,
      moderator: req.user,
      reason: req.body.reason,
      duplicateOfId: req.body.duplicateOfId,
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) {
      req.flash('error', error.message);
      return res.redirect(`/questions/${questionId}`);
    }
    return next(error);
  }
  req.flash('success', 'Question closed. New answers are disabled until a moderator reopens it.');
  return res.redirect(`/questions/${questionId}`);
});

router.post('/questions/:id/reopen', requireAuth, (req, res, next) => {
  const questionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Question not found',
      message: 'That question no longer exists.',
    });
  }
  try {
    moderationService.reopenQuestion({ questionId, moderator: req.user });
  } catch (error) {
    return next(error);
  }
  req.flash('success', 'Question reopened.');
  return res.redirect(`/questions/${questionId}`);
});

module.exports = router;
