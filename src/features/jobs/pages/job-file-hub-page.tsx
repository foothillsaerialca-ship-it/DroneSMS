import { Link, useParams } from 'react-router-dom';

export function JobFileHubPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link className="text-sm font-medium text-brand-700" to="/jobs">
          ← Back to Jobs
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-brand-900">Job File Hub</h1>
        <p className="mt-2 text-sm text-slate-600">Access required job forms and operational readiness tools.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Templates</p>
        <h2 className="mt-2 text-lg font-semibold text-brand-900">Pre-Flight Checklist</h2>
        <p className="mt-2 text-sm text-slate-600">
          Complete aircraft, environment, airspace, crew, and RPIC approval checks before flight operations.
        </p>
        <Link
          className="mt-4 inline-flex w-full justify-center rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white sm:w-auto"
          to={id ? `/jobs/${id}/templates/preflight` : '/jobs'}
        >
          Open Pre-Flight Checklist
        </Link>
      </div>
    </section>
  );
}
