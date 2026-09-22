/**
 * File purpose: Provides sms defaults domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export {
  DEFAULT_EMERGENCY_PROCEDURES_SUMMARY,
  DEFAULT_HAZARD_REPORTING_STATEMENT,
  DEFAULT_STOP_WORK_AUTHORITY_STATEMENT,
} from "./default-content";

/**
 * Implements default sms value for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
export function defaultSmsValue(value: unknown, fallback: string) {
  const text = String(value ?? "");
  return text.trim() ? text : fallback;
}
