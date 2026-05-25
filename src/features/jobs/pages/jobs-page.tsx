import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

type Job = {
  id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load jobs. Please try again.';
}

function formatPlannedDate(plannedDate: string) {
  if (!plannedDate) return 'Not scheduled';

  const [year, month, day] = plannedDate.split('-');
  if (!year || !month || !day) return plannedDate;

  return `${month}/${day}/${year}`;
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadJobs() {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: jobsError } = await supabase
          .from('jobs')
          .select('id, name, service_type, location, planned_date, status')
          .order('planned_date', { ascending: true })
          .order('created_at', { ascending: false });

        if (jobsError) throw jobsError;
        if (!isMounted) return;

        setJobs((data ?? []) as Job[]);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadJobs();

    return () => {
      isMounted = false;
    };
  }, []);

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

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading jobs...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h2 className="text-base font-semibold text-red-800">Unable to load jobs</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <article>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-brand-900">{job.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{job.service_type}</p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    {job.status}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">Location</dt>
                    <dd className="mt-1 text-slate-700">{job.location}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Planned date</dt>
                    <dd className="mt-1 text-slate-700">{formatPlannedDate(job.planned_date)}</dd>
                  </div>
                </dl>
              </article>
            </Link>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && jobs.length === 0 ? (
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
      ) : null}
    </section>
  );
}
