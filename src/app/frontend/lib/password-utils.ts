/**
 * File purpose: Provides password utils domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export interface PasswordRequirements {
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

/**
 * Implements validate password requirements for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
export function validatePasswordRequirements(password: string): PasswordRequirements {
  return {
    hasMinLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
}

/**
 * Determines are all requirements met for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function areAllRequirementsMet(requirements: PasswordRequirements): boolean {
  return (
    requirements.hasMinLength &&
    requirements.hasUpperCase &&
    requirements.hasNumber &&
    requirements.hasSpecialChar
  );
}
