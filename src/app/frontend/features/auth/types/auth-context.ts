/**
 * File purpose: Defines the auth context TypeScript contracts shared by dependent modules.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import type { Session } from '@supabase/supabase-js';

/**
 * Purpose: Defines the auth status data contract used by the auth context module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Purpose: Represents the complete profile state used by the auth context workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
export type ProfileState = 'loading' | 'missing' | 'incomplete' | 'complete' | 'error';

/**
 * Purpose: Defines the auth context value data contract used by the auth context module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profileState: ProfileState;
  profileError: string | null;
  refreshProfileState: () => Promise<void>;
};
