import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './frontend/shell';
import { DashboardPage } from './frontend/features/dashboard/pages/dashboard-page';
import { JobsPage } from './frontend/features/jobs/pages/jobs-page';
import { NewJobPage } from './frontend/features/jobs/pages/new-job-page';
import { NewProposalPage } from './frontend/features/jobs/pages/new-proposal-page';
import { JobDetailPage } from './frontend/features/jobs/pages/job-detail-page';
import { JobFileHubPage } from './frontend/features/jobs/pages/job-file-hub-page';
import { JobHazardAnalysisPage } from './frontend/features/jobs/pages/job-hazard-analysis-page';
import { PreflightChecklistPage } from './frontend/features/preflight/pages/preflight-checklist-page';
import { PersonnelPage } from './frontend/features/personnel/pages/personnel-page';
import { EquipmentPage } from './frontend/features/equipment/pages/equipment-page';
import { LoginPage } from './frontend/features/auth/pages/login-page';
import { RegisterPage } from './frontend/features/auth/pages/register-page';
import { CompanyOnboardingPage } from './frontend/features/auth/pages/company-onboarding-page';
import { SettingsPage } from './frontend/features/settings/pages/settings-page';
import { ReportsPage } from './frontend/features/reports/pages/reports-page';
import { AboutPage } from './frontend/features/information/team';
import { ProtectedRoute } from './frontend/features/auth/components/protected-route';

function LandingPage() {
  return (
    <section className="mx-auto w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Welcome to</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">DroneSMS</h1>
        <p className="mx-auto max-w-lg text-sm leading-6 text-slate-600">
          A practical operational safety system for drone operators, helping teams identify hazards, document mitigations, capture evidence, generate operational records, and demonstrate due diligence throughout every stage of flight operations.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          Sign In
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Register
        </Link>
      </div>
    </section>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/onboarding/company" element={<CompanyOnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/proposals" element={<JobsPage mode="proposals" />} />
          <Route path="/jobs/new" element={<NewJobPage />} />
          <Route path="/jobs/proposals/new" element={<NewProposalPage />} />
          <Route path="/jobs/proposals/:proposalId/edit" element={<NewProposalPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/jobs/:jobId/hub" element={<JobFileHubPage />} />
          <Route path="/jobs/:jobId/templates/jha" element={<JobHazardAnalysisPage />} />
          <Route path="/jobs/:jobId/templates/preflight" element={<PreflightChecklistPage />} />
          <Route path="/personnel" element={<PersonnelPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
