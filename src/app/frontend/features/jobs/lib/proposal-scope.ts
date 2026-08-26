/**
 * File purpose: Provides proposal scope domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export type ProposalScopeDefaults = {
  deliverables: string;
  exclusions: string;
};

/**
 * Purpose: Maps scope defaults values to the canonical metadata consumed by proposal scope.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const scopeDefaults: Record<string, ProposalScopeDefaults> = {
  'cleaning operations': {
    deliverables: 'Completed exterior cleaning of identified surfaces.\nBefore/after photographic documentation where applicable.\nMission completion summary.',
    exclusions: 'Interior surfaces.\nRepairs to damaged glazing, panels, seals, roofing, or building components.\nWork requiring access methods outside the accepted scope.'
  },
  'thermal inspection': {
    deliverables: 'Thermal imagery captured during the operation.\nAnnotated findings summary.\nMission completion summary.',
    exclusions: 'Engineering analysis.\nRepair design or corrective work.\nDestructive testing or invasive investigation.'
  },
  agricultural: {
    deliverables: 'Treatment completion documentation.\nFlight operation summary.\nMission completion summary.',
    exclusions: 'Agronomic recommendations.\nCrop performance guarantees.\nTreatment efficacy guarantees.\nChemical or material selection unless expressly included in the accepted scope.'
  },
  'mapping / surveying': {
    deliverables: 'Map, model, or survey output identified in the accepted scope.\nFlight operation summary.\nMission completion summary.',
    exclusions: 'Licensed land surveying unless expressly included.\nEngineering certification.\nBoundary determinations or legal descriptions.'
  },
  'construction progress': {
    deliverables: 'Progress imagery captured during the operation.\nOrganized photo or video documentation.\nMission completion summary.',
    exclusions: 'Construction inspection.\nCode compliance determination.\nEngineering analysis or certification.'
  },
  'real estate / property media': {
    deliverables: 'Photo and/or video media captured during the operation.\nEdited media files identified in the accepted scope.\nMission completion summary.',
    exclusions: 'Marketing strategy.\nAdvertising placement.\nInterior media unless expressly included.'
  }
};

/**
 * Purpose: Maps inspection defaults values to the canonical metadata consumed by proposal scope.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const inspectionDefaults: ProposalScopeDefaults = {
  deliverables: 'Visual documentation captured during the operation.\nAnnotated findings summary where applicable.\nMission completion summary.',
  exclusions: 'Engineering analysis.\nRepair design or corrective work.\nDestructive testing or invasive investigation.'
};

/**
 * Purpose: Maps custom operation defaults values to the canonical metadata consumed by proposal scope.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const customOperationDefaults: ProposalScopeDefaults = {
  deliverables: 'Documentation of completed work prepared according to the accepted scope and site conditions.\nMission completion summary.',
  exclusions: 'Work not expressly included in the accepted scope.\nAdditional site requirements or scope changes unless approved in writing.'
};

/**
 * Computes get proposal scope defaults for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function getProposalScopeDefaults(serviceType: string | null | undefined): ProposalScopeDefaults {
  const normalizedServiceType = serviceType?.trim().toLowerCase() ?? '';
  if (!normalizedServiceType) return customOperationDefaults;
  if (scopeDefaults[normalizedServiceType]) return scopeDefaults[normalizedServiceType];
  if (normalizedServiceType.includes('thermal')) return scopeDefaults['thermal inspection'];
  if (normalizedServiceType.includes('inspection')) return inspectionDefaults;
  return customOperationDefaults;
}


/**
 * Determines is proposal scope field customized for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function isProposalScopeFieldCustomized(
  value: string | null | undefined,
  serviceType: string | null | undefined,
  field: keyof ProposalScopeDefaults
) {
  return (value ?? '') !== getProposalScopeDefaults(serviceType)[field];
}

/**
 * Determines has customized proposal scope for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function hasCustomizedProposalScope(
  values: Pick<ProposalScopeDefaults, 'deliverables' | 'exclusions'>,
  serviceType: string | null | undefined
) {
  return (
    isProposalScopeFieldCustomized(values.deliverables, serviceType, 'deliverables') ||
    isProposalScopeFieldCustomized(values.exclusions, serviceType, 'exclusions')
  );
}
