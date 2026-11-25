'use strict';
const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

// In-memory sessions: token -> { userId, expires }
const sessions = new Map();
const SESSION_MS = 8 * 60 * 60 * 1000;

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expires: Date.now() + SESSION_MS });
  return token;
}

function getSession(token) {
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  s.expires = Date.now() + SESSION_MS;
  return s;
}

function destroySession(token) { sessions.delete(token); }

function destroyUserSessions(userId) {
  for (const [t, s] of sessions) if (s.userId === userId) sessions.delete(t);
}

// Simple login throttle: 8 failures per 10 minutes per email+ip
const failures = new Map();
function throttled(key) {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() - f.first > 10 * 60 * 1000) { failures.delete(key); return false; }
  return f.count >= 8;
}
function recordFailure(key) {
  const f = failures.get(key) || { count: 0, first: Date.now() };
  f.count++;
  failures.set(key, f);
}
function clearFailures(key) { failures.delete(key); }

// Role ladder (least privilege): viewer < organiser < approver < admin
const RANK = { organiser: 1, approver: 2, admin: 3 };
function atLeast(user, role) {
  return !!user && (RANK[user.role] || 0) >= RANK[role];
}

module.exports = {
  hashPassword, verifyPassword, createSession, getSession, destroySession,
  destroyUserSessions, throttled, recordFailure, clearFailures, atLeast,
};
