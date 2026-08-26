/**
 * File purpose: Verifies the jha attestations domain helpers with deterministic Node unit tests.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { operationalRoleLabel, recordOperationalAttestation } from './jha-attestations.ts';

test('different Safety Manager and RPIC attestations remain independent', () => {
  const initial = { safetyManagerReviewedAt: null, rpicAcceptedAt: null };
  const reviewed = recordOperationalAttestation(initial, 'safety-manager', '2026-08-21T10:00:00Z');

  assert.deepEqual(reviewed, {
    safetyManagerReviewedAt: '2026-08-21T10:00:00Z',
    rpicAcceptedAt: null
  });
  assert.deepEqual(recordOperationalAttestation(reviewed, 'rpic', '2026-08-21T10:05:00Z'), {
    safetyManagerReviewedAt: '2026-08-21T10:00:00Z',
    rpicAcceptedAt: '2026-08-21T10:05:00Z'
  });
});

test('one person can hold both labels without combining the two actions', () => {
  assert.equal(operationalRoleLabel(true, true), 'Safety Manager / RPIC');
  const initial = { safetyManagerReviewedAt: null, rpicAcceptedAt: null };
  const accepted = recordOperationalAttestation(initial, 'rpic', '2026-08-21T11:00:00Z');

  assert.equal(accepted.safetyManagerReviewedAt, null);
  assert.equal(accepted.rpicAcceptedAt, '2026-08-21T11:00:00Z');
});
