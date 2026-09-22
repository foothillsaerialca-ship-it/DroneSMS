# DroneSMS project audit — 2026-09-10

> Remediation update — 2026-09-21: The findings below are the original audit snapshot. The prioritized 1–35 closure record, including implemented fixes and clearly separated hosted-environment actions, is at the bottom of `docs/Notes.txt`. Current local verification is 120 passing unit/security/parity tests, 3 passing Chromium smoke tests, clean ESLint and TypeScript checks, a successful production build, and 0 production dependency vulnerabilities. The Supabase reset/lint/pgTAP job is committed to CI; it could not be run locally because Docker Desktop is unavailable on this workstation.

## Executive summary

The application is a functional React/Vite/Supabase MVP with organization-scoped RLS, browser-generated PDFs, and a useful operational workflow. It now builds cleanly, all 113 deterministic tests pass, and route-level lazy loading reduces the initial JavaScript payload.

The primary scale limitation is data loading: several screens fetch an entire organization and then sort, filter, count, or search in the browser. That works for a small tenant but will become slow and memory-heavy as jobs, proposals, personnel, equipment, photos, reviews, and generated documents grow. The primary data-integrity risks are mutable attribution fields in broad update grants and independent Storage/database operations.

## Changes made in this pass

- Added route-level lazy loading in `src/app/router.tsx`. The production build now emits page chunks instead of one approximately 854 kB application chunk; the largest initial entry is approximately 393 kB before gzip.
- Added `generated_documents.form_data jsonb` in `supabase/migrations/20260910010000_add_generated_document_form_data.sql`.
- Proposal and job-packet generation now stores a compact key/value snapshot of the source form data. Empty strings, nulls, undefined values, empty arrays, and empty objects are omitted while `false` and `0` are retained.
- `generated_by_user_id` and `generated_at` continue to provide the immutable author and timestamp. Generated PDF bytes are downloaded locally and are not retained in PostgreSQL or Supabase Storage; only lightweight metadata and `form_data` JSONB remain.
- Generated-document updates are limited to archive columns. The generated-document Storage bucket is purged and its upload/view policies are removed by `20260910030000_stop_retaining_generated_pdfs.sql`.
- Existing generated-PDF objects must be purged once through the Storage API with `npm run purge:generated-pdfs -- --confirm`; direct SQL deletion is intentionally avoided because it can orphan the physical blobs.
- Added compound/partial indexes for active jobs, proposals, generated documents, assignments, and packet photos.

## Findings

### High priority

1. Unbounded repository reads

`jobs-page.tsx`, `personnel-page.tsx`, and `equipment-page.tsx` load all tenant rows. Search, filtering, readiness counts, and sorting then happen in React. Add server-side search/filtering plus cursor pagination and return counts from database queries or RPCs. Do not add a fixed `limit` without adding pagination, because that would silently hide records.

2. Dashboard work grows with the entire tenant

`dashboard-page.tsx` fetches all jobs, JHA rows, job-personnel rows, and job-equipment rows to calculate a handful of counts. Replace this with a database view/RPC that returns the dashboard projection and aggregate counts. The dashboard should fetch only the current operation, the next small page of upcoming work, and recent activity.

3. Attribution and tenant-bound columns are writable through broad table updates

Several update policies validate the new row's organization but do not make `user_id`, `organization_id`, or relationship keys immutable. A client can potentially rewrite provenance or move a row's relationship while remaining inside an organization. Protect these columns with column-level update grants and/or database triggers, and test cross-tenant and provenance tampering with integration tests.

4. Storage and database operations are not generally transactional

Equipment references and hazard photos upload files and then insert metadata. Failures between those operations can leave orphaned files or metadata. Use an Edge Function for multi-step writes, or implement compensating cleanup for every upload/delete path and add a reconciliation job for old orphans.

5. Migration execution is not integration-tested in this repository

The SQL history is statically reviewed but there is no disposable Supabase project/local stack in the test command. Before production rollout, apply migrations to a staging project and verify RLS, Storage policies, RPC grants, triggers, unique constraints, and rollback/retry behavior with two organizations and multiple roles.

### Medium priority

6. `select('*')` and nested wildcard reads

The JHA, preflight, MOC, and safety-assurance paths include wildcard projections. Explicit projections reduce bandwidth, prevent accidental exposure when columns are added, and make frontend contracts stable.

7. No shared server-state cache or request cancellation

Each page owns its loading state and repeats requests after navigation or mutation. A query cache such as TanStack Query would deduplicate requests, cache stable reference data, invalidate affected records, and provide retry/backoff behavior. Effects should also use an abort/mounted guard so a slow response cannot overwrite a newer route's state.

8. Generated-document metadata accumulates indefinitely

Every PDF generation creates a metadata row. Add retention rules, an explicit archive/delete policy, and a scheduled cleanup process if long-term JSON history is not required. Uploaded equipment reference documents are a separate workflow and remain in their own Storage bucket.

9. Browser-side PDF generation is expensive for large packets

Job packet generation loads multiple related datasets, images, and reference documents into the browser. This is acceptable for a small packet but can cause memory pressure on iPad Safari. A future server-side/Edge rendering path should receive a bounded snapshot and stream the result, while retaining the client fallback for offline or temporary service failures.

10. The source still contains dead compatibility branches from prior conflict resolution

`job-hazard-analysis-page.tsx` contains unreachable `if (false)` blocks around duplicate legacy implementations. They do not execute, but they increase maintenance cost and can inflate transformed source. Remove them after confirming the current branch is the canonical implementation.

11. Validation is split between client code and SQL without enough shared contracts

Several statuses and flexible JSON shapes are interpreted by application code. Keep the UI validation for usability, but add database checks/RPC validation for invariants that must hold when clients or future integrations bypass the UI.

12. Observability is minimal

Errors are generally shown locally or logged with `console.error`. Add structured client events for failed saves/PDF generation, server logs for RPC/storage failures, correlation IDs for multi-step operations, and metrics for query latency and packet size. Never log form snapshots or credentials.

## Recommended implementation order

1. Create staging RLS/Storage integration tests and verify the new migrations.
2. Replace dashboard aggregation with a bounded SQL view/RPC.
3. Add cursor pagination and server-side filters to jobs, proposals, personnel, equipment, safety assurance, and MOC lists.
4. Restrict update grants/immutable columns and add cross-tenant tampering tests.
5. Add a shared query cache and stale-request cancellation.
6. Add generated-file retention/reconciliation and measure packet-size limits.
7. Move large PDF rendering to a server-side worker when packet size or device telemetry justifies it.

## Verification

- `npm test`: 113 passed.
- `npm run build`: passed; Vite reports no build failure. A chunk-size warning remains for a shared entry chunk, but route-level page chunks are now emitted.
- SQL application, RLS behavior, Storage behavior, and PDF visual rendering remain unverified against a live Supabase/staging environment.
