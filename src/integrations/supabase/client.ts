import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../lib/env';

let supabase: SupabaseClient | null = null;

if (env.hasSupabaseConfig && env.supabaseUrl && env.supabaseAnonKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
}

export { supabase };
