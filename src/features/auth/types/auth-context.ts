import type { Session } from '@supabase/supabase-js';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type ProfileState = 'loading' | 'missing' | 'incomplete' | 'complete';

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profileState: ProfileState;
  refreshProfileState: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ errorMessage: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ errorMessage: string | null }>;
  signOut: () => Promise<void>;
};
