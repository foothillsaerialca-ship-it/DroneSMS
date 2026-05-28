import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { useAuth } from '../../auth/components/use-auth';

type ChecklistField =
  | 'aircraft_selected'
  | 'battery_condition'
  | 'propeller_inspection'
  | 'firmware_app_status'
  | 'gps_signal_confirmed'
  | 'home_point_verified'
  | 'storage_check'
  | 'weather_verified'
  | 'wind_conditions_acceptable'
  | 'airspace_reviewed'
  | 'laanc_confirmed_if_required'
  | 'notam_tfr_check_completed'
  | 'visual_observer_assigned'
  | 'emergency_procedures_reviewed'
  | 'crew_communications_confirmed'
  | 'rpic_final_approval';

type ChecklistState = Record<ChecklistField, boolean> & {
  notes: string;
};

type ChecklistRecord = ChecklistState & {
  id: string;
  job_id: string;
  organization_id: string;
  user_id: string;
  is_complete: boolean;
};

type ChecklistItem = {
  field: ChecklistField;
  label: string;
  requiredForCompletion?: boolean;
};

type ChecklistSection = {
  title: string;
  helper: string;
  items: ChecklistItem[];
};

const initialChecklist: ChecklistState = {
  aircraft_selected: false,
  battery_condition: false,
  propeller_inspection: false,
  firmware_app_status: false,
  gps_signal_confirmed: false,
  home_point_verified: false,
  storage_check: false,
  weather_verified: false,
  wind_conditions_acceptable: false,
  airspace_reviewed: false,
  laanc_confirmed_if_required: false,
  notam_tfr_check_completed: false,
  visual_observer_assigned: false,
  emergency_procedures_reviewed: false,
  crew_communications_confirmed: false,
  rpic_final_approval: false,
  notes: ''
};

const sections: ChecklistSection[] = [
  {
    title: 'Aircraft & Equipment',
    helper: 'Confirm the aircraft and supporting hardware are ready before leaving the ground.',
    items: [
      { field: 'aircraft_selected', label: 'Aircraft selected' },
      { field: 'battery_condition', label: 'Battery condition' },
      { field: 'propeller_inspection', label: 'Propeller inspection' },
      { field: 'firmware_app_status', label: 'Firmware/app status' },
      { field: 'gps_signal_confirmed', label: 'GPS signal confirmed' },
      { field: 'home_point_verified', label: 'Home point verified' },
      { field: 'storage_check', label: 'SD card/storage check' }
    ]
  },
  {
    title: 'Environment & Airspace',
    helper: 'Review current operational conditions and regulatory constraints.',
    items: [
      { field: 'weather_verified', label: 'Weather verified', requiredForCompletion: true },
      { field: 'wind_conditions_acceptable', label: 'Wind conditions acceptable' },
      { field: 'airspace_reviewed', label: 'Airspace reviewed', requiredForCompletion: true },
      { field: 'laanc_confirmed_if_required', label: 'LAANC confirmed if required' },
      { field: 'notam_tfr_check_completed', label: 'NOTAM/TFR check completed' }
    ]
  },
  {
    title: 'Crew & Safety',
    helper: 'Confirm crew roles, communications, emergency posture, and final RPIC approval.',
    items: [
      { field: 'visual_observer_assigned', label: 'Visual Observer assigned' },
      { field: 'emergency_procedures_reviewed', label: 'Emergency procedures reviewed' },
      { field: 'crew_communications_confirmed', label: 'Crew communications confirmed' },
      { field: 'rpic_final_approval', label: 'Final RPIC approval', requiredForCompletion: true }
    ]
  }
];

const checklistFields = sections.flatMap((section) => section.items.map((item) => item.field));
const requiredCompletionFields = sections
  .flatMap((section) => section.items)
  .filter((item) => item.requiredForCompletion)
  .map((item) => item.field);

