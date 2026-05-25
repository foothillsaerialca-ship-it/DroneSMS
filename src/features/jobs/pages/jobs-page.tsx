import { useState } from 'react';
import { Link } from 'react-router-dom';

type PlaceholderJob = {
  id: string;
  jobName: string;
  serviceType: string;
  jobLocation: string;
  plannedDate: string;
  status?: string;
};

const placeholderJobsKey = 'dronesms.jobs.placeholder';

function isPlaceholderJob(value: unknown): value is PlaceholderJob {
  if (!value || typeof value !== 'object') return false;

  const job = value as Partial<PlaceholderJob>;
  return (
    typeof job.id === 'string' &&
    typeof job.jobName === 'string' &&
    typeof job.serviceType === 'string' &&
    typeof job.jobLocation === 'string' &&
    typeof job.plannedDate === 'string'
  );
}

function loadPlaceholderJobs() {
  try {
    const storedJobs = JSON.parse(localStorage.getItem(placeholderJobsKey) ?? '[]') as unknown;
    return Array.isArray(storedJobs) ? storedJobs.filter(isPlaceholderJob) : [];
  } catch {
    return [];
  }
}

function formatPlannedDate(plannedDate: string) {
  if (!plannedDate) return 'Not scheduled';

  const [year, month, day] = plannedDate.split('-');
  if (!year || !month || !day) return plannedDate;

  return `${month}/${day}/${year}`;
}

export function JobsPage() {
  const [jobs] = useState(loadPlaceholderJobs);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand-900">Jobs</h1>
            <p className="mt-2 text-sm text-slate-600">Track upcoming DroneSMS operations and planning status.</p>
          </div>
          <Link
            to="/jobs/new"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            New Job
          </Link>
        </div>
      </div>

      {jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-brand-900">{job.jobName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{job.serviceType}</p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {job.status ?? 'Planned'}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Location</dt>
                  <dd className="mt-1 text-slate-700">{job.jobLocation}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Planned date</dt>
                  <dd className="mt-1 text-slate-700">{formatPlannedDate(job.plannedDate)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">No jobs yet</h2>
          <p className="mt-2 text-sm text-slate-600">Create your first job to start building an operations list.</p>
          <Link
            to="/jobs/new"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            New Job
          </Link>
        </div>
      )}
    </section>
  );
}
