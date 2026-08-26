/**
 * File purpose: Implements the new job page application page, including its presentation, state, validation, and service interactions.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { OrganizationIdentityCard } from '@frontend/features/settings/components/organization-identity-card';
import { loadOrganizationSettingsForUser, type OrganizationSettings } from '@frontend/features/settings/lib/organization-settings';
import { serviceTypes } from '@frontend/features/jobs/lib/workflow-types';

/**
 * Purpose: Provides the stable default shape for initial form state in the new job page workflow.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const initialFormState = {
  jobName: '',
  serviceType: serviceTypes[0],
  jobLocation: '',
  plannedDate: '',
  notes: ''
};

/**
 * Computes get error message for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to save job. Please try again.';
}

/**
 * Computes get current organization id for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
async function getCurrentOrganizationId(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.organization_id) return profile.organization_id as string;

  const { data: ownedOrganizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', userId)
    .limit(1);

  if (organizationError) throw organizationError;

  const organization = ownedOrganizations?.[0];

  if (!organization) return null;

  const { error: profileUpsertError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      organization_id: organization.id,
      company_name: organization.name,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (profileUpsertError) throw profileUpsertError;

  return organization.id as string;
}

/**
 * Renders the new job interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function NewJobPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings | null>(null);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    /**
     * Performs load company identity for the surrounding workflow.
     * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
     */
    async function loadCompanyIdentity() {
      setIsLoadingOrganization(true);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const userId = userData.user?.id;
        const settings = userId ? await loadOrganizationSettingsForUser(userId) : null;
        if (isMounted) setOrganizationSettings(settings);
      } catch {
        if (isMounted) setOrganizationSettings(null);
      } finally {
        if (isMounted) setIsLoadingOrganization(false);
      }
    }

    void loadCompanyIdentity();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Renders the update field interface and coordinates its user interactions.
   * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
   */
  function updateField(field: keyof typeof formData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  /**
   * Implements validate form for this module.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function validateForm() {
    if (!formData.jobName.trim()) return 'Job name is required.';
    if (!formData.serviceType) return 'Service type is required.';
    if (!formData.jobLocation.trim()) return 'Job location is required.';
    if (!formData.plannedDate) return 'Planned date is required.';
    return null;
  }

  /**
   * Handles submit while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to save a job.');

      const organizationId = await getCurrentOrganizationId(userData.user.id);

      if (!organizationId) {
        throw new Error('Finish company onboarding before creating jobs.');
      }

      const { error: jobError } = await supabase.from('jobs').insert({
        organization_id: organizationId,
        user_id: userData.user.id,
        name: formData.jobName.trim(),
        service_type: formData.serviceType,
        location: formData.jobLocation.trim(),
        planned_date: formData.plannedDate,
        notes: formData.notes.trim() || null,
        status: 'Planned'
      });

      if (jobError) throw jobError;

      navigate('/jobs', { replace: true });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
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

      <OrganizationIdentityCard
        organization={organizationSettings}
        title="Mission Basics Company Information"
        description="Company identity is auto-populated from Settings for mission basics and downstream job documents."
        isLoading={isLoadingOrganization}
      />

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
