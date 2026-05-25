import { Link } from 'react-router-dom';

export function JobsPage() {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-brand-900">Jobs</h1>
          <Link
            to="/jobs/new"
            className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white"
          >
            New Job
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-600">Placeholder list for mobile-first job management.</p>
      </div>
    </section>
  );
}
