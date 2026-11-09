'use strict';

/**
 * Minimal fixed-window rate limiter for the credential endpoints.
 * Single-process in-memory counters are the right scope for this
 * one-process self-hosted app; nothing external is required.
 */
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 12;
const buckets = new Map();

function allow(key) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_ATTEMPTS;
}

function clientKey(req, identifier) {
  return `${req.ip || 'local'}|${String(identifier || '').toLowerCase()}`;
}

/** Drop stale buckets so the map cannot grow without bound. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, WINDOW_MS).unref();

module.exports = { allow, clientKey };
