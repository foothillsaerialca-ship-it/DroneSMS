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
import { LoginPage } from './frontend/features/auth/pages/login-page';
import { RegisterPage } from './frontend/features/auth/pages/register-page';
import { CompanyOnboardingPage } from './frontend/features/auth/pages/company-onboarding-page';
import { SettingsPage } from '../features/settings/pages/settings-page';
import { ProfilePage } from '../features/settings/pages/profile-page';
import { ProtectedRoute } from './frontend/features/auth/components/protected-route';

export function AppRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/onboarding/company" element={<CompanyOnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/new" element={<NewJobPage />} />
          <Route path="/jobs/proposals/new" element={<NewProposalPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/jobs/:jobId/hub" element={<JobFileHubPage />} />
          <Route path="/jobs/:jobId/templates/jha" element={<JobHazardAnalysisPage />} />
          <Route path="/jobs/:jobId/templates/preflight" element={<PreflightChecklistPage />} />
          <Route path="/personnel" element={<PersonnelPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
