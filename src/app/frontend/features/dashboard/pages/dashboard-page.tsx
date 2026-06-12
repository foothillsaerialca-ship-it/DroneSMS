import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/components/use-auth';
import { supabase } from '@frontend/lib/supabase';

type DashboardJob = {
  id: string;
  name: string;
  client_name: string | null;
  service_type: string;
  planned_date: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type DashboardJha = {
  job_id: string;
  status: string | null;
  crew_briefed: boolean | null;
  controls_in_place: boolean | null;
  stop_work_authority_acknowledged: boolean | null;
  updated_at: string;
};

type DashboardProposal = {
  id: string;
  proposal_name: string;
  client_name: string;
  service_type: string;
  status: string;
  converted_to_job: boolean;
  converted_job_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

type CountByJobId = Record<string, number>;

type AttentionItem = {
  id: string;
  label: string;
  detail: string;
  to: string;
};

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  to: string;
};

type DashboardData = {
  companyName: string | null;
  currentOperation: DashboardJob | null;
  currentWorkflowStage: string;
  attentionItems: AttentionItem[];
  upcomingOperations: DashboardJob[];
  recentActivity: ActivityItem[];
};

const activeJobStatuses = new Set(['planned', 'in progress', 'needs review', 'awaiting review', 'awaiting closeout']);
const currentPriority: Record<string, number> = {
  'in progress': 0,
  'awaiting closeout': 1,
  'needs review': 2,
  'awaiting review': 2,
  planned: 3
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load dashboard. Please try again.';
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function formatPlannedDate(dateValue: string) {
  if (!dateValue) return 'Not scheduled';

  const [datePart] = dateValue.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return dateValue;

  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(year, month - 1, day));
}

function formatActivityDate(dateValue: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(dateValue));
}

function isActiveJob(job: DashboardJob) {
  return activeJobStatuses.has(normalizeStatus(job.status));
}

function isJhaComplete(jha: DashboardJha | undefined) {
  return normalizeStatus(jha?.status) === 'complete' || normalizeStatus(jha?.status) === 'completed';
}

function isCloseoutStatus(status: string) {
  const normalized = normalizeStatus(status);
  return normalized === 'needs review' || normalized === 'awaiting review' || normalized === 'awaiting closeout';
}

function getWorkflowStage(job: DashboardJob | null, jhaByJobId: Map<string, DashboardJha>, crewCounts: CountByJobId, equipmentCounts: CountByJobId) {
  if (!job) return 'No active workflow';

  const status = normalizeStatus(job.status);
  if (status === 'in progress') return 'In Progress';
  if (isCloseoutStatus(job.status)) return 'Awaiting Closeout';
  if ((crewCounts[job.id] ?? 0) === 0) return 'Crew Assignment';
  if ((equipmentCounts[job.id] ?? 0) === 0) return 'Equipment Assignment';
  if (!isJhaComplete(jhaByJobId.get(job.id))) return 'JHA In Progress';
  return 'Ready';
}

function getCurrentOperation(jobs: DashboardJob[]) {
  const today = getTodayDateString();
  const activeJobs = jobs.filter(isActiveJob);

  return [...activeJobs].sort((first, second) => {
    const firstPriority = currentPriority[normalizeStatus(first.status)] ?? 4;
    const secondPriority = currentPriority[normalizeStatus(second.status)] ?? 4;
    if (firstPriority !== secondPriority) return firstPriority - secondPriority;

    const firstIsUpcoming = first.planned_date >= today ? 0 : 1;
    const secondIsUpcoming = second.planned_date >= today ? 0 : 1;
    if (firstIsUpcoming !== secondIsUpcoming) return firstIsUpcoming - secondIsUpcoming;

    return first.planned_date.localeCompare(second.planned_date);
  })[0] ?? null;
}