export function PreflightChecklistPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { session } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistState>(initialChecklist);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const completedCount = checklistFields.filter((field) => checklist[field]).length;
  const totalCount = checklistFields.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const missingCompletionItems = useMemo(
    () => requiredCompletionFields.filter((field) => !checklist[field]),
    [checklist]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadChecklist() {
      if (!supabase || !jobId || !session?.user.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('organization_id')
        .eq('id', jobId)
        .maybeSingle();

      if (!isMounted) return;

      if (jobError || !job?.organization_id) {
        setError('Unable to load the job file for this checklist.');
        setIsLoading(false);
        return;
      }

      setOrganizationId(job.organization_id);

      const { data, error: checklistError } = await supabase
        .from('preflight_checklists')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (!isMounted) return;

      if (checklistError) {
        setError('Unable to load the pre-flight checklist.');
        setIsLoading(false);
        return;
      }

      if (data) {
        const existingChecklist = data as ChecklistRecord;
        setIsComplete(existingChecklist.is_complete);
        setChecklist({
          aircraft_selected: existingChecklist.aircraft_selected,
          battery_condition: existingChecklist.battery_condition,
          propeller_inspection: existingChecklist.propeller_inspection,
          firmware_app_status: existingChecklist.firmware_app_status,
          gps_signal_confirmed: existingChecklist.gps_signal_confirmed,
          home_point_verified: existingChecklist.home_point_verified,
          storage_check: existingChecklist.storage_check,
          weather_verified: existingChecklist.weather_verified,
          wind_conditions_acceptable: existingChecklist.wind_conditions_acceptable,
          airspace_reviewed: existingChecklist.airspace_reviewed,
          laanc_confirmed_if_required: existingChecklist.laanc_confirmed_if_required,
          notam_tfr_check_completed: existingChecklist.notam_tfr_check_completed,
          visual_observer_assigned: existingChecklist.visual_observer_assigned,
          emergency_procedures_reviewed: existingChecklist.emergency_procedures_reviewed,
          crew_communications_confirmed: existingChecklist.crew_communications_confirmed,
          rpic_final_approval: existingChecklist.rpic_final_approval,
          notes: existingChecklist.notes ?? ''
        });
      }

      setIsLoading(false);
    }

    void loadChecklist();

    return () => {
      isMounted = false;
    };
  }, [jobId, session?.user.id]);

  function updateCheckbox(field: ChecklistField, value: boolean) {
    setChecklist((current) => ({ ...current, [field]: value }));
    setSuccessMessage(null);
  }

  async function saveChecklist(complete: boolean) {
    if (!supabase) {
      setError('Supabase is not configured. Checklist changes cannot be saved.');
      return;
    }

    if (!jobId || !session?.user.id || !organizationId) {
      setError('Missing job or user context. Return to the job file and try again.');
      return;
    }

    if (complete && missingCompletionItems.length > 0) {
      setError('Completion requires RPIC approval, airspace review, and weather verification.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payload = {
      ...checklist,
      job_id: jobId,
      organization_id: organizationId,
      user_id: session.user.id,
      is_complete: complete,
      completed_at: complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data, error: saveError } = await supabase
      .from('preflight_checklists')
      .upsert(payload, { onConflict: 'job_id' })
      .select('id, is_complete')
      .single();

    setIsSaving(false);

    if (saveError) {
      setError('Unable to save the pre-flight checklist.');
      return;
    }

    setIsComplete(data.is_complete);
    setSuccessMessage(complete ? 'Checklist completed.' : 'Draft saved.');
  }

  function handleDraftSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveChecklist(false);
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Loading pre-flight checklist…</p>
      </section>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleDraftSubmit}>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link className="text-sm font-medium text-brand-700" to={jobId ? `/jobs/${jobId}` : '/jobs'}>
          ← Back to Job File
        </Link>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand-900">Pre-Flight Checklist</h1>
            <p className="mt-1 text-sm text-slate-600">Guided RPIC readiness workflow for this job file.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {isComplete ? 'Complete' : 'Draft'}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>{completedCount} of {totalCount} checks complete</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-700" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {successMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p> : null}

      {sections.map((section) => (
        <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">{section.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{section.helper}</p>
          <div className="mt-4 space-y-3">
            {section.items.map((item) => (
              <label key={item.field} className="flex gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  checked={checklist[item.field]}
                  className="mt-1 h-5 w-5 rounded border-slate-300"
                  onChange={(event) => updateCheckbox(item.field, event.target.checked)}
                  type="checkbox"
                />
                <span>
                  {item.label}
                  {item.requiredForCompletion ? <span className="ml-1 text-xs font-medium text-brand-700">Required</span> : null}
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Notes
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2"
            onChange={(event) => setChecklist((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Add operational notes, crew reminders, or exception details."
            value={checklist.notes}
          />
        </label>
      </section>

      <div className="sticky bottom-16 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            className="rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-60"
            disabled={isSaving}
            onClick={() => void saveChecklist(true)}
            type="button"
          >
            {isSaving ? 'Saving…' : 'Complete Checklist'}
          </button>
        </div>
      </div>
    </form>
  );
}
