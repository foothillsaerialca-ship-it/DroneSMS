import { type FormEvent, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@frontend/lib/supabase';
import {
  validatePasswordRequirements,
  areAllRequirementsMet,
  hashPassword,
} from '@frontend/lib/password-utils';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to create account. Please try again.';
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const configured = isSupabaseConfigured();

  const passwordRequirements = useMemo(
    () => validatePasswordRequirements(password),
    [password]
  );

  const allRequirementsMet = useMemo(
    () => areAllRequirementsMet(passwordRequirements),
    [passwordRequirements]
  );

  const passwordsMatch = password === confirmPassword && password.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Full name, email, and password are required.');
      return;
    }

    if (!allRequirementsMet) {
      setError('Password does not meet all requirements.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const hashedPassword = await hashPassword(password);

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: hashedPassword,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user?.id) throw new Error('Signup succeeded but user ID was not returned.');

      // Create profile record with full_name
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: authData.user.id,
          full_name: fullName.trim(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;

      navigate('/dashboard', { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">Operator Registration</h1>
      <p className="mt-2 text-sm text-slate-600">Create your account to access DroneSMS.</p>

      {!configured ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Please add <code className="rounded bg-slate-100 px-1.5 py-0.5">VITE_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> to your environment.
        </div>
      ) : null}

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Full Name
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="text"
            placeholder="Alex Pilot"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={isSubmitting || !configured}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="email"
            placeholder="pilot@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting || !configured}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="password"
            placeholder="Create password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting || !configured}
            required
          />
        </label>

        {/* Password Requirements */}
        <div className="space-y-1 rounded-lg bg-slate-50 p-3">
          {!passwordRequirements.hasMinLength && (
            <div className="flex items-center text-sm text-slate-600">
              <span className="mr-2 text-red-500">✗</span>
              At least 8 characters
            </div>
          )}
          {!passwordRequirements.hasUpperCase && (
            <div className="flex items-center text-sm text-slate-600">
              <span className="mr-2 text-red-500">✗</span>
              One uppercase letter (A-Z)
            </div>
          )}
          {!passwordRequirements.hasNumber && (
            <div className="flex items-center text-sm text-slate-600">
              <span className="mr-2 text-red-500">✗</span>
              One number (0-9)
            </div>
          )}
          {!passwordRequirements.hasSpecialChar && (
            <div className="flex items-center text-sm text-slate-600">
              <span className="mr-2 text-red-500">✗</span>
              One special character (!@#$%^&*)
            </div>
          )}
          {allRequirementsMet && (
            <div className="flex items-center text-sm text-green-600">
              <span className="mr-2">✓</span>
              Password requirements met
            </div>
          )}
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Confirm Password
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSubmitting || !configured || !allRequirementsMet}
            required
          />
        </label>

        {/* Password Match Indicator */}
        {confirmPassword.length > 0 && !passwordsMatch && (
          <div className="flex items-center text-sm text-red-600">
            <span className="mr-2">✗</span>
            Passwords do not match
          </div>
        )}
        {passwordsMatch && allRequirementsMet && (
          <div className="flex items-center text-sm text-green-600">
            <span className="mr-2">✓</span>
            Passwords match
          </div>
        )}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting || !configured || !allRequirementsMet || !passwordsMatch}
        >
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Already registered?{' '}
        <Link className="text-brand-700" to="/login">
          Sign in
        </Link>
      </p>
    </section>
  );
}
