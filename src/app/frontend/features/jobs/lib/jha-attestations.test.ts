import assert from 'node:assert/strict';
import test from 'node:test';
import { getOperationalCompletionMessages, operationalAttestationStatus, operationalRoleLabel, recordOperationalAttestation } from './jha-attestations.ts';

test('different Safety Manager and RPIC attestations remain independent', () => {
  const initial = { safetyManagerReviewedAt: null, rpicAcceptedAt: null };
  const reviewed = recordOperationalAttestation(initial, 'safety-manager', '2026-08-21T10:00:00Z');

  assert.deepEqual(reviewed, {
    safetyManagerReviewedAt: '2026-08-21T10:00:00Z',
    rpicAcceptedAt: null,
    safetyManagerReviewStale: false
  });
  assert.deepEqual(recordOperationalAttestation(reviewed, 'rpic', '2026-08-21T10:05:00Z'), {
    safetyManagerReviewedAt: '2026-08-21T10:00:00Z',
    rpicAcceptedAt: '2026-08-21T10:05:00Z',
    safetyManagerReviewStale: false,
    rpicAcceptanceStale: false
  });
});

test('completion messages identify every distinct missing requirement without a legacy RPIC checkbox', () => {
  assert.deepEqual(getOperationalCompletionMessages({ crewBriefed: false, controlsInPlace: false, safetyManagerReviewedAt: null, rpicAcceptedAt: null }), [
    'Confirm that the crew briefing was completed before marking the JHA complete.',
    'Confirm that required controls are in place before marking the JHA complete.',
    'Safety Manager Review is required before marking the JHA complete.',
    'RPIC Acceptance is required before marking the JHA complete.'
  ]);
  assert.deepEqual(getOperationalCompletionMessages({ crewBriefed: true, controlsInPlace: true, safetyManagerReviewedAt: 'reviewed', rpicAcceptedAt: 'accepted' }), []);
});

test('material-change flags require both role-specific attestations again', () => {
  const requirements = { crewBriefed: true, controlsInPlace: true, safetyManagerReviewedAt: 'reviewed', rpicAcceptedAt: 'accepted', safetyManagerReviewStale: true, rpicAcceptanceStale: true };
  assert.deepEqual(getOperationalCompletionMessages(requirements), [
    'Safety Manager re-review is required before marking the JHA complete.',
    'RPIC re-acceptance is required before marking the JHA complete.'
  ]);
  assert.equal(operationalAttestationStatus('reviewed', true, 'Reviewed', 'Re-review required', 'Pending'), 'Re-review required');
  assert.equal(operationalAttestationStatus('accepted', true, 'Accepted', 'Re-acceptance required', 'Pending'), 'Re-acceptance required');
});

test('one person can hold both labels without combining the two actions', () => {
  assert.equal(operationalRoleLabel(true, true), 'Safety Manager / RPIC');
  const initial = { safetyManagerReviewedAt: null, rpicAcceptedAt: null };
  const accepted = recordOperationalAttestation(initial, 'rpic', '2026-08-21T11:00:00Z');

  assert.equal(accepted.safetyManagerReviewedAt, null);
  assert.equal(accepted.rpicAcceptedAt, '2026-08-21T11:00:00Z');
});
