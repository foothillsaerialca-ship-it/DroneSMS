import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { checklistItems, checklistSections, emptyChecklistStates, getCompletionError, readChecklistStates, type ChecklistItemState, type ChecklistKey, type ChecklistStates } from '../lib/preflight-checklist';
const statusLabels = { Draft: 'Draft', Complete: 'Complete' } as const;

type ChecklistStatus = keyof typeof statusLabels;
type Job = { id: string; organization_id: string; name: string; service_type: string; location: string; planned_date: string | null; status: string };
type Checklist = { states: ChecklistStates; notes: string; status: ChecklistStatus };
type PreflightChecklistRow = Partial<Record<ChecklistKey, boolean>> & { id: string; checklist_states?: unknown; notes: string | null; status: string | null };
type ChecklistPayload = Record<ChecklistKey, boolean> & {
  checklist_states: ChecklistStates;
  job_id: string;
  organization_id: string;
  user_id: string;
  notes: string | null;
  status: ChecklistStatus;
  updated_at: string;
};

const emptyChecklist: Checklist = {
  states: emptyChecklistStates,
  notes: '',
  status: 'Draft'
};

function getErrorMessage(error: unknown, fallback = 'Unable to load the pre-flight checklist. Please try again.') {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message);
    if (message) return message;
  }

  return fallback;
}

function toChecklist(row: PreflightChecklistRow | null): Checklist {
  if (!row) return emptyChecklist;

  return {
    states: readChecklistStates(row.checklist_states, row),
    notes: row.notes ?? '',
    status: row.status === 'Complete' ? 'Complete' : 'Draft'
  };
}

function formatPlannedDate(plannedDate: string | null) {
  if (!plannedDate) return 'Not scheduled';
  const [year, month, day] = plannedDate.split('-');
  return year && month && day ? `${month}/${day}/${year}` : plannedDate;
}

export function PreflightChecklistPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [checklist, setChecklist] = useState<Checklist>(emptyChecklist);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const totalItems = useMemo(() => checklistItems.length, []);
  const completedItems = useMemo(() => checklistItems.filter(({ key }) => checklist.states[key] === 'confirmed' || checklist.states[key] === 'not_applicable').length, [checklist.states]);
  const completionPercent = Math.round((completedItems / totalItems) * 100);

  useEffect(() => {
    let isMounted = true;

    async function loadChecklist() {
      if (!jobId) {
        setLoadError('Missing job id.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('id, organization_id, name, service_type, location, planned_date, status')
          .eq('id', jobId)
          .maybeSingle();
        if (jobError) throw jobError;
        if (!jobData) throw new Error('Job not found.');

        const { data: checklistData, error: checklistError } = await supabase
          .from('preflight_checklists')
          .select('*')
          .eq('job_id', jobId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (checklistError) throw checklistError;
        if (!isMounted) return;

        setJob(jobData as Job);
        setChecklist(toChecklist(checklistData as PreflightChecklistRow | null));
      } catch (error) {
        if (isMounted) setLoadError(getErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadChecklist();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  function updateChecklist(key: ChecklistKey, state: ChecklistItemState) {
    setChecklist((current) => ({ ...current, states: { ...current.states, [key]: state }, status: 'Draft' }));
    setSaveMessage(null);
    setSaveError(null);
  }

  async function saveChecklist(status: ChecklistStatus) {
    if (!job) return;

    if (status === 'Complete') {
      const validationError = getCompletionError(checklist.states);
      if (validationError) {
        setSaveError(validationError);
        setSaveMessage(null);
        return;
      }
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to save a pre-flight checklist.');

      const payload: ChecklistPayload = {
        ...(Object.fromEntries(checklistItems.map(({ key }) => [key, checklist.states[key] === 'confirmed'])) as Record<ChecklistKey, boolean>),
        checklist_states: checklist.states,
        job_id: job.id,
        organization_id: job.organization_id,
        user_id: userData.user.id,
        notes: checklist.notes.trim() || null,
        status,
        updated_at: new Date().toISOString()
      };

      const { data: existingChecklist, error: existingChecklistError } = await supabase
        .from('preflight_checklists')
        .select('id')
        .eq('job_id', job.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingChecklistError) throw existingChecklistError;

      if (existingChecklist) {
        const { error } = await supabase.from('preflight_checklists').update(payload).eq('id', existingChecklist.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('preflight_checklists').insert(payload);
        if (error) throw error;
      }

      setChecklist((current) => ({
        ...current,
        states: payload.checklist_states,
        notes: payload.notes ?? '',
        status: payload.status
      }));
      setSaveMessage(status === 'Complete' ? 'Pre-flight checklist completed.' : 'Draft saved.');
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Unable to save the pre-flight checklist. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading pre-flight checklist...</section>;
  }

  if (loadError || !job) {
    return (
      <section className="space-y-4">
        <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={jobId ? `/jobs/${jobId}/hub` : '/jobs'}>
          Back to Job File
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h1 className="text-base font-semibold text-red-800">Unable to load pre-flight checklist</h1>
          <p className="mt-2 text-sm text-red-700">{loadError ?? 'Please try again.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-6">
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={`/jobs/${job.id}/hub`}>
        Back to Job File
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Pre-Flight Checklist</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{job.name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {job.service_type} • {job.location} • {formatPlannedDate(job.planned_date)}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {checklist.status}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{completedItems} of {totalItems} resolved</span>
            <span className="font-semibold text-brand-700">{completionPercent}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Checklist completion">
            <div className="h-full rounded-full bg-brand-700 transition-all" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </div>

      {saveError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{saveError}</div> : null}
      {saveMessage ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700" role="status">{saveMessage}</div> : null}

      {checklistSections.map((section) => (
        <fieldset key={section.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" disabled={isSaving}>
          <legend className="px-1 text-base font-semibold text-brand-900">{section.title}</legend>
          <div className="mt-3 space-y-3">
            {section.items.map(({ key, label }) => {
              const state = checklist.states[key];
              const tone = state === 'confirmed' ? 'border-green-200 bg-green-50' : state === 'not_applicable' ? 'border-slate-300 bg-slate-50' : state === 'not_confirmed' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50';
              return (
                <div key={key} className={`rounded-lg border p-3 ${tone}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
                      {([['confirmed', 'Confirmed'], ['not_confirmed', 'Not Confirmed'], ['not_applicable', 'Not Applicable']] as const).map(([value, text]) => (
                        <label key={value} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">
                          <input type="radio" name={key} value={value} checked={state === value} onChange={() => updateChecklist(key, value)} />
                          {text}
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">{state === 'confirmed' ? 'Confirmed' : state === 'not_confirmed' ? 'Not Confirmed — resolve before completion' : state === 'not_applicable' ? 'Not Applicable' : 'Unresolved — select a state'}</p>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <label className="block rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm sm:p-6">
        Notes
        <textarea
          className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
          value={checklist.notes}
          onChange={(event) => {
            setChecklist((current) => ({ ...current, notes: event.target.value }));
            setSaveMessage(null);
            setSaveError(null);
          }}
          disabled={isSaving}
          placeholder="Add aircraft, weather, airspace, or crew notes for this job."
        />
      </label>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <button className="min-h-11 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 sm:py-2" type="button" disabled={isSaving} onClick={() => void saveChecklist('Draft')}>
          {isSaving ? 'Saving...' : 'Save Draft'}
        </button>
        <button className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:py-2" type="button" disabled={isSaving} onClick={() => void saveChecklist('Complete')}>
          {isSaving ? 'Saving...' : 'Complete Checklist'}
        </button>
      </div>
    </section>
  );
}
