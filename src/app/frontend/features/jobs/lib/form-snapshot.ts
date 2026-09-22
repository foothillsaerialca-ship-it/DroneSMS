/**
 * File purpose: Compacts form values into a JSON-safe key/value snapshot for document provenance.
 * Fallback/error behavior: Empty values and unsupported values are omitted; meaningful false and zero values are retained.
 */
function compactFormSnapshot(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() ? value : undefined;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    const compacted = value.map(compactFormSnapshot).filter((item) => item !== undefined);
    return compacted.length ? compacted : undefined;
  }

  const compacted = Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, item]) => {
    const compactedItem = compactFormSnapshot(item);
    if (compactedItem !== undefined) result[key] = compactedItem;
    return result;
  }, {});
  return Object.keys(compacted).length ? compacted : undefined;
}

export function createFormSnapshot(formData: Record<string, unknown>) {
  const snapshot = compactFormSnapshot(formData);
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown>
    : {};
}
