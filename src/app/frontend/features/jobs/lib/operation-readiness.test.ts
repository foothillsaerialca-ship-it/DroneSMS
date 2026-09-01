import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReadinessPacketRows, getOperationReadinessStatus, getReadinessBlockingReasons, isApprovalCurrent, type ReadinessPrerequisites } from './operation-readiness.ts';

const ready: ReadinessPrerequisites = { jhaComplete: true, safetyManagerReviewCurrent: true, rpicAcceptanceCurrent: true, controlsInPlace: true, preflightComplete: true, assignedRpicId: 'rpic-1', fitnessForDutyConfirmed: true };

test('Ready to Operate is blocked by each missing safety prerequisite', () => {
  for (const key of ['jhaComplete', 'safetyManagerReviewCurrent', 'rpicAcceptanceCurrent', 'controlsInPlace', 'preflightComplete', 'fitnessForDutyConfirmed'] as const) {
    assert.ok(getReadinessBlockingReasons({ ...ready, [key]: false }).length, `${key} should block approval`);
  }
  assert.ok(getReadinessBlockingReasons({ ...ready, assignedRpicId: null }).some((reason) => reason.includes('RPIC')));
});

test('Ready to Operate is allowed when all prerequisites are current', () => assert.deepEqual(getReadinessBlockingReasons(ready), []));

test('approval is current only for the assigned RPIC and becomes stale explicitly', () => {
  const record = { approved_at: '2026-09-01T12:00:00Z', approval_stale: false, fitness_for_duty_confirmed: true, rpic_personnel_id: 'rpic-1' };
  assert.equal(getOperationReadinessStatus(record), 'Ready to Operate');
  assert.equal(isApprovalCurrent(record, 'rpic-1'), true);
  assert.equal(isApprovalCurrent(record, 'rpic-2'), false);
  assert.equal(getOperationReadinessStatus({ ...record, approval_stale: true }), 'Approval Stale');
});

test('legacy jobs without a readiness record remain readable as Not Ready', () => assert.equal(getOperationReadinessStatus(null), 'Not Ready'));

test('packet output includes final approval, fitness confirmation, identity, timestamp, and currency', () => {
  const rows = buildReadinessPacketRows({ approved_at: '2026-09-01T12:00:00Z', approval_stale: false, fitness_for_duty_confirmed: true, rpic_personnel_id: 'rpic-1', rpic_name: 'A. Pilot', approved_by_user_id: 'user-1' });
  assert.deepEqual(rows.map(([label]) => label), ['Ready to Operate', 'Fitness for Duty', 'Assigned RPIC', 'Approved By User', 'Approval Timestamp', 'Current for Operation']);
  assert.equal(rows[1][1], 'Confirmed'); assert.equal(rows[5][1], 'Yes');
});
