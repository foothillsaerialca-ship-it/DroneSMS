import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/components/use-auth';

function AccountPlaceholder({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-500">{description}</dd>
    </div>
  );
}

export function ProfilePage() {
  const { session } = useAuth();

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-brand-700">Settings</p>
      <h1 className="mt-1 text-xl font-semibold text-brand-900">Account Settings</h1>
      <p className="mt-2 text-sm text-slate-600">Manage the authenticated user’s account access and security.</p>

      <dl className="mt-6 space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Address</dt>
          <dd className={`mt-1 text-sm ${session?.user.email ? 'text-slate-800' : 'text-slate-400'}`}>
            {session?.user.email ?? 'Not provided'}
          </dd>
        </div>
        <AccountPlaceholder label="Change Password" description="Coming soon: self-service password management." />
        <AccountPlaceholder label="Multi-Factor Authentication" description="Coming soon." />
        <AccountPlaceholder label="Active Sessions" description="Coming soon." />
      </dl>

      <Link
        to="/settings"
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-800 sm:py-2"
      >
        Back to Settings
      </Link>
    </section>
  );
}
