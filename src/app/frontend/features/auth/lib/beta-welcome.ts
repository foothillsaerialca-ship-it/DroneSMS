/**
 * File purpose: Defines beta welcome configuration and client-side auth-attempt persistence helpers.
 * Fallback/error behavior: Safely treats unavailable storage as no prior attempt.
 * Whether the beta welcome is shown is an admin-managed app setting; see useBetaWelcomeEnabled in features/admin/lib/app-settings.
 * Known limitation: The local-storage marker is browser-local and is not authoritative account state.
 */
const BETA_AUTH_ATTEMPT_KEY = 'dronesms.betaWelcome.authAttemptStarted';

export function hasStartedBetaAuthAttempt() {
  return sessionStorage.getItem(BETA_AUTH_ATTEMPT_KEY) === 'true';
}

export function startBetaAuthAttempt() {
  sessionStorage.setItem(BETA_AUTH_ATTEMPT_KEY, 'true');
}

export function resetBetaAuthAttempt() {
  sessionStorage.removeItem(BETA_AUTH_ATTEMPT_KEY);
}