function buildAttentionItems(
  jobs: DashboardJob[],
  proposals: DashboardProposal[],
  jhaByJobId: Map<string, DashboardJha>,
  crewCounts: CountByJobId,
  equipmentCounts: CountByJobId
) {
  const items: AttentionItem[] = [];

  jobs.filter(isActiveJob).forEach((job) => {
    if ((crewCounts[job.id] ?? 0) === 0) {
      items.push({ id: `${job.id}-crew`, label: 'Crew assignment missing', detail: job.name, to: `/jobs/${job.id}/hub#crew-assignment` });
    }

    if ((equipmentCounts[job.id] ?? 0) === 0) {
      items.push({ id: `${job.id}-equipment`, label: 'Equipment assignment missing', detail: job.name, to: `/jobs/${job.id}/hub#equipment-assignment` });
    }

    const jha = jhaByJobId.get(job.id);
    if (!isJhaComplete(jha)) {
      items.push({ id: `${job.id}-jha`, label: 'JHA not completed', detail: job.name, to: `/jobs/${job.id}/templates/jha` });
    }

    if (isCloseoutStatus(job.status)) {
      items.push({ id: `${job.id}-closeout`, label: 'Closeout required', detail: job.name, to: `/jobs/${job.id}/hub` });
    }
  });

  proposals
    .filter((proposal) => !proposal.converted_to_job && ['sent', 'under review'].includes(normalizeStatus(proposal.status)))
    .forEach((proposal) => {
      items.push({ id: `${proposal.id}-proposal`, label: 'Proposal awaiting review', detail: proposal.proposal_name, to: `/jobs/proposals/${proposal.id}/edit` });
    });

  return items.slice(0, 5);
}

function buildUpcomingOperations(jobs: DashboardJob[], currentOperation: DashboardJob | null) {
  const today = getTodayDateString();

  return jobs
    .filter((job) => isActiveJob(job) && job.id !== currentOperation?.id && job.planned_date >= today)
    .sort((first, second) => first.planned_date.localeCompare(second.planned_date))
    .slice(0, 3);
}

function buildRecentActivity(jobs: DashboardJob[], proposals: DashboardProposal[], jhas: DashboardJha[], photoRows: Array<{ id: string; job_id: string; created_at: string }>) {
  const jobNames = new Map(jobs.map((job) => [job.id, job.name]));
  const items: ActivityItem[] = [];

  proposals.forEach((proposal) => {
    items.push({
      id: `${proposal.id}-created`,
      label: 'Proposal Created',
      detail: proposal.proposal_name,
      timestamp: proposal.created_at,
      to: `/jobs/proposals/${proposal.id}/edit`
    });

    if (proposal.converted_to_job && proposal.converted_job_id && proposal.converted_at) {
      items.push({
        id: `${proposal.id}-converted`,
        label: 'Proposal Converted to Job',
        detail: proposal.proposal_name,
        timestamp: proposal.converted_at,
        to: `/jobs/${proposal.converted_job_id}/hub`
      });
    }
  });

  jobs.forEach((job) => {
    if (normalizeStatus(job.status) === 'complete' || normalizeStatus(job.status) === 'completed') {
      items.push({ id: `${job.id}-closed`, label: 'Job Closed', detail: job.name, timestamp: job.updated_at, to: `/jobs/${job.id}/hub` });
    }
  });

  jhas.filter(isJhaComplete).forEach((jha) => {
    items.push({
      id: `${jha.job_id}-jha-complete`,
      label: 'JHA Completed',
      detail: jobNames.get(jha.job_id) ?? 'Job hazard analysis',
      timestamp: jha.updated_at,
      to: `/jobs/${jha.job_id}/templates/jha`
    });
  });

  photoRows.forEach((photo) => {
    items.push({
      id: `${photo.id}-photo`,
      label: 'Evidence Photo Added',
      detail: jobNames.get(photo.job_id) ?? 'Job evidence',
      timestamp: photo.created_at,
      to: `/jobs/${photo.job_id}/templates/jha`
    });
  });

  return items
    .filter((item) => Boolean(item.timestamp))
    .sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime())
    .slice(0, 6);
}

function countRowsByJobId(rows: Array<{ job_id: string }>) {
  return rows.reduce<CountByJobId>((counts, row) => {
    counts[row.job_id] = (counts[row.job_id] ?? 0) + 1;
    return counts;
  }, {});
}

