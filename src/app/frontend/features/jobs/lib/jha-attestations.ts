/**
 * File purpose: Provides jha attestations domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export type OperationalJhaAttestations = {
  safetyManagerReviewedAt: string | null;
  rpicAcceptedAt: string | null;
  safetyManagerReviewStale?: boolean;
  rpicAcceptanceStale?: boolean;
};

export type OperationalCompletionRequirements = {
  crewBriefed: boolean;
  controlsInPlace: boolean;
  safetyManagerReviewedAt: string | null;
  rpicAcceptedAt: string | null;
  safetyManagerReviewStale?: boolean;
  rpicAcceptanceStale?: boolean;
};

export function getOperationalCompletionMessages(requirements: OperationalCompletionRequirements) {
  const messages: string[] = [];
  if (!requirements.crewBriefed) messages.push('Confirm that the crew briefing was completed before marking the JHA complete.');
  if (!requirements.controlsInPlace) messages.push('Confirm that required controls are in place before marking the JHA complete.');
  if (!requirements.safetyManagerReviewedAt || requirements.safetyManagerReviewStale) {
    messages.push(requirements.safetyManagerReviewStale ? 'Safety Manager re-review is required before marking the JHA complete.' : 'Safety Manager Review is required before marking the JHA complete.');
  }
  if (!requirements.rpicAcceptedAt || requirements.rpicAcceptanceStale) {
    messages.push(requirements.rpicAcceptanceStale ? 'RPIC re-acceptance is required before marking the JHA complete.' : 'RPIC Acceptance is required before marking the JHA complete.');
  }
  return messages;
}

export function operationalAttestationStatus(timestamp: string | null, stale: boolean, completedLabel: string, staleLabel: string, pendingLabel: string) {
  if (timestamp && stale) return staleLabel;
  return timestamp ? completedLabel : pendingLabel;
}

export function operationalRoleLabel(isSafetyManager: boolean, isRpic: boolean) {
  if (isSafetyManager && isRpic) return 'Safety Manager / RPIC';
  if (isSafetyManager) return 'Safety Manager';
  return isRpic ? 'RPIC' : '';
}

/**
 * Implements record operational attestation for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
export function recordOperationalAttestation(
  current: OperationalJhaAttestations,
  role: 'safety-manager' | 'rpic',
  timestamp: string
): OperationalJhaAttestations {
  return role === 'safety-manager'
    ? { ...current, safetyManagerReviewedAt: timestamp, safetyManagerReviewStale: false }
    : { ...current, rpicAcceptedAt: timestamp, rpicAcceptanceStale: false };
}
