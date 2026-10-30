/**
 * File purpose: Decides whether a JHA save would change the stored assessment row.
 * Fallback/error behavior: any value that cannot be shown equal (type differences, extra keys, missing rows) counts as a change, so the caller writes.
 * Known issues: numeric columns returned as strings by the API compare as changed and are rewritten once, which matches the pre-check behavior.
 */

/**
 * Compares two JSON-compatible values structurally. Object key order is ignored and undefined
 * object members are treated as absent, matching how JSON and jsonb columns round-trip.
 * Fallback/error behavior: values of different types are unequal.
 */
export function jsonValuesEqual(first: unknown, second: unknown): boolean {
  if (first === undefined) first = null;
  if (second === undefined) second = null;
  if (first === second) return true;
  if (first === null || second === null || typeof first !== 'object' || typeof second !== 'object') return false;
  if (Array.isArray(first) || Array.isArray(second)) {
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
    return first.every((item, index) => jsonValuesEqual(item, second[index]));
  }
  const firstRecord = first as Record<string, unknown>;
  const secondRecord = second as Record<string, unknown>;
  const keys = new Set([...Object.keys(firstRecord), ...Object.keys(secondRecord)]);
  for (const key of keys) {
    if (!jsonValuesEqual(firstRecord[key], secondRecord[key])) return false;
  }
  return true;
}

/**
 * Returns true when every column the page would write already holds the same value in the stored row.
 * Fallback/error behavior: a missing stored row always needs a write.
 */
export function assessmentRecordMatchesStored(record: Record<string, unknown>, stored: Record<string, unknown> | null) {
  if (!stored) return false;
  return Object.keys(record).every((column) => jsonValuesEqual(record[column], stored[column]));
}
