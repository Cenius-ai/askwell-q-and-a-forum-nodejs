'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { db } = require('./db');
const { SESSION_SECRET, DEMO_ACCOUNT, ROOT_DIR } = require('./config');
const { SqliteSessionStore } = require('./session-store');
const { renderPage } = require('./render');
const helpers = require('./helpers');
const { loadUser } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const { flashMessages } = require('./middleware/flash');
const { notFoundHandler, errorHandler } = require('./middleware/errors');

const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const answerRoutes = require('./routes/answers');
const tagRoutes = require('./routes/tags');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(ROOT_DIR, 'views'));
app.disable('x-powered-by');

// Template helpers available in every view.
app.locals.timeAgo = helpers.timeAgo;
app.locals.formatDate = helpers.formatDate;
app.locals.formatNumber = helpers.formatNumber;
app.locals.isoTime = helpers.isoTime;

// Security headers. All scripts and styles are same-origin external files, so
// a strict 'self' policy works with no inline code and no CDN.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    xFrameOptions: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(
  express.static(path.join(ROOT_DIR, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true,
  })
);

app.use(express.urlencoded({ extended: false, limit: '100kb' }));

const sessionStore = new SqliteSessionStore(db);
app.use(
  session({
    name: 'askwell.sid',
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    // Plain-HTTP friendly: secure cookies would be dropped by the browser on
    // http:// and every request after login would be logged out again.
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use(renderPage(app));
app.use(loadUser);
app.use(flashMessages);
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.demoAccount = DEMO_ACCOUNT;
  next();
});
app.use(csrfProtection);

app.get('/health', (req, res) => res.type('text/plain').send('ok'));

app.use('/', authRoutes);
app.use('/', questionRoutes);
app.use('/', answerRoutes);
app.use('/', tagRoutes);
app.use('/', dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
