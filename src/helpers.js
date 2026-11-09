'use strict';

/** Small display + normalisation helpers shared by routes and templates. */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Human relative timestamp, clamped so it never reads "in 3 hours". */
function timeAgo(value, now = Date.now()) {
  const date = parseDate(value);
  if (!date) return '';
  const diff = now - date.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diff < 30 * DAY) {
    const days = Math.floor(diff / DAY);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return formatDate(date);
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatNumber(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US');
}

/** ISO timestamp used for <time datetime="...">. */
function isoTime(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : '';
}

/** Normalise a tag label: "PostgreSQL " -> "postgresql". */
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9+#.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** "sqlite" -> "SQLite" style display name is left to the caller; store the raw name. */
function normaliseTagName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 40);
}

/** Parse the comma separated tag input from the ask/edit forms. */
function parseTagInput(raw) {
  if (!raw) return [];
  const seen = new Set();
  const names = [];
  for (const part of String(raw).split(',')) {
    const name = normaliseTagName(part);
    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    names.push(name);
  }
  return names;
}

module.exports = {
  timeAgo,
  formatDate,
  formatNumber,
  isoTime,
  slugify,
  normaliseTagName,
  parseTagInput,
};
