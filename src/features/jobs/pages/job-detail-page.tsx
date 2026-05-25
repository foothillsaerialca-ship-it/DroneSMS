import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

const serviceTypes = [
  'Cleaning Operations',
  'Thermal Inspection',
  'Roof Inspection',
  'Agricultural',
  'Mapping / Surveying',
  'Construction Progress',
  'Real Estate / Property Media',
  'Custom Operation'
];

const statusOptions = ['Planned', 'In Progress', 'Needs Review', 'Complete'];

type Job = {
  id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
  notes: string | null;
};

type JobFormState = {
  name: string;
  serviceType: string;
  location: string;
  plannedDate: string;
  status: string;
  notes: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function formatPlannedDate(plannedDate: string) {
  if (!plannedDate) return 'Not scheduled';

  const [year, month, day] = plannedDate.split('-');
  if (!year || !month || !day) return plannedDate;

  return `${month}/${day}/${year}`;
}

function toFormState(job: Job): JobFormState {
  return {
    name: job.name,
    serviceType: job.service_type,
    location: job.location,
    plannedDate: job.planned_date,
    status: job.status,
    notes: job.notes ?? ''
  };
}

export function JobDetailPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<JobFormState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadJob() {
      if (!jobId) {
        setLoadError('Missing job id.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, name, service_type, location, planned_date, status, notes')
          .eq('id', jobId)
          .maybeSingle();

        if (error) throw error;
        if (!isMounted) return;

        if (!data) {
          setLoadError('Job not found.');
          setJob(null);
          setFormData(null);
          return;
        }

        const loadedJob = data as Job;
        setJob(loadedJob);
        setFormData(toFormState(loadedJob));
      } catch (error) {
        if (!isMounted) return;
        setLoadError(getErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadJob();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  function updateField(field: keyof JobFormState, value: string) {
    setFormData((current) => (current ? { ...current, [field]: value } : current));
  }

  function validateForm() {
    if (!formData?.name.trim()) return 'Job name is required.';
    if (!formData.serviceType) return 'Service type is required.';
    if (!formData.location.trim()) return 'Location is required.';
    if (!formData.plannedDate) return 'Planned date is required.';
    if (!formData.status) return 'Status is required.';
    return null;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job || !formData) return;

    const validationError = validateForm();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('jobs')
        .update({
          name: formData.name.trim(),
          service_type: formData.serviceType,
          location: formData.location.trim(),
          planned_date: formData.plannedDate,
          status: formData.status,
          notes: formData.notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .select('id, name, service_type, location, planned_date, status, notes')
        .single();

      if (error) throw error;

      const updatedJob = data as Job;
      setJob(updatedJob);
      setFormData(toFormState(updatedJob));
      setIsEditing(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Loading job...
      </section>
    );
  }

  if (loadError || !job || !formData) {
    return (
      <section className="space-y-4">
        <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to="/jobs">
          Back to Jobs
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h1 className="text-base font-semibold text-red-800">Unable to load job</h1>
          <p className="mt-2 text-sm text-red-700">{loadError ?? 'Please try again.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to="/jobs">
        Back to Jobs
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Job Detail</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{job.name}</h1>
            <p className="mt-2 text-sm text-slate-600">{job.service_type}</p>
          </div>
          {!isEditing ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSave}>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Job name
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                type="text"
                value={formData.name}
                onChange={(event) => updateField('name', event.target.value)}
                disabled={isSaving}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Service type
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                value={formData.serviceType}
                onChange={(event) => updateField('serviceType', event.target.value)}
                disabled={isSaving}
              >
                {serviceTypes.map((serviceType) => (
                  <option key={serviceType} value={serviceType}>
                    {serviceType}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Location
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                type="text"
                value={formData.location}
                onChange={(event) => updateField('location', event.target.value)}
                disabled={isSaving}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Planned date
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                type="date"
                value={formData.plannedDate}
                onChange={(event) => updateField('plannedDate', event.target.value)}
                disabled={isSaving}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                value={formData.status}
                onChange={(event) => updateField('status', event.target.value)}
                disabled={isSaving}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Notes
              <textarea
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
                value={formData.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                disabled={isSaving}
              />
            </label>
          </div>

          {saveError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {saveError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-h-0 sm:py-2"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 sm:min-h-0 sm:py-2"
              disabled={isSaving}
              onClick={() => {
                setFormData(toFormState(job));
                setSaveError(null);
                setIsEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Service type</dt>
              <dd className="mt-1 text-slate-800">{job.service_type}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Location</dt>
              <dd className="mt-1 text-slate-800">{job.location}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Planned date</dt>
              <dd className="mt-1 text-slate-800">{formatPlannedDate(job.planned_date)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Status</dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {job.status}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-800">{job.notes || 'No notes yet.'}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
