import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { HazardLibrarySelector } from '../../safety/components/hazard-library-selector';
import { type HazardLibraryRecord } from '../../safety/lib/hazard-library';
import { loadHazardLibrary } from '../../safety/lib/hazard-library-service';

type Review = {
  id: string; source_type: 'Custom Hazard' | 'Safety Event'; source_job_id: string; safety_event_id: string | null;
  hazard_name_snapshot: string | null; description_snapshot: string | null; category_snapshot: string | null;
  mitigations_snapshot: string[]; rpic_name_snapshot: string | null; created_at: string; status: 'Pending' | 'Reviewed'; resolution: string | null;
  jobs: { name: string } | null; job_safety_events: { category: string; description: string; immediate_actions_taken: string | null; outcome: string } | null;
};
type Mode = 'create' | 'link' | 'none';

const blankForm = { name: '', description: '', category: '', mitigations: [''] };

export function SafetyReviewArea({ organizationId }: { organizationId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [library, setLibrary] = useState<HazardLibraryRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<Mode>('create');
  const [form, setForm] = useState(blankForm);
  const [linkedHazardId, setLinkedHazardId] = useState('');
  const [newMitigation, setNewMitigation] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!organizationId) return;
    const [reviewResult, libraryResult] = await Promise.all([
      supabase.from('hazard_library_reviews').select('*, jobs(name), job_safety_events(category, description, immediate_actions_taken, outcome)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      loadHazardLibrary()
    ]);
    if (reviewResult.error || libraryResult.error) return setError(reviewResult.error?.message || libraryResult.error?.message || 'Unable to load reviews.');
    setReviews((reviewResult.data || []) as unknown as Review[]);
    setLibrary((libraryResult.data || []) as HazardLibraryRecord[]);
  }

  useEffect(() => { void load(); }, [organizationId]);
  const selected = reviews.find((review) => review.id === selectedId) ?? null;
  const pendingCustom = reviews.filter((review) => review.status === 'Pending' && review.source_type === 'Custom Hazard');
  const pendingEvents = reviews.filter((review) => review.status === 'Pending' && review.source_type === 'Safety Event');

  function openReview(review: Review) {
    setSelectedId(review.id); setMode(review.source_type === 'Custom Hazard' ? 'create' : 'none'); setLinkedHazardId(''); setNewMitigation(''); setFeedback(null); setError(null);
    setForm({ name: review.hazard_name_snapshot || '', description: review.description_snapshot || '', category: review.category_snapshot || '', mitigations: review.mitigations_snapshot.length ? review.mitigations_snapshot : [''] });
  }

  async function recordAction(actionType: string, hazardId: string | null, mitigation: string | null) {
    if (!selected) return;
    const { data: user } = await supabase.auth.getUser();
    const { error: actionError } = await supabase.from('hazard_library_review_actions').insert({ review_id: selected.id, hazard_id: hazardId, action_type: actionType, mitigation_added: mitigation, performed_by: user.user?.id || null });
    if (actionError) throw actionError;
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setBusy(true); setError(null); setFeedback(null);
    try {
      if (mode === 'create') {
        const mitigations = form.mitigations.map((item) => item.trim()).filter(Boolean);
        if (!form.name.trim() || !form.category.trim() || !mitigations.length) throw new Error('Hazard name, category, and at least one mitigation are required.');
        if (library.some((hazard) => hazard.hazard_name.trim().toLowerCase() === form.name.trim().toLowerCase())) throw new Error('A hazard with this name already exists. Use Link to Existing to avoid a duplicate.');
        const { data, error: insertError } = await supabase.from('hazard_library').insert({ organization_id: organizationId, hazard_name: form.name.trim(), description: form.description.trim() || null, category: form.category.trim(), default_mitigation: mitigations[0], mitigations, is_system_hazard: false, source_review_id: selected.id }).select('id').single();
        if (insertError) throw insertError;
        await recordAction('Created Hazard', String(data.id), null);
        setFeedback('Hazard added to the organizational Hazard Library. The source record was not changed.');
      } else if (mode === 'link') {
        if (!linkedHazardId) throw new Error('Select an existing hazard.');
        const hazard = library.find((item) => item.id === linkedHazardId);
        const mitigation = newMitigation.trim();
        if (mitigation && hazard && !hazard.mitigations.some((item) => item.toLowerCase() === mitigation.toLowerCase())) {
          const { error: updateError } = await supabase.from('hazard_library').update({ mitigations: [...hazard.mitigations, mitigation], updated_at: new Date().toISOString() }).eq('id', linkedHazardId);
          if (updateError) throw updateError;
          await recordAction('Added Mitigation', linkedHazardId, mitigation);
        }
        await recordAction('Linked Hazard', linkedHazardId, null);
        setFeedback('Review linked to the existing hazard. Existing mitigations were preserved.');
      } else {
        await completeReview('No Library Action', null);
        return;
      }
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save the review action.'); } finally { setBusy(false); }
  }

  async function completeReview(resolution = 'No Library Action', hazardId: string | null = null) {
    if (!selected) return; setBusy(true); setError(null);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (resolution === 'No Library Action') await recordAction('No Library Action', null, null);
      const { error: updateError } = await supabase.from('hazard_library_reviews').update({ status: 'Reviewed', resolution, resolved_hazard_id: hazardId, reviewed_by: user.user?.id || null, reviewed_at: new Date().toISOString() }).eq('id', selected.id);
      if (updateError) throw updateError;
      setFeedback('Safety Manager Review completed. Safety Event closure, when applicable, remains separate.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to complete review.'); } finally { setBusy(false); }
  }

  const list = (title: string, items: Review[]) => <section><div className="flex items-center justify-between"><h3 className="font-semibold text-brand-900">{title}</h3><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{items.length} pending</span></div><div className="mt-3 space-y-2">{items.length ? items.map((review) => <button key={review.id} type="button" onClick={() => openReview(review)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-brand-300"><span className="block font-medium text-slate-900">{review.hazard_name_snapshot || review.job_safety_events?.category || review.source_type}</span><span className="mt-1 block text-xs text-slate-500">{review.jobs?.name || 'Operation'} · {new Date(review.created_at).toLocaleDateString()}</span></button>) : <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">No pending reviews.</p>}</div></section>;

  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium uppercase tracking-wide text-brand-700">Safety Assurance</p><h2 className="text-lg font-semibold text-brand-900">Safety Manager Review</h2><p className="mt-1 text-sm text-slate-600">Review operational learning before it becomes reusable organizational knowledge.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">{pendingCustom.length + pendingEvents.length} pending</span></div><div className="mt-5 grid gap-5 md:grid-cols-2">{list('Custom Hazard Reviews', pendingCustom)}{list('Safety Event Reviews', pendingEvents)}</div>
    {selected ? <form className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4" onSubmit={submitAction}><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-brand-900">{selected.source_type}</h3><p className="text-sm text-slate-600">Source: {selected.jobs?.name || 'Operation'}{selected.rpic_name_snapshot ? ` · RPIC: ${selected.rpic_name_snapshot}` : ''}</p></div><div className="flex gap-3"><Link className="text-sm font-semibold text-brand-700" to={`/jobs/${selected.source_job_id}/hub${selected.safety_event_id ? '#safety-events' : ''}`}>Open source</Link><button type="button" className="text-sm text-slate-600" onClick={() => setSelectedId('')}>Close</button></div></div>
      {selected.job_safety_events ? <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700"><p>{selected.job_safety_events.description}</p>{selected.job_safety_events.immediate_actions_taken ? <p className="mt-2"><b>Immediate actions:</b> {selected.job_safety_events.immediate_actions_taken}</p> : null}<p className="mt-2 text-xs font-semibold uppercase text-slate-500">Outcome: {selected.job_safety_events.outcome}</p></div> : null}
      <fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-800">Hazard Library Action</legend><div className="mt-2 flex flex-wrap gap-2">{(['create', 'link', 'none'] as Mode[]).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === value ? 'bg-brand-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{value === 'create' ? selected.source_type === 'Custom Hazard' ? 'Add / Edit & Add' : 'Create New Hazard' : value === 'link' ? 'Link to Existing' : 'No Library Action'}</button>)}</div></fieldset>
      {mode === 'create' ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Hazard name" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} /><Field label="Category" value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} /><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Description<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-2" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>{form.mitigations.map((mitigation, index) => <div key={index} className="sm:col-span-2"><Field label={`Mitigation ${index + 1}`} value={mitigation} onChange={(value) => setForm((current) => ({ ...current, mitigations: current.mitigations.map((item, itemIndex) => itemIndex === index ? value : item) }))} /></div>)}<button type="button" className="w-fit text-sm font-semibold text-brand-700" onClick={() => setForm((current) => ({ ...current, mitigations: [...current.mitigations, ''] }))}>+ Add mitigation</button></div> : null}
      {mode === 'link' ? <div className="mt-4 grid gap-3"><HazardLibrarySelector hazards={library} value={linkedHazardId} onChange={setLinkedHazardId} disabled={busy} /><Field label="Optional new mitigation learned" value={newMitigation} onChange={setNewMitigation} /></div> : null}
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}{feedback ? <p className="mt-3 text-sm text-emerald-700" role="status">{feedback}</p> : null}<div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">{mode === 'none' ? 'Record No Library Action' : 'Save Library Action'}</button>{mode !== 'none' ? <button type="button" disabled={busy} onClick={() => void completeReview(mode === 'link' ? 'Linked to Existing' : 'Added to Hazard Library', mode === 'link' ? linkedHazardId || null : null)} className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700">Complete Review</button> : null}</div><p className="mt-2 text-xs text-slate-500">Library actions do not close a Safety Event. Complete the review separately after all needed hazards have been created or linked.</p></form> : null}
  </article>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
