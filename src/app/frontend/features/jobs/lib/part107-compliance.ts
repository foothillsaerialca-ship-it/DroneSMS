export function isPart107ReportableEvent(input: {
  seriousInjury: boolean;
  lossOfConsciousness: boolean;
  nonSuasPropertyDamageCostUsd: number | null;
  propertyTotalLoss: boolean;
  propertyFairMarketValueUsd: number | null;
}) {
  return input.seriousInjury
    || input.lossOfConsciousness
    || (input.propertyTotalLoss
      ? (input.propertyFairMarketValueUsd ?? 0) > 500
      : (input.nonSuasPropertyDamageCostUsd ?? 0) > 500);
}

export function getPart107ReportDeadline(occurredAt: string) {
  const date = new Date(`${occurredAt}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 10);
  return date.toISOString().slice(0, 10);
}

export function requiresPart107AtcAuthorization(
  airspaceClass: string | null,
  classESurfaceAuthorizationRequired: boolean,
) {
  return ['B', 'C', 'D'].includes(airspaceClass ?? '')
    || (airspaceClass === 'E' && classESurfaceAuthorizationRequired);
}

export function isPart107WeatherMinimumMet(input: {
  visibilityStatuteMiles: number | null;
  cloudClearanceBelowFeet: number | null;
  cloudHorizontalDistanceFeet: number | null;
}) {
  return input.visibilityStatuteMiles !== null
    && input.visibilityStatuteMiles >= 3
    && input.cloudClearanceBelowFeet !== null
    && input.cloudClearanceBelowFeet >= 500
    && input.cloudHorizontalDistanceFeet !== null
    && input.cloudHorizontalDistanceFeet >= 2000;
}
