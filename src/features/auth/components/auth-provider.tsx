import { type PropsWithChildren, createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import type { AuthContextValue, AuthStatus, ProfileState } from '../types/auth-context';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [profileState, setProfileState] = useState<ProfileState>('loading');

  const refreshProfileState = useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      setProfileState('missing');
      return;
    }

    setProfileState('loading');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, company_name')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !data) {
      setProfileState('missing');
      return;
    }

    setProfileState(data.company_name ? 'complete' : 'incomplete');
  }, [session?.user?.id]);

  const signInWithPassword = useCallback<AuthContextValue['signInWithPassword']>(async (email, password) => {
    if (!supabase) return { errorMessage: 'Supabase is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { errorMessage: error?.message ?? null };
  }, []);

  const signUpWithPassword = useCallback<AuthContextValue['signUpWithPassword']>(async (email, password) => {
    if (!supabase) return { errorMessage: 'Supabase is not configured.' };
    const { error } = await supabase.auth.signUp({ email, password });
    return { errorMessage: error?.message ?? null };
  }, []);

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setStatus('unauthenticated');
      setProfileState('missing');
      return;
    }

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

    setProfileState('missing');
  }, [status, refreshProfileState]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profileState, refreshProfileState, signInWithPassword, signUpWithPassword, signOut }),
    [status, session, profileState, refreshProfileState, signInWithPassword, signUpWithPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
