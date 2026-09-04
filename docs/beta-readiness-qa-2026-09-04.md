# DroneSMS beta-readiness QA — 2026-09-04

## BETA QA RESULT

**READY FOR MANUAL BETA WALKTHROUGH**

The application builds and all 82 automated tests pass. The workflow contracts cover the intended solo/crew distinction, briefing versioning, readiness prerequisites, permit branches, MOC routing, Safety Assurance persistence, legacy compatibility, and human-readable readiness export identity. The source audit originally found one P1 authorization defect in `mark_job_operation_readiness_stale(uuid,text)`; the 2026-09-04 follow-up resolves it with a forward ACL migration and focused regression coverage. Live database and manual workflow verification remain required before production release.

This was an audit-first pass at repository baseline `708b801`. The follow-up changes only the internal helper's client-role function privileges; it does not change readiness state, prerequisites, stale reasons, or product UI behavior.

### QA-01 resolution follow-up

`20260904000000_restrict_readiness_stale_helper.sql` explicitly revokes direct execution of `mark_job_operation_readiness_stale(uuid,text)` from `PUBLIC`, `anon`, and `authenticated`, with no broad grant back. Function ownership is unchanged, so trigger functions and trusted owner-context server-side functions retain internal execution. Contract tests verify all three revocations, detect any later broad grant, and confirm that the four readiness invalidation triggers plus briefing/job/crew invalidation callers remain wired to the helper. No historical readiness row is rewritten.

## Execution scope and evidence

- `npm test`: **PASS**, 82/82 tests. The suite exercises crew invitation/acknowledgment contracts, repeated briefing invalidation, assignment removal/history, JHA attestations, readiness and permits, readiness-helper ACL hardening, proposal language/conversion snapshots, preflight states, MOC routing, Safety Assurance validation/atomic persistence, and legacy risk compatibility.
- `npm run build`: **PASS**. TypeScript and Vite production build completed; Vite emitted only its existing large-chunk advisory (851.85 kB minified main chunk).
- `git diff --check`: **PASS** before this report and after authoring it.
- Supabase CLI: **UNAVAILABLE** (`supabase: command not found`). Database behavior was therefore evaluated through ordered migration source and source-level contract tests, not a running PostgreSQL/Supabase instance.
- No configured tenant, seeded users, email credentials, deployment target, or production document store was available. Representative live operations and final PDFs could not be created.

## SCENARIO RESULTS

### 1 — Solo operation: PASS WITH LIMITATION

Automated contracts confirm that an RPIC-only assignment creates no crew acknowledgment requirement; non-operational assignments also do not create one. Proposal language and conversion snapshot tests, JHA attestation tests, preflight completion-state tests, readiness prerequisite tests, and closeout/Safety Assurance tests pass. The hub explicitly presents solo wording and routes the RPIC through acceptance/readiness instead of crew acknowledgment. Live proposal creation, conversion, full closeout, and a production client packet require a configured tenant/database.

### 2 — Crewed operation: PASS WITH LIMITATION

Contracts confirm supported non-RPIC roles require current evidence, `Sent` and stale evidence do not qualify, RPIC is excluded from that requirement, and role/job/person/version are persisted. The public payload assembles operation, recipient, complete operational crew, RPIC, and briefing sections. A live multi-user crew assignment was not possible without Supabase.

### 3 — Email crew acknowledgment: PASS WITH LIMITATION

Migration tests confirm invitation and delivery-status functions fail closed for missing/wrong RPIC users. The invitation stores person, assignment, role, job, organization, email, and current briefing version; the public RPC is intentionally available to anonymous recipients only by hashed, expiring token. Typed-name acknowledgment changes status/timestamp and clears the token hash, preventing reuse. Changed briefing or assignment invalidates access. The Edge Function's outbound provider and receipt of a real email were not exercised.

### 4 — Manual field briefing: PASS WITH LIMITATION

