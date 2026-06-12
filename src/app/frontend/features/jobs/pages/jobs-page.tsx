import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { OrganizationIdentityCard } from '@frontend/features/settings/components/organization-identity-card';
import { loadOrganizationSettingsForUser, type OrganizationSettings } from '@frontend/features/settings/lib/organization-settings';
import { getSelectedHazardName, normalizeSelectedHazards, type SelectedPreliminaryHazard } from '@frontend/features/safety/lib/preliminary-hazard-library';

type Job = {
  id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
};

type ProposalStatus = 'Draft' | 'Sent' | 'Under Review' | 'Accepted' | 'Declined';

type Proposal = {
  id: string;
  organization_id: string;
  proposal_number: string | null;
  proposal_name: string;
  client_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  service_type: string;
  site_address: string | null;
  status: ProposalStatus;
  created_at: string;
  hazard_assessment: SelectedPreliminaryHazard[] | null;
  proposed_rpic_id: string | null;
  proposed_rpic_name: string | null;
  proposed_rpic_credentials: string | null;
  proposed_rpic_bio: string | null;
};

type JobsTab = 'proposals' | 'active' | 'completed';

const proposalStatuses: ProposalStatus[] = ['Draft', 'Sent', 'Under Review', 'Accepted', 'Declined'];
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<JobsTab>(() => getInitialTab(searchParams.get('tab')));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingProposals, setIsLoadingProposals] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [updatingProposalId, setUpdatingProposalId] = useState<string | null>(null);
  const [creatingJobProposalId, setCreatingJobProposalId] = useState<string | null>(null);
  const [deletingProposalId, setDeletingProposalId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings | null>(null);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);

  const loadJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    setJobsError(null);

    try {
      const { data, error: jobsLoadError } = await supabase
        .from('jobs')
        .select('id, name, service_type, location, planned_date, status')
        .is('deleted_at', null)
        .order('planned_date', { ascending: true })
        .order('created_at', { ascending: false });

      if (jobsLoadError) throw jobsLoadError;

      setJobs((data ?? []) as Job[]);
    } catch (loadError) {
      setJobsError(getErrorMessage(loadError));
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  const loadProposals = useCallback(async () => {
    setIsLoadingProposals(true);
    setProposalsError(null);

    try {
      const { data, error: proposalsLoadError } = await supabase
        .from('proposals')
        .select('id, organization_id, proposal_number, proposal_name, client_name, contact_name, phone, email, service_type, site_address, status, created_at, hazard_assessment, proposed_rpic_id, proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (proposalsLoadError) throw proposalsLoadError;

      setProposals(((data ?? []) as Proposal[]).map((proposal) => ({
        ...proposal,
        hazard_assessment: normalizeSelectedHazards(proposal.hazard_assessment)
      })));
    } catch (loadError) {
      setProposalsError(getErrorMessage(loadError));
    } finally {
      setIsLoadingProposals(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCompanyIdentity() {
      setIsLoadingOrganization(true);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const userId = userData.user?.id;
        const settings = userId ? await loadOrganizationSettingsForUser(userId) : null;
        if (isMounted) setOrganizationSettings(settings);
      } catch {
        if (isMounted) setOrganizationSettings(null);
      } finally {
        if (isMounted) setIsLoadingOrganization(false);
      }
    }

    void loadCompanyIdentity();
    void loadJobs();
    void loadProposals();

    return () => {
      isMounted = false;
    };
  }, [loadJobs, loadProposals]);

  const activeJobs = useMemo(() => jobs.filter((job) => !isCompletedJob(job)), [jobs]);
  const completedJobs = useMemo(() => jobs.filter(isCompletedJob), [jobs]);
  const visibleJobs = activeTab === 'completed' ? completedJobs : activeJobs;
  const isLoadingCurrentTab = activeTab === 'proposals' ? isLoadingProposals : isLoadingJobs;
  const currentError = activeTab === 'proposals' ? proposalsError : jobsError;

  function selectTab(tab: JobsTab) {
    setActiveTab(tab);
    setSearchParams(tab === 'active' ? {} : { tab });
  }

  function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  async function createJobFromProposal(proposal: Proposal) {
    setCreatingJobProposalId(proposal.id);
    setProposalsError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to create a job.');

      const proposalNumber = proposal.proposal_number ?? proposal.id.slice(0, 8).toUpperCase();
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          organization_id: proposal.organization_id,
          user_id: userData.user.id,
          name: proposal.proposal_name,
          service_type: proposal.service_type,
          location: proposal.site_address || proposal.client_name,
          planned_date: getTodayDate(),
          notes: `Created from proposal ${proposalNumber}. Confirm planned date during Mission Planning / JHA.`,
          status: 'Planned',
          source_proposal_id: proposal.id,
          source_proposal_number: proposalNumber,
          client_name: proposal.client_name,
          contact_name: proposal.contact_name,
          client_phone: proposal.phone,
          client_email: proposal.email,
          site_address: proposal.site_address,
          preliminary_hazards: proposal.hazard_assessment ?? [],
          proposed_rpic_id: proposal.proposed_rpic_id,
          proposed_rpic_name: proposal.proposed_rpic_name,
          proposed_rpic_credentials: proposal.proposed_rpic_credentials,
          proposed_rpic_bio: proposal.proposed_rpic_bio
        })
        .select('id, name, service_type, location, planned_date, status')
        .single();

      if (error) throw error;

      setJobs((current) => [data as Job, ...current]);
      await updateProposalStatus(proposal.id, 'Accepted');
      navigate(`/jobs/${(data as Job).id}`);
    } catch (createError) {
      setProposalsError(getErrorMessage(createError));
    } finally {
      setCreatingJobProposalId(null);
    }
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

  async function deleteProposal(proposalId: string) {
    if (!window.confirm('Are you sure? This will remove the proposal from your active workspace.')) return;

    setDeletingProposalId(proposalId);
    setProposalsError(null);
    setWorkspaceMessage(null);

    try {
      // Soft-delete only. Future Archive and Locked Record workflows can branch from deleted_at.
      const { error } = await supabase
        .from('proposals')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (error) throw error;

      setWorkspaceMessage('Proposal removed from your active workspace.');
      await loadProposals();
    } catch (deleteError) {
      setProposalsError(getErrorMessage(deleteError));
    } finally {
      setDeletingProposalId(null);
    }
  }

  async function deleteJob(jobId: string) {
    if (!window.confirm('Are you sure? This will remove the job from your active workspace.')) return;

    setDeletingJobId(jobId);
    setJobsError(null);
    setWorkspaceMessage(null);

    try {
      // Soft-delete only. Future Archive and Locked Record workflows can branch from deleted_at.
      const { error } = await supabase
        .from('jobs')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;

      setWorkspaceMessage('Job removed from your active workspace.');
      await loadJobs();
    } catch (deleteError) {
      setJobsError(getErrorMessage(deleteError));
    } finally {
      setDeletingJobId(null);
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
            Unable to load or update {activeTab === 'proposals' ? 'proposals' : 'jobs'}
          </h2>
          <p className="mt-2 text-sm text-red-700">{currentError}</p>
        </div>
      ) : null}

      {workspaceMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 shadow-sm" role="status">
          {workspaceMessage}
        </div>
      ) : null}

      {activeTab === 'proposals' ? (
        <OrganizationIdentityCard
          organization={organizationSettings}
          title="Proposal Company Information"
          description="Company identity is auto-populated from Settings for proposal display and future exports."
          isLoading={isLoadingOrganization}
        />
      ) : null}

      {activeTab === 'proposals' && !isLoadingProposals && !proposalsError && proposals.length > 0 ? (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <article key={proposal.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-brand-900">{proposal.proposal_name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{proposal.client_name}</p>
                </div>
                <div className="flex flex-col gap-2 sm:min-w-44">
                  <label className="block text-sm font-medium text-slate-700">
                    <span className="sr-only">Proposal status</span>
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 sm:py-2 sm:text-sm"
                      value={proposal.status}
                      onChange={(event) => void updateProposalStatus(proposal.id, event.target.value as ProposalStatus)}
                      disabled={updatingProposalId === proposal.id || creatingJobProposalId === proposal.id}
                    >
                      {proposalStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-h-0 sm:py-2"
                    onClick={() => void createJobFromProposal(proposal)}
                    disabled={creatingJobProposalId === proposal.id}
                  >
                    {creatingJobProposalId === proposal.id ? 'Creating Job...' : 'Create Job'}
                  </button>
                  <Link
                    to={`/jobs/proposals/${proposal.id}/edit`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-700 bg-white px-3 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 sm:min-h-0 sm:py-2"
                  >
                    Edit Proposal
                  </Link>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0 sm:py-2"
                    onClick={() => void deleteProposal(proposal.id)}
                    disabled={deletingProposalId === proposal.id || creatingJobProposalId === proposal.id}
                  >
                    {deletingProposalId === proposal.id ? 'Removing...' : 'Delete Proposal'}
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="font-medium text-slate-500">Proposal number</dt>
                  <dd className="mt-1 text-slate-700">{proposal.proposal_number ?? proposal.id.slice(0, 8).toUpperCase()}</dd>
                </div>
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
                <div>
                  <dt className="font-medium text-slate-500">Proposed RPIC</dt>
                  <dd className="mt-1 text-slate-700">{proposal.proposed_rpic_name ?? 'Not selected'}</dd>
                </div>
              </dl>

              {proposal.proposed_rpic_credentials || proposal.proposed_rpic_bio ? (
                <div className="mt-4 grid gap-3 text-sm lg:grid-cols-2">
                  {proposal.proposed_rpic_credentials ? (
                    <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
                      <h3 className="font-semibold text-brand-900">RPIC Credentials Snapshot</h3>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{proposal.proposed_rpic_credentials}</p>
                    </div>
                  ) : null}
                  {proposal.proposed_rpic_bio ? (
                    <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
                      <h3 className="font-semibold text-brand-900">RPIC Bio Snapshot</h3>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{proposal.proposed_rpic_bio}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {proposal.hazard_assessment?.length ? (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-brand-900">Preliminary Hazard Assessment</h3>
                  <div className="grid gap-2 lg:grid-cols-2">
                    {proposal.hazard_assessment.map((hazard) => (
                      <div key={hazard.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <p className="font-semibold text-brand-900">{getSelectedHazardName(hazard)}</p>
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{hazard.category}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-slate-700">{hazard.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {activeTab !== 'proposals' && !isLoadingJobs && !jobsError && visibleJobs.length > 0 ? (
        <div className="space-y-3">
          {visibleJobs.map((job) => (
            <article key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <Link
                  to={`/jobs/${job.id}`}
                  className="block flex-1 rounded-lg transition hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <h2 className="text-base font-semibold text-brand-900">{job.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{job.service_type}</p>
                </Link>
                <div className="flex flex-col gap-2 sm:items-end">
                  <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    {job.status}
                  </span>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0 sm:py-2"
                    onClick={() => void deleteJob(job.id)}
                    disabled={deletingJobId === job.id}
                  >
                    {deletingJobId === job.id ? 'Removing...' : 'Delete Job'}
                  </button>
                </div>
              </div>

              <Link
                to={`/jobs/${job.id}`}
                className="mt-4 block rounded-lg transition hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">Location</dt>
                    <dd className="mt-1 text-slate-700">{job.location}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Planned date</dt>
                    <dd className="mt-1 text-slate-700">{formatDate(job.planned_date)}</dd>
                  </div>
                </dl>
              </Link>
            </article>
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
