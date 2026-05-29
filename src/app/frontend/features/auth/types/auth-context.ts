import type { Session } from '@supabase/supabase-js';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type ProfileState = 'loading' | 'missing' | 'incomplete' | 'complete' | 'error';

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profileState: ProfileState;
  profileError: string | null;
  refreshProfileState: () => Promise<void>;
};
