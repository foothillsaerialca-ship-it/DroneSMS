# DroneSMS documentation and implementation history

## Document control

| Field | Value |
| --- | --- |
| Application | DroneSMS |
| Package version | `0.1.0` |
| Documentation baseline | 2026-08-25 |
| Recorded deployment | `https://7067bf63.dronesms-app.pages.dev/` |
| Primary source of truth | Current source, package manifests, and Supabase migrations |

This document records the application as implemented at the audit date. Planning documents describe future direction and are not evidence that a feature is complete.

## Product purpose

DroneSMS is a multi-tenant operational safety system for commercial drone operators. It connects proposals and jobs to personnel/equipment readiness, operational JHAs, pre-flight checks, safety events, photo evidence, closeout records, and PDF artifacts. Supabase enforces organization-scoped access while the React client supplies the operational workflow.

## Architecture

### Client

- React 18 single-page application mounted by `src/app/frontend/main.tsx`
- React Router route tree in `src/app/router.tsx`
- Authenticated responsive shell and navigation
- Feature-local React state and Supabase requests
- Tailwind CSS presentation
- Browser-side PDF builder for proposals and job closeout packets

### Backend services

- Supabase email/password Authentication
- Postgres tables and RPC functions
- Organization-scoped row-level-security policies
- Storage for organization logos, JHA evidence, generated documents, and equipment references
- Environment-aware Supabase adapter with a missing-configuration fallback

### Configuration

- `VITE_SUPABASE_URL`: required hosted project URL
- `VITE_SUPABASE_ANON_KEY`: required browser-safe publishable key
- `VITE_APP_URL`: optional redirect origin; browser origin and then `/` are fallbacks
- Vite aliases: `@backend`, `@frontend`, and `@app`

## Application routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Product landing page |
| `/login`, `/register` | Public | Authentication entry |
| `/forgot-password`, `/reset-password` | Public | Password recovery |
| `/auth/callback` | Public | Email confirmation/auth callback |
| `/onboarding/company` | Authenticated | Organization creation or recovery |
| `/dashboard` | Authenticated | Workflow and attention summaries |
| `/jobs`, `/proposals` | Authenticated | Job/proposal repositories |
| `/jobs/new`, `/proposals/new` | Authenticated | New records |
| `/proposals/:proposalId/edit` | Authenticated | Proposal editing |
| `/jobs/:jobId` | Authenticated | Job editing |
| `/jobs/:jobId/hub` | Authenticated | Assignments, events, closeout, and exports |
| `/jobs/:jobId/templates/jha` | Authenticated | Multi-step JHA |
| `/jobs/:jobId/templates/preflight` | Authenticated | Pre-flight checklist |
| `/personnel`, `/equipment` | Authenticated | Resource repositories |
| `/sms` | Authenticated | SMS role and program language |
| `/settings/account` | Authenticated | Account security and future placeholders |
| `/settings/organization` | Authenticated | Organization settings |
| `/reports` | Authenticated | Placeholder report page |
| `/about` | Authenticated | Team/about information |

Unknown routes redirect to `/`. `/settings` redirects to `/settings/organization`.

## Implementation history

### Foundation and authentication

The application establishes a Vite/React/Tailwind shell, lazy Supabase client acquisition, protected routes, and a shared authentication provider. Authentication includes registration with password validation, email confirmation, login, verification resend, password recovery/reset, password updates, secure email-change requests, and sign-out. Missing Supabase configuration produces actionable service errors rather than failing module import.

### Organizations and settings

Users can create or recover an owned organization and profile relationship. Settings include identity/contact fields, logo storage, credentials, service commitments, stop-work language, and operational defaults. The SMS page supports Safety Manager designation and program language. Account security supports password and email changes; other account cards are future placeholders.

### Proposals and jobs

Proposal authoring captures client/site details, service type, default/custom scope, deliverables, exclusions, price/terms, airspace findings, proposed RPIC/crew, equipment, and preliminary hazards. Users can generate proposal PDFs, update status, and convert a proposal to a job while copying applicable context. Jobs can also be created directly and edited.

### Operational job file

The job hub coordinates personnel/equipment assignments, readiness and expiration indicators, safety events, operation closeout, generated documents, and packet export. Generated records are retained through Supabase metadata/Storage and support opening, downloading, archiving, and stable naming.

