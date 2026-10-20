/**
 * File purpose: Guards admin-only routes so they render only for signed-in platform admins.
 * Fallback/error behavior: Signed-out visitors go to sign in, non-admins to the dashboard; pending checks show a short loading message.
 * Known limitation: This only hides screens. The database refuses admin actions from non-admins on its own.
 */
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/components/use-auth';

function Checking({ label }: { label: string }) {
  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      {label}
    </section>
  );
}

// Admin tools do not require company onboarding, so staff accounts without an
// organization can still manage the platform; this guard handles sign-in itself.
export function AdminRoute() {
  const { status, isPlatformAdmin, refreshPlatformAdmin } = useAuth();
  const location = useLocation();

  // Re-check on entry and whenever the tab regains focus, so an admin removed
  // by someone else loses these screens without reloading.
  useEffect(() => {
    if (status !== 'authenticated') return;
    void refreshPlatformAdmin();
    const recheck = () => {
      if (document.visibilityState === 'visible') void refreshPlatformAdmin();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [status, refreshPlatformAdmin]);

  if (status === 'loading') return <Checking label="Checking sign-in status..." />;

  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (isPlatformAdmin === null) return <Checking label="Checking access..." />;

  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
