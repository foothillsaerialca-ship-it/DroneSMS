export const operationalCrewRoles = ['Pilot', 'Visual Observer', 'Payload Operator', 'Ground Crew'] as const;

export type CrewBriefingEvidence = {
  assignment_id: string;
  assigned_role?: string;
  briefing_version: number;
  status: 'Invited' | 'Sent' | 'Acknowledged' | 'Manual Field Briefing' | 'Superseded' | 'Email Failed';
  acknowledged_at?: string | null;
  field_briefed_at?: string | null;
};

export type OperationalAssignment = {
  id: string;
  assigned_role: string;
  personnel: { id: string; full_name: string; email?: string | null; status?: string | null } | null;
};

export function requiredCrewAssignments(assignments: OperationalAssignment[]) {
  return assignments.filter((assignment) => assignment.personnel?.status !== 'Inactive'
    && (operationalCrewRoles as readonly string[]).includes(assignment.assigned_role));
}

export function currentCrewEvidence(assignment: OperationalAssignment, evidence: CrewBriefingEvidence[], briefingVersion: number) {
  return evidence.find((record) => record.assignment_id === assignment.id && record.briefing_version === briefingVersion
    && (!record.assigned_role || record.assigned_role === assignment.assigned_role)
    && (record.status === 'Acknowledged' || record.status === 'Manual Field Briefing')) ?? null;
}

export function crewAcknowledgmentsCurrent(assignments: OperationalAssignment[], evidence: CrewBriefingEvidence[], briefingVersion: number) {
  return requiredCrewAssignments(assignments).every((assignment) => Boolean(currentCrewEvidence(assignment, evidence, briefingVersion)));
}

export function crewBriefingStatus(assignment: OperationalAssignment, evidence: CrewBriefingEvidence[], briefingVersion: number) {
  if (assignment.assigned_role === 'RPIC') return 'RPIC Accepted';
  const records = evidence.filter((record) => record.assignment_id === assignment.id);
  const current = records.find((record) => record.briefing_version === briefingVersion && (!record.assigned_role || record.assigned_role === assignment.assigned_role) && !['Superseded', 'Email Failed'].includes(record.status));
  if (current?.status === 'Acknowledged' || current?.status === 'Manual Field Briefing' || current?.status === 'Sent') return current.status;
  if (records.some((record) => record.status === 'Acknowledged' || record.status === 'Manual Field Briefing')) return 'Stale';
  return 'Not Sent';
}

export function validateManualFieldBriefing(reason: string, otherReason: string, attested: boolean) {
  const reasons = ['No internet/cellular service', 'Crew member unable to access email', 'Device/access issue', 'Other'];
  if (!reasons.includes(reason)) return 'Select why electronic acknowledgment was unavailable.';
  if (reason === 'Other' && !otherReason.trim()) return 'Enter a short explanation.';
  if (!attested) return 'The RPIC attestation is required.';
  return null;
}

export function crewAcknowledgmentSendErrorMessage() {
  return 'Crew acknowledgment could not be sent. Please check the crew member’s email address and try again.';
}
