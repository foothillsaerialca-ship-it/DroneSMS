import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';

export function ProtectedRoute() {
  const { status, profileState, profileError } = useAuth();
  const location = useLocation();

  if (status === 'loading' || (status === 'authenticated' && profileState === 'loading')) {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Checking company setup...
      </section>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profileState === 'error') {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <h1 className="text-base font-semibold text-red-800">Unable to check company setup</h1>
        <p className="mt-2 text-sm text-red-700">
          {profileError ?? 'Please refresh and try again. If this keeps happening, contact support.'}
        </p>
      </section>
    );
  }

  if (profileState === 'complete' && location.pathname === '/onboarding/company') {
    return <Navigate to="/dashboard" replace />;
  }

  if (profileState !== 'complete' && location.pathname !== '/onboarding/company') {
    return <Navigate to="/onboarding/company" replace />;
  }

  return <Outlet />;
}
