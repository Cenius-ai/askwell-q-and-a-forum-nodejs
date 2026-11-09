'use strict';

/**
 * Seed entrypoint: creates the demo account + community content, prints a
 * summary and exits. It never starts the HTTP server.
 */
const { seed } = require('../src/seed');

try {
  const summary = seed();
  console.log(
    `[askwell] seed complete — users=${summary.users} questions=${summary.questions} ` +
      `answers=${summary.answers} tags=${summary.tags} votes=${summary.votes}`
  );
  process.exit(0);
} catch (error) {
  console.error('[askwell] seed failed:', error.stack || error.message);
  process.exit(1);
}
