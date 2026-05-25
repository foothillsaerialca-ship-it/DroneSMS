import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { useAuth } from '../components/use-auth';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to save company details. Please try again.';
}

export function CompanyOnboardingPage() {
  const navigate = useNavigate();
  const { refreshProfileState } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [part107Number, setPart107Number] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedCompanyName = companyName.trim();
    const trimmedPart107Number = part107Number.trim();

    if (!trimmedCompanyName) {
      setError('Company name is required.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to finish company setup.');

      const { data: profile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profileLookupError) throw profileLookupError;

      let organizationId = profile?.organization_id ?? null;

      if (!organizationId) {
        const { data: ownedOrganizations, error: ownedOrganizationError } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_user_id', userData.user.id)
          .limit(1);

        if (ownedOrganizationError) throw ownedOrganizationError;

        organizationId = ownedOrganizations?.[0]?.id ?? null;
      }

      if (organizationId) {
        const { error: organizationUpdateError } = await supabase
          .from('organizations')
          .update({
            name: trimmedCompanyName,
            part_107_number: trimmedPart107Number || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', organizationId);

        if (organizationUpdateError) throw organizationUpdateError;
      } else {
        const { data: organization, error: organizationError } = await supabase
          .from('organizations')
          .insert({
            name: trimmedCompanyName,
            part_107_number: trimmedPart107Number || null,
            owner_user_id: userData.user.id
          })
          .select('id')
          .single();

        if (organizationError) throw organizationError;
        if (!organization) throw new Error('Company setup did not return an organization record.');

        organizationId = organization.id;
      }

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userData.user.id,
          organization_id: organizationId,
          company_name: trimmedCompanyName,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;

      await refreshProfileState();
      navigate('/dashboard', { replace: true });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold text-brand-900">Company Onboarding</h1>
      <p className="mt-2 text-sm text-slate-600">Complete your company setup before dashboard access.</p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Company Name
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
            type="text"
            placeholder="Skyline Drone Ops"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            autoComplete="organization"
            disabled={isSaving}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          FAA Part 107 Number (Optional)
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
            type="text"
            placeholder="Enter certificate number"
            value={part107Number}
            onChange={(event) => setPart107Number(event.target.value)}
            autoComplete="off"
            disabled={isSaving}
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </section>
  );
}
