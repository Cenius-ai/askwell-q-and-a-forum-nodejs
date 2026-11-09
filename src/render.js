'use strict';

/** Render res.locals-provided template data plus the shared layout. */
function renderPage(app) {
  return function attachRenderPage(req, res, next) {
    res.renderPage = function renderWithLayout(view, locals = {}, status) {
      const data = { ...res.locals, ...locals };
      if (typeof status === 'number') res.status(status);
      app.render(view, data, (viewError, body) => {
        if (viewError) return next(viewError);
        app.render('layout', { ...data, body }, (layoutError, html) => {
          if (layoutError) return next(layoutError);
          res.type('html').send(html);
        });
      });
    };
    next();
  };
}

module.exports = { renderPage };
