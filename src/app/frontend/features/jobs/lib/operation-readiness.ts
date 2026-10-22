/**
 * File purpose: Computes operational readiness status, blocking reasons, approval freshness, and packet rows.
 * Fallback/error behavior: Missing prerequisites produce a not-ready result with actionable blocking reasons.
 * Known limitation: The module evaluates supplied snapshots and does not fetch or mutate operational records.
 */
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

/** Operations closed out without flying do not need a Ready to Operate approval. */
export const resultsAllowedWithoutReadiness = new Set(['Aborted', 'Delayed']);

/** Equipment statuses that mean the item is not available to fly. */
export const unavailableEquipmentStatuses = new Set(['Maintenance', 'Inactive', 'Retired']);

export function closeoutRequiresReadiness(operationResult: string) {
  return !resultsAllowedWithoutReadiness.has(operationResult);
}

export type ReadinessCrewMember = {
  personnelId: string;
  name: string;
  assignedRole: string;
  part107CertificateNumber: string | null;
  part107ExpirationDate: string | null;
  trainingExpirationDate: string | null;
};

export type ReadinessEquipmentItem = {
  equipmentId: string;
  name: string;
  equipmentType: string | null;
  status: string | null;
  faaRegistrationNumber: string | null;
  maintenanceDueDate: string | null;
};

export type ReadinessOverrideType = 'maintenance_overdue' | 'training_expired';

export type ReadinessOverrideRecord = {
  item_type: ReadinessOverrideType;
  item_id: string;
  item_date: string;
  item_name: string;
  reason: string;
  approved_by_name: string;
  approved_at: string;
};

export type OverridableReadinessIssue = {
  itemType: ReadinessOverrideType;
  itemId: string;
  itemName: string;
  itemDate: string;
  label: string;
  override: ReadinessOverrideRecord | null;
};

/**
 * Mirrors the crew and equipment checks in confirm_job_ready_to_operate. Blocking issues cannot be
 * overridden; overridable issues need a Safety Manager override that matches the record's current date.
 * Dates are ISO yyyy-mm-dd strings compared against `today` in UTC, matching the database's current_date.
 */
export function getResourceReadinessIssues(
  crew: ReadinessCrewMember[],
  equipment: ReadinessEquipmentItem[],
  overrides: ReadinessOverrideRecord[],
  today: string,
) {
  const blocking: string[] = [];
  const overridable: OverridableReadinessIssue[] = [];
  const findOverride = (itemType: ReadinessOverrideType, itemId: string, itemDate: string) =>
    overrides.find((record) => record.item_type === itemType && record.item_id === itemId && record.item_date === itemDate) ?? null;

  for (const member of crew) {
    if (member.assignedRole === 'RPIC' && (!member.part107CertificateNumber?.trim() || !member.part107ExpirationDate || member.part107ExpirationDate < today)) {
      blocking.push(`${member.name} (RPIC) needs a current Part 107 certificate number and expiration date in Personnel.`);
    }
  }
  for (const item of equipment) {
    if (item.status && unavailableEquipmentStatuses.has(item.status)) {
      blocking.push(`${item.name} is marked ${item.status}. Remove it from the job or update its status.`);
    }
    if (item.equipmentType === 'Drone' && !item.faaRegistrationNumber?.trim()) {
      blocking.push(`${item.name} needs an FAA registration number in Equipment.`);
    }
  }

  for (const item of equipment) {
    if (item.maintenanceDueDate && item.maintenanceDueDate < today) {
      overridable.push({ itemType: 'maintenance_overdue', itemId: item.equipmentId, itemName: item.name, itemDate: item.maintenanceDueDate,
        label: `${item.name} is overdue for maintenance (due ${item.maintenanceDueDate}).`, override: findOverride('maintenance_overdue', item.equipmentId, item.maintenanceDueDate) });
    }
  }
  const seenPeople = new Set<string>();
  for (const member of crew) {
    if (seenPeople.has(member.personnelId)) continue;
    seenPeople.add(member.personnelId);
    if (member.trainingExpirationDate && member.trainingExpirationDate < today) {
      overridable.push({ itemType: 'training_expired', itemId: member.personnelId, itemName: member.name, itemDate: member.trainingExpirationDate,
        label: `${member.name}'s training expired on ${member.trainingExpirationDate}.`, override: findOverride('training_expired', member.personnelId, member.trainingExpirationDate) });
    }
  }

  return {
    blocking,
    overridable,
    pendingOverrideReasons: overridable.filter((issue) => !issue.override).map((issue) => `${issue.label} A Safety Manager override is required.`),
  };
}
