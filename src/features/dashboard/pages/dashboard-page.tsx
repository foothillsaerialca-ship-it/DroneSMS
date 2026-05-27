import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/components/use-auth';
import { supabase } from '../../../integrations/supabase/client';

type JobMetric = {
  status: string | null;
};

type HazardEntryMetric = {
  likelihood?: number | string | null;
  severity?: number | string | null;
  riskScore?: number | string | null;
};

type JhaMetric = {
  status: string | null;
  hazard_entries: unknown;
  overall_risk_rating: string | null;
  remote_pilot_in_command: string | null;
  crew_briefed: boolean | null;
  controls_in_place: boolean | null;
  stop_work_authority_acknowledged: boolean | null;
  rpic_printed_name: string | null;
};

type DashboardMetrics = {
  companyName: string | null;
  openJobs: number;
  highRiskJhas: number;
  draftJhas: number;
  incompleteCertifications: number;
  missingCrewBriefings: number;
  readinessPercent: number;
  readinessDetail: string;
};

type DashboardCard = {
  title: string;
  value: string;
  detail: string;
  accent: string;
};

const openJobStatuses = new Set(['planned', 'in progress', 'awaiting review']);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load dashboard metrics. Please try again.';
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function getHazardScore(entry: HazardEntryMetric) {
  const explicitScore = Number(entry.riskScore);
  if (Number.isFinite(explicitScore) && explicitScore > 0) return explicitScore;

  const likelihood = Number(entry.likelihood);
  const severity = Number(entry.severity);
  if (!Number.isFinite(likelihood) || !Number.isFinite(severity)) return 0;

  return likelihood * severity;
}

function hasHighRiskHazard(assessment: JhaMetric) {
  if (normalizeStatus(assessment.overall_risk_rating) === 'high') return true;
  if (!Array.isArray(assessment.hazard_entries)) return false;

  return assessment.hazard_entries.some((entry) => getHazardScore(entry as HazardEntryMetric) >= 15);
}

function isCertificationIncomplete(assessment: JhaMetric) {
  return !assessment.crew_briefed || !assessment.controls_in_place || !assessment.stop_work_authority_acknowledged;
}

function hasRpicName(assessment: JhaMetric) {
  return Boolean(assessment.rpic_printed_name?.trim() || assessment.remote_pilot_in_command?.trim());
}

function calculateReadiness(assessments: JhaMetric[]) {
  if (assessments.length === 0) {
    return {
      readinessPercent: 0,
      readinessDetail: 'No JHA readiness records yet.'
    };
  }

  const completedChecks = assessments.reduce((total, assessment) => {
    const rpicReady = hasRpicName(assessment) ? 1 : 0;
    const crewReady = assessment.crew_briefed ? 1 : 0;
    const jhaComplete = normalizeStatus(assessment.status) === 'complete' ? 1 : 0;

    return total + rpicReady + crewReady + jhaComplete;
  }, 0);
  const totalChecks = assessments.length * 3;
  const readinessPercent = Math.round((completedChecks / totalChecks) * 100);

  return {
    readinessPercent,
    readinessDetail: `${completedChecks} of ${totalChecks} readiness checks complete across ${assessments.length} JHA${assessments.length === 1 ? '' : 's'}.`
  };
}

async function loadDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const profileQuery = supabase.from('profiles').select('company_name').eq('id', userId).maybeSingle();
  const jobsQuery = supabase.from('jobs').select('status');
  const jhaQuery = supabase
    .from('jha_assessments')
    .select('status, hazard_entries, overall_risk_rating, remote_pilot_in_command, crew_briefed, controls_in_place, stop_work_authority_acknowledged, rpic_printed_name');

  const [profileResult, jobsResult, jhaResult] = await Promise.all([profileQuery, jobsQuery, jhaQuery]);

  if (profileResult.error) throw profileResult.error;
  if (jobsResult.error) throw jobsResult.error;
  if (jhaResult.error) throw jhaResult.error;

  const jobs = (jobsResult.data ?? []) as JobMetric[];
  const assessments = (jhaResult.data ?? []) as JhaMetric[];
  const highRiskJhas = assessments.filter(hasHighRiskHazard).length;
  const draftJhas = assessments.filter((assessment) => normalizeStatus(assessment.status) === 'draft').length;
  const incompleteCertifications = assessments.filter(isCertificationIncomplete).length;
  const missingCrewBriefings = assessments.filter((assessment) => !assessment.crew_briefed).length;
  const readiness = calculateReadiness(assessments);

  return {
    companyName: profileResult.data?.company_name ?? null,
    openJobs: jobs.filter((job) => openJobStatuses.has(normalizeStatus(job.status))).length,
    highRiskJhas,
    draftJhas,
    incompleteCertifications,
    missingCrewBriefings,
    ...readiness
  };
}