### JHA and pre-flight

The JHA captures mission basics, site/surface/access conditions, exclusion-zone planning, airspace, environmental/runoff and applied-material controls, hazards/mitigations, regulatory citations, PPE, evidence photos, emergency information, certification, and independent Safety Manager/RPIC attestations. Signed photo URLs fall back to public URLs when necessary. The pre-flight workflow loads or creates one checklist per job, validates required items, and persists draft/complete state.

### Personnel and equipment

Personnel records track roles, RPIC credentials, certificate/training expiration, status, and readiness. Equipment covers aircraft and supporting equipment, maintenance, status, chemical/application fields, and reference documents. Readiness helpers classify incomplete, expired, due-soon, grounded/inactive, or ready conditions.

### PDF output

The browser PDF implementation creates proposal and job closeout packets without a PDF framework dependency. It supports text wrapping, sections, tables, images, branding, hazards, crew/equipment summaries, chemical references, pre-flight/JHA summaries, evidence photos, closeout content, Storage retention, and downloads. Missing optional data uses renderer-defined placeholders or omission; other failures surface to the page.

## File and function documentation policy

Every TypeScript/TSX module now begins with a purpose, fallback/error, and known-issue note. Named functions, components, event handlers, and PDF methods have adjacent responsibility and failure-behavior comments. Every top-level type alias, interface, class, and significant collection/object data structure has an adjacent purpose, fallback/error, and runtime-limitation comment. Inline anonymous React callbacks and temporary expression-local objects are covered by their owning named function/component. CSS, SVG, HTML, build configuration, and SQL migrations have format-appropriate headers. Every migration-created table and SQL RPC/trigger function has adjacent purpose and limitation comments.

### Module inventory

- `src/app/backend`: environment lookup and lazy Supabase client
- `features/auth`: auth state, protection, onboarding, and credential pages
- `dashboard`: summary derivation and data loading
- `equipment` and `personnel`: repositories, validation, and readiness
- `jobs/pages`: proposals, jobs, hub, JHA, and pre-flight workflows
- `jobs/lib`: scope defaults, operational rules, attestations, documents, and PDF engine
- `safety/lib`: service normalization and fallback hazard library
- `settings` and `sms`: identity, defaults, security, and safety designation
- `navigation`, `information`, and `reports`: supporting UI
- `supabase/migrations`: schema, RLS, RPC, and Storage history

## Redundancy audit and consolidation

The 2026-08-25 structure audit compared top-level type shapes, option collections, and normalized named-function bodies. Behavior-equivalent definitions were consolidated into:

- `features/jobs/lib/workflow-types.ts`: canonical service types, proposal statuses, proposal-equipment snapshots, and proposal-equipment normalization
- `frontend/lib/date-utils.ts`: ISO date defaults, display formatting, and calendar-day calculations
- `frontend/lib/readiness.ts`: the shared readiness presentation contract
- `frontend/lib/organization.ts`: the common profile-to-organization lookup
- `frontend/lib/error-utils.ts`: the identical generic error fallback

This removed duplicate service/status arrays, duplicate proposal-equipment normalizers and overlapping equipment snapshot declarations, duplicate readiness result types, repeated day/date/today helpers, three identical simple organization lookups, and two identical generic error functions.

Similar structures were intentionally retained where merging would change meaning or weaken type safety: page-specific database projections, form-state contracts, typed state-update closures, domain-specific error fallbacks, the new-job owned-organization recovery path, and effect-local company identity loaders. Their resemblance is implementation symmetry rather than interchangeable domain data.

## Database and storage history

### `20260524000000_merged.sql`

Consolidates the initial schema and MVP additions: organizations/profiles, jobs/proposals, JHA/pre-flight, personnel/equipment assignment, hazards, generated documents, safety events, closeout, photo evidence, and reference documents. It also establishes indexes, RLS, Storage buckets/policies, integrity helpers, and defaults.

### `20260814000000_add_jha_site_planning_fields.sql`

Adds emergency/aviation facilities, work surface/site constraints, environmental concern categories, communication planning, chemical review, and related JHA fields.

### `20260814010000_add_airspace_workflow_fields.sql`

