import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@frontend/lib/supabase';
import { getAppUrl } from '../lib/auth-helpers';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || !email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAppUrl('/reset-password')
    });
    setIsSubmitting(false);
    if (resetError) {
      // Keep the response neutral so account existence is never disclosed.
      setSent(true);
      return;
    }
    setSent(true);
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold text-brand-900">Reset your password</h1>
      <p className="mt-2 text-sm text-slate-600">Enter the email address you use to sign in to DroneSMS.</p>
      {sent ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            If an account exists for that email address, a password reset link has been sent.
          </p>
          <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50" to="/login">Return to login</Link>
        </div>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">Email
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isSubmitting} required />
          </label>
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
          <button className="min-h-11 w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:bg-slate-400" disabled={isSubmitting || !configured}>{isSubmitting ? 'Sending...' : 'Send reset link'}</button>
          <Link className="block text-center text-sm font-medium text-brand-700 hover:text-brand-800" to="/login">Return to login</Link>
        </form>
      )}
    </section>
  );
}
