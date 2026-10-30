/**
 * File purpose: Decides which company onboarding state applies to the current auth session.
 * Fallback/error behavior: A result that was not resolved for the signed-in user reports 'loading', never 'missing' or 'incomplete'.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import type { AuthStatus, ProfileState } from '../types/auth-context';

/**
 * Purpose: Pairs a resolved onboarding state with the user it was resolved for.
 * Fallback/error behavior: userId is null for states that belong to no signed-in user (signed out or not yet checked).
 */
export type ProfileResult = {
  userId: string | null;
  state: ProfileState;
  error: string | null;
};

/**
 * Returns the onboarding state for the current session, treating a result resolved for no user or another user as still loading.
 * Fallback/error behavior: Signed-out and loading sessions pass the stored result through; route guards check auth status first.
 */
export function getSessionProfileState(
  status: AuthStatus,
  sessionUserId: string | null,
  result: ProfileResult
): { profileState: ProfileState; profileError: string | null } {
  if (status === 'authenticated' && result.userId !== sessionUserId) {
    return { profileState: 'loading', profileError: null };
  }
  return { profileState: result.state, profileError: result.error };
}
