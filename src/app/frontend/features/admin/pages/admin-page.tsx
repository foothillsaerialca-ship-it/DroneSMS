/**
 * File purpose: Implements the platform admin page: app-wide settings, the admin list, and the admin activity log.
 * Fallback/error behavior: Load and save failures are shown on the page; every change is re-checked by the database.
 * Known limitation: Admins can only be added by the email of an existing DroneSMS account.
 */
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';
import { useAuth } from '../../auth/components/use-auth';
import { type AppSettings, applyAppSetting, useAppSettings } from '../lib/app-settings';

type PlatformAdmin = { user_id: string; email: string; granted_at: string; granted_by_email: string | null; note: string | null };
type AuditEntry = {
  id: string;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  setting_key: string | null;
  new_value: unknown;
  created_at: string;
};

const settingLabels: Record<keyof AppSettings, { title: string; description: string }> = {
  beta_welcome_enabled: {
    title: 'Beta welcome and BETA badges',
    description: 'Shows the beta welcome screen before sign-in and the BETA badge across the app.'
  }
};

const cardClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6';
const buttonClass =
  'rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2 disabled:opacity-60';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function describeAudit(entry: AuditEntry) {
  if (entry.action === 'Changed setting') {
    const label = settingLabels[entry.setting_key as keyof AppSettings]?.title ?? entry.setting_key;
    const value = entry.new_value === true ? 'On' : entry.new_value === false ? 'Off' : JSON.stringify(entry.new_value);
    return `Set ${label} to ${value}`;
  }
  return `${entry.action}: ${entry.target_email ?? 'deleted account'}`;
}

function SettingsCard() {
  const settings = useAppSettings();
  const [savingKey, setSavingKey] = useState<keyof AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof AppSettings) {
    const next = !settings[key];
    setSavingKey(key);
    setError(null);
    const { error: saveError } = await supabase.rpc('set_app_setting', { setting_key: key, setting_value: next });
    setSavingKey(null);
    if (saveError) return setError(saveError.message);
    applyAppSetting(key, next);
  }

  return (
    <article className={cardClass}>
      <h2 className="text-lg font-semibold text-brand-900">App Settings</h2>
      <p className="mt-1 text-sm text-slate-600">These apply to every DroneSMS user immediately.</p>
      <ul className="mt-4 divide-y divide-slate-100">
        {(Object.keys(settingLabels) as (keyof AppSettings)[]).map((key) => (
          <li key={key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{settingLabels[key].title}</p>
              <p className="text-sm text-slate-500">{settingLabels[key].description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings[key]}
              aria-label={settingLabels[key].title}
              disabled={savingKey !== null}
              onClick={() => void toggle(key)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2 disabled:opacity-60 ${settings[key] ? 'bg-brand-700' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${settings[key] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </article>
  );
}

function AdminsCard({ onChanged }: { onChanged: () => void }) {
  const { session, refreshPlatformAdmin } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc('list_platform_admins');
    setLoading(false);
    if (loadError) return setError(loadError.message);
    setAdmins((data as PlatformAdmin[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAdmin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: grantError } = await supabase.rpc('grant_platform_admin', { target_email: email.trim(), grant_note: note.trim() || null });
    setBusy(false);
    if (grantError) return setError(grantError.message);
    setMessage(`${email.trim()} is now an admin.`);
    setEmail('');
    setNote('');
    await load();
    onChanged();
  }

  async function removeAdmin(admin: PlatformAdmin) {
    const isSelf = admin.user_id === session?.user.id;
    const prompt = isSelf
      ? 'Remove your own admin access? You will lose access to this page.'
      : `Remove admin access for ${admin.email}?`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: revokeError } = await supabase.rpc('revoke_platform_admin', { target_user_id: admin.user_id });
    setBusy(false);
    if (revokeError) return setError(revokeError.message);
    if (isSelf) return refreshPlatformAdmin();
    setMessage(`${admin.email} is no longer an admin.`);
    await load();
    onChanged();
  }

  return (
    <article className={cardClass}>
      <h2 className="text-lg font-semibold text-brand-900">Admins</h2>
      <p className="mt-1 text-sm text-slate-600">Admins can change app settings and add or remove other admins.</p>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading admins...</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {admins.map((admin) => (
            <li key={admin.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-all font-medium text-slate-800">
                  {admin.email}
                  {admin.user_id === session?.user.id ? <span className="ml-2 text-xs font-semibold uppercase text-slate-500">You</span> : null}
                </p>
                <p className="text-sm text-slate-500">
                  Added {formatDate(admin.granted_at)}
                  {admin.granted_by_email ? ` by ${admin.granted_by_email}` : ''}
                  {admin.note ? ` · ${admin.note}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || admins.length <= 1}
                onClick={() => void removeAdmin(admin)}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void addAdmin(event)}>
        <label className="text-sm font-medium text-slate-700">
          Account email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="name@company.com"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Note (optional)
          <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={busy} className={`${buttonClass} self-end`}>
          Add Admin
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
    </article>
  );
}

function ActivityCard({ refreshKey }: { refreshKey: number }) {
  const settings = useAppSettings();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from('platform_admin_audit')
        .select('id, action, actor_email, target_email, setting_key, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(25);
      if (!active) return;
      if (loadError) return setError(loadError.message);
      setEntries((data as AuditEntry[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey, settings]);

  return (
    <article className={cardClass}>
      <h2 className="text-lg font-semibold text-brand-900">Recent Admin Activity</h2>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {entries.length === 0 && !error ? <p className="mt-3 text-sm text-slate-500">No admin activity yet.</p> : null}
      <ul className="mt-3 divide-y divide-slate-100">
        {entries.map((entry) => (
          <li key={entry.id} className="py-2 text-sm">
            <p className="text-slate-800">{describeAudit(entry)}</p>
            <p className="text-slate-500">
              {entry.actor_email ?? 'Unknown'} · {formatDate(entry.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function AdminPage() {
  const [activityKey, setActivityKey] = useState(0);
  const refreshActivity = useCallback(() => setActivityKey((key) => key + 1), []);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">Platform Admin</h1>
        <p className="mt-2 text-sm text-slate-600">Only DroneSMS admins can see this page.</p>
      </header>
      <SettingsCard />
      <AdminsCard onChanged={refreshActivity} />
      <ActivityCard refreshKey={activityKey} />
    </section>
  );
}

export default AdminPage;
