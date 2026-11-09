'use strict';

const express = require('express');

const { db } = require('../db');
const questionsService = require('../services/questions');
const answersService = require('../services/answers');
const tagsService = require('../services/tags');
const badgesService = require('../services/badges');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const REASON_LABELS = {
  question_upvote: 'Question upvoted',
  question_downvote: 'Question downvoted',
  answer_upvote: 'Answer upvoted',
  answer_downvote: 'Answer downvoted',
  answer_accepted: 'Answer accepted',
  accepted_answer_unaccepted: 'Acceptance removed',
  accepted_answer_replaced: 'Acceptance moved',
  accepted_answer_revoked: 'Accepted answer deleted',
};

router.get('/dashboard', requireAuth, (req, res) => {
  const myQuestions = questionsService.listByAuthor(req.user.id);
  const myAnswers = answersService.answersByAuthor(req.user.id);
  const followed = tagsService.followedTags(req.user.id);
  const earnedBadges = badgesService.badgesForUser(req.user.id);
  const activity = db.prepare(
    `SELECT delta, reason, created_at FROM reputation_events
      WHERE user_id = ? ORDER BY id DESC LIMIT 8`
  ).all(req.user.id);

  const run_totals = db.prepare(
    `SELECT COUNT(*) AS answer_count,
            COALESCE(SUM(CASE WHEN q.accepted_answer_id = a.id THEN 1 ELSE 0 END), 0) AS accepted_count
       FROM answers a JOIN questions q ON q.id = a.question_id
      WHERE a.author_id = ?`
  ).get(req.user.id);

  res.renderPage('dashboard', {
    pageTitle: 'Your dashboard',
    myQuestions,
    myAnswers,
    followed,
    earnedBadges,
    activity: activity.map((entry) => ({ ...entry, label: REASON_LABELS[entry.reason] || entry.reason })),
    totals: run_totals,
    allBadges: badgesService.BADGE_DEFINITIONS,
  });
});

module.exports = router;
