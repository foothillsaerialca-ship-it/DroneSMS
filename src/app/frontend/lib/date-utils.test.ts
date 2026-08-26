/**
 * File purpose: Verifies shared ISO date formatting, defaulting, and calendar-day calculations.
 * Fallback/error behavior: deterministic assertions fail the test process when date compatibility behavior changes.
 * Known issues: host-clock correctness and daylight-saving transitions are outside this unit test.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { daysUntilDate, formatIsoDate, todayIsoDate } from './date-utils.ts';

test('ISO dates format without time-zone conversion and retain malformed values', () => {
  assert.equal(formatIsoDate('2026-08-25'), '08/25/2026');
  assert.equal(formatIsoDate('', 'Not tracked'), 'Not tracked');
  assert.equal(formatIsoDate('legacy-date'), 'legacy-date');
});

test('today ISO date is a valid calendar form default', () => {
  assert.match(todayIsoDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test('local calendar day calculation returns zero for the current local date', () => {
  const now = new Date();
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  assert.equal(daysUntilDate(localToday), 0);
});
