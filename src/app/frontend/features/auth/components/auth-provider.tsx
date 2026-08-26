/**
 * File purpose: Provides the reusable auth provider React component and its local interaction behavior.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { type PropsWithChildren, createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';
import type { AuthContextValue, AuthStatus, ProfileState } from '../types/auth-context';

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
 * Renders the auth provider interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [profileState, setProfileState] = useState<ProfileState>('loading');
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfileState = useCallback(async () => {
    if (!session?.user?.id) {
      setProfileError(null);
      setProfileState('missing');
      return;
    }

    setProfileError(null);
    setProfileState('loading');

    try {
      const { data: profile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('id, company_name, organization_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileLookupError) throw profileLookupError;

      if (profile?.organization_id) {
        const { data: linkedOrganization, error: linkedOrganizationError } = await supabase
          .from('organizations')
          .select('id')
          .eq('id', profile.organization_id)
          .maybeSingle();

        if (linkedOrganizationError) throw linkedOrganizationError;

        if (linkedOrganization) {
          setProfileState('complete');
          return;
        }
      }

      const { data: ownedOrganizations, error: organizationLookupError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('owner_user_id', session.user.id)
        .limit(1);

      if (organizationLookupError) throw organizationLookupError;

      const organization = ownedOrganizations?.[0];

      if (!organization) {
        setProfileState('incomplete');
        return;
      }

      const { error: profileUpsertError } = await supabase.from('profiles').upsert(
        {
          id: session.user.id,
          organization_id: organization.id,
          company_name: profile?.company_name || organization.name,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

      if (profileUpsertError) throw profileUpsertError;

      setProfileState('complete');
    } catch (error) {
      setProfileError(getErrorMessage(error));
      setProfileState('error');
    }
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

    setProfileError(null);
    setProfileState('missing');
  }, [status, refreshProfileState]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profileState, profileError, refreshProfileState }),
    [status, session, profileState, profileError, refreshProfileState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