async function loadDashboardData(userId: string): Promise<DashboardData> {
  const profileQuery = supabase.from('profiles').select('company_name').eq('id', userId).maybeSingle();
  const jobsQuery = supabase
    .from('jobs')
    .select('id, name, client_name, service_type, planned_date, status, created_at, updated_at')
    .is('deleted_at', null)
    .order('planned_date', { ascending: true })
    .order('created_at', { ascending: false });
  const proposalsQuery = supabase
    .from('proposals')
    .select('id, proposal_name, client_name, service_type, status, converted_to_job, converted_job_id, converted_at, created_at, updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  const jhaQuery = supabase.from('jha_assessments').select('job_id, status, crew_briefed, controls_in_place, stop_work_authority_acknowledged, updated_at');
  const personnelQuery = supabase.from('job_personnel').select('job_id');
  const equipmentQuery = supabase.from('job_equipment').select('job_id');
  const photosQuery = supabase
    .from('job_hazard_photos')
    .select('id, job_id, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const [profileResult, jobsResult, proposalsResult, jhaResult, personnelResult, equipmentResult, photosResult] = await Promise.all([
    profileQuery,
    jobsQuery,
    proposalsQuery,
    jhaQuery,
    personnelQuery,
    equipmentQuery,
    photosQuery
  ]);

  if (profileResult.error) throw profileResult.error;
  if (jobsResult.error) throw jobsResult.error;
  if (proposalsResult.error) throw proposalsResult.error;
  if (jhaResult.error) throw jhaResult.error;
  if (personnelResult.error) throw personnelResult.error;
  if (equipmentResult.error) throw equipmentResult.error;
  if (photosResult.error) throw photosResult.error;

  const jobs = (jobsResult.data ?? []) as DashboardJob[];
  const proposals = (proposalsResult.data ?? []) as DashboardProposal[];
  const jhas = (jhaResult.data ?? []) as DashboardJha[];
  const jhaByJobId = new Map(jhas.map((jha) => [jha.job_id, jha]));
  const crewCounts = countRowsByJobId((personnelResult.data ?? []) as Array<{ job_id: string }>);
  const equipmentCounts = countRowsByJobId((equipmentResult.data ?? []) as Array<{ job_id: string }>);
  const currentOperation = getCurrentOperation(jobs);

  return {
    companyName: profileResult.data?.company_name ?? null,
    currentOperation,
    currentWorkflowStage: getWorkflowStage(currentOperation, jhaByJobId, crewCounts, equipmentCounts),
    attentionItems: buildAttentionItems(jobs, proposals, jhaByJobId, crewCounts, equipmentCounts),
    upcomingOperations: buildUpcomingOperations(jobs, currentOperation),
    recentActivity: buildRecentActivity(jobs, proposals, jhas, (photosResult.data ?? []) as Array<{ id: string; job_id: string; created_at: string }>)
  };
}

