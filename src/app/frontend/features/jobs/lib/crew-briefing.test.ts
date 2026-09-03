import assert from 'node:assert/strict';
import test from 'node:test';
import { crewAcknowledgmentsCurrent, crewBriefingStatus, requiredCrewAssignments, validateManualFieldBriefing } from './crew-briefing.ts';

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
  assert.ok(validateManualFieldBriefing('Other', '', true));
  assert.ok(validateManualFieldBriefing('Device/access issue', '', false));
  assert.equal(validateManualFieldBriefing('Other', 'No usable device', true), null);
});
