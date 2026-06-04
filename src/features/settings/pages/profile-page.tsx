import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../app/frontend/lib/supabase';
import { useAuth } from '../../../app/frontend/features/auth/components/use-auth';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An error occurred. Please try again.';
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [faaPartNumber, setFaaPartNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user?.id) {
        navigate('/settings');
        return;
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, company_name, faa_part_number')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile) {
          setFullName(profile.full_name || '');
          setCompanyName(profile.company_name || '');
          setFaaPartNumber(profile.faa_part_number || '');
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [session?.user?.id, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.user?.id) {
      setError('User session not found. Please log in again.');
      return;
    }

    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          company_name: companyName.trim() || null,
          faa_part_number: faaPartNumber.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        navigate('/settings');
      }, 1500);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">Edit Profile</h1>
      <p className="mt-2 text-sm text-slate-600">Update your personal and professional information.</p>

      {isLoading ? (
        <div className="mt-4 text-center text-sm text-slate-600">Loading profile...</div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Full Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={isSaving}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Company Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              type="text"
              placeholder="Your company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            FAA Part 107 License Number
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              type="text"
              placeholder="e.g., 12345678"
              value={faaPartNumber}
              onChange={(event) => setFaaPartNumber(event.target.value)}
              disabled={isSaving}
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="alert">
              Profile updated successfully!
            </p>
          ) : null}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={() => navigate('/settings')}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
