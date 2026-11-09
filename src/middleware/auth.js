'use strict';

const { db } = require('../db');

const selectUser = db.prepare(
  'SELECT id, email, display_name, reputation, role, created_at FROM users WHERE id = ?'
);

/** Attach req.user / res.locals.user from the server-side session. */
function loadUser(req, res, next) {
  req.user = null;
  const userId = req.session ? req.session.userId : null;
  if (userId) {
    const user = selectUser.get(userId);
    if (user) {
      req.user = user;
    } else {
      delete req.session.userId;
    }
  }
  res.locals.user = req.user;
  next();
}

/** Authenticate, then rotate the session id so a pre-login id cannot be reused. */
function establishSession(req, user, callback) {
  const pendingTarget = req.session.returnTo;
  req.session.regenerate((regenerateError) => {
    if (regenerateError) return callback(regenerateError);
    req.session.userId = user.id;
    if (pendingTarget) req.session.returnTo = pendingTarget;
    req.session.save((saveError) => callback(saveError || null));
  });
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  req.flash('error', 'Please sign in to continue.');
  const target = req.originalUrl && req.originalUrl.startsWith('/') ? req.originalUrl : '/';
  return res.redirect(`/login?next=${encodeURIComponent(target)}`);
}

/** Function-level guard: moderator-only actions are re-checked server side. */
function requireModerator(req, res, next) {
  if (!req.user) {
    req.flash('error', 'Please sign in to continue.');
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/')}`);
  }
  if (req.user.role !== 'moderator') {
    return res.status(403).renderPage('errors/403', {
      pageTitle: 'Not allowed',
      message: 'Only moderators can close or mark questions as duplicates.',
    });
  }
  return next();
}

function isModerator(user) {
  return Boolean(user && user.role === 'moderator');
}

/** Only allow same-origin relative redirect targets. */
function safeRedirectTarget(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

module.exports = {
  loadUser,
  establishSession,
  requireAuth,
  requireModerator,
  isModerator,
  safeRedirectTarget,
};
