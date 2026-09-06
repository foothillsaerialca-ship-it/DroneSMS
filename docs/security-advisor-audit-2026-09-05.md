# Supabase Security Advisor audit — 2026-09-05

## Method and effective-state findings

This audit traced the ordered migrations, browser RPC call sites, the
`send-crew-acknowledgment` Edge Function, trigger declarations, and calls between
functions. PostgreSQL's default function ACL grants `EXECUTE` to `PUBLIC`; therefore
an explicit `GRANT ... TO authenticated` does **not** narrow a newly-created
function unless `PUBLIC` is also revoked. The forward migration
`20260905030000_security_advisor_function_acl_audit.sql` makes that effective state
explicit without changing function bodies, RLS, or product behavior.

All effective `SECURITY DEFINER` functions now use the controlled
`pg_catalog, public` search path. Application objects are schema-qualified and
Supabase does not grant untrusted API roles schema-creation rights in `public`.
These functions bypass table RLS deliberately, but their callable entry points bind
operations to `auth.uid()`, the current organization, and (where applicable) the
assigned RPIC or designated Safety Manager.

## Security Advisor classification

“Before” means the effective state immediately before the audit migration. A
`PUBLIC` grant was inherited by both `anon` and `authenticated`.

| Function | Current exposure (before) | Intended exposure (after) | Internal authorization / caller trace | Classification | Change required |
|---|---|---|---|---|---|
| `accept_operational_jha_as_rpic(uuid)` | authenticated | authenticated | Browser RPC; resolves the active assigned RPIC and requires its `user_id = auth.uid()`; update is constrained to that RPIC's organization. | SAFE BUT WARNING EXPECTED | Search path normalized; ACL restated. |
| `acknowledge_public_crew_briefing(text,text)` | anon, authenticated | anon, authenticated | Public page RPC; SHA-256 token lookup only, `Sent` status, expiry, current assignment/version, row lock, and one-time hash destruction. | EXPECTED / INTENTIONAL | Keep warning and named-role grants. |
| `approve_management_of_change(uuid,text,text)` | PUBLIC | authenticated | Browser RPC; selects only the caller's organization and requires designated Safety Manager/owner before update. | NEEDS HARDENING | Revoke PUBLIC/anon; preserve authenticated. |
| `capture_custom_hazard_reviews()` | PUBLIC | function owner via trigger only | `jha_assessments` trigger; no browser, Edge, or function RPC caller. Trigger execution is not dependent on client EXECUTE. | INTERNAL-ONLY | Revoke all client roles. |
| `capture_safety_event_review()` | PUBLIC | function owner via trigger only | `job_safety_events` trigger; no direct caller. | INTERNAL-ONLY | Revoke all client roles. |
| `complete_safety_assurance_review(uuid,text,jsonb)` | PUBLIC | authenticated | Browser RPC; joins review organization to the designated Safety Manager whose `user_id = auth.uid()`, and only completes `Open` rows. | NEEDS HARDENING | Revoke PUBLIC/anon; preserve authenticated. |
| `confirm_job_ready_to_operate(uuid,boolean)` | authenticated | authenticated | Browser RPC; tenant lookup plus exact active assigned-RPIC identity and current JHA, review, acceptance, preflight, permit, and crew evidence gates. | SAFE BUT WARNING EXPECTED | Search path normalized; ACL restated. |
| `correct_completed_management_of_change(uuid,jsonb,text)` | PUBLIC | authenticated | No current UI call found, but it is the designed attributed admin-correction RPC; tenant and Safety Manager checks, closed-state check, and mandatory reason. | NEEDS HARDENING | Revoke PUBLIC/anon; retain authenticated API contract. |
| `create_crew_briefing_invitation(uuid)` | authenticated | authenticated | Edge Function RPC using the user's bearer token; tenant lookup and exact assigned-RPIC check. | SAFE BUT WARNING EXPECTED | Search path normalized; ACL restated. |
| `crew_briefing_assigned_rpic(uuid)` | no client role (PUBLIC already revoked) | definer callers only | Called by invitation, email-result, and manual-briefing definer RPCs; no direct frontend/Edge call. | INTERNAL-ONLY | Explicitly revoke anon/authenticated too. |
| `current_user_organization_id()` | PUBLIC | authenticated | RLS/function helper; returns only the organization on the profile matching `auth.uid()`. | SAFE BUT WARNING EXPECTED | Remove anon/PUBLIC; retain authenticated for RLS. |
| `get_public_crew_briefing(text)` | anon, authenticated | anon, authenticated | Public page RPC; token hash, `Sent`, expiry, assignment and briefing-version checks precede a fixed, briefing-only JSON projection. It accepts no UUID/filter and exposes no arbitrary query surface. | EXPECTED / INTENTIONAL | Keep warning and named-role grants. |
| `is_organization_safety_manager(uuid)` | PUBLIC | authenticated | RLS/business helper; result is true only for organization owner or designated personnel matching `auth.uid()`. | SAFE BUT WARNING EXPECTED | Remove anon/PUBLIC; retain authenticated for RLS. |
| `log_moc_change()` | PUBLIC | function owner via trigger only | Trigger on MOC insert/update; no RPC caller. | INTERNAL-ONLY | Revoke all client roles. |
| `log_moc_child_change()` | PUBLIC | function owner via trigger only | Trigger on MOC action/link changes; no RPC caller. | INTERNAL-ONLY | Revoke all client roles. |
| `mark_crew_briefing_email_result(uuid,boolean)` | authenticated | authenticated | Edge Function RPC with propagated user JWT; invitation's job resolves to exact assigned RPIC `auth.uid()`. | SAFE BUT WARNING EXPECTED | Search path normalized; ACL restated. |
| `record_manual_field_briefing(uuid,text,text,boolean)` | authenticated | authenticated | Browser RPC; tenant-bound job and exact assigned-RPIC check, restricted crew roles, reason, and attestation validation. | SAFE BUT WARNING EXPECTED | Search path normalized; ACL restated. |
| `review_operational_jha_as_safety_manager(uuid)` | authenticated | authenticated | Browser RPC; designated active Safety Manager must match `auth.uid()`; update constrained to that organization. | SAFE BUT WARNING EXPECTED | Search path normalized; ACL restated. |
| `save_operation_closeout_with_assurance(...)` | PUBLIC | authenticated | Browser RPC; membership check against job organization and validation that every hazard/control/event belongs to the originating job. | NEEDS HARDENING | Revoke PUBLIC/anon; preserve authenticated. |
| `start_management_of_change(...)` | PUBLIC | authenticated | Browser RPC; derives organization solely from caller profile and rejects equipment, event, or capability outside it. | NEEDS HARDENING | Revoke PUBLIC/anon; preserve authenticated. |
| `mark_job_operation_readiness_stale(uuid,text)` | no client role | definer callers only | Internal helper called by six trigger wrappers; its ACL was already hardened in the prior readiness migration. | INTERNAL-ONLY | Search path normalized only. |
| `invalidate_readiness_from_jha()` | no client role | function owner via trigger only | Trigger wrapper calling the readiness helper. | INTERNAL-ONLY | No ACL change; retain trigger-definer execution. |
| `invalidate_readiness_from_preflight()` | no client role | function owner via trigger only | Trigger wrapper calling the readiness helper. | INTERNAL-ONLY | No ACL change; retain trigger-definer execution. |
| `invalidate_readiness_from_assignment()` | no client role | function owner via trigger only | Trigger wrapper calling the readiness helper. | INTERNAL-ONLY | No ACL change; retain trigger-definer execution. |
| `invalidate_readiness_from_equipment()` | no client role | function owner via trigger only | Trigger wrapper calling the readiness helper. | INTERNAL-ONLY | No ACL change; retain trigger-definer execution. |
| `advance_crew_briefing_version_from_job()` | no client role | function owner via trigger only | Trigger wrapper versions public briefing content and calls the readiness helper. | INTERNAL-ONLY | No ACL change; retain trigger-definer execution. |
| `advance_crew_briefing_version_from_assignment()` | no client role | function owner via trigger only | Trigger wrapper versions briefing content and calls the readiness helper. | INTERNAL-ONLY | No ACL change; retain trigger-definer execution. |

