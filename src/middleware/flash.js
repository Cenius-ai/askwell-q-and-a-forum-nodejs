'use strict';

/** One-shot flash messages carried in the session and rendered on the next page. */
function flashMessages(req, res, next) {
  res.locals.flash = req.session ? req.session.flash || null : null;
  if (req.session) delete req.session.flash;

  req.flash = (type, message) => {
    if (!req.session) return;
    req.session.flash = { type, message };
  };
  next();
}

module.exports = { flashMessages };
