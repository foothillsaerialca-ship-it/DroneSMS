/**
 * File purpose: Loads hazard-library records through the Supabase data-access boundary.
 * Fallback/error behavior: Supabase errors are returned to the calling page for user-visible handling.
 * Known limitation: Record visibility is limited by the database RLS policies for the current user.
 */
import { supabase } from '../../../lib/supabase';

/** Loads every Hazard Library record made available to the user by Supabase RLS. */
export async function loadHazardLibrary() {
  return supabase
    .from('hazard_library')
    .select('id, hazard_name, category, default_mitigation, mitigations, service_types, is_universal, is_system_hazard')
    .order('hazard_name');
}
