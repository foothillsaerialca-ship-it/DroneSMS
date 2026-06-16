export interface PasswordRequirements {
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export function validatePasswordRequirements(password: string): PasswordRequirements {
  return {
    hasMinLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
}

export function areAllRequirementsMet(requirements: PasswordRequirements): boolean {
  return (
    requirements.hasMinLength &&
    requirements.hasUpperCase &&
    requirements.hasNumber &&
    requirements.hasSpecialChar
  );
}
