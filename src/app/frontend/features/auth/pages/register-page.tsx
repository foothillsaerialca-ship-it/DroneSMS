/**
 * File purpose: Implements the register page application page, including its presentation, state, validation, and service interactions.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { type FormEvent, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@frontend/lib/supabase';
import {
  validatePasswordRequirements,
  areAllRequirementsMet,
} from '@frontend/lib/password-utils';
import { friendlyAuthError, getAppUrl } from '../lib/auth-helpers';

/**
 * Renders the register interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  /**
   * Handles submit while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName || !email.trim() || !password) {
      setError('First name, last name, email, and password are required.');
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
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getAppUrl('/auth/callback'),
          data: {
            first_name: trimmedFirstName,
            last_name: trimmedLastName
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user?.id) throw new Error('Signup succeeded but user ID was not returned.');

      if (!authData.session) {
        setSuccessMessage('Account created. Check your email to confirm your account, then sign in.');
        return;
      }

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: authData.user.id,
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;

      navigate('/dashboard', { replace: true });
    } catch (submitError) {
      setError(friendlyAuthError(submitError, 'Unable to create account. Please try again.'));
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
          First Name
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="text"
            placeholder="Alex"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={isSubmitting || !configured}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Last Name
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="text"
            placeholder="Pilot"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
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
        {successMessage ? (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
            {successMessage}
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
