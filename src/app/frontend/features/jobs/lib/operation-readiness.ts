export type OperationReadinessStatus = 'Not Ready' | 'Ready to Operate' | 'Approval Stale';

export type ReadinessPrerequisites = {
  jhaComplete: boolean;
  safetyManagerReviewCurrent: boolean;
  rpicAcceptanceCurrent: boolean;
  controlsInPlace: boolean;
  preflightComplete: boolean;
  assignedRpicId: string | null;
  fitnessForDutyConfirmed: boolean;
  crewAcknowledgmentsCurrent?: boolean;
  publicRightOfWayRestrictionRequired?: boolean | null;
  permitAuthorizationRequired?: boolean | null;
  permitAuthorizationStatus?: 'Pending' | 'Approved' | null;
};

export type OperationReadinessRecord = {
  approved_at: string | null;
  approval_stale: boolean;
  fitness_for_duty_confirmed: boolean;
  rpic_personnel_id: string | null;
};

type ReadinessApproverPersonnel = { full_name?: string | null; email?: string | null; user_id?: string | null };

export function resolveReadinessApproverIdentity(
  assignedRpic: ReadinessApproverPersonnel | null,
  approvedByUserId: string | null,
  authenticatedUser?: { id: string; email?: string | null } | null,
) {
  if (assignedRpic?.user_id === approvedByUserId) {
    const assignedRpicIdentity = assignedRpic.full_name?.trim() || assignedRpic.email?.trim();
    if (assignedRpicIdentity) return assignedRpicIdentity;
  }
  if (authenticatedUser?.id === approvedByUserId) return authenticatedUser.email?.trim() || null;
  return null;
}

export type PermitPlanningInput = {
  publicRightOfWayRestrictionRequired: string;
  permitAuthorizationRequired: string;
  permitIssuingAuthority: string;
  permitAuthorizationNumber: string;
  permitAuthorizationStatus: string;
};

export function getPermitPlanningValidationMessage(input: PermitPlanningInput, requireCompletion: boolean) {
  if (!requireCompletion) return null;
  if (!input.publicRightOfWayRestrictionRequired) return 'Indicate whether the exclusion zone will restrict a public right-of-way.';
  if (input.publicRightOfWayRestrictionRequired === 'Yes' && !input.permitAuthorizationRequired) return 'Record the operator determination about whether a permit or authorization is required.';
  if (input.permitAuthorizationRequired === 'Yes' && (!input.permitIssuingAuthority.trim() || !input.permitAuthorizationNumber.trim() || !input.permitAuthorizationStatus)) return 'Issuing authority, permit or authorization number, and status are required when a permit is required.';
  return null;
}

export function getReadinessBlockingReasons(input: ReadinessPrerequisites) {
  return [
    !input.jhaComplete ? 'Complete the JHA.' : null,
    !input.safetyManagerReviewCurrent ? 'Current Safety Manager Review is required.' : null,
    !input.rpicAcceptanceCurrent ? 'Current RPIC JHA Acceptance is required.' : null,
    !input.controlsInPlace ? 'Confirm required controls are in place.' : null,
    !input.preflightComplete ? 'Complete the pre-flight checklist.' : null,
    !input.assignedRpicId ? 'Assign an active RPIC.' : null,
    !input.fitnessForDutyConfirmed ? 'The assigned RPIC must confirm fitness for duty.' : null,
    input.crewAcknowledgmentsCurrent === false ? 'Every assigned non-RPIC operational crew member needs a current Crew Briefing acknowledgment or Manual Field Briefing.' : null,
    input.permitAuthorizationRequired === true && input.permitAuthorizationStatus !== 'Approved'
      ? 'Required public right-of-way permit or authorization must be Approved.'
      : null,
  ].filter((reason): reason is string => Boolean(reason));
}

export function getOperationReadinessStatus(record: OperationReadinessRecord | null): OperationReadinessStatus {
  if (record?.approval_stale && record.approved_at) return 'Approval Stale';
  if (record?.approved_at && record.fitness_for_duty_confirmed) return 'Ready to Operate';
  return 'Not Ready';
}

export function isApprovalCurrent(record: OperationReadinessRecord | null, assignedRpicId: string | null) {
  return getOperationReadinessStatus(record) === 'Ready to Operate'
    && Boolean(assignedRpicId)
    && record?.rpic_personnel_id === assignedRpicId;
}

export function buildReadinessPacketRows(record: (OperationReadinessRecord & { rpic_name?: string | null; approved_by_name?: string | null; approved_by_user_id?: string | null }) | null, formatTimestamp = (value: string) => value): Array<[string, string]> {
  if (!record) return [['Ready to Operate', 'Not recorded (legacy or not yet approved)'], ['Fitness for Duty', 'Not confirmed']];
  const status = getOperationReadinessStatus(record);
  return [
    ['Ready to Operate', status],
    ['Fitness for Duty', record.fitness_for_duty_confirmed ? 'Confirmed' : 'Not confirmed'],
    ['Assigned RPIC', record.rpic_name || 'Personnel identity unavailable'],
    ['Approved By', record.approved_by_name || record.approved_by_user_id || 'Not recorded'],
    ['Approval Timestamp', record.approved_at ? formatTimestamp(record.approved_at) : 'Not recorded'],
    ['Current for Operation', status === 'Ready to Operate' ? 'Yes' : 'No'],
  ];
}
