import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReadinessPacketRows, getOperationReadinessStatus, getPermitPlanningValidationMessage, getReadinessBlockingReasons, isApprovalCurrent, type ReadinessPrerequisites } from './operation-readiness.ts';

const ready: ReadinessPrerequisites = { jhaComplete: true, safetyManagerReviewCurrent: true, rpicAcceptanceCurrent: true, controlsInPlace: true, preflightComplete: true, assignedRpicId: 'rpic-1', fitnessForDutyConfirmed: true };

test('Ready to Operate is blocked by each missing safety prerequisite', () => {
  for (const key of ['jhaComplete', 'safetyManagerReviewCurrent', 'rpicAcceptanceCurrent', 'controlsInPlace', 'preflightComplete', 'fitnessForDutyConfirmed'] as const) {
    assert.ok(getReadinessBlockingReasons({ ...ready, [key]: false }).length, `${key} should block approval`);
  }
  assert.ok(getReadinessBlockingReasons({ ...ready, assignedRpicId: null }).some((reason) => reason.includes('RPIC')));
});

test('Ready to Operate is allowed when all prerequisites are current', () => assert.deepEqual(getReadinessBlockingReasons(ready), []));

test('public right-of-way planning blocks only a required permit that is not approved', () => {
  assert.deepEqual(getReadinessBlockingReasons({ ...ready, publicRightOfWayRestrictionRequired: false }), []);
  assert.deepEqual(getReadinessBlockingReasons({ ...ready, publicRightOfWayRestrictionRequired: true, permitAuthorizationRequired: false }), []);
  assert.ok(getReadinessBlockingReasons({ ...ready, publicRightOfWayRestrictionRequired: true, permitAuthorizationRequired: true, permitAuthorizationStatus: 'Pending' }).some((reason) => reason.includes('permit')));
  assert.deepEqual(getReadinessBlockingReasons({ ...ready, publicRightOfWayRestrictionRequired: true, permitAuthorizationRequired: true, permitAuthorizationStatus: 'Approved' }), []);
});

test('changing permit required to No removes stale permit blocking', () => {
  assert.deepEqual(getReadinessBlockingReasons({ ...ready, publicRightOfWayRestrictionRequired: true, permitAuthorizationRequired: false, permitAuthorizationStatus: 'Pending' }), []);
});

test('a Draft planning record can be saved while a required permit is Pending', () => {
  assert.equal(getPermitPlanningValidationMessage({ publicRightOfWayRestrictionRequired: 'Yes', permitAuthorizationRequired: 'Yes', permitIssuingAuthority: '', permitAuthorizationNumber: '', permitAuthorizationStatus: 'Pending' }, false), null);
});

test('completed planning accepts No branches and requires only the small permit section for Yes', () => {
  const base = { publicRightOfWayRestrictionRequired: 'No', permitAuthorizationRequired: '', permitIssuingAuthority: '', permitAuthorizationNumber: '', permitAuthorizationStatus: 'Pending' };
  assert.equal(getPermitPlanningValidationMessage(base, true), null);
  assert.equal(getPermitPlanningValidationMessage({ ...base, publicRightOfWayRestrictionRequired: 'Yes', permitAuthorizationRequired: 'No' }, true), null);
  assert.ok(getPermitPlanningValidationMessage({ ...base, publicRightOfWayRestrictionRequired: 'Yes', permitAuthorizationRequired: 'Yes' }, true));
  assert.equal(getPermitPlanningValidationMessage({ ...base, publicRightOfWayRestrictionRequired: 'Yes', permitAuthorizationRequired: 'Yes', permitIssuingAuthority: 'City Public Works', permitAuthorizationNumber: 'ROW-42' }, true), null);
});

test('legacy jobs without public right-of-way fields are not retroactively blocked', () => {
  assert.deepEqual(getReadinessBlockingReasons({ ...ready, publicRightOfWayRestrictionRequired: null, permitAuthorizationRequired: null, permitAuthorizationStatus: null }), []);
});

test('approval is current only for the assigned RPIC and becomes stale explicitly', () => {
  const record = { approved_at: '2026-09-01T12:00:00Z', approval_stale: false, fitness_for_duty_confirmed: true, rpic_personnel_id: 'rpic-1' };
  assert.equal(getOperationReadinessStatus(record), 'Ready to Operate');
  assert.equal(isApprovalCurrent(record, 'rpic-1'), true);
  assert.equal(isApprovalCurrent(record, 'rpic-2'), false);
  assert.equal(getOperationReadinessStatus({ ...record, approval_stale: true }), 'Approval Stale');
});

test('legacy jobs without a readiness record remain readable as Not Ready', () => assert.equal(getOperationReadinessStatus(null), 'Not Ready'));

test('packet output includes a human-readable approver instead of the stored user UUID', () => {
  const approverUuid = '7936f3c9-263b-4987-b4a6-bc246e488bfa';
  const rows = buildReadinessPacketRows({ approved_at: '2026-09-01T12:00:00Z', approval_stale: false, fitness_for_duty_confirmed: true, rpic_personnel_id: 'rpic-1', rpic_name: 'A. Pilot', approved_by_name: 'Alex Pilot', approved_by_user_id: approverUuid });
  assert.deepEqual(rows.map(([label]) => label), ['Ready to Operate', 'Fitness for Duty', 'Assigned RPIC', 'Approved By', 'Approval Timestamp', 'Current for Operation']);
  assert.deepEqual(rows.find(([label]) => label === 'Approved By'), ['Approved By', 'Alex Pilot']);
  assert.equal(rows.some(([, value]) => value === approverUuid), false);
  assert.equal(rows[1][1], 'Confirmed'); assert.equal(rows[5][1], 'Yes');
  assert.equal(rows.some(([label]) => label.includes('Permit') || label.includes('Right-of-Way')), false);
});
