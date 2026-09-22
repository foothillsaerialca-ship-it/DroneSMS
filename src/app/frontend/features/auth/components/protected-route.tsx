/**
 * File purpose: Provides the reusable protected route React component and its local interaction behavior.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./use-auth";
import { supabase } from "@frontend/lib/supabase";

/**
 * Renders the protected route interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function ProtectedRoute() {
  const { status, session, profileState, profileError } = useAuth();
  const location = useLocation();
  const [mfaState, setMfaState] = useState<
    "checking" | "verified" | "required" | "error"
  >("checking");

  useEffect(() => {
    if (status !== "authenticated") {
      setMfaState("verified");
      return;
    }
    let active = true;
    setMfaState("checking");
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then((result) => {
      if (!active) return;
      if (result.error) {
        setMfaState("error");
        return;
      }
      setMfaState(
        result.data.nextLevel === "aal2" && result.data.currentLevel !== "aal2"
          ? "required"
          : "verified",
      );
    });
    return () => {
      active = false;
    };
  }, [session?.access_token, status]);

  if (
    status === "loading" ||
    (status === "authenticated" &&
      (profileState === "loading" || mfaState === "checking"))
  ) {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Checking company setup...
      </section>
    );
  }

  if (status !== "authenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  if (mfaState === "required") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  if (mfaState === "error") {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <h1 className="text-base font-semibold text-red-800">
          Unable to verify account security
        </h1>
        <p className="mt-2 text-sm text-red-700">
          Refresh and try again. Access remains locked until multi-factor status
          can be verified.
        </p>
      </section>
    );
  }

  if (profileState === "error") {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <h1 className="text-base font-semibold text-red-800">
          Unable to check company setup
        </h1>
        <p className="mt-2 text-sm text-red-700">
          {profileError ??
            "Please refresh and try again. If this keeps happening, contact support."}
        </p>
      </section>
    );
  }

  if (
    profileState === "complete" &&
    location.pathname === "/onboarding/company"
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    profileState !== "complete" &&
    location.pathname !== "/onboarding/company"
  ) {
    return <Navigate to="/onboarding/company" replace />;
  }

  return <Outlet />;
}
