import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../../../../supabase/migrations/20260918000000_full_application_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const jobsPage = readFileSync(
  new URL("../pages/jobs-page.tsx", import.meta.url),
  "utf8",
);
const preflightPage = readFileSync(
  new URL(
    "../../preflight/pages/preflight-checklist-page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const mocPage = readFileSync(
  new URL("../../sms/pages/moc-detail-page.tsx", import.meta.url),
  "utf8",
);
const authProvider = readFileSync(
  new URL("../../auth/components/auth-provider.tsx", import.meta.url),
  "utf8",
);
const resetPasswordPage = readFileSync(
  new URL("../../auth/pages/reset-password-page.tsx", import.meta.url),
  "utf8",
);

test("tenant membership is authoritative and profile organization changes are guarded", () => {
  assert.match(
    migration,
    /create table if not exists public\.organization_memberships/,
  );
  assert.match(migration, /guard_profile_organization_membership/);
  assert.match(migration, /An accepted organization membership is required/);
  assert.match(migration, /protect_organization_owner/);
});

test("safety identities and workflow columns are protected server-side", () => {
  assert.match(migration, /protect_personnel_identity_binding/);
  assert.match(migration, /claim_personnel_identity/);
  assert.match(migration, /guard_jha_protected_fields/);
  assert.match(
    migration,
    /create table if not exists public\.jha_attestation_history/,
  );
  assert.match(
    migration,
    /revoke insert, update, delete on public\.job_operation_closeouts from authenticated/,
  );
  assert.match(
    migration,
    /revoke insert, update, delete on public\.preflight_checklists from authenticated/,
  );
  assert.match(migration, /guard_moc_workflow_fields/);
  assert.match(
    migration,
    /revoke delete on public\.management_of_change from authenticated/,
  );
});

test("proposal conversion and preflight completion use transactional RPCs", () => {
  assert.match(
    migration,
    /create unique index if not exists jobs_one_source_proposal/,
  );
  assert.match(migration, /function public\.convert_proposal_to_job/);
  assert.match(
    migration,
    /create table if not exists public\.data_normalization_audit/,
  );
  assert.match(migration, /validate constraint jobs_status_domain_check/);
  assert.match(jobsPage, /rpc\("convert_proposal_to_job"/);
  assert.match(migration, /function public\.save_preflight_checklist/);
  assert.match(preflightPage, /rpc\(["']save_preflight_checklist["']/);
  assert.match(mocPage, /rpc\(["']transition_management_of_change["']/);
});

test("public crew tokens, snapshot deduplication, and cleanup are explicitly bounded", () => {
  assert.match(migration, /interval '2 minutes'/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(
    migration,
    /grant execute on function public\.get_public_crew_briefing\(text\) to anon, authenticated/,
  );
  assert.match(
    migration,
    /create table if not exists public\.generated_document_snapshots/,
  );
  assert.match(
    migration,
    /create table if not exists public\.storage_cleanup_queue/,
  );
  assert.match(migration, /function public\.claim_storage_cleanup_batch/);
  assert.match(migration, /for update skip locked/);
});

test("password reset authorization comes only from the provider recovery event", () => {
  assert.match(authProvider, /event === ["']PASSWORD_RECOVERY["']/);
  assert.match(resetPasswordPage, /passwordRecoveryStartedAt/);
  assert.doesNotMatch(resetPasswordPage, /sessionStorage/);
});
