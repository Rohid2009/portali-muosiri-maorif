import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundGrade, quarterGrade, annualGrade } from './grades.ts';

test('roundGrade — қоидаи округ', () => {
  assert.equal(roundGrade(6.4), 6);
  assert.equal(roundGrade(6.49), 6);
  assert.equal(roundGrade(6.5), 7);
  assert.equal(roundGrade(6.75), 7);
  assert.equal(roundGrade(10), 10);
  assert.equal(roundGrade(0.1 + 0.2 + 6.2), 7); // 6.5000000001 → 7
  assert.equal(roundGrade(19.5 / 3), 7);        // 6.5 → 7
});

test('quarterGrade — мисоли промт: 4, 6, 8, 9 → 7', () => {
  assert.equal(quarterGrade([4, 6, 8, 9]), 7);
});

test('quarterGrade — бе баҳо → null (тақсим ба сифр нест)', () => {
  assert.equal(quarterGrade([]), null);
});

test('quarterGrade — баҳоҳои нодуруст сарфи назар мешаванд', () => {
  assert.equal(quarterGrade([0, 11, 8]), 8);
});

test('annualGrade', () => {
  assert.equal(annualGrade([7, 8, null, 9]), 8);
  assert.equal(annualGrade([null, null]), null);
  assert.equal(annualGrade([6, 7, 7, 7], 9, 50), 8); // (6.75 + 9)/2 = 7.875 → 8
  assert.equal(annualGrade([6, 7, 7, 7], 9, 0), 7);
});
