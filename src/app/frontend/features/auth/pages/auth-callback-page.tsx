/**
 * File purpose: Implements the auth callback page application page, including its presentation, state, validation, and service interactions.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';

/**
 * Renders the auth callback interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.session) setFailed(true);
      else navigate('/dashboard', { replace: true });
    });
    return () => { mounted = false; };
  }, [navigate]);

  return <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">{failed ? <><p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700" role="alert">This verification link is invalid or has expired.</p><Link className="mt-4 block text-center font-medium text-brand-700" to="/login">Return to login</Link></> : 'Completing email verification...'}</section>;
}
