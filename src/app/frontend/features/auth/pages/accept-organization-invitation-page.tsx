import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../components/use-auth";

const invitationStorageKey = "dronesms.organization-invitation-token";

function captureInvitationToken() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = hash.get("token");
  if (token) {
    window.sessionStorage.setItem(invitationStorageKey, token);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }
  return token ?? window.sessionStorage.getItem(invitationStorageKey);
}

export function AcceptOrganizationInvitationPage() {
  const { status, refreshProfileState } = useAuth();
  const [token] = useState(captureInvitationToken);
  const [state, setState] = useState<
    "waiting" | "accepting" | "accepted" | "error"
  >("waiting");
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !token || attempted.current) return;
    attempted.current = true;
    setState("accepting");
    void supabase
      .rpc("accept_organization_invitation", { raw_token: token })
      .then(async (result) => {
        if (result.error) {
          setError(result.error.message);
          setState("error");
          return;
        }
        window.sessionStorage.removeItem(invitationStorageKey);
        await refreshProfileState();
        setState("accepted");
      });
  }, [refreshProfileState, status, token]);

  if (!token)
    return (
      <InvitationCard title="Invitation unavailable">
        <p>
          This invitation link is missing its secure token. Ask an administrator
          to create a new invitation.
        </p>
      </InvitationCard>
    );
  if (status === "loading")
    return (
      <InvitationCard title="Checking your account">
        <p>Please wait...</p>
      </InvitationCard>
    );
  if (status !== "authenticated")
    return (
      <InvitationCard title="Join this organization">
        <p>
          Sign in with the exact email address that received the invitation. The
          invitation will be preserved during sign-in.
        </p>
        <Link
          className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white"
          to="/login"
          state={{ from: "/accept-invitation" }}
        >
          Sign in to accept
        </Link>
      </InvitationCard>
    );
  if (state === "accepted")
    return (
      <InvitationCard title="Invitation accepted">
        <p>Your organization membership is active.</p>
        <Link
          className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white"
          to="/dashboard"
        >
          Continue to Dashboard
        </Link>
      </InvitationCard>
    );
  if (state === "error")
    return (
      <InvitationCard title="Unable to accept invitation">
        <p className="text-red-700">{error}</p>
        <p className="mt-2">
          Confirm that you signed in with the invited email address, or ask an
          administrator for a new link.
        </p>
      </InvitationCard>
    );
  return (
    <InvitationCard title="Accepting invitation">
      <p>Please wait...</p>
    </InvitationCard>
  );
}

function InvitationCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">{title}</h1>
      <div className="mt-3">{children}</div>
    </section>
  );
}
