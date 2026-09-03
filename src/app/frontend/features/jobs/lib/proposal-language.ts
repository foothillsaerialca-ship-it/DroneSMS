export const OPERATIONAL_PERSONNEL_ROLES = new Set([
  'RPIC',
  'Pilot',
  'Visual Observer',
  'Payload Operator',
  'Ground Crew',
]);

export type ProposalOperationalPersonnel = {
  personnelId?: string | null;
  name?: string | null;
  role?: string | null;
};

export function resolveProposalRpic(
  assignments: ProposalOperationalPersonnel[],
  proposalRpic: { personnelId?: string | null; name?: string | null },
) {
  const assignedRpic = assignments.find((assignment) => assignment.role === 'RPIC');
  if (assignedRpic) {
    return {
      name: assignedRpic.name?.trim() ?? '',
      usesProposalSnapshot: Boolean(
        proposalRpic.personnelId
        && assignedRpic.personnelId === proposalRpic.personnelId,
      ),
    };
  }

  // An empty assignment set means there is no live job data to supersede the
  // proposal snapshot. A non-empty set without an RPIC must not be combined
  // with the historical RPIC identity.
  return {
    name: assignments.length ? '' : proposalRpic.name?.trim() ?? '',
    usesProposalSnapshot: assignments.length === 0,
  };
}

export function buildProposalPersonnelLanguage(assignments: ProposalOperationalPersonnel[]) {
  const operationalPeople = new Set(
    assignments
      .filter((assignment) => OPERATIONAL_PERSONNEL_ROLES.has(assignment.role ?? ''))
      .map((assignment, index) => assignment.personnelId?.trim() || assignment.name?.trim() || `assignment-${index}`),
  );
  const isCrewed = operationalPeople.size >= 2;

  return {
    isCrewed,
    executiveSummaryQualification: (rpicName: string, organizationName: string) => rpicName
      ? isCrewed
        ? `${rpicName}, FAA Part 107 certificated Remote Pilot in Command, will lead the field operation with the assigned crew operating under ${organizationName}'s documented Safety Management System.`
        : `${rpicName}, FAA Part 107 certificated Remote Pilot in Command, will conduct the field operation under ${organizationName}'s documented Safety Management System.`
      : isCrewed
        ? `The assigned FAA Part 107 certificated Remote Pilot in Command will lead the field operation with the assigned crew operating under ${organizationName}'s documented Safety Management System.`
        : `The assigned FAA Part 107 certificated Remote Pilot in Command will conduct the field operation under ${organizationName}'s documented Safety Management System.`,
    siteSetup: isCrewed
      ? 'Establish the operating/staging area, verify equipment readiness, conduct crew briefing, and implement site controls appropriate to the operating environment.'
      : 'Establish the operating/staging area, verify equipment readiness, and implement site controls appropriate to the operating environment.',
    conditionsVerification: isCrewed
      ? 'The crew verifies current conditions before flight and coordinates with the client when conditions change.'
      : 'The operator verifies current conditions before flight and coordinates with the client when conditions change.',
    personnelHelper: 'Personnel assignments are confirmed before scheduling and matched to the site requirements.',
  };
}
