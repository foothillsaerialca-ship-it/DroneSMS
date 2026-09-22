import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";

type MemberRole =
  "owner" | "admin" | "safety_manager" | "operator" | "read_only";
type MemberStatus = "active" | "suspended" | "revoked";
type OrganizationMember = {
  user_id: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  accepted_at: string | null;
  created_at: string;
};

const editableRoles: Exclude<MemberRole, "owner">[] = [
  "admin",
  "safety_manager",
  "operator",
  "read_only",
];
const editableStatuses: MemberStatus[] = ["active", "suspended", "revoked"];

function roleLabel(role: MemberRole) {
  return role
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OrganizationMembersPage() {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<MemberRole, "owner">>("operator");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMembers = useCallback(async () => {
    setError(null);
    const [memberResult, userResult] = await Promise.all([
      supabase.rpc("list_organization_members"),
      supabase.auth.getUser(),
    ]);
    if (memberResult.error) {
      setError(memberResult.error.message);
      return;
    }
    setCurrentUserId(userResult.data.user?.id ?? null);
    setMembers((memberResult.data ?? []) as OrganizationMember[]);
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const currentMember = useMemo(
    () => members.find((member) => member.user_id === currentUserId) ?? null,
    [currentUserId, members],
  );

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setInviteLink(null);
    const result = await supabase.rpc("create_organization_invitation", {
      invitee_email: email.trim(),
      invited_role: role,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const payload = result.data as {
      token?: string;
      expires_at?: string;
    } | null;
    if (!payload?.token) {
      setError(
        "The invitation was created, but its one-time token was not returned. Create a new invitation.",
      );
      return;
    }
    const url = new URL("/accept-invitation", window.location.origin);
    url.hash = `token=${encodeURIComponent(payload.token)}`;
    setInviteLink(url.toString());
    setMessage(
      `Invitation created${payload.expires_at ? ` and expires ${new Date(payload.expires_at).toLocaleString()}` : ""}.`,
    );
    setEmail("");
  }

  async function copyInvitation() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage(
      "Invitation link copied. Share it only with the intended recipient.",
    );
  }

  async function updateMember(
    member: OrganizationMember,
    nextRole: Exclude<MemberRole, "owner">,
    nextStatus: MemberStatus,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: updateError } = await supabase.rpc(
      "update_organization_member",
      {
        member_user_id: member.user_id,
        requested_role: nextRole,
        requested_status: nextStatus,
      },
    );
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage(`${member.email} was updated.`);
    await loadMembers();
  }

  async function transferOwnership(member: OrganizationMember) {
    if (
      window.prompt(
        `Type ${member.email} to confirm the ownership transfer.`,
      ) !== member.email
    )
      return;
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") {
      setError(
        "Verify with multi-factor authentication in Account Settings before transferring ownership.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { error: transferError } = await supabase.rpc(
      "transfer_organization_ownership",
      {
        new_owner_user_id: member.user_id,
      },
    );
    setBusy(false);
    if (transferError) {
      setError(transferError.message);
      return;
    }
    setMessage(`Ownership was transferred to ${member.email}.`);
    await loadMembers();
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-700">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-900">
            Organization Members
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Invite members and apply the least access needed for their work.
          </p>
        </div>
        <Link
          className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700"
          to="/settings/organization"
        >
          Organization Settings
        </Link>
      </header>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-brand-900">
          Invite a member
        </h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto]"
          onSubmit={createInvitation}
        >
          <label className="text-sm font-medium text-slate-700">
            Email address
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Role
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as Exclude<MemberRole, "owner">)
              }
            >
              {editableRoles.map((value) => (
                <option key={value} value={value}>
                  {roleLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            disabled={busy}
          >
            Create Invite
          </button>
        </form>
        {inviteLink ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              This link is shown once and expires in 72 hours.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-xs"
                readOnly
                value={inviteLink}
              />
              <button
                className="rounded border border-amber-500 px-3 py-1 text-sm font-semibold"
                type="button"
                onClick={() => void copyInvitation()}
              >
                Copy
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="p-4 text-lg font-semibold text-brand-900 sm:px-6">
          Current members
        </h2>
        <ul className="divide-y divide-slate-200">
          {members.map((member) => {
            const immutable =
              member.role === "owner" || member.user_id === currentUserId;
            return (
              <li
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_11rem_10rem_auto] sm:items-center sm:px-6"
                key={member.user_id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {member.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    Joined{" "}
                    {new Date(
                      member.accepted_at ?? member.created_at,
                    ).toLocaleDateString()}
                  </p>
                </div>
                <select
                  aria-label={`Role for ${member.email}`}
                  className="rounded-lg border px-2 py-2 text-sm"
                  disabled={immutable || busy}
                  value={member.role}
                  onChange={(event) =>
                    void updateMember(
                      member,
                      event.target.value as Exclude<MemberRole, "owner">,
                      member.status,
                    )
                  }
                >
                  {member.role === "owner" ? (
                    <option value="owner">Owner</option>
                  ) : null}
                  {editableRoles.map((value) => (
                    <option key={value} value={value}>
                      {roleLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Status for ${member.email}`}
                  className="rounded-lg border px-2 py-2 text-sm"
                  disabled={immutable || busy}
                  value={member.status}
                  onChange={(event) =>
                    void updateMember(
                      member,
                      member.role as Exclude<MemberRole, "owner">,
                      event.target.value as MemberStatus,
                    )
                  }
                >
                  {editableStatuses.map((value) => (
                    <option key={value} value={value}>
                      {roleLabel(value as MemberRole)}
                    </option>
                  ))}
                </select>
                {currentMember?.role === "owner" &&
                member.role !== "owner" &&
                member.status === "active" ? (
                  <button
                    className="text-left text-xs font-semibold text-brand-700 sm:text-center"
                    disabled={busy}
                    type="button"
                    onClick={() => void transferOwnership(member)}
                  >
                    Transfer ownership
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
