/**
 * File purpose: Verifies operation-readiness status, blocking-reason, approval, and packet helpers.
 * Fallback/error behavior: Assertions fail when incomplete prerequisites are incorrectly treated as operationally ready.
 * Known limitation: These tests do not verify database invalidation triggers or UI state transitions.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReadinessPacketRows, closeoutRequiresReadiness, getOperationReadinessStatus, getPermitPlanningValidationMessage, getReadinessBlockingReasons, getResourceReadinessIssues, getCrewCredentialLabel, getCrewCredentialWarnings, getEquipmentMaintenanceLabel, isApprovalCurrent, isApprovalForToday, resolveReadinessApproverIdentity, type ReadinessCrewMember, type ReadinessEquipmentItem, type ReadinessPrerequisites } from './operation-readiness.ts';

const ready: ReadinessPrerequisites = { jhaComplete: true, safetyManagerReviewCurrent: true, rpicAcceptanceCurrent: true, controlsInPlace: true, preflightComplete: true, assignedRpicId: 'rpic-1', fitnessForDutyConfirmed: true };

test('Ready to Operate is blocked by each missing safety prerequisite', () => {
  for (const key of ['jhaComplete', 'safetyManagerReviewCurrent', 'rpicAcceptanceCurrent', 'controlsInPlace', 'preflightComplete', 'fitnessForDutyConfirmed'] as const) {
    assert.ok(getReadinessBlockingReasons({ ...ready, [key]: false }).length, `${key} should block approval`);
  }
  assert.ok(getReadinessBlockingReasons({ ...ready, assignedRpicId: null }).some((reason) => reason.includes('RPIC')));
});

test('Ready to Operate is allowed when all prerequisites are current', () => assert.deepEqual(getReadinessBlockingReasons(ready), []));

test('crew acknowledgment blocks only when explicitly required and incomplete', () => {
  assert.deepEqual(getReadinessBlockingReasons({ ...ready, crewAcknowledgmentsCurrent: true }), []);
  assert.ok(getReadinessBlockingReasons({ ...ready, crewAcknowledgmentsCurrent: false }).some((reason) => reason.includes('crew member')));
  assert.deepEqual(getReadinessBlockingReasons(ready), []); // legacy jobs remain compatible
});

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

test('packet approver uses the exact assigned RPIC when an account has multiple personnel records', () => {
  const bryceUserId = '7936f3c9-263b-4987-b4a6-bc246e488bfa';
  const personnelForAccount = [
    { full_name: 'Test Visual Observer', email: 'bryce@example.com', user_id: bryceUserId },
    { full_name: 'Bryce Finger', email: 'bryce@example.com', user_id: bryceUserId },
  ];
  const assignedRpic = personnelForAccount[1];
  const approvedByName = resolveReadinessApproverIdentity(assignedRpic, bryceUserId);
  const rows = buildReadinessPacketRows({ approved_at: '2026-09-01T12:00:00Z', approval_stale: false, fitness_for_duty_confirmed: true, rpic_personnel_id: 'bryce-personnel-id', rpic_name: assignedRpic.full_name, approved_by_name: approvedByName, approved_by_user_id: bryceUserId });

  assert.equal(personnelForAccount[0].full_name, 'Test Visual Observer');
  assert.equal(assignedRpic.full_name, 'Bryce Finger');
  assert.deepEqual(rows.find(([label]) => label === 'Approved By'), ['Approved By', 'Bryce Finger']);
});

const today = '2026-10-22';
const currentRpic: ReadinessCrewMember = { personnelId: 'p-rpic', name: 'Pat', assignedRole: 'RPIC', part107CertificateNumber: '4000001', part107ExpirationDate: '2027-06-01', trainingExpirationDate: '2027-01-01' };
const readyDrone: ReadinessEquipmentItem = { equipmentId: 'e-drone', name: 'Drone A', equipmentType: 'Drone', status: 'Available', faaRegistrationNumber: 'FA12345', maintenanceDueDate: '2026-12-01' };

test('a current RPIC and a registered, available drone raise no readiness issues', () => {
  const issues = getResourceReadinessIssues([currentRpic], [readyDrone], [], today);
  assert.deepEqual(issues.blocking, []);
  assert.deepEqual(issues.overridable, []);
});

test('an RPIC without a current Part 107 blocks readiness', () => {
  for (const change of [{ part107CertificateNumber: null }, { part107CertificateNumber: '  ' }, { part107ExpirationDate: null }, { part107ExpirationDate: '2026-10-21' }]) {
    const issues = getResourceReadinessIssues([{ ...currentRpic, ...change }], [readyDrone], [], today);
    assert.ok(issues.blocking.some((reason) => reason.includes('Part 107')), JSON.stringify(change));
  }
  const visualObserver = { ...currentRpic, assignedRole: 'Visual Observer', part107CertificateNumber: null };
  assert.deepEqual(getResourceReadinessIssues([visualObserver], [], [], today).blocking, []);
});

test('unavailable equipment and unregistered drones block readiness', () => {
  for (const status of ['Maintenance', 'Inactive', 'Retired']) {
    assert.ok(getResourceReadinessIssues([], [{ ...readyDrone, status }], [], today).blocking.some((reason) => reason.includes(status)));
  }
  assert.ok(getResourceReadinessIssues([], [{ ...readyDrone, faaRegistrationNumber: '' }], [], today).blocking.some((reason) => reason.includes('FAA registration')));
  const camera = { ...readyDrone, equipmentType: 'Camera / Sensor', faaRegistrationNumber: null };
  assert.deepEqual(getResourceReadinessIssues([], [camera], [], today).blocking, []);
});

test('overdue maintenance is a reminder, not a gate', () => {
  const overdue = { ...readyDrone, maintenanceDueDate: '2026-09-01' };
  const issues = getResourceReadinessIssues([currentRpic], [overdue], [], today);
  assert.deepEqual(issues.blocking, []);
  assert.deepEqual(issues.overridable, []);
  assert.deepEqual(issues.pendingOverrideReasons, []);
  assert.match(issues.reminders[0], /Drone A is overdue for maintenance \(due 2026-09-01\)/);
  assert.equal(getEquipmentMaintenanceLabel('2026-09-01', today), ' (maintenance overdue)');
  assert.equal(getEquipmentMaintenanceLabel('2026-12-01', today), '');
  assert.equal(getEquipmentMaintenanceLabel(null, today), '');
});

test('expired training needs an override that matches the current date', () => {
  const expired = { ...currentRpic, trainingExpirationDate: '2026-01-31' };
  const pending = getResourceReadinessIssues([expired], [], [], today);
  assert.equal(pending.blocking.length, 0);
  assert.deepEqual(pending.overridable.map((issue) => issue.itemType), ['training_expired']);
  assert.equal(pending.pendingOverrideReasons.length, 1);

  const record = (item_date: string) => ({ item_type: 'training_expired' as const, item_id: 'p-rpic', item_date, item_name: 'x', reason: 'Accepted for this job', approved_by_name: 'SM', approved_at: '2026-10-22T10:00:00Z' });
  assert.deepEqual(getResourceReadinessIssues([expired], [], [record('2026-01-31')], today).pendingOverrideReasons, []);
  assert.equal(getResourceReadinessIssues([{ ...expired, trainingExpirationDate: '2026-03-31' }], [], [record('2026-01-31')], today).pendingOverrideReasons.length, 1, 'an override for an older date no longer applies');
});

test('the same person assigned twice is listed once for expired training', () => {
  const expired = { ...currentRpic, trainingExpirationDate: '2026-01-31' };
  assert.equal(getResourceReadinessIssues([expired, { ...expired, assignedRole: 'Visual Observer' }], [], [], today).overridable.length, 1);
});

test('closeout requires Ready to Operate unless the job was aborted or delayed', () => {
  for (const result of ['Completed as Planned', 'Completed with Changes', 'Incident Occurred']) assert.equal(closeoutRequiresReadiness(result), true, result);
  for (const result of ['Aborted', 'Delayed']) assert.equal(closeoutRequiresReadiness(result), false, result);
});

test('a Ready to Operate approval only covers the day it was given', () => {
  const record = { approved_at: new Date(2026, 9, 22, 7, 30).toISOString(), approval_stale: false, fitness_for_duty_confirmed: true, rpic_personnel_id: 'rpic-1' };
  assert.equal(isApprovalForToday(record, new Date(2026, 9, 22, 18, 0)), true);
  assert.equal(isApprovalForToday(record, new Date(2026, 9, 23, 6, 0)), false);
  assert.equal(isApprovalForToday({ ...record, approved_at: null }, new Date(2026, 9, 22, 18, 0)), false);
  assert.equal(isApprovalForToday(null), false);
});

test('crew pickers label lapsed credentials and warn for an RPIC without a current Part 107', () => {
  const today = '2026-10-22';
  const expired = { part_107_certificate_number: '4000001', part_107_expiration_date: '2026-09-30', training_expiration_date: '2026-01-31' };
  const current = { part_107_certificate_number: '4000002', part_107_expiration_date: '2027-06-01', training_expiration_date: '2027-06-01' };
  assert.equal(getCrewCredentialLabel(expired, today), ' (Part 107 expired, training expired)');
  assert.equal(getCrewCredentialLabel(current, today), '');
  assert.deepEqual(getCrewCredentialWarnings(current, 'RPIC', today), []);
  const rpicWarnings = getCrewCredentialWarnings(expired, 'RPIC', today);
  assert.equal(rpicWarnings.length, 2);
  assert.match(rpicWarnings[0], /Part 107 expired on 2026-09-30\. Ready to Operate will be blocked/);
  assert.match(rpicWarnings[1], /Training expired on 2026-01-31/);
  assert.deepEqual(getCrewCredentialWarnings(expired, 'Visual Observer', today).length, 1);
  assert.match(getCrewCredentialWarnings({ ...current, part_107_certificate_number: '' }, 'RPIC', today)[0], /No Part 107 certificate number/);
});