function ActionLink({ to, children, variant = 'secondary' }: { to: string; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  const classes =
    variant === 'primary'
      ? 'bg-brand-700 text-white hover:bg-brand-900 focus:ring-brand-100'
      : 'border border-slate-200 bg-slate-100 text-slate-700 hover:border-brand-700 hover:text-brand-900 focus:ring-brand-100';

  return (
    <Link to={to} className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 sm:min-h-0 sm:py-2 ${classes}`}>
      {children}
    </Link>
  );
}

export function DashboardPage() {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const dashboardData = await loadDashboardData(session.user.id);
        if (!isMounted) return;
        setDashboard(dashboardData);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const displayName = isLoading ? 'Loading company...' : dashboard?.companyName ?? 'Your flight operation';
  const currentOperation = dashboard?.currentOperation ?? null;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">{displayName}</h1>
        <p className="mt-2 text-sm text-slate-600">Your operation-focused workspace: what needs to happen next.</p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading dashboard...</div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h2 className="text-base font-semibold text-red-800">Unable to load dashboard</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && dashboard ? (
        <>
          <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="current-operation-heading">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-700">Current Operation</p>
                {currentOperation ? (
                  <>
                    <h2 id="current-operation-heading" className="mt-1 text-2xl font-semibold text-brand-900">
                      {currentOperation.name}
                    </h2>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <dt className="font-medium text-slate-500">Client</dt>
                        <dd className="mt-1 text-slate-900">{currentOperation.client_name || 'Not specified'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Service Type</dt>
                        <dd className="mt-1 text-slate-900">{currentOperation.service_type}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Planned Date</dt>
                        <dd className="mt-1 text-slate-900">{formatPlannedDate(currentOperation.planned_date)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Current Status</dt>
                        <dd className="mt-1 text-slate-900">{currentOperation.status}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Current Workflow Stage</dt>
                        <dd className="mt-1 text-slate-900">{dashboard.currentWorkflowStage}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <div>
                    <h2 id="current-operation-heading" className="mt-1 text-2xl font-semibold text-brand-900">No Active Operations</h2>
                    <p className="mt-2 text-sm text-slate-600">Create a proposal or job to begin the next operational workflow.</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                {currentOperation ? (
                  <ActionLink to={`/jobs/${currentOperation.id}/hub`} variant="primary">Continue Operation</ActionLink>
                ) : (
                  <>
                    <ActionLink to="/jobs/proposals/new" variant="primary">Create Proposal</ActionLink>
                    <ActionLink to="/jobs/new">Create Job</ActionLink>
                  </>
                )}
              </div>
            </div>
          </section>

          {dashboard.attentionItems.length > 0 ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5" aria-labelledby="attention-required-heading">
              <h2 id="attention-required-heading" className="text-lg font-semibold text-amber-900">Attention Required</h2>
              <div className="mt-3 space-y-2">
                {dashboard.attentionItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    </div>
                    <ActionLink to={item.to}>Open</ActionLink>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="upcoming-operations-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="upcoming-operations-heading" className="text-lg font-semibold text-brand-900">Upcoming Operations</h2>
                  <p className="mt-1 text-sm text-slate-600">Planned work coming up next.</p>
                </div>
                <ActionLink to="/jobs">View All Jobs</ActionLink>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {dashboard.upcomingOperations.length > 0 ? (
                  dashboard.upcomingOperations.map((job) => (
                    <Link key={job.id} to={`/jobs/${job.id}/hub`} className="grid gap-2 py-3 text-sm transition hover:bg-slate-50 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center">
                      <span className="font-semibold text-brand-700">{formatPlannedDate(job.planned_date)}</span>
                      <span>
                        <span className="block font-medium text-slate-900">{job.name}</span>
                        <span className="block text-slate-600">{job.service_type}</span>
                      </span>
                      <span className="w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{job.status}</span>
                    </Link>
                  ))
                ) : (
                  <p className="py-4 text-sm text-slate-600">No upcoming operations scheduled.</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="recent-activity-heading">
              <h2 id="recent-activity-heading" className="text-lg font-semibold text-brand-900">Recent Activity</h2>
              <div className="mt-4 space-y-3">
                {dashboard.recentActivity.length > 0 ? (
                  dashboard.recentActivity.map((activity) => (
                    <Link key={activity.id} to={activity.to} className="flex gap-3 rounded-lg p-2 transition hover:bg-slate-50">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-700" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{activity.label}</span>
                        <span className="block truncate text-sm text-slate-600">{activity.detail}</span>
                        <span className="block text-xs text-slate-500">{formatActivityDate(activity.timestamp)}</span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">No recent activity yet.</p>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="quick-actions-heading">
            <h2 id="quick-actions-heading" className="text-lg font-semibold text-brand-900">Quick Actions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <ActionLink to="/jobs/proposals/new" variant="primary">Create Proposal</ActionLink>
              <ActionLink to="/jobs/new">Create Job</ActionLink>
              <ActionLink to="/personnel">Personnel</ActionLink>
              <ActionLink to="/equipment">Equipment</ActionLink>
              <button
                type="button"
                className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-400 sm:min-h-0 sm:py-2"
                disabled
                title="Packet export will be available from the closeout workflow in a future update."
              >
                Export Packet
              </button>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