No effective `SECURITY DEFINER` function was left **AMBIGUOUS — LEFT UNCHANGED**.
The non-definer trigger functions were reviewed but are outside the Advisor finding.

## Public crew-token threat review

The token is 32 random bytes (64 hexadecimal characters; 256 bits) created with
`extensions.gen_random_bytes`. Only its SHA-256 digest is stored. Both public RPCs
hash the supplied token and do not accept a record UUID. They reject expired links,
non-`Sent` status, changed/removed assignments, and stale briefing versions. A
successful acknowledgment updates the locked row and clears `token_hash`, making
replay impossible. The read response is a fixed projection of operation name/site/
date, recipient/operational crew names and roles, and briefing safety content; it
does not return organization records, internal identifiers, email addresses, or a
general listing/filter capability. Anonymous execution is therefore intentional.

## Exact ACL changes and verified callers

* **PUBLIC → authenticated:** `approve_management_of_change`,
  `complete_safety_assurance_review`, `correct_completed_management_of_change`,
  `save_operation_closeout_with_assurance`, and `start_management_of_change`.
  Browser call sites were found for all except the deliberately retained correction
  API. Their internal tenant/role checks are summarized above.
* **PUBLIC → authenticated helper:** `current_user_organization_id` and
  `is_organization_safety_manager`. Both are required by authenticated RLS policies
  and definer RPCs, so authenticated execution was preserved.
