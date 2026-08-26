/**
 * File purpose: Provides sms defaults domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export const DEFAULT_STOP_WORK_AUTHORITY_STATEMENT =
  'Every crew member has the authority and responsibility to immediately stop work whenever an unsafe condition, unforeseen hazard, equipment malfunction, regulatory concern, or environmental risk is identified. Operations will not resume until the hazard has been evaluated and appropriate controls have been implemented or the risk has been reduced to an acceptable level.';

export const DEFAULT_HAZARD_REPORTING_STATEMENT =
  'All personnel are expected to promptly report hazards, near misses, equipment deficiencies, procedural concerns, and safety observations. Hazard reports are used to improve operations through corrective action and continuous learning, not to assign blame. Timely reporting supports a proactive safety culture and strengthens operational decision-making.';

export const DEFAULT_EMERGENCY_PROCEDURES_SUMMARY =
  'In the event of an emergency, operations shall cease immediately. Personnel will prioritize the protection of life, notify emergency services when required, secure the operating area, and preserve the scene when appropriate. The Remote Pilot in Command will document the event, notify affected parties as required, and initiate post-event review and corrective actions before operations resume.';

/**
 * Implements default sms value for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
export function defaultSmsValue(value: unknown, fallback: string) {
  const text = String(value ?? '');
  return text.trim() ? text : fallback;
}
