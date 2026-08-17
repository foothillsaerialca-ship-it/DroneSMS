export function getAppUrl(path = '/') {
  const configuredUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  const baseUrl = configuredUrl || window.location.origin;
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

export function friendlyAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : '';

  if (message.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) return 'Please verify your email address before signing in.';
  if (message.includes('already registered') || message.includes('already been registered') || message.includes('user already exists')) return 'An account with this email address is already registered.';
  if (message.includes('expired') || message.includes('invalid') && (message.includes('token') || message.includes('link'))) return 'This password recovery link is invalid or has expired.';
  if (message.includes('same password')) return 'Choose a password that is different from your current password.';
  if (message.includes('password')) return 'The password could not be updated. Check the requirements and try again.';
  if (message.includes('email')) return 'The email request could not be completed. Check the address and try again.';
  return fallback;
}
