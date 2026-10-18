# Testing and linting

DroneSMS has two automated test suites, an ESLint configuration, and a GitHub Actions workflow that runs every check on pull requests.

## Commands

| Command | What it runs |
| --- | --- |
| `npm test` | Existing `node:test` suite (`*.test.ts`): domain rules plus source-inspection checks. No DOM. |
| `npm run test:components` | Vitest + React Testing Library component suite (`*.test.tsx`) in jsdom. |
| `npm run test:all` | Both suites, `npm test` first. |
| `npm run lint` | ESLint over the whole repository (`eslint.config.js`). |
| `npm run typecheck` | TypeScript check of `src/` without emitting files. |
| `npm run build` | Production build (`tsc -b && vite build`), unchanged. |

For a watch loop while writing component tests, run `npx vitest`.

`npm test` lists its files explicitly. When adding a `node:test` file, add it to the script, or it will not run.

## Component tests

Component tests render real application code: `AppRouter`, `AuthProvider`, `ProtectedRoute`, and the pages under test. Only the Supabase client is replaced.

- `src/test/setup.ts` replaces both Supabase client modules (`@frontend/lib/supabase` and `@backend/integrations/supabase/client`) with an in-memory stand-in, makes `fetch`, `XMLHttpRequest`, and `WebSocket` throw so a missing mock cannot reach the network, and resets all state between tests.
- `vitest.config.ts` never reads `.env` files and blanks the `VITE_SUPABASE_*` variables, so tests cannot pick up real credentials.
- `src/test/supabase-mock.ts` is the stand-in. Tests seed rows with `supabaseMock.setTable(table, rows)`, override a request with `supabaseMock.respond(call => result)`, control sessions with `setSession`, `setSessionLoader`, and `emitAuthChange`, and inspect requests with `calls` and `writes()`. Use `createDeferred()` to hold a response open while asserting a loading state. Do not use timers.
- `src/test/render.tsx` mounts `AuthProvider` and a `MemoryRouter` around the real `AppRouter` (or any route tree you pass). It exposes the current URL and a `navigate` helper for history (back is `navigate(-1)`). `signInCompletedUser()` seeds a signed-in user whose company onboarding is complete.
- `src/test/fixtures/` holds fictitious records.

`tailwind.config.ts` leaves `*.test.tsx` files and `src/test/` out of its content scan, so test text cannot add CSS to the production build.

Supabase returns query errors as plain objects, not `Error` instances. The stand-in does the same, so error-message tests match production behavior.

### Current coverage

| File | Guards |
| --- | --- |
| `features/jobs/pages/jobs-page.test.tsx` | Jobs/Proposals page identity, URL-driven tab selection, sidebar switching, back/forward, section refresh, and the loading, empty, and failure states |
| `features/auth/components/protected-route.test.tsx` | Waiting for auth initialization, deep links, sign-in redirect, sign-out, onboarding redirects, relinking an owned organization, delayed profile lookups, and lookup failures |
| `features/jobs/pages/job-hazard-analysis-page.test.tsx` | Expanding and collapsing hazards, multiple expanded hazards, Expand All and Collapse All, auto-expanding new hazards, search filtering, keeping unsaved field and caption values, and keeping state on the right hazard while filtered |

Each guarded behavior was checked by temporarily breaking it in a throwaway copy of the source and confirming that a test failed.

## Lint enforcement

`eslint.config.js` uses `@eslint/js` recommended, `typescript-eslint` recommended, and the React Hooks `rules-of-hooks` and `exhaustive-deps` rules, all as errors. It has no stylistic rules. `dist/`, `coverage/`, and `node_modules/` are ignored.

When lint was first enabled, the code already had 30 findings in 11 files. These are recorded in `eslint-suppressions.json` using ESLint's bulk-suppression feature. No rules are turned off. The effect:

- `npm run lint` passes on the current code and fails on any new violation, including a new violation of the same rule in a file that already has suppressed ones (suppressions are per-file counts).
- When you fix a suppressed finding, lint reports that suppressions are left over. Run `npx eslint . --prune-suppressions` and commit the smaller `eslint-suppressions.json`.
- Never run `--suppress-all` again to hide new findings. Fix them, or add a targeted `eslint-disable-next-line` comment that explains why.

Pre-existing findings at baseline (recommended for separate cleanup work):

| Rule | Count | Location | Significance |
| --- | --- | --- | --- |
| `react-hooks/exhaustive-deps` | 3 | `sms/components/safety-assurance-area.tsx`, `sms/components/safety-review-area.tsx`, `sms/pages/moc-detail-page.tsx` | Medium. Each effect calls a `load` function defined in render. Its listed dependency (`organizationId`/`mocId`) is the value `load` reads, so no stale data was found, but the pattern is fragile. |
| `@typescript-eslint/no-explicit-any` | 21 | `backend/integrations/supabase/client.ts` (8), `jobs/lib/proposal-pdf.ts` (11), `job-hazard-analysis-page.tsx` (1), `vite.config.ts` (1) | Low. Type-safety debt, mostly around proxy and PDF-library interop. |
| `no-control-regex` | 2 | `jobs/lib/proposal-pdf.ts`, `lib/xlsx-writer.ts` | None. These are intentional control-character sanitizers. |
| `no-useless-escape` | 2 | `lib/password-utils.ts` | None. Redundant escapes in a character class; behavior is the same. |
| `prefer-const` | 1 | `equipment/pages/equipment-page.tsx` | None. |
| `@typescript-eslint/no-unused-vars` | 1 | `preflight/pages/preflight-checklist-page.tsx` (`statusLabels` used only as a type) | None. |

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`. It uses Node.js 22 with the npm cache and runs `npm ci`, then typecheck, lint, `npm test`, `npm run test:components`, and `npm run build`. After a successful install, every check runs even if an earlier one failed, so one run reports all failures. A newer pull-request run cancels the older one; runs for pushes to `main` are never cancelled.

The workflow has read-only `contents` permission, uses no secrets, does not persist checkout credentials, and does not deploy. Deployment stays with the existing hosting pipeline. Making the check required is a branch-protection setting that a repository admin must turn on.
