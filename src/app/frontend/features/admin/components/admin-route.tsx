/**
 * File purpose: Guards admin-only routes so they render only for platform admins.
 * Fallback/error behavior: Non-admins are sent to the dashboard; a pending admin check shows a short loading message.
 * Known limitation: This only hides screens. The database refuses admin actions from non-admins on its own.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/components/use-auth';

export function AdminRoute() {
  const { isPlatformAdmin } = useAuth();

  if (isPlatformAdmin === null) {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Checking access...
      </section>
    );
  }

  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
