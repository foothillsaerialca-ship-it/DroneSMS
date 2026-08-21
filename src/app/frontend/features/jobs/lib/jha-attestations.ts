export type OperationalJhaAttestations = {
  safetyManagerReviewedAt: string | null;
  rpicAcceptedAt: string | null;
};

export function operationalRoleLabel(isSafetyManager: boolean, isRpic: boolean) {
  if (isSafetyManager && isRpic) return 'Safety Manager / RPIC';
  if (isSafetyManager) return 'Safety Manager';
  return isRpic ? 'RPIC' : '';
}

export function recordOperationalAttestation(
  current: OperationalJhaAttestations,
  role: 'safety-manager' | 'rpic',
  timestamp: string
): OperationalJhaAttestations {
  return role === 'safety-manager'
    ? { ...current, safetyManagerReviewedAt: timestamp }
    : { ...current, rpicAcceptedAt: timestamp };
}
