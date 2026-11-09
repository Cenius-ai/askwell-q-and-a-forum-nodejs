'use strict';

const crypto = require('node:crypto');

/** Endpoints that establish a session, so they cannot require a prior token. */
const CSRF_EXEMPT_PATHS = new Set(['/login', '/signup', '/login/demo', '/logout']);

/**
 * Session-bound CSRF token for every state-changing request.
 * Token is rendered into each form as a hidden _csrf field.
 */
function csrfProtection(req, res, next) {
  if (!req.session) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  const isStateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (!isStateChanging || CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const submitted = req.body && typeof req.body._csrf === 'string' ? req.body._csrf : '';
  const expected = req.session.csrfToken;
  const valid =
    submitted.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));

  if (!valid) {
    // A signed-out visitor with a stale form gets a sign-in prompt rather than a
    // dead end; a signed-in visitor is told the form token expired.
    if (!req.session.userId) {
      req.flash('error', 'Your session expired. Sign in again to continue.');
      const target = req.originalUrl && req.originalUrl.startsWith('/') ? req.originalUrl : '/';
      return res.redirect(`/login?next=${encodeURIComponent(target)}`);
    }
    return res.status(403).renderPage('errors/403', {
      pageTitle: 'Security check failed',
      message: 'Your form session expired. Please go back, reload the page and try again.',
    });
  }
  return next();
}

module.exports = { csrfProtection };
