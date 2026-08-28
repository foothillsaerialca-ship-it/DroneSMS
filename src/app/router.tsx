import { Navigate, Route, Routes } from 'react-router-dom';
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
import { BetaWelcomePage } from './frontend/features/auth/pages/beta-welcome-page';
import { RegisterPage } from './frontend/features/auth/pages/register-page';
import { CompanyOnboardingPage } from './frontend/features/auth/pages/company-onboarding-page';
import { SettingsPage } from './frontend/features/settings/pages/settings-page';
import { AccountSettingsPage } from './frontend/features/settings/pages/account-settings-page';
import { SmsPage } from './frontend/features/sms/pages/sms-page';
import { ReportsPage } from './frontend/features/reports/pages/reports-page';
import { AboutPage } from './frontend/features/information/team';
import { ProtectedRoute } from './frontend/features/auth/components/protected-route';
import { ForgotPasswordPage } from './frontend/features/auth/pages/forgot-password-page';
import { ResetPasswordPage } from './frontend/features/auth/pages/reset-password-page';
import { AuthCallbackPage } from './frontend/features/auth/pages/auth-callback-page';

export function AppRouter() {
  return (
    <Routes>
      <Route index element={<BetaWelcomePage />} />
      <Route path="/login" element={<BetaWelcomePage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/onboarding/company" element={<CompanyOnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/proposals" element={<JobsPage mode="proposals" />} />
          <Route path="/jobs/new" element={<NewJobPage />} />
          <Route path="/proposals/new" element={<NewProposalPage />} />
          <Route path="/proposals/:proposalId/edit" element={<NewProposalPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/jobs/:jobId/hub" element={<JobFileHubPage />} />
          <Route path="/jobs/:jobId/templates/jha" element={<JobHazardAnalysisPage />} />
          <Route path="/jobs/:jobId/templates/preflight" element={<PreflightChecklistPage />} />
          <Route path="/personnel" element={<PersonnelPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/settings" element={<Navigate to="/settings/organization" replace />} />
          <Route path="/settings/account" element={<AccountSettingsPage />} />
          <Route path="/settings/organization" element={<SettingsPage />} />
          <Route path="/sms" element={<SmsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
