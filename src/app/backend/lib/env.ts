function loadEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_APP_URL'): string {
  // Return the raw import.meta.env value or empty string when not provided.
  return (import.meta.env[name] as string) ?? '';
}

export function getEnv() {
  return {
    supabaseUrl: loadEnv('VITE_SUPABASE_URL'),
    supabaseAnonKey: loadEnv('VITE_SUPABASE_ANON_KEY'),
    appUrl: loadEnv('VITE_APP_URL')
  };
}

export function isSupabaseConfigured() {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  return Boolean(supabaseUrl && supabaseAnonKey);
}
