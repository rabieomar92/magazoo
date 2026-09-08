import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { token } from './storage.mjs';

/**
 * Passwords are never stored in plain text. The value placed in the .env file
 * is a salted, deliberately expensive SHA-256-based verifier:
 * pbkdf2-sha256$iterations$salt$derived-key
 *
 * A legacy sha256$hex value is accepted for migration, but new values should
 * always be generated with hashPassword().
 */
export const PASSWORD_ITERATIONS = 310_000;
const PASSWORD_BYTES = 32;

export function hashPassword(password, salt = randomBytes(16), iterations = PASSWORD_ITERATIONS) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Admin password must be at least 8 characters.');
  }
  const derived = pbkdf2Sync(password, salt, iterations, PASSWORD_BYTES, 'sha256');
  return `pbkdf2-sha256$${iterations}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  if (encoded.startsWith('sha256$')) {
    const expected = encoded.slice('sha256$'.length).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) return false;
    return safeEqual(createHash('sha256').update(password).digest('hex'), expected);
  }
  const match = encoded.match(/^pbkdf2-sha256\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/);
  if (!match) return false;
  const iterations = Number(match[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return false;
  try {
    const salt = Buffer.from(match[2], 'base64url');
    const expected = Buffer.from(match[3], 'base64url');
    if (salt.length < 16 || expected.length !== PASSWORD_BYTES) return false;
    const actual = pbkdf2Sync(password, salt, iterations, PASSWORD_BYTES, 'sha256');
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** In-memory sessions and failed-login throttling. Restarting the process
 * invalidates sessions, while the password verifier remains in .env. */
export function createAuth({ passwordHash, now = Date.now }) {
  const sessions = new Map();
  const attempts = new Map();
  const prune = () => {
    for (const map of [sessions, attempts]) {
      for (const [id, item] of map) if (item.expires < now()) map.delete(id);
    }
  };
  const timer = setInterval(prune, 60_000);
  timer.unref();
  return {
    close() { clearInterval(timer); },
    async login(password, ip) {
      prune();
      if (!passwordHash) throw Object.assign(new Error('Admin password is not configured. Set MAGAZOO_ADMIN_PASSWORD_HASH on the server.'), { status: 503 });
      const key = ip || 'unknown';
      const rate = attempts.get(key) ?? { count: 0, expires: now() + 600_000 };
      if (rate.expires < now()) { rate.count = 0; rate.expires = now() + 600_000; }
      rate.count += 1;
      attempts.set(key, rate);
      if (rate.count > 20) throw Object.assign(new Error('Too many login attempts. Try again later.'), { status: 429 });
      if (!verifyPassword(password, passwordHash)) return null;
      attempts.delete(key);
      const secret = token();
      const csrf = token();
      sessions.set(secret, { csrf, expires: now() + 8 * 3_600_000 });
      return { secret, csrf };
    },
    session(secret) {
      const item = sessions.get(secret);
      return item && item.expires >= now() ? item : null;
    },
    logout(secret) { sessions.delete(secret); },
  };
}
