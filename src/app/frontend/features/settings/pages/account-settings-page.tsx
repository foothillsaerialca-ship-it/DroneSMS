/**
 * File purpose: Implements the account settings page application page, including its presentation, state, validation, and service interactions.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/components/use-auth';
import { AccountSecurityCard } from '../components/account-security-card';

/**
 * Implements future account feature for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
function FutureAccountFeature({ title, description }: { title: string; description: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"><h3 className="font-semibold text-slate-800">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p><span className="mt-3 inline-block rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Coming Soon</span></div>;
}

/**
 * Renders the account settings interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function AccountSettingsPage() {
  const { session } = useAuth();
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium uppercase tracking-wide text-brand-700">Settings</p><h1 className="mt-1 text-2xl font-semibold text-brand-900">Account Settings</h1></div><Link className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50" to="/settings/organization">Organization Settings</Link></div><p className="mt-2 text-sm text-slate-600">Manage your individual account identity, login credentials, and security.</p></header>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-brand-900">Account Identity</h2><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Current Sign-In Email</p><p className="mt-1 break-all text-sm text-slate-800">{session?.user.email || 'Unavailable'}</p></article>
      <AccountSecurityCard currentEmail={session?.user.email} />
      <div className="grid gap-4 sm:grid-cols-2"><FutureAccountFeature title="Multi-Factor Authentication" description="Additional sign-in verification will be available in a future release." /><FutureAccountFeature title="Active Sessions" description="Session review and remote sign-out will be available in a future release." /></div>
    </section>
  );
}
