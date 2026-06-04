import bcrypt from 'bcryptjs';

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

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}
