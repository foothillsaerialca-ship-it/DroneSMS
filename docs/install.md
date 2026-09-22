# Install and run DroneSMS locally

DroneSMS is a client-rendered React, TypeScript, Vite, and Supabase application.

## Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 7 requirement); a current Node.js LTS release is recommended
- npm and network access to the configured package registry
- Docker Desktop for local Supabase migration/RLS/pgTAP validation
- A Supabase project
- Permission to configure Supabase Authentication, run SQL migrations, and create the migration-defined Storage resources

The documentation audit used Node.js `24.14.0` and npm `11.9.0` successfully. Dependency ranges live in `package.json`; exact resolved versions live in `package-lock.json`.

## 1. Install dependencies

From the repository root:

```bash
npm install
```

For a clean, lockfile-exact CI installation, use:

```bash
npm ci
```

No `pip install` step is required. `docs/requirements.txt` is informational and intentionally declares no Python packages.

## 2. Configure Supabase

Use the Supabase CLI as the migration source of truth; do not maintain or follow a hand-written migration list. For a disposable local stack:

```bash
supabase start
supabase db reset --local
supabase db lint --local --level warning
supabase test db
```

For a linked hosted project, take a verified backup and review the pending migration plan before running `supabase db push`. The migrations establish tables, indexes, RLS, grants, RPCs, retention metadata, cleanup queues, and Storage buckets/policies. The CI database job rebuilds the complete schema and runs adversarial cross-tenant tests on every change.

Deploy both Edge Functions after schema deployment:

```bash
supabase functions deploy send-crew-acknowledgment
supabase functions deploy process-storage-cleanup --no-verify-jwt
```

`process-storage-cleanup` authenticates its scheduler with `STORAGE_CLEANUP_SECRET`; it does not use a public browser token. Schedule it from a trusted secret-capable job runner and retain its correlation-ID logs.

The final generated-document migration disables generated-PDF Storage access and keeps only metadata plus `form_data` JSONB. If the project already contains generated PDFs, set a server-only `SUPABASE_SERVICE_ROLE_KEY` and run `npm run purge:generated-pdfs` for a dry run, then `npm run purge:generated-pdfs -- --confirm` to permanently remove those objects through the Storage API. Never expose the service-role key through a `VITE_` variable.

## 3. Configure environment variables

Create a root `.env` file that is not committed:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
VITE_APP_URL=http://localhost:5173
VITE_ENABLE_REPORTS=false
VITE_TELEMETRY_ENDPOINT=
```

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required for live data and authentication.
- `VITE_APP_URL` controls email-confirmation and recovery redirects. If omitted, the application uses `window.location.origin` in a browser and `/` outside a browser.
- `VITE_ENABLE_REPORTS` keeps the unfinished Reports module out of navigation and routing unless deliberately enabled.
- `VITE_TELEMETRY_ENDPOINT` is optional and should be a same-origin, first-party redacted event collector.
- Never store a Supabase service-role key in a `VITE_` variable; Vite embeds such variables in browser assets.

If the required Supabase values are absent, the client intentionally falls back to an unavailable-client proxy. The UI can render, but Supabase operations return a configuration error.

## 4. Configure authentication URLs

In Supabase Authentication URL settings:

- Set the Site URL to the active local or deployed origin.
- Allow `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password` for local development.
- Add the equivalent production URLs before deployment.
- Keep email confirmation enabled and review Secure email change for the intended policy.
- Enable leaked-password protection, TOTP MFA, CAPTCHA, provider rate limits, and only the exact deployed redirect origins.

See [authentication-deployment.md](authentication-deployment.md).

## 5. Run and verify

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Run the deterministic checks separately:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run audit:production
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the completed production build locally. The same checks are mandatory in `.github/workflows/quality.yml`, along with a clean local Supabase rebuild and database tests.

## Troubleshooting

- Configuration error on every data action: verify the two required `VITE_SUPABASE_*` values, then restart Vite.
- Confirmation/recovery returns to the wrong origin: set `VITE_APP_URL` and update Supabase's redirect allowlist.
- Permission errors after login: confirm all migrations and RLS policies were applied in order and that the user has an active `organization_memberships` row for the selected profile organization.
- Storage upload or download errors: confirm migration-created buckets and object policies exist.
- Blank page after a production deploy: inspect the browser console and verify the host serves `index.html` for client-side routes.

See [security-operations.md](security-operations.md) for release, Auth, cleanup, retention, backup/restore, malware-scanning, and monitoring controls that require deployment-platform configuration.
