import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/use-auth';
import {
  hasStartedBetaAuthAttempt,
  isBetaWelcomeEnabled,
  startBetaAuthAttempt
} from '../lib/beta-welcome';
import { LoginPage } from './login-page';

export function BetaWelcomePage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [hasStartedSignIn, setHasStartedSignIn] = useState(hasStartedBetaAuthAttempt);

  if (status === 'loading') {
    return (
      <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm sm:p-6">
        Checking sign-in status...
      </section>
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isBetaWelcomeEnabled || hasStartedSignIn) {
    return <LoginPage />;
  }

  function proceedToSignIn() {
    startBetaAuthAttempt();
    setHasStartedSignIn(true);
    navigate('/login', { replace: true });
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold text-brand-900">Welcome to DroneSMS</h1>
      <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
        <p>
          DroneSMS is currently in beta testing. I’ve personally tested the platform extensively, but you may still
          encounter errors, inaccuracies, or unexpected behavior.
        </p>
        <p>
          Please review your information carefully and let me know if something doesn’t look right. Your feedback will
          help make DroneSMS better.
        </p>
      </div>
      <button
        type="button"
        className="mt-6 min-h-11 w-full rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2 sm:py-2"
        onClick={proceedToSignIn}
      >
        Proceed to Sign In
      </button>
    </section>
  );
}