Adds relevant-airport/heliport, airspace-restriction, LAANC, and additional-authorization fields to proposals and JHAs.

### `20260821000000_add_safety_representative_designation.sql`

Adds an organization-scoped Safety Manager designation, membership trigger, index, and owner/member RLS policies.

### `20260821010000_add_jha_role_attestations.sql`

Adds independent Safety Manager review and RPIC acceptance identities/timestamps. Security-definer RPCs validate the current user against the organization designation or assigned RPIC. Designations are tightened to require an active, user-linked personnel record.

## Dependencies

Declared ranges are in `package.json`; exact versions are locked in `package-lock.json`. At audit time the installed direct tree included React `18.3.1`, React Router `6.30.4`, Supabase JS `2.106.2`, Vite `7.3.5`, TypeScript `5.9.3`, Tailwind `3.4.19`, and ESLint `9.39.4`. Python is not part of the toolchain.

## Fallback and error conventions

- Missing environment values become empty strings; missing Supabase configuration yields a consistent unavailable-client error.
- Auth initialization and events refresh profile/organization state; common failures are normalized for users.
- Nullable database data is converted to stable form defaults and empty-state UI.
- Loaders and mutations set page errors; shared service functions throw to callers.
- Form validation prevents incomplete/inconsistent persistence.
- Signed photo URLs can fall back to public URLs; selected optimistic edits restore prior state on failure.
- Local system hazards cover missing database hazard content and normalize legacy service aliases.
- Missing optional PDF inputs use placeholder/omission rules.

## Verification record

Audit executed on 2026-08-25 with Node.js `24.14.0` and npm `11.9.0`.

| Check | Result | Coverage |
| --- | --- | --- |
| `npm test` | Passed: 17/17 | Hazard rules, environmental rule, JHA attestations, workflow structures, proposal-equipment normalization, and date utilities |
| `npm run build` | Passed with warning | TypeScript build, 119 Vite modules, production assets |
| `npm run lint` | Failed before analysis | ESLint configuration discovery; no source was linted |
| Dependency inspection | Passed | Installed direct tree resolved |
| Migration review | Static only | References and ordered SQL inspected |
| UI/service functions | Compile/static verification | Components and Supabase handlers compile |

No browser/DOM test runner, Supabase emulator configuration, or isolated integration credentials exist here. It would therefore be inaccurate to claim an independent runtime test for every UI handler, Storage call, auth transition, and database function. Each named function was reviewed and compiled; available deterministic tests were executed. Remaining coverage debt is recorded below.

## Planned or incomplete work

- Reports and several account-management cards are placeholders.
- Billing/paywall, admin tools, multiple-company membership, scheduled account activity, advertising concepts, and JSON-first document storage are notes only.
- External smart-site intelligence, server-side PDF rendering, offline sync, and Stripe described in older plans are not present.

## Known errors and limitations

### KE-001: ESLint command is unusable

`npm run lint` exits with code 1 because ESLint `9.39.4` requires a flat `eslint.config.*` file and the repository contains none. No source lint result is available. This audit documents the error and intentionally does not add configuration.

### KE-002: Production JavaScript chunk exceeds Vite's warning threshold

`npm run build` succeeds, but the primary minified JavaScript asset is approximately 765 kB (about 197 kB gzip), exceeding Vite's 500 kB warning threshold. No route-level dynamic import or manual vendor chunking is configured. This is a performance warning, not a build failure.

### KE-003: Full function-level runtime verification is unavailable

Only 17 domain unit tests exist. There is no DOM/browser framework or isolated Supabase environment, so auth, RLS/RPC, Storage, React handlers, and PDF visual output cannot be automatically exercised function by function. Those paths passed compilation and static review only. No tests were fabricated and no production mutations were attempted.

### KE-004: Database migrations were not integration-tested

The SQL history was inspected statically, but no disposable Supabase project or local CLI stack was available. Runtime syntax/dependencies, RLS, trigger exceptions, and RPC authorization remain unverified.

### KE-005: Placeholder and planned interfaces are incomplete

Reports and future account cards do not implement their advertised future workflows. Planning documents describe billing, admin, site intelligence, offline behavior, and server-rendered PDFs that are not implemented.
