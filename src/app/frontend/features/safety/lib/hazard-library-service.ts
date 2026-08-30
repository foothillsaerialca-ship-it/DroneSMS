import { supabase } from '../../../lib/supabase';

/** Loads every Hazard Library record made available to the user by Supabase RLS. */
export async function loadHazardLibrary() {
  return supabase
    .from('hazard_library')
    .select('id, hazard_name, category, default_mitigation, mitigations, service_types, is_universal, is_system_hazard')
    .order('hazard_name');
}
