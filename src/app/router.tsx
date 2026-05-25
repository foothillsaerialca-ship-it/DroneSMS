import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './shell';
import { DashboardPage } from '../features/dashboard/pages/dashboard-page';
import { JobsPage } from '../features/jobs/pages/jobs-page';
import { NewJobPage } from '../features/jobs/pages/new-job-page';
import { LoginPage } from '../features/auth/pages/login-page';
import { RegisterPage } from '../features/auth/pages/register-page';
import { CompanyOnboardingPage } from '../features/auth/pages/company-onboarding-page';
import { ProtectedRoute } from '../features/auth/components/protected-route';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">Route placeholder.</p>
    </section>
  );
}

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
          <Route path="/jobs/:id" element={<PlaceholderPage title="Job Details" />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
