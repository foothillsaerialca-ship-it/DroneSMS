/**
 * File purpose: Verifies crew-briefing status, assignment, validation, and error-message helpers.
 * Fallback/error behavior: Assertions fail when malformed or incomplete briefing inputs are not normalized correctly.
 * Known limitation: These tests cover pure helper behavior and do not exercise Supabase or page rendering.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { crewAcknowledgmentSendErrorMessage, crewAcknowledgmentsCurrent, crewBriefingStatus, requiredCrewAssignments, validateManualFieldBriefing } from './crew-briefing.ts';

const assignments = [
  { id: 'rpic', assigned_role: 'RPIC', personnel: { id: 'p1', full_name: 'Pilot', email: null, status: 'Active' } },
  { id: 'vo', assigned_role: 'Visual Observer', personnel: { id: 'p2', full_name: 'Observer', email: 'vo@example.test', status: 'Active' } },
];

test('solo RPIC and non-operational assignments create no crew acknowledgment requirement', () => {
  assert.equal(requiredCrewAssignments(assignments.slice(0, 1)).length, 0);
  assert.equal(crewAcknowledgmentsCurrent(assignments.slice(0, 1), [], 1), true);
  assert.equal(requiredCrewAssignments([...assignments.slice(0, 1), { id: 'admin', assigned_role: 'Safety Manager', personnel: { id: 'p3', full_name: 'Safety', status: 'Active' } }]).length, 0);
});

test('current electronic or manual evidence satisfies readiness, while sent and stale evidence do not', () => {
  assert.equal(crewAcknowledgmentsCurrent(assignments, [], 2), false);
  assert.equal(crewAcknowledgmentsCurrent(assignments, [{ assignment_id: 'vo', briefing_version: 2, status: 'Sent' }], 2), false);
  assert.equal(crewAcknowledgmentsCurrent(assignments, [{ assignment_id: 'vo', briefing_version: 1, status: 'Acknowledged' }], 2), false);
  assert.equal(crewBriefingStatus(assignments[1], [{ assignment_id: 'vo', briefing_version: 1, status: 'Acknowledged' }], 2), 'Stale');
  assert.equal(crewAcknowledgmentsCurrent(assignments, [{ assignment_id: 'vo', briefing_version: 2, status: 'Acknowledged' }], 2), true);
  assert.equal(crewAcknowledgmentsCurrent(assignments, [{ assignment_id: 'vo', briefing_version: 2, status: 'Manual Field Briefing' }], 2), true);
});

test('manual field briefing requires reason, Other explanation, and RPIC attestation', () => {
  assert.ok(validateManualFieldBriefing('', '', true));
  assert.ok(validateManualFieldBriefing('free-form but unsupported', '', true));
  assert.ok(validateManualFieldBriefing('Other', '', true));
  assert.ok(validateManualFieldBriefing('Device/access issue', '', false));
  assert.equal(validateManualFieldBriefing('Other', 'No usable device', true), null);
});

test('electronic delivery failures use operator language rather than implementation terminology', () => {
  const message = crewAcknowledgmentSendErrorMessage();
  assert.match(message, /could not be sent/i);
  assert.doesNotMatch(message, /Edge Function|Supabase|RPC/i);
});

test('a repeated material change keeps old evidence stale until the new version is acknowledged', () => {
  const acknowledgedVersion = 4;
  const afterAnotherDraftEdit = acknowledgedVersion + 1;
  const oldEvidence = [{ assignment_id: 'vo', assigned_role: 'Visual Observer', briefing_version: acknowledgedVersion, status: 'Acknowledged' as const }];
  assert.equal(crewBriefingStatus(assignments[1], oldEvidence, afterAnotherDraftEdit), 'Stale');
  assert.equal(crewAcknowledgmentsCurrent(assignments, oldEvidence, afterAnotherDraftEdit), false);
  assert.equal(crewAcknowledgmentsCurrent(assignments, [...oldEvidence, { ...oldEvidence[0], briefing_version: afterAnotherDraftEdit }], afterAnotherDraftEdit), true);
});

test('removing a crew assignment stops its preserved evidence from blocking the current crew', () => {
  const historicalEvidence = [{ assignment_id: 'vo', assigned_role: 'Visual Observer', briefing_version: 2, status: 'Acknowledged' as const }];
  assert.equal(crewAcknowledgmentsCurrent(assignments.slice(0, 1), historicalEvidence, 3), true);
});
