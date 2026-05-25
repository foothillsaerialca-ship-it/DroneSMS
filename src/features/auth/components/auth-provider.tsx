import { type PropsWithChildren, createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import type { AuthContextValue, AuthStatus, ProfileState } from '../types/auth-context';

export const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to check company onboarding status.';
}

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

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
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
