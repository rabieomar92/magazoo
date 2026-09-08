import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './passwordAuth.mjs';

test('password verifier is salted, rejects wrong values, and supports legacy SHA-256', () => {
  const encoded = hashPassword('correct horse battery staple');
  assert.match(encoded, /^pbkdf2-sha256\$/);
  assert.equal(verifyPassword('correct horse battery staple', encoded), true);
  assert.equal(verifyPassword('wrong password', encoded), false);
  assert.notEqual(encoded, hashPassword('correct horse battery staple'));
  assert.equal(verifyPassword('test', `sha256$${'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'}`), true);
  assert.equal(verifyPassword('test2', `sha256$${'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'}`), false);
});

test('password hashing rejects short passwords and malformed hashes', () => {
  assert.throws(() => hashPassword('short'), /at least 8/);
  assert.equal(verifyPassword('anything', 'not-a-password-hash'), false);
});
