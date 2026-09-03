import { type FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/components/use-auth';
import { SafetyReviewArea } from '../components/safety-review-area';
import { SafetyAssuranceArea } from '../components/safety-assurance-area';

type Member = { id: string; full_name: string };
const pillars = [
  { title: 'Safety Policy & Objectives', items: ['Safety Policy Statement', 'Safety Objectives'] },
  { title: 'Safety Risk Management', items: ['Hazard Identification & Control Planning', 'Controls-in-Place Verification'] },
  { title: 'Safety Assurance', items: ['Internal Audit Program', 'Corrective Action Process'] },
  { title: 'Safety Promotion', items: ['Training Program Summary', 'Safety Meeting Frequency'] }
] as const;

export function SmsPage() {
  const { session } = useAuth();
  const [organizationId, setOrganizationId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [smsLanguage, setSmsLanguage] = useState({ stopWork: '', hazardReporting: '', emergencyProcedures: '' });
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!session?.user.id) return;
      setLoading(true);
      const { data: profile, error: profileError } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
      if (profileError || !profile?.organization_id) { if (mounted) { setError(profileError?.message || 'Organization setup is required.'); setLoading(false); } return; }
      const organizationId = String(profile.organization_id);
      const [organizationResult, membersResult, designationResult] = await Promise.all([
        supabase.from('organizations').select('owner_user_id, stop_work_authority_statement, hazard_reporting_statement, emergency_procedures_summary').eq('id', organizationId).single(),
        supabase.from('personnel').select('id, full_name').eq('organization_id', organizationId).eq('status', 'Active').order('full_name'),
        supabase.from('organization_safety_designations').select('personnel_id').eq('organization_id', organizationId).maybeSingle()
      ]);
      const loadError = organizationResult.error || membersResult.error || designationResult.error;
      if (mounted) {
        setOrganizationId(organizationId);
        setCanManage(organizationResult.data?.owner_user_id === session.user.id);
        setSmsLanguage({
          stopWork: String(organizationResult.data?.stop_work_authority_statement || ''),
          hazardReporting: String(organizationResult.data?.hazard_reporting_statement || ''),
          emergencyProcedures: String(organizationResult.data?.emergency_procedures_summary || '')
        });
        setMembers((membersResult.data || []) as Member[]);
        setSelectedId(String(designationResult.data?.personnel_id || ''));
        setError(loadError?.message || null);
        setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [session?.user.id]);

  async function saveDesignation(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !selectedId || !session?.user.id) return setError('Select an active organization member.');
    setSaving(true); setError(null); setMessage(null);
    const { error } = await supabase.from('organization_safety_designations').upsert({ organization_id: organizationId, personnel_id: selectedId, designated_by: session.user.id, designated_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
    setSaving(false);
    if (error) return setError(error.message);
    setMessage('Safety Manager saved.');
  }

  async function saveProgramLanguage(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setSaving(true); setError(null); setMessage(null);
    const { error } = await supabase.from('organizations').update({
      stop_work_authority_statement: smsLanguage.stopWork.trim() || null,
      hazard_reporting_statement: smsLanguage.hazardReporting.trim() || null,
      emergency_procedures_summary: smsLanguage.emergencyProcedures.trim() || null,
      updated_at: new Date().toISOString()
    }).eq('id', organizationId);
    setSaving(false);
    if (error) return setError(error.message);
    setMessage('SMS program language saved.');
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header><p className="text-sm font-medium uppercase tracking-wide text-brand-700">Safety Management System</p><h1 className="mt-1 text-2xl font-semibold text-brand-900">SMS Program</h1><p className="mt-2 text-sm text-slate-600">Manage the organization’s safety responsibilities and program across the four SMS pillars.</p></header>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{message}</p> : null}
      <SafetyReviewArea organizationId={organizationId} />
      <SafetyAssuranceArea organizationId={organizationId} />
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-brand-900">Safety Manager Configuration</h2><p className="mt-1 text-sm text-slate-600">Designate an active organization member responsible for SMS review and safety oversight.</p>
        {loading ? <p className="mt-4 text-sm text-slate-500">Loading Safety Manager...</p> : <form className="mt-4 space-y-3" onSubmit={saveDesignation}><label className="block text-sm font-medium text-slate-700">Safety Manager<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base sm:py-2 sm:text-sm" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!canManage || saving}><option value="">Select an active member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name} — Safety Manager</option>)}</select></label>{canManage ? <button className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400" disabled={saving || !selectedId}>{saving ? 'Saving...' : 'Save Designation'}</button> : <p className="text-sm text-slate-500">Only the organization owner can change this designation.</p>}</form>}
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-brand-900">Safety Policy &amp; Objectives</h2><p className="mt-1 text-sm text-slate-600">Existing organization SMS language remains connected to the organization record.</p>
        <form className="mt-4 space-y-4" onSubmit={saveProgramLanguage}>{[
          ['stopWork', 'Stop-Work Authority Statement'],
          ['hazardReporting', 'Hazard Reporting Statement'],
          ['emergencyProcedures', 'Emergency Procedures Summary']
        ].map(([key, label]) => <label key={key} className="block text-sm font-medium text-slate-700">{label}<textarea className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100" value={smsLanguage[key as keyof typeof smsLanguage]} onChange={(event) => setSmsLanguage((current) => ({ ...current, [key]: event.target.value }))} disabled={!canManage || saving} /></label>)}
          {canManage ? <button className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400" disabled={saving}>{saving ? 'Saving...' : 'Save SMS Language'}</button> : <p className="text-sm text-slate-500">Only the organization owner can edit SMS program language.</p>}
        </form>
      </article>
      <div className="grid gap-4 sm:grid-cols-2">{pillars.map((pillar) => <article key={pillar.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-brand-900">{pillar.title}</h2><div className="mt-3 space-y-2">{pillar.items.map((item) => <div key={item} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"><span className="text-sm text-slate-700">{item}</span><span className="shrink-0 text-xs font-semibold uppercase text-slate-400">Coming Soon</span></div>)}</div></article>)}</div>
    </section>
  );
}
