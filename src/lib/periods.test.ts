import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePeriods, quarterOf, attendanceStats, average } from './periods.ts';
import { normalizeClassName, cleanName } from './normalize.ts';
import { todayISO, weekdayOf, isIsoDate, formatTj } from './dates.ts';

const Q = [
  { number: 1, start: '2026-09-01', end: '2026-10-31' },
  { number: 2, start: '2026-11-09', end: '2026-12-27' },
  { number: 3, start: '2027-01-11', end: '2027-03-20' },
  { number: 4, start: '2027-03-30', end: '2027-05-25' },
];

test('quarterOf', () => {
  assert.equal(quarterOf('2026-09-01', Q), 1);
  assert.equal(quarterOf('2026-11-03', Q), null); // таътил
  assert.equal(quarterOf('2027-05-25', Q), 4);
});

test('computePeriods — мисоли промт ва «бе баҳо»', () => {
  const rows = [
    { date: '2026-09-02', grade: 4 },
    { date: '2026-09-10', grade: 6 },
    { date: '2026-10-01', grade: 8 },
    { date: '2026-10-20', grade: 9 },
    { date: '2026-11-10', grade: null },     // ҳузур бе баҳо
    { date: '2026-11-04', grade: 10 },       // таътил — ҳисоб намешавад
  ];
  const r = computePeriods(rows, Q);
  assert.deepEqual(r.quarters, [7, null, null, null]);
  assert.equal(r.annual, 7);
});

test('attendanceStats', () => {
  const s = attendanceStats(['PRESENT', 'PRESENT', 'ABSENT', 'EXCUSED']);
  assert.deepEqual(s, { present: 2, absent: 1, excused: 1, total: 4, percent: 50 });
  assert.equal(attendanceStats([]).percent, null);
});

test('average', () => {
  assert.equal(average([7, 8]), 7.5);
  assert.equal(average([]), null);
});

test('normalizeClassName', () => {
  assert.deepEqual(normalizeClassName('10a'), { gradeLevel: 10, letter: 'А', name: '10-А' });
  assert.equal(normalizeClassName('10-a')?.name, '10-А');
  assert.equal(normalizeClassName(' 10 а ')?.name, '10-А');
  assert.equal(normalizeClassName('8г')?.name, '8-Г');
  assert.equal(normalizeClassName('5')?.name, '5');
  assert.equal(normalizeClassName('12-А'), null);
  assert.equal(normalizeClassName('abc'), null);
  assert.equal(cleanName('  Алиев   Вали '), 'Алиев Вали');
});

test('dates', () => {
  // 2026-11-24 20:00 UTC = 2026-11-25 01:00 дар Душанбе
  assert.equal(todayISO(new Date('2026-11-24T20:00:00Z')), '2026-11-25');
  assert.equal(weekdayOf('2026-11-25'), 3); // чоршанбе
  assert.equal(weekdayOf('2026-11-29'), 7); // якшанбе
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(formatTj('2026-11-25'), '25.11.2026');
});

import { normalizePhone, formatPhone, shortStudentName } from './phone.ts';

test('phone', () => {
  assert.equal(normalizePhone('90 123 45 67'), '992901234567');
  assert.equal(normalizePhone('+992 (90) 123-45-67'), '992901234567');
  assert.equal(normalizePhone('00992901234567'), '992901234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(formatPhone('992901234567'), '+992 90 123 4567');
  assert.equal(shortStudentName('Боқиева Мадина Ҷамшедовна'), 'Мадина Б.');
  assert.equal(shortStudentName('Алӣ'), 'А.');
});