Contracts confirm assigned-RPIC-only execution, missing-RPIC failure, allowed reason validation, required detail for `Other`, explicit RPIC attestation, and current person/role/job/version storage. Evidence retains person and role snapshots after assignment deletion, while deleted assignments stop blocking current readiness. This is a connected server-side fallback; no offline/PWA support was claimed. Live RPC execution was unavailable.

### 5 — Material change after acknowledgment: PASS WITH LIMITATION

Migration contracts enumerate every public briefing JHA field plus job name/location/date/service, independently increment `briefing_version`, and stale readiness. The version trigger does not depend on JHA status, and the repeated-Draft-edit test confirms evidence for N remains stale after a second edit until the new version is acknowledged. Historical rows are retained. Live trigger execution was unavailable.

### 6 — Operational crew changes: PASS WITH LIMITATION

Source contracts cover operational-role insert/update/delete, version advancement, readiness invalidation, historical evidence preservation through `ON DELETE SET NULL`, and removal of deleted crew from current blocking logic. Live add/change/remove operations against an approved job were unavailable.

### 7 — Ready to Operate: PASS WITH LIMITATION

The approval RPC correctly tenant-scopes the job, requires the current active assigned RPIC's `auth.uid()`, and enforces current complete JHA, Safety Manager review, RPIC acceptance, controls, preflight, Fitness for Duty, applicable permit approval, and current non-RPIC crew evidence. Automated export contracts confirm the displayed/exported identity resolves from the exact readiness RPIC personnel relationship rather than a raw UUID or another personnel record sharing the account. The follow-up ACL migration prevents all client roles from invoking the internal staleness helper directly while retaining its trigger callers. Live database execution remains required.

### 8 — Public right-of-way / permit: PASS WITH LIMITATION

Tests cover no restriction, restriction with no permit, required/Pending, required/Approved, and legacy nulls. Planning remains saveable while Pending; readiness blocks only when permit is explicitly required and not Approved. The JHA save payload nulls authority, number, status, approval, and expiry whenever the parent branch no longer applies, preventing stale branch data. Live database execution was unavailable.

### 9 — Management of Change: PASS WITH LIMITATION

Tests confirm material capability/control changes offer MOC, a control not followed or training need routes to corrective action, and uncertainty continues investigation. MOC approval blocks on incomplete pre-use actions and establishes linked capability only upon approval. The active workflow uses qualitative linkage and contains no scored-risk/matrix UI. A live lifecycle and equipment/capability record were unavailable.

### 10 — Safety Assurance / control effectiveness: PASS WITH LIMITATION

Tests cover Yes, Not Applicable, Partially, No, and unexpected issues, including required narratives/actions and open-review routing. Persistence contracts confirm one transactional closeout/assurance RPC, relationship tenant/job checks, immutable superseded history, and only-current-open completion. Client packet loading selects only closeout result/narrative/date and does not query `safety_assurance_reviews`, preserving client/internal separation. Live transactions and rollback behavior were not executed.

### 11 — Legacy compatibility: PASS

Ordered-migration tests confirm legacy `overall_risk_rating`, proposal risk, `assessor_name`, `assessment_date`, and `rpic_printed_name` survive and remain readable while current completion/readiness do not depend on them. `stop_work_authority_acknowledged` remains loaded and saved. Active SMS UI tests confirm no Low/Medium/High classification or matrix configuration has returned.

### 12 — Exports / PDFs: PASS WITH LIMITATION

Tests confirm proposal solo/crew wording, proposal-to-job RPIC snapshot separation, reassigned job RPIC behavior, complete preflight status labels, no raw readiness user UUID in packet rows, and exact assigned-RPIC identity when an account maps to multiple personnel records. Source inspection confirms client packet data excludes internal Safety Assurance review rows. The generator could not produce representative final files without tenant records/storage, so final PDF rendering, pagination, data placement, and all three requested real-record variants remain manual checks.

### 13 — Beta indicator: PASS WITH LIMITATION

