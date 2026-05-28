import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

type ChecklistKey =
  | 'aircraft_selected'
  | 'battery_condition_checked'
  | 'propellers_inspected'
  | 'firmware_app_status_checked'
  | 'gps_signal_confirmed'
  | 'home_point_verified'
  | 'storage_media_checked'
  | 'weather_verified'
  | 'wind_conditions_acceptable'
  | 'airspace_reviewed'
  | 'laanc_confirmed_if_required'
  | 'notam_tfr_checked'
  | 'visual_observer_assigned_if_needed'
  | 'emergency_procedures_reviewed'
  | 'crew_communications_confirmed'
  | 'final_rpic_approval';

type ChecklistItem = { key: ChecklistKey; label: string };

const sections: { title: string; items: ChecklistItem[] }[] = [
  {
    title: 'Aircraft & Equipment',
    items: [
      { key: 'aircraft_selected', label: 'Aircraft selected' },
      { key: 'battery_condition_checked', label: 'Battery condition checked' },
      { key: 'propellers_inspected', label: 'Propellers inspected' },
      { key: 'firmware_app_status_checked', label: 'Firmware/app status checked' },
      { key: 'gps_signal_confirmed', label: 'GPS/signal confirmed' },
      { key: 'home_point_verified', label: 'Home point verified' },
      { key: 'storage_media_checked', label: 'Storage/media checked' }
    ]
  },
  {
    title: 'Environment & Airspace',
    items: [
      { key: 'weather_verified', label: 'Weather verified' },
      { key: 'wind_conditions_acceptable', label: 'Wind conditions acceptable' },
      { key: 'airspace_reviewed', label: 'Airspace reviewed' },
      { key: 'laanc_confirmed_if_required', label: 'LAANC confirmed if required' },
      { key: 'notam_tfr_checked', label: 'NOTAM/TFR checked' }
    ]
  },
  {
    title: 'Crew & Safety',
    items: [
      { key: 'visual_observer_assigned_if_needed', label: 'Visual observer assigned if needed' },
      { key: 'emergency_procedures_reviewed', label: 'Emergency procedures reviewed' },
      { key: 'crew_communications_confirmed', label: 'Crew communications confirmed' },
      { key: 'final_rpic_approval', label: 'Final RPIC approval' }
    ]
  }
];

const allItems = sections.flatMap((section) => section.items);

const requiredForCompletion: ChecklistKey[] = ['weather_verified', 'airspace_reviewed', 'final_rpic_approval'];
const statusLabels = { Draft: 'Draft', Complete: 'Complete' } as const;

type ChecklistStatus = keyof typeof statusLabels;
type Job = { id: string; organization_id: string; name: string; service_type: string; location: string; planned_date: string | null; status: string };
type Checklist = Record<ChecklistKey, boolean> & { notes: string; status: ChecklistStatus };
type PreflightChecklistRow = Partial<Record<ChecklistKey, boolean>> & { notes: string | null; status: string | null };

const emptyChecklist: Checklist = {
  aircraft_selected: false,
  battery_condition_checked: false,
  propellers_inspected: false,
  firmware_app_status_checked: false,
  gps_signal_confirmed: false,
  home_point_verified: false,
  storage_media_checked: false,
  weather_verified: false,
  wind_conditions_acceptable: false,
  airspace_reviewed: false,
  laanc_confirmed_if_required: false,
  notam_tfr_checked: false,
  visual_observer_assigned_if_needed: false,
  emergency_procedures_reviewed: false,
  crew_communications_confirmed: false,
  final_rpic_approval: false,
  notes: '',
  status: 'Draft'
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load the pre-flight checklist. Please try again.';
}

function toChecklist(row: PreflightChecklistRow | null): Checklist {
  if (!row) return emptyChecklist;

  return {
    ...emptyChecklist,
    ...Object.fromEntries(allItems.map(({ key }) => [key, Boolean(row[key])])),
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

  const totalItems = useMemo(() => allItems.length, []);
  const completedItems = useMemo(() => allItems.filter(({ key }) => checklist[key]).length, [checklist]);
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

  function updateChecklist(key: ChecklistKey, checked: boolean) {
    setChecklist((current) => ({ ...current, [key]: checked }));
    setSaveMessage(null);
    setSaveError(null);
  }

  function getCompletionError() {
    const missingLabels = allItems.filter(({ key }) => requiredForCompletion.includes(key) && !checklist[key]).map(({ label }) => label);

    return missingLabels.length ? `Complete these required items before completing the checklist: ${missingLabels.join(', ')}.` : null;
  }

  async function saveChecklist(status: ChecklistStatus) {
    if (!job) return;

    if (status === 'Complete') {
      const validationError = getCompletionError();
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

      const { error } = await supabase.from('preflight_checklists').upsert(
        {
          ...Object.fromEntries(allItems.map(({ key }) => [key, checklist[key]])),
          job_id: job.id,
          organization_id: job.organization_id,
          user_id: userData.user.id,
          notes: checklist.notes.trim() || null,
          status,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'job_id' }
      );
      if (error) throw error;

      setChecklist((current) => ({ ...current, status }));
      setSaveMessage(status === 'Complete' ? 'Pre-flight checklist completed.' : 'Draft saved.');
    } catch (error) {
      setSaveError(getErrorMessage(error));
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
            <span className="font-medium text-slate-700">{completedItems} of {totalItems} complete</span>
            <span className="font-semibold text-brand-700">{completionPercent}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Checklist completion">
            <div className="h-full rounded-full bg-brand-700 transition-all" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </div>

      {saveError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{saveError}</div> : null}
      {saveMessage ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700" role="status">{saveMessage}</div> : null}

      {sections.map((section) => (
        <fieldset key={section.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" disabled={isSaving}>
          <legend className="px-1 text-base font-semibold text-brand-900">{section.title}</legend>
          <div className="mt-3 space-y-3">
            {section.items.map(({ key, label }) => (
              <label key={key} className="flex min-h-12 items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700">
                <input className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-700" type="checkbox" checked={checklist[key]} onChange={(event) => updateChecklist(key, event.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <label className="block rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm sm:p-6">
        Notes
        <textarea
          className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
          value={checklist.notes}
          onChange={(event) => setChecklist((current) => ({ ...current, notes: event.target.value }))}
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
