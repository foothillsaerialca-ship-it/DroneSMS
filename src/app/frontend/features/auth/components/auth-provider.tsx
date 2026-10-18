/**
 * File purpose: Provides the reusable auth provider React component and its local interaction behavior.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { type PropsWithChildren, createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';
import { type ProfileResult, getSessionProfileState } from '../lib/profile-state';
import type { AuthContextValue, AuthStatus } from '../types/auth-context';

/**
 * Purpose: Stores the shared auth context structure used by the auth provider module.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Computes get error message for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to check company onboarding status.';
}

/**
 * Looks up whether the user's company onboarding is complete, relinking an owned organization when the profile link is missing.
 * Fallback/error behavior: Lookup failures are thrown so callers report an error state instead of treating the profile as missing.
 */
async function lookUpProfileState(userId: string): Promise<'complete' | 'incomplete'> {
  const { data: profile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id, company_name, organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  if (profile?.organization_id) {
    const { data: linkedOrganization, error: linkedOrganizationError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', profile.organization_id)
      .maybeSingle();

    if (linkedOrganizationError) throw linkedOrganizationError;

    if (linkedOrganization) return 'complete';
  }

  const { data: ownedOrganizations, error: organizationLookupError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', userId)
    .limit(1);

  if (organizationLookupError) throw organizationLookupError;

  const organization = ownedOrganizations?.[0];

  if (!organization) return 'incomplete';

  const { error: profileUpsertError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      organization_id: organization.id,
      company_name: profile?.company_name || organization.name,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (profileUpsertError) throw profileUpsertError;

  return 'complete';
}

/**
 * Renders the auth provider interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  // The resolved onboarding state is tagged with the user it was resolved for, so a
  // restored session is never judged by a result that belongs to no user or another user.
  const [profileResult, setProfileResult] = useState<ProfileResult>({ userId: null, state: 'loading', error: null });
  const profileRequestId = useRef(0);

  const refreshProfileState = useCallback(async () => {
    const userId = session?.user?.id ?? null;
    const requestId = ++profileRequestId.current;

    if (!userId) {
      setProfileResult({ userId: null, state: 'missing', error: null });
      return;
    }

    setProfileResult({ userId, state: 'loading', error: null });

    let result: ProfileResult;
    try {
      result = { userId, state: await lookUpProfileState(userId), error: null };
    } catch (error) {
      result = { userId, state: 'error', error: getErrorMessage(error) };
    }

    // A newer lookup, sign-out, or user change superseded this request.
    if (requestId !== profileRequestId.current) return;
    setProfileResult(result);
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;

    /**
     * Implements initialize auth for this module.
     * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
     */
    async function initializeAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(data.session);
        setStatus(data.session ? 'authenticated' : 'unauthenticated');
      } catch {
        if (!isMounted) return;
        setSession(null);
        setStatus('unauthenticated');
      }
    }

    initializeAuth();

    let authListenerSubscription: { unsubscribe: () => void } | null = null;
    try {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      });
      authListenerSubscription = authListener.subscription;
    } catch {
      authListenerSubscription = null;
    }

    return () => {
      isMounted = false;
      authListenerSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      void refreshProfileState();
      return;
    }

    profileRequestId.current += 1;
    setProfileResult({ userId: null, state: 'missing', error: null });
  }, [status, refreshProfileState]);

  const { profileState, profileError } = getSessionProfileState(status, session?.user?.id ?? null, profileResult);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profileState, profileError, refreshProfileState }),
    [status, session, profileState, profileError, refreshProfileState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
