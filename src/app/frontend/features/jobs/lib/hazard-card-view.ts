/**
 * File purpose: Client-side view helpers for the JHA hazard list: search matching and per-hazard expand/collapse state.
 * Fallback/error behavior: an empty or whitespace-only query matches every hazard; hazards without an explicit expansion choice use the default for when they appeared.
 * Known issues: view state only; nothing here reads or writes stored hazard data.
 */

export type HazardSearchFields = { description: string; category: string; mitigation: string };
/** Explicit expand (true) or collapse (false) choices keyed by hazard id. */
export type HazardExpansionOverrides = Record<string, boolean>;

/**
 * Case-insensitive match of the query against hazard name/description, category, and mitigation text.
 * Fallback/error behavior: a blank query matches every hazard.
 */
export function hazardMatchesSearch(entry: HazardSearchFields, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.description, entry.category, entry.mitigation].some((value) => (value ?? '').toLowerCase().includes(needle));
}

/**
 * Hazards present when the list opened start collapsed; hazards added afterwards start expanded.
 * An explicit choice for the hazard id takes precedence over either default.
 */
export function isHazardExpanded(id: string, overrides: HazardExpansionOverrides, initialIds: ReadonlySet<string>) {
  return overrides[id] ?? !initialIds.has(id);
}

/** Records the same expansion choice for each listed hazard id, leaving other ids unchanged. */
export function setHazardsExpanded(overrides: HazardExpansionOverrides, ids: readonly string[], expanded: boolean): HazardExpansionOverrides {
  return { ...overrides, ...Object.fromEntries(ids.map((id) => [id, expanded])) };
}

/** Drops the expansion choice for a removed hazard id. */
export function withoutHazardExpansion(overrides: HazardExpansionOverrides, id: string): HazardExpansionOverrides {
  if (!(id in overrides)) return overrides;
  const rest = { ...overrides };
  delete rest[id];
  return rest;
}

/**
 * Lists the required fields the JHA completion check would reject for this hazard. Mirrors validateForm in
 * job-hazard-analysis-page.tsx: hazards with neither a description nor a mitigation are skipped by that check,
 * and every other hazard needs a description, category, and mitigation.
 * Fallback/error behavior: returns an empty list when the hazard would pass or is skipped.
 */
export function getMissingRequiredHazardFields(entry: HazardSearchFields): string[] {
  const description = (entry.description ?? '').trim();
  const mitigation = (entry.mitigation ?? '').trim();
  if (!description && !mitigation) return [];
  return [!description ? 'description' : '', !(entry.category ?? '').trim() ? 'category' : '', !mitigation ? 'mitigation' : ''].filter(Boolean);
}
