/**
 * File purpose: Loads Management of Change records, actions, activity, and organization identities for Excel exports.
 * Fallback/error behavior: Query failures throw so the calling page can show an error instead of downloading an incomplete workbook.
 * Known limitation: Data is read with the signed-in user's RLS permissions; all reads are paged to avoid the API row cap.
 */
import { supabase } from '../../../lib/supabase';
import type { MocExportActivity, MocExportAction, MocExportData, MocExportPersonnel, MocExportRecord } from './moc-export';

const PAGE_SIZE = 1000;
const MOC_EXPORT_SELECT = '*,operational_capabilities(name,status),equipment(name,make,model),job_safety_events(category,description,outcome,immediate_actions_taken,created_at)';

type PagedQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function loadAllPages<T>(query: PagedQuery<T>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Loads organization context and the people who can appear on MOC records. */
export async function loadMocExportContext() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('You must be signed in to export Management of Change records.');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (profileError || !profile?.organization_id) throw new Error(profileError?.message || 'Organization setup is required.');
  const organizationId = String(profile.organization_id);
  const [organizationResult, personnelResult, designationResult] = await Promise.all([
    supabase.from('organizations').select('name,owner_user_id').eq('id', organizationId).single(),
    // All statuses are loaded so people who have since left still resolve on historical records.
    supabase.from('personnel').select('id,user_id,full_name,role,email,status').eq('organization_id', organizationId),
    supabase.from('organization_safety_designations').select('personnel_id').eq('organization_id', organizationId).maybeSingle(),
  ]);
  const error = organizationResult.error || personnelResult.error || designationResult.error;
  if (error) throw new Error(error.message);
  return {
    organizationName: String(organizationResult.data?.name || 'Organization'),
    organizationOwnerUserId: (organizationResult.data?.owner_user_id as string | null) ?? null,
    safetyManagerPersonnelId: (designationResult.data?.personnel_id as string | null) ?? null,
    currentUser: { id: user.id, email: user.email ?? null },
    personnel: (personnelResult.data ?? []) as MocExportPersonnel[],
  };
}

/** Loads everything needed for an export: one MOC when mocId is given, otherwise every MOC visible to the organization. */
export async function loadMocExportData(mocId?: string): Promise<MocExportData> {
  const [context, mocs, actions, activity] = await Promise.all([
    loadMocExportContext(),
    loadAllPages<MocExportRecord>((from, to) => {
      const query = supabase.from('management_of_change').select(MOC_EXPORT_SELECT);
      return (mocId ? query.eq('id', mocId) : query).order('moc_number').range(from, to) as unknown as PromiseLike<{ data: MocExportRecord[] | null; error: { message: string } | null }>;
    }),
    loadAllPages<MocExportAction>((from, to) => {
      const query = supabase.from('management_of_change_actions').select('id,moc_id,description,owner_id,due_date,required_before_operational_use,status,completion_date,notes_or_evidence,created_at');
      return (mocId ? query.eq('moc_id', mocId) : query).order('created_at').order('id').range(from, to);
    }),
    loadAllPages<MocExportActivity>((from, to) => {
      const query = supabase.from('management_of_change_activity').select('id,moc_id,action,details,performed_by,created_at');
      return (mocId ? query.eq('moc_id', mocId) : query).order('created_at').order('id').range(from, to) as unknown as PromiseLike<{ data: MocExportActivity[] | null; error: { message: string } | null }>;
    }),
  ]);
  if (mocId && !mocs.length) throw new Error('This Management of Change record could not be found.');
  return { ...context, mocs, actions, activity };
}