The follow-up flag fix is present. `VITE_BETA_WELCOME_ENABLED` defaults on and disables when explicitly `false`; the shared badge is used in public auth layout, desktop brand, mobile top bar, and drawer brand. Responsive classes constrain/truncate the brand and keep the badge non-shrinking. The production build passed, but authenticated and mobile browser layouts were not visually exercised with a real session.

## AUTHORIZATION AND TENANT-ISOLATION SPOT CHECKS

- **Ready approval:** assigned-RPIC and tenant checks are server-side; prerequisite tests pass. The staleness helper is now denied to every broad client role by a forward migration.
- **Crew invitation/manual fallback:** server-side assigned-RPIC lookup fails closed for missing or mismatched users, and target job is scoped to the current organization.
- **Public token:** only the two intended token RPCs are granted to `anon`; token is random, stored hashed, expires, is scoped to its exact evidence/job/assignment/version, and is destroyed after acknowledgment.
- **Historical evidence:** authenticated read policy compares evidence organization to `current_user_organization_id()`; assignment deletion retains immutable identity/version snapshots.
- **Definer helper:** **Pass by migration contract.** `mark_job_operation_readiness_stale(uuid,text)` is denied to `PUBLIC`, `anon`, and `authenticated`; no later broad grant exists. Live ACL inspection remains required.

## DEFECTS FOUND

### QA-01 — P1 — Ready to Operate authorization / tenant isolation

- **Exact issue:** `public.mark_job_operation_readiness_stale(target_job_id uuid, reason text)` is `SECURITY DEFINER`, directly updates readiness by caller-supplied job UUID, has no `auth.uid()`/organization predicate, and never revokes execute from `PUBLIC`.
- **Impact:** an anonymous or unrelated authenticated caller who learns/guesses a valid job UUID can mark another organization's Ready to Operate approval stale and supply the visible stale reason. This is cross-tenant integrity loss and an operational denial-of-service against approved jobs; it does not grant approval or expose row contents.
- **Disposition:** **fixed.** A forward migration revokes execution from `PUBLIC`, `anon`, and `authenticated` without changing function ownership, body, trigger wiring, stale reasons, or existing readiness evidence.
- **Affected code:** `supabase/migrations/20260904000000_restrict_readiness_stale_helper.sql`; regression contract `readiness-invalidation-security.test.ts`. The existing function and callers remain unchanged.

No P0, P2, or P3 defect was established by the available test/source evidence. The Vite chunk-size advisory is a regression-risk observation, not a functional beta defect.

## EXTERNAL VERIFICATION STILL REQUIRED

1. Apply the full ordered migrations to a fresh Supabase project and an upgrade-shaped database; inspect function ACLs (`proacl`) and verify anonymous/cross-tenant calls, especially the readiness staleness helper.
2. Execute both complete seeded workflows with distinct RPIC, Safety Manager, VO, admin, unrelated, and second-tenant accounts, including stale/re-approval transitions and assignment deletion.
3. Send and receive a real transactional email, open it in a logged-out browser, acknowledge once, then verify replay/expiry/stale-version URLs fail.
4. Exercise Cloudflare/production deployment configuration, redirects, Supabase callback origins, Edge Function secrets, and storage CORS.
5. Generate and visually inspect final PDFs for solo, crewed, and Safety-Assurance-closeout jobs, including long text, photos, names, statuses, pagination, client/internal separation, and archived proposal/job identity.
6. Perform desktop and narrow-mobile visual checks for public/authenticated BETA badges, navigation drawers, headers, wrapping, and overlap.

## REGRESSION / SCOPE CHECK

- Product code changed: **No**.
- Schema/migrations changed: **Yes — one forward function-ACL migration; no tables, columns, data, function bodies, or historical readiness records changed**.
- QA documentation changed: **Yes — QA-01 resolution recorded**.
- Tests: **PASS, 82/82**.
- Production build: **PASS**, with the existing Vite chunk-size advisory.
- Unrelated workflows touched: **No**.
- Historical compatibility: **retained by source-level ordered-migration and UI contract tests; live upgrade execution remains required**.
