/**
 * File purpose: Provides the token-based crew briefing acknowledgment page for invited crew members.
 * Fallback/error behavior: Invalid, expired, or already-used tokens are shown as user-visible page errors.
 * Known limitation: The page depends on the acknowledgment endpoint and cannot validate a token offline.
 */
import { type FormEvent, useEffect, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';

type Briefing = {
  already_acknowledged: boolean;
  operation: { name: string; site: string; planned_date: string };
  recipient: { name: string; role: string };
  rpic: string;
  crew: Array<{ name: string; role: string }>;
  briefing: { scope?: string; hazards?: Array<{ description?: string; mitigation?: string; hazard?: string; control?: string }>; ppe?: unknown; communications?: string; emergency_facility?: string; emergency_facility_address?: string; emergency_contact?: string; emergency_actions?: string; site_constraints?: string; exclusion_zone?: string; airspace_restrictions?: string };
};

function Value({ value, fallback = 'Not recorded' }: { value: unknown; fallback?: string }) {
  const display = typeof value === 'string' ? value : value ? JSON.stringify(value) : '';
  return <p className="mt-1 whitespace-pre-wrap text-slate-700">{display || fallback}</p>;
}

export function CrewBriefingAcknowledgmentPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [typedName, setTypedName] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void (async () => {
    const { data, error: loadError } = await supabase.rpc('get_public_crew_briefing', { p_token: token });
    if (loadError) setError(loadError.message); else setBriefing(data as Briefing);
  })(); }, [token]);

  async function acknowledge(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!reviewed) { setError('Confirm that you reviewed the full briefing before acknowledging.'); return; }
    if (!typedName.trim()) { setError('Type your full name.'); return; }
    setSaving(true);
    const { error: saveError } = await supabase.rpc('acknowledge_public_crew_briefing', { p_token: token, p_typed_name: typedName.trim() });
    setSaving(false);
    if (saveError) setError(saveError.message); else setBriefing((current) => current ? { ...current, already_acknowledged: true } : current);
  }

  if (error && !briefing) return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-bold text-brand-900">DroneSMS Crew Briefing</h1><p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p></main>;
  if (!briefing) return <main className="mx-auto max-w-xl p-6"><p>Loading secure crew briefing…</p></main>;
  const details = briefing.briefing;
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
    <header><p className="font-semibold uppercase tracking-wide text-brand-700">DroneSMS</p><h1 className="mt-1 text-3xl font-bold text-brand-900">Crew Briefing Acknowledgment</h1><p className="mt-2 text-slate-600">This acknowledgment follows the in-person briefing conducted by the RPIC.</p></header>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{briefing.operation.name}</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2"><div><dt className="font-medium">Site</dt><dd>{briefing.operation.site || 'Not recorded'}</dd></div><div><dt className="font-medium">Planned date</dt><dd>{briefing.operation.planned_date || 'Not recorded'}</dd></div><div><dt className="font-medium">Assigned RPIC</dt><dd>{briefing.rpic || 'Not recorded'}</dd></div><div><dt className="font-medium">Acknowledging crew member</dt><dd>{briefing.recipient.name} — {briefing.recipient.role}</dd></div></dl></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Operational crew and roles</h2><ul className="mt-2 list-disc pl-5">{briefing.crew.map((person, index) => <li key={`${person.name}-${person.role}-${index}`}>{person.name} — {person.role}</li>)}</ul></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Full operation briefing</h2><div className="mt-4 space-y-4"><div><h3 className="font-medium">Operation scope</h3><Value value={details.scope} /></div><div><h3 className="font-medium">Hazards and controls / mitigations</h3>{details.hazards?.length ? <ul className="mt-2 space-y-2">{details.hazards.map((hazard, index) => <li key={index} className="rounded bg-slate-50 p-3"><strong>{hazard.description || hazard.hazard || 'Hazard'}</strong><Value value={hazard.mitigation || hazard.control} /></li>)}</ul> : <Value value={null} />}</div><div><h3 className="font-medium">PPE and controls</h3><Value value={details.ppe} /></div><div><h3 className="font-medium">Communications procedures</h3><Value value={details.communications} /></div><div><h3 className="font-medium">Emergency planning and actions</h3><Value value={[details.emergency_facility, details.emergency_facility_address, details.emergency_contact, details.emergency_actions].filter(Boolean).join('\n')} /></div><div><h3 className="font-medium">Site and operational constraints</h3><Value value={[details.site_constraints, details.exclusion_zone, details.airspace_restrictions].filter(Boolean).join('\n')} /></div></div></section>
    {briefing.already_acknowledged ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">Already acknowledged. Your acknowledgment is recorded with the operation.</p> : <form className="rounded-xl border bg-white p-5" onSubmit={acknowledge}><p className="text-slate-700">I acknowledge that I participated in the crew briefing for this operation and reviewed the full briefing, including assigned roles and responsibilities, identified hazards and controls, communications procedures, emergency actions, and operational constraints.</p><label className="mt-4 flex gap-3"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>I reviewed the full operation briefing shown above.</span></label><label className="mt-4 block font-medium">Typed Full Name<input className="mt-1 w-full rounded-lg border px-3 py-2" value={typedName} onChange={(event) => setTypedName(event.target.value)} autoComplete="name" required /></label>{error ? <p className="mt-3 text-red-700">{error}</p> : null}<button className="mt-4 rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white disabled:bg-slate-400" disabled={saving || !reviewed || !typedName.trim()}>{saving ? 'Recording…' : 'Acknowledge Briefing'}</button></form>}
  </main>;
}
