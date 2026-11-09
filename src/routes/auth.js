'use strict';

const express = require('express');

const usersService = require('../services/users');
const { DEMO_ACCOUNT } = require('../config');
const { establishSession, safeRedirectTarget } = require('../middleware/auth');
const { allow, clientKey } = require('../lib/rate-limit');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;

function loginView(res, locals = {}) {
  return res.renderPage('login', {
    pageTitle: 'Sign in',
    email: '',
    error: null,
    ...locals,
  });
}

router.get('/login', (req, res) => {
  const next = safeRedirectTarget(req.query.next, '');
  if (req.user) return res.redirect(next || '/dashboard');
  return loginView(res, { next });
});

router.post('/login', (req, res, next) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const target = safeRedirectTarget(req.body.next, '');

  if (!email || !password) {
    return loginView(res, { email, next: target, error: 'Enter your email and password to sign in.' });
  }

  if (!allow(clientKey(req, email))) {
    return res.status(429).renderPage('login', {
      pageTitle: 'Sign in',
      email,
      next: target,
      error: 'Too many sign-in attempts. Wait a minute and try again.',
    });
  }

  const account = usersService.findByEmail(email);
  // One message for every failure mode — never reveal whether the account exists.
  if (!account || !usersService.verifyPassword(password, account.password_hash)) {
    return loginView(res, { email, next: target, error: 'Email or password is incorrect.' });
  }

  return establishSession(req, account, (sessionError) => {
    if (sessionError) return next(sessionError);
    return res.redirect(target || '/dashboard');
  });
});

router.post('/login/demo', (req, res, next) => {
  const account = usersService.findByEmail(DEMO_ACCOUNT.email);
  if (!account) {
    return res.status(500).renderPage('errors/500', {
      pageTitle: 'Demo account unavailable',
      message: 'The demo account is missing. Run npm run seed and try again.',
    });
  }
  return establishSession(req, account, (sessionError) => {
    if (sessionError) return next(sessionError);
    return res.redirect(safeRedirectTarget(req.body.next, '/dashboard'));
  });
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  return res.renderPage('signup', {
    pageTitle: 'Create an account',
    values: { displayName: '', email: '' },
    errors: {},
    formError: null,
  });
});

router.post('/signup', (req, res, next) => {
  const values = {
    displayName: String(req.body.displayName || '').trim(),
    email: String(req.body.email || '').trim(),
  };
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirmPassword || '');
  const errors = {};

  if (values.displayName.length < 2) errors.displayName = 'Use at least 2 characters for your display name.';
  else if (values.displayName.length > 40) errors.displayName = 'Keep the display name under 40 characters.';
  if (!EMAIL_PATTERN.test(values.email)) errors.email = 'Enter a valid email address.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }
  if (confirm !== password) errors.confirmPassword = 'The two passwords do not match.';

  if (Object.keys(errors).length === 0 && usersService.findByEmail(values.email)) {
    errors.email = 'That email is already registered — try signing in instead.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).renderPage('signup', {
      pageTitle: 'Create an account',
      values,
      errors,
      formError: 'Please fix the highlighted fields.',
    });
  }

  let account;
  try {
    account = usersService.createUser({
      email: values.email,
      displayName: values.displayName,
      password,
    });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(422).renderPage('signup', {
        pageTitle: 'Create an account',
        values,
        errors: { email: 'That email is already registered — try signing in instead.' },
        formError: 'Please fix the highlighted fields.',
      });
    }
    return next(error);
  }

  return establishSession(req, account, (sessionError) => {
    if (sessionError) return next(sessionError);
    req.flash('success', `Welcome to Askwell, ${account.display_name}. Ask your first question to get started.`);
    return res.redirect('/dashboard');
  });
});

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.redirect('/');
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('askwell.sid');
    return res.redirect('/');
  });
});

module.exports = router;
