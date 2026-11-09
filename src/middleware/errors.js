'use strict';

function notFoundHandler(req, res) {
  res.status(404).renderPage('errors/404', { pageTitle: 'Page not found' });
}

/* eslint-disable-next-line no-unused-vars */
function errorHandler(error, req, res, next) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

  if (status >= 500) {
    // Full detail stays in the server log; the client only sees a safe page.
    console.error(`[askwell] ${req.method} ${req.originalUrl} failed:`, error.stack || error.message);
  }

  if (res.headersSent) return;

  const view = status === 403 ? 'errors/403' : status === 404 ? 'errors/404' : 'errors/500';
  const message = status === 403
    ? 'You do not have permission to do that.'
    : status === 404
      ? 'That page does not exist.'
      : 'Something went wrong on our side. Please try again.';

  try {
    res.status(status).renderPage(view, { pageTitle: status === 500 ? 'Server error' : 'Not available', message });
  } catch (renderError) {
    console.error('[askwell] failed to render error page:', renderError.stack || renderError.message);
    res.status(status).type('text').send(message);
  }
}

module.exports = { notFoundHandler, errorHandler };
