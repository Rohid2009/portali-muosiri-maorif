import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword, loginCandidate, validateNewPassword, normalizeLogin } from './credentials.ts';

test('generatePassword — дарозӣ, ҳарф ва рақам, бе аломатҳои омехташаванда', () => {
  for (let i = 0; i < 500; i++) {
    const p = generatePassword();
    assert.equal(p.length, 10);
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /[2-9]/);
    assert.doesNotMatch(p, /[0O1lIo]/);
  }
});

test('generatePassword — 10 000 парол, ҳама гуногун', () => {
  const set = new Set(Array.from({ length: 10000 }, () => generatePassword()));
  assert.equal(set.size, 10000);
});

test('loginCandidate', () => {
  assert.match(loginCandidate('TEACHER', 12), /^t12-\d{4}$/);
  assert.match(loginCandidate('DISTRICT_ADMIN', null), /^a0-\d{4}$/);
});

test('validateNewPassword', () => {
  assert.ok(validateNewPassword('short1'));
  assert.ok(validateNewPassword('faqathарф'));
  assert.equal(validateNewPassword('Мактаб2026'), null);
});

test('normalizeLogin', () => {
  assert.equal(normalizeLogin('  T12-0001 '), 't12-0001');
});

import { validateLogin } from './credentials.ts';
test('validateLogin', () => {
  assert.equal(validateLogin('gulnora.r'), null);
  assert.equal(validateLogin('992901234567'), null);
  assert.ok(validateLogin('ab'));
  assert.ok(validateLogin('Гулнора'));
  assert.ok(validateLogin('-abc'));
});
