import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../lib/env';

const hasValidSupabaseUrl = typeof env.supabaseUrl === 'string' && /^https?:\/\//.test(env.supabaseUrl);
const hasValidSupabaseKey = typeof env.supabaseAnonKey === 'string' && env.supabaseAnonKey.length > 0;

let supabase: SupabaseClient | null = null;

if (env.hasSupabaseConfig && hasValidSupabaseUrl && hasValidSupabaseKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
}

export { supabase };
