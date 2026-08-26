/**
 * File purpose: Provides jha attestations domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export type OperationalJhaAttestations = {
  safetyManagerReviewedAt: string | null;
  rpicAcceptedAt: string | null;
};

/**
 * Implements operational role label for this module.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
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
    ? { ...current, safetyManagerReviewedAt: timestamp }
    : { ...current, rpicAcceptedAt: timestamp };
}
