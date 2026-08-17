import { type FormEvent, useMemo, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';
import { areAllRequirementsMet, validatePasswordRequirements } from '@frontend/lib/password-utils';
import { friendlyAuthError, getAppUrl } from '../../auth/lib/auth-helpers';

export function AccountSecurityCard({ currentEmail }: { currentEmail?: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'email' | null>(null);
  const requirementsMet = useMemo(() => areAllRequirementsMet(validatePasswordRequirements(password)), [password]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (!requirementsMet) return setPasswordError('Password does not meet all requirements.');
    if (password !== confirmPassword) return setPasswordError('Passwords do not match.');
    setBusy('password');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) return setPasswordError(friendlyAuthError(error, 'Unable to change your password. Please try again.'));
    setPassword('');
    setConfirmPassword('');
    setPasswordMessage('Password successfully changed.');
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setEmailMessage(null);
    const email = newEmail.trim();
    if (!email || email.toLowerCase() === currentEmail?.toLowerCase()) return setEmailError('Enter a different email address.');
    setBusy('email');
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: getAppUrl('/auth/callback') });
    setBusy(null);
    if (error) return setEmailError(friendlyAuthError(error, 'Unable to start the email change. Please try again.'));
    setNewEmail('');
    setEmailMessage('Email change requested. Follow the verification instructions sent by email; your sign-in address will not change until verification is complete.');
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100';
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-brand-900">Account Security</h2><p className="mt-1 text-sm text-slate-600">Manage the credentials used to sign in to DroneSMS.</p><div className="mt-5 grid gap-6 sm:grid-cols-2"><form className="space-y-3" onSubmit={changePassword}><h3 className="font-semibold text-slate-800">Change password</h3><p className="text-xs text-slate-500">At least 8 characters with an uppercase letter, number, and special character.</p><label className="block text-sm font-medium text-slate-700">New Password<input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="block text-sm font-medium text-slate-700">Confirm New Password<input className={inputClass} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>{passwordError ? <p className="text-sm text-red-700" role="alert">{passwordError}</p> : null}{passwordMessage ? <p className="text-sm text-emerald-700" role="status">{passwordMessage}</p> : null}<button className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400" disabled={busy !== null}>{busy === 'password' ? 'Changing...' : 'Change password'}</button></form><form className="space-y-3" onSubmit={changeEmail}><h3 className="font-semibold text-slate-800">Change email address</h3><p className="text-xs text-slate-500">Current sign-in email: {currentEmail || 'Unavailable'}</p><label className="block text-sm font-medium text-slate-700">New Email Address<input className={inputClass} type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required /></label>{emailError ? <p className="text-sm text-red-700" role="alert">{emailError}</p> : null}{emailMessage ? <p className="text-sm text-emerald-700" role="status">{emailMessage}</p> : null}<button className="min-h-11 rounded-lg border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 disabled:border-slate-300 disabled:text-slate-400" disabled={busy !== null}>{busy === 'email' ? 'Requesting...' : 'Request email change'}</button></form></div></article>;
}
