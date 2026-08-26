/**
 * Performs load env for the surrounding workflow.
 * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
 */
function loadEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_APP_URL'): string {
  // Return the raw import.meta.env value or empty string when not provided.
  return (import.meta.env[name] as string) ?? '';
}

/**
 * Computes get env for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function getEnv() {
  return {
    supabaseUrl: loadEnv('VITE_SUPABASE_URL'),
    supabaseAnonKey: loadEnv('VITE_SUPABASE_ANON_KEY'),
    appUrl: loadEnv('VITE_APP_URL')
  };
}

/**
 * Determines is supabase configured for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
export function isSupabaseConfigured() {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  return Boolean(supabaseUrl && supabaseAnonKey);
}
