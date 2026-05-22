import type { Session } from '@supabase/supabase-js';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type ProfileState = 'missing' | 'incomplete' | 'complete';

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profileState: ProfileState;
  refreshProfileState: () => Promise<void>;
};
