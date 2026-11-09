'use strict';

/** Error carrying an HTTP status, thrown by services and translated by routes. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const forbidden = (message = 'You do not have permission to do that.') => new HttpError(403, message);
const notFound = (message = 'Not found.') => new HttpError(404, message);
const badRequest = (message) => new HttpError(400, message);

module.exports = { HttpError, forbidden, notFound, badRequest };
