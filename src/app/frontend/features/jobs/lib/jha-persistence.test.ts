/**
 * File purpose: Verifies the JHA unchanged-save comparison with deterministic Node unit tests.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assessmentRecordMatchesStored, jsonValuesEqual } from './jha-persistence.ts';

test('jsonb round-trips with reordered keys and dropped undefined members still compare equal', () => {
  assert.equal(jsonValuesEqual({ a: 1, b: { c: [1, 2], d: undefined } }, { b: { c: [1, 2] }, a: 1 }), true);
  assert.equal(jsonValuesEqual(undefined, null), true);
});

test('value, type, and array-order differences compare unequal', () => {
  assert.equal(jsonValuesEqual({ a: 1 }, { a: 2 }), false);
  assert.equal(jsonValuesEqual(12, '12'), false);
  assert.equal(jsonValuesEqual([1, 2], [2, 1]), false);
  assert.equal(jsonValuesEqual({ a: [] }, { a: {} }), false);
});

test('only columns the page writes are compared against the stored row', () => {
  const stored = { job_type_scope: 'Roof Cleaning - Roof Wash', crew_members: 'A (Pilot)', updated_at: '2026-10-14T00:00:00Z', safety_manager_reviewed_at: '2026-10-14T00:00:00Z' };
  assert.equal(assessmentRecordMatchesStored({ job_type_scope: 'Roof Cleaning - Roof Wash', crew_members: 'A (Pilot)' }, stored), true);
});

test('derived Mission Basics drift and missing stored rows require a write', () => {
  const stored = { job_type_scope: 'Roof Cleaning - Roof Wash', crew_members: 'A (Pilot)', jha_number: null };
  assert.equal(assessmentRecordMatchesStored({ job_type_scope: 'Roof Cleaning - Roof Wash', crew_members: 'A (Pilot), B (Visual Observer)' }, stored), false);
  assert.equal(assessmentRecordMatchesStored({ jha_number: 'JHA-1234ABCD' }, stored), false);
  assert.equal(assessmentRecordMatchesStored({ job_type_scope: 'x' }, null), false);
});
