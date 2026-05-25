import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

const initialFormState = {
  jobName: '',
  serviceType: serviceTypes[0],
  jobLocation: '',
  plannedDate: '',
  notes: ''
};

export function NewJobPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    if (!formData.jobName.trim()) return 'Job name is required.';
    if (!formData.serviceType) return 'Service type is required.';
    if (!formData.jobLocation.trim()) return 'Job location is required.';
    if (!formData.plannedDate) return 'Planned date is required.';
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSaving(true);

    const savedJob = {
      id: crypto.randomUUID(),
      jobName: formData.jobName.trim(),
      serviceType: formData.serviceType,
      jobLocation: formData.jobLocation.trim(),
      plannedDate: formData.plannedDate,
      notes: formData.notes.trim(),
      createdAt: new Date().toISOString()
    };

    const existingJobs = JSON.parse(localStorage.getItem('dronesms.jobs.placeholder') ?? '[]') as unknown[];
    localStorage.setItem('dronesms.jobs.placeholder', JSON.stringify([savedJob, ...existingJobs]));

    navigate('/jobs', { replace: true });
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Jobs</p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-900">Create Job</h1>
          <p className="mt-2 text-sm text-slate-600">Capture the first details for an upcoming drone operation.</p>
        </div>
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Job name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.jobName}
              onChange={(event) => updateField('jobName', event.target.value)}
              placeholder="Downtown roof inspection"
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
            Job location
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.jobLocation}
              onChange={(event) => updateField('jobLocation', event.target.value)}
              placeholder="123 Main St, Auburn, CA"
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
            Notes
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              value={formData.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Access notes, client details, site concerns, or preflight reminders"
              disabled={isSaving}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="mt-5 min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Job'}
        </button>
      </form>
    </section>
  );
}
