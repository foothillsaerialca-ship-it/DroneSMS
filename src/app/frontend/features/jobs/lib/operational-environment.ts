/**
 * File purpose: Provides operational environment domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export const environmentalConcernCategories = [
  'Wildlife or nesting activity',
  'Sensitive / protected area',
  'Water body / wetland',
  'Runoff',
  'Fire conditions / dry vegetation',
  'Applied material / chemical',
  'Spill / release concern',
  'Other'
] as const;

/**
 * Purpose: Stores the shared applied material service terms structure used by the operational environment module.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const appliedMaterialServiceTerms = [
  'clean', 'wash', 'softwash', 'soft wash', 'spray', 'application', 'applicator',
  'agricultur', 'pesticide', 'herbicide', 'fertilizer', 'treatment', 'coating'
];

/** Central capability check keeps service-aware behavior reusable as service labels evolve. */
export function serviceUsesAppliedMaterials(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  return appliedMaterialServiceTerms.some((term) => normalized.includes(term));
}
