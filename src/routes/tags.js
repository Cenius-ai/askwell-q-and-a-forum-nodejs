'use strict';

const express = require('express');

const tagsService = require('../services/tags');
const questionsService = require('../services/questions');
const { requireAuth, safeRedirectTarget } = require('../middleware/auth');

const router = express.Router();

router.get('/tags', (req, res) => {
  res.renderPage('tags/index', {
    pageTitle: 'Tags',
    tags: tagsService.listAll(),
    followedIds: req.user
      ? new Set(tagsService.followedTags(req.user.id).map((tag) => tag.id))
      : new Set(),
  });
});

router.get('/tags/:slug', (req, res) => {
  const tag = tagsService.getBySlug(req.params.slug);
  if (!tag) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Tag not found',
      message: 'That tag does not exist yet.',
    });
  }

  return res.renderPage('tags/show', {
    pageTitle: `#${tag.name}`,
    tag,
    questions: questionsService.listByTag(tag.id, 30),
    following: req.user ? tagsService.isFollowing(req.user.id, tag.id) : false,
  });
});

router.post('/tags/:id/follow', requireAuth, (req, res) => {
  const tag = tagsService.getById(req.params.id);
  if (!tag) {
    return res.status(404).renderPage('errors/404', {
      pageTitle: 'Tag not found',
      message: 'That tag does not exist.',
    });
  }
  const result = tagsService.toggleFollow(req.user.id, tag.id);
  req.flash('success', result.following ? `Following #${tag.name}.` : `Unfollowed #${tag.name}.`);
  return res.redirect(safeRedirectTarget(req.body.returnTo, '/tags'));
});

module.exports = router;
