/**
 * File purpose: Provides shared organization-membership lookups for authenticated feature pages.
 * Fallback/error behavior: users without a profile organization return `null`; Supabase query failures propagate to the page handler.
 * Known issues: this lookup does not perform the owned-organization recovery used by the new-job workflow.
 */
import { supabase } from '@frontend/lib/supabase';

/**
 * Loads the organization currently linked to a user's profile.
 * Fallback/error behavior: missing profile or organization data returns `null`; query errors are thrown.
 */
export async function getCurrentOrganizationId(userId: string) {
  const { data, error } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.organization_id ?? null;
}
