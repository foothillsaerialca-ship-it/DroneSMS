import { env } from '../lib/env';

export function SupabaseWarningBanner() {
  if (env.hasSupabaseConfig) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication.
    </div>
  );
}
