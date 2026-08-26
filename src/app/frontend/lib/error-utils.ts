/**
 * File purpose: Provides the shared generic error-message fallback used by workflows without a domain-specific message.
 * Fallback/error behavior: native `Error` messages are preserved and all other values use a stable user-facing fallback.
 * Known issues: structured service errors that are not `Error` instances require a domain-specific normalizer.
 */

/** Returns a native error message or the generic retry instruction for unknown values. */
export function getGenericErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