function getSafetyStatus(metrics: DashboardMetrics) {
  if (metrics.highRiskJhas > 0) return 'High Risk Attention Required';
  if (metrics.incompleteCertifications > 0 || metrics.missingCrewBriefings > 0 || metrics.draftJhas > 0) return 'Needs Review';
  return 'Ready';
}

function getSafetyDetail(metrics: DashboardMetrics) {
  if (metrics.highRiskJhas > 0) {
    return `${metrics.highRiskJhas} high-risk JHA${metrics.highRiskJhas === 1 ? '' : 's'} require review before work proceeds.`;
  }

  if (metrics.incompleteCertifications > 0 || metrics.missingCrewBriefings > 0) {
    return `${metrics.incompleteCertifications} JHA${metrics.incompleteCertifications === 1 ? '' : 's'} have incomplete certification or crew briefing acknowledgements.`;
  }

  if (metrics.draftJhas > 0) {
    return `${metrics.draftJhas} draft JHA${metrics.draftJhas === 1 ? '' : 's'} should be completed before operations.`;
  }

  return 'No active safety blockers found in current JHAs.';
}

function getHazardReportMessage(metrics: DashboardMetrics) {
  if (metrics.highRiskJhas > 0) {
    return `${metrics.highRiskJhas} High Risk JHA${metrics.highRiskJhas === 1 ? ' Requires' : 's Require'} Review`;
  }

  if (metrics.incompleteCertifications > 0) {
    return `${metrics.incompleteCertifications} JHA${metrics.incompleteCertifications === 1 ? '' : 's'} Need Crew Certification`;
  }

  if (metrics.draftJhas > 0) {
    return `${metrics.draftJhas} Draft JHA${metrics.draftJhas === 1 ? '' : 's'} Pending`;
  }

  return 'No active hazard alerts';
}

function buildDashboardCards(metrics: DashboardMetrics): DashboardCard[] {
  const safetyStatus = getSafetyStatus(metrics);
  const hazardAlertCount = metrics.highRiskJhas + metrics.draftJhas + metrics.incompleteCertifications;

  return [
    {
      title: 'Safety Status',
      value: safetyStatus,
      detail: getSafetyDetail(metrics),
      accent:
        safetyStatus === 'Ready'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : safetyStatus === 'Needs Review'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-red-50 text-red-700 border-red-200'
    },
    {
      title: 'Open Jobs',
      value: String(metrics.openJobs),
      detail: 'Jobs currently Planned, In Progress, or Awaiting Review.',
      accent: 'bg-blue-50 text-brand-700 border-blue-200'
    },
    {
      title: 'Recent Hazard Reports',
      value: String(hazardAlertCount),
      detail: getHazardReportMessage(metrics),
      accent: hazardAlertCount === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      title: 'Aircraft/Pilot Readiness',
      value: `${metrics.readinessPercent}%`,
      detail: metrics.readinessDetail,
      accent: metrics.readinessPercent >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
    }
  ];
}

export function DashboardPage() {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMetrics() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const dashboardMetrics = await loadDashboardMetrics(session.user.id);
        if (!isMounted) return;
        setMetrics(dashboardMetrics);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const displayName = isLoading ? 'Loading company...' : metrics?.companyName ?? 'Your flight operation';
  const dashboardCards = metrics ? buildDashboardCards(metrics) : [];

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{displayName}</h1>
            <p className="mt-2 text-sm text-slate-600">Today's safety, job, and readiness snapshot.</p>
          </div>
          <Link
            to="/jobs/new"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            Create Job
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading dashboard metrics...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h2 className="text-base font-semibold text-red-800">Unable to load dashboard metrics</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && metrics ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {dashboardCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-brand-900">{card.title}</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${card.accent}`}>{card.value}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{card.detail}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
