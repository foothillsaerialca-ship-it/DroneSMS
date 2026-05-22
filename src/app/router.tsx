import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './shell';
import { DashboardPage } from '../features/dashboard/pages/dashboard-page';
import { JobsPage } from '../features/jobs/pages/jobs-page';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">Phase 0 route placeholder.</p>
    </section>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<PlaceholderPage title="Job Details" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
    </Routes>
  );
}
