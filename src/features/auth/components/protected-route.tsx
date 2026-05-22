import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';

export function ProtectedRoute() {
  const { status, profileState } = useAuth();
  const location = useLocation();

  if (status === 'loading' || (status === 'authenticated' && profileState === 'loading')) {
    return <p className="p-4 text-sm text-slate-600">Checking session…</p>;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profileState !== 'complete' && location.pathname !== '/onboarding/company') {
    return <Navigate to="/onboarding/company" replace />;
  }

  return <Outlet />;
}
