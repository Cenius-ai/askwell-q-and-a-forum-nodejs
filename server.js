'use strict';

const app = require('./src/app');
const { PORT, HOST } = require('./src/config');
const { seed } = require('./src/seed');

// Bind first so the health probe never waits on seeding, then top up demo data.
const server = app.listen(PORT, HOST, () => {
  console.log(`[askwell] listening on http://${HOST}:${PORT}`);
  try {
    const summary = seed();
    console.log(
      `[askwell] demo data ready — users=${summary.users} questions=${summary.questions} ` +
        `answers=${summary.answers} tags=${summary.tags}`
    );
  } catch (error) {
    console.error('[askwell] seed check failed:', error.stack || error.message);
  }
});

function shutdown(signal) {
  console.log(`[askwell] ${signal} received, closing server`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
