import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { type ProposalStatus, proposalStatuses } from '../proposals';

type Job = {
  id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
};

type Proposal = {
  id: string;
  proposal_name: string;
  proposal_number: string | null;
  client_name: string;
  company_name: string | null;
  service_type: string;
  status: ProposalStatus;
  created_at: string;
};

type JobsTab = 'proposals' | 'active' | 'completed';

const tabs: { id: JobsTab; label: string }[] = [
  { id: 'proposals', label: 'Proposals' },
  { id: 'active', label: 'Active Jobs' },
  { id: 'completed', label: 'Completed Jobs' }
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load jobs. Please try again.';
}

function formatDate(dateValue: string) {
  if (!dateValue) return 'Not scheduled';

  const [datePart] = dateValue.split('T');
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return dateValue;

  return `${month}/${day}/${year}`;
}

function isCompletedJob(job: Job) {
  return job.status.toLowerCase() === 'complete' || job.status.toLowerCase() === 'completed';
}

function getInitialTab(tab: string | null): JobsTab {
  if (tab === 'proposals' || tab === 'completed') return tab;
  return 'active';
}

export function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<JobsTab>(() => getInitialTab(searchParams.get('tab')));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingProposals, setIsLoadingProposals] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [updatingProposalId, setUpdatingProposalId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadJobs() {
      setIsLoadingJobs(true);
      setJobsError(null);

      try {
        const { data, error: jobsLoadError } = await supabase
          .from('jobs')
          .select('id, name, service_type, location, planned_date, status')
          .order('planned_date', { ascending: true })
          .order('created_at', { ascending: false });

        if (jobsLoadError) throw jobsLoadError;
        if (!isMounted) return;

        setJobs((data ?? []) as Job[]);
      } catch (loadError) {
        if (!isMounted) return;
        setJobsError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoadingJobs(false);
      }
    }

    async function loadProposals() {
      setIsLoadingProposals(true);
      setProposalsError(null);

      try {
        const { data, error: proposalsLoadError } = await supabase
          .from('proposals')
          .select('id, proposal_name, proposal_number, client_name, company_name, service_type, status, created_at')
          .order('created_at', { ascending: false });

        if (proposalsLoadError) throw proposalsLoadError;
        if (!isMounted) return;

        setProposals((data ?? []) as Proposal[]);
      } catch (loadError) {
        if (!isMounted) return;
        setProposalsError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoadingProposals(false);
      }
    }

    void loadJobs();
    void loadProposals();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeJobs = useMemo(() => jobs.filter((job) => !isCompletedJob(job)), [jobs]);
  const completedJobs = useMemo(() => jobs.filter(isCompletedJob), [jobs]);
  const visibleJobs = activeTab === 'completed' ? completedJobs : activeJobs;
  const isLoadingCurrentTab = activeTab === 'proposals' ? isLoadingProposals : isLoadingJobs;
  const currentError = activeTab === 'proposals' ? proposalsError : jobsError;

  function selectTab(tab: JobsTab) {
    setActiveTab(tab);
    setSearchParams(tab === 'active' ? {} : { tab });
  }

  async function updateProposalStatus(proposalId: string, status: ProposalStatus) {
    const previousProposals = proposals;
    setUpdatingProposalId(proposalId);
    setProposals((current) =>
      current.map((proposal) => (proposal.id === proposalId ? { ...proposal, status } : proposal))
    );
    setProposalsError(null);

    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (error) throw error;
    } catch (statusError) {
      setProposals(previousProposals);
      setProposalsError(getErrorMessage(statusError));
    } finally {
      setUpdatingProposalId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand-900">Jobs</h1>
            <p className="mt-2 text-sm text-slate-600">
              Track proposals, active operations, and completed DroneSMS work.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/jobs/proposals/new"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-700 bg-white px-3 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 sm:min-h-0 sm:py-2"
            >
              + New Proposal
            </Link>
            <Link
              to="/jobs/new"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
            >
              New Job
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="Jobs sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-brand-900'
              }`}
              onClick={() => selectTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoadingCurrentTab ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading {activeTab === 'proposals' ? 'proposals' : 'jobs'}...
        </div>
      ) : null}

      {currentError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h2 className="text-base font-semibold text-red-800">
            Unable to load {activeTab === 'proposals' ? 'proposals' : 'jobs'}
          </h2>
          <p className="mt-2 text-sm text-red-700">{currentError}</p>
        </div>
      ) : null}

      {activeTab === 'proposals' && !isLoadingProposals && !proposalsError && proposals.length > 0 ? (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <article key={proposal.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link className="text-base font-semibold text-brand-900 hover:text-brand-700" to={`/jobs/proposals/${proposal.id}`}>{proposal.proposal_name}</Link>
                  <p className="mt-1 text-sm text-slate-600">{proposal.client_name}{proposal.company_name ? ` · ${proposal.company_name}` : ''}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{proposal.proposal_number ?? `PROP-${proposal.id.slice(0, 8).toUpperCase()}`}</p>
                </div>
                <label className="block text-sm font-medium text-slate-700 sm:min-w-44">
                  <span className="sr-only">Proposal status</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 sm:py-2 sm:text-sm"
                    value={proposal.status}
                    onChange={(event) => void updateProposalStatus(proposal.id, event.target.value as ProposalStatus)}
                    disabled={updatingProposalId === proposal.id}
                  >
                    {proposalStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-slate-500">Service type</dt>
                  <dd className="mt-1 text-slate-700">{proposal.service_type}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Status</dt>
                  <dd className="mt-1 text-slate-700">{proposal.status}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Date created</dt>
                  <dd className="mt-1 text-slate-700">{formatDate(proposal.created_at)}</dd>
                </div>
              </dl>
              <Link className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2" to={`/jobs/proposals/${proposal.id}`}>Review Proposal</Link>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab !== 'proposals' && !isLoadingJobs && !jobsError && visibleJobs.length > 0 ? (
        <div className="space-y-3">
          {visibleJobs.map((job) => (
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
                    <dd className="mt-1 text-slate-700">{formatDate(job.planned_date)}</dd>
                  </div>
                </dl>
              </article>
            </Link>
          ))}
        </div>
      ) : null}

      {activeTab === 'proposals' && !isLoadingProposals && !proposalsError && proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">No proposals yet</h2>
          <p className="mt-2 text-sm text-slate-600">Create the first proposal before work becomes a job.</p>
          <Link
            to="/jobs/proposals/new"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            + New Proposal
          </Link>
        </div>
      ) : null}

      {activeTab !== 'proposals' && !isLoadingJobs && !jobsError && visibleJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">
            No {activeTab === 'completed' ? 'completed jobs' : 'active jobs'} yet
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {activeTab === 'completed'
              ? 'Completed operations will appear here when a job status is complete.'
              : 'Create your first job to start building an operations list.'}
          </p>
          {activeTab === 'active' ? (
            <Link
              to="/jobs/new"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
            >
              New Job
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