* **PUBLIC → owner/trigger only:** `capture_custom_hazard_reviews`,
  `capture_safety_event_review`, `log_moc_change`, and `log_moc_child_change`.
  Their only callers are their declared table triggers.
* **Already non-public → explicitly internal:** `crew_briefing_assigned_rpic`.
  Its only callers are SECURITY DEFINER crew RPCs, so revoking direct client roles
  does not recreate the earlier invoker-trigger failure mode.
* **Authenticated remained authenticated:** JHA attestation, readiness, invitation,
  delivery-result, and manual-briefing RPCs. No frontend or Edge workflow loses its
  required grant.
* **Anon/authenticated remained anon/authenticated:** the two public token RPCs.

Regression tests assert each changed signature's final ACL statement, preserve the
public token grants, ensure no later migration restores internal helper grants,
retain trigger wiring, and cover the controlled search path.

## Storage warning

The bucket remains public because the UI renders stored paths through
`getPublicUrl`. Public object delivery is distinct from the `storage.objects` SELECT
policy. The broad authenticated SELECT policy allowed every signed-in account to
list metadata for every object in `organization-logos`; the forward migration drops
only that policy. Upload/update/delete remain restricted to the caller's own
organization-id folder, and existing public image URLs continue to work. Anonymous
bucket enumeration was not granted by the policy (it targeted `authenticated`), but
the Advisor's broad-listing concern is removed without making logos private.

## Warnings expected to remain

Supabase should continue to report signed-in execution of the authenticated
`SECURITY DEFINER` business RPCs and helpers if the Advisor treats any definer RPC as
a warning. Those are safe-but-expected because the application must call them and
authorization is enforced inside each function. It should also continue to report
public/anonymous execution for `get_public_crew_briefing` and
`acknowledge_public_crew_briefing`; those two warnings are expected and intentional.

## Manual Supabase action

**Leaked Password Protection is an Auth project setting, not schema SQL.** In the
Supabase Dashboard, open **Authentication → Configuration → Security and
Protection**, enable **Leaked Password Protection**, and save. Then rerun Security
Advisor. This repository intentionally does not attempt to emulate that dashboard/
Auth-service configuration in a migration.
