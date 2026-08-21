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

const appliedMaterialServiceTerms = [
  'clean', 'wash', 'softwash', 'soft wash', 'spray', 'application', 'applicator',
  'agricultur', 'pesticide', 'herbicide', 'fertilizer', 'treatment', 'coating'
];

/** Central capability check keeps service-aware behavior reusable as service labels evolve. */
export function serviceUsesAppliedMaterials(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  return appliedMaterialServiceTerms.some((term) => normalized.includes(term));
}
