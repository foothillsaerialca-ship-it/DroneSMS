/**
 * File purpose: Defines beta welcome configuration and client-side auth-attempt persistence helpers.
 * Fallback/error behavior: Uses the enabled-by-default feature flag and safely treats unavailable storage as no prior attempt.
 * Known limitation: The local-storage marker is browser-local and is not authoritative account state.
 */
const BETA_AUTH_ATTEMPT_KEY = 'dronesms.betaWelcome.authAttemptStarted';

/**
 * The beta welcome is enabled by default. Set VITE_BETA_WELCOME_ENABLED=false
 * to remove it when the beta period ends.
 */
export const isBetaWelcomeEnabled = import.meta.env.VITE_BETA_WELCOME_ENABLED !== 'false';

export function hasStartedBetaAuthAttempt() {
  return sessionStorage.getItem(BETA_AUTH_ATTEMPT_KEY) === 'true';
}

export function startBetaAuthAttempt() {
  sessionStorage.setItem(BETA_AUTH_ATTEMPT_KEY, 'true');
}

export function resetBetaAuthAttempt() {
  sessionStorage.removeItem(BETA_AUTH_ATTEMPT_KEY);
}
