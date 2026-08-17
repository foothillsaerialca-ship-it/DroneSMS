import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@frontend/lib/supabase';
import { friendlyAuthError, getAppUrl } from '../lib/auth-helpers';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setError(null);
    setCanResendVerification(false);
    setVerificationMessage(null);
    setIsSigningIn(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password
      });

      if (signInError) throw signInError;

      navigate('/dashboard', { replace: true });
    } catch (loginError) {
      const message = friendlyAuthError(loginError, 'Unable to sign in. Please try again.');
      setError(message);
      setCanResendVerification(message.includes('verify your email'));
    } finally {
      setIsSigningIn(false);
    }
  }

  async function resendVerification() {
    if (!email.trim()) return;
    setVerificationMessage(null);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: getAppUrl('/auth/callback') }
    });
    if (resendError) setError('Unable to resend the verification email. Please try again shortly.');
    else {
      setError(null);
      setVerificationMessage('Verification email resent. Check your inbox.');
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold text-brand-900">Pilot Login</h1>
      <p className="mt-2 text-sm text-slate-600">Sign in to continue to DroneSMS.</p>
      {!configured ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured. Please add <code className="rounded bg-slate-100 px-1.5 py-0.5">VITE_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> to your environment.
        </div>
      ) : null}
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input 
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
            type="email"
            placeholder="pilot@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={isSigningIn}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={isSigningIn}
            required
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {canResendVerification ? <button type="button" className="text-sm font-medium text-brand-700 hover:text-brand-800" onClick={resendVerification}>Resend verification email</button> : null}
        {verificationMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{verificationMessage}</p> : null}

        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
          disabled={isSigningIn || !configured}
        >
          {isSigningIn ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <Link className="mt-3 block text-center text-sm font-medium text-brand-700 hover:text-brand-800" to="/forgot-password">Forgot Password?</Link>
      <p className="mt-4 text-sm text-slate-600">
        Need an account?{' '}
        <Link className="font-medium text-brand-700 hover:text-brand-800" to="/register">
          Register
        </Link>
      </p>
    </section>
  );
}
