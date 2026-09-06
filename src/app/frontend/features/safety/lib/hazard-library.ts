/**
 * File purpose: Defines reusable hazard-library record types and search/normalization helpers.
 * Fallback/error behavior: Missing or malformed optional values are normalized to safe display defaults.
 * Known limitation: Library records are data contracts; authorization and persistence remain outside this module.
 */
export type HazardLibraryRecord = {
  id: string;
  hazard_name: string;
  category: string;
  default_mitigation: string;
  mitigations: string[];
  service_types: string[];
  is_universal: boolean;
  is_system_hazard: boolean;
};

export function searchHazardLibrary(hazards: HazardLibraryRecord[], query: string) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return hazards;

  return hazards.filter((hazard) => {
    const searchableText = [
      hazard.hazard_name,
      hazard.category,
      hazard.default_mitigation,
      ...(hazard.service_types || [])
    ].join(' ').toLocaleLowerCase();
    return terms.every((term) => searchableText.includes(term));
  });
}
