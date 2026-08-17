import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { areAllRequirementsMet, validatePasswordRequirements } from '@frontend/lib/password-utils';
import { friendlyAuthError } from '../lib/auth-helpers';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [linkState, setLinkState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requirementsMet = useMemo(() => areAllRequirementsMet(validatePasswordRequirements(password)), [password]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setLinkState(data.session ? 'valid' : 'invalid');
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && (event === 'PASSWORD_RECOVERY' || session)) setLinkState('valid');
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requirementsMet) return setError('Password does not meet all requirements.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setIsSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) return setError(friendlyAuthError(updateError, 'Unable to change your password. Please request a new reset link.'));
    setSuccess(true);
    window.setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
  }

  if (linkState === 'checking') return <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">Validating password reset link...</section>;
  if (linkState === 'invalid') return <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-semibold text-brand-900">Reset link unavailable</h1><p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">This password recovery link is invalid or has expired.</p><Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white" to="/forgot-password">Request another reset link</Link><Link className="mt-3 block text-center text-sm font-medium text-brand-700" to="/login">Return to login</Link></section>;

  return <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h1 className="text-xl font-semibold text-brand-900">Choose a new password</h1><p className="mt-2 text-sm text-slate-600">Use at least 8 characters, one uppercase letter, one number, and one special character.</p>{success ? <div className="mt-4"><p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">Password successfully changed. Taking you back to DroneSMS...</p><Link className="mt-3 block text-center text-sm font-medium text-brand-700" to="/dashboard">Continue now</Link></div> : <form className="mt-4 space-y-4" onSubmit={handleSubmit}><label className="block text-sm font-medium text-slate-700">New Password<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="block text-sm font-medium text-slate-700">Confirm New Password<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>{error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}<button className="min-h-11 w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-400" disabled={isSubmitting}>{isSubmitting ? 'Changing password...' : 'Change password'}</button></form>}</section>;
}
