/**
 * File purpose: Defines the types TypeScript contracts shared by dependent modules.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];
