# Install and run DroneSMS locally

DroneSMS is a client-rendered React, TypeScript, Vite, and Supabase application.

## Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 7 requirement); a current Node.js LTS release is recommended
- npm and network access to the configured package registry
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

Create a project and apply every SQL file in `supabase/migrations/` in filename order:

1. `20260524000000_merged.sql`
2. `20260814000000_add_jha_site_planning_fields.sql`
3. `20260814010000_add_airspace_workflow_fields.sql`
4. `20260821000000_add_safety_representative_designation.sql`
5. `20260821010000_add_jha_role_attestations.sql`

The migrations establish tables, indexes, row-level-security policies, RPC functions, and the `organization-logos`, `job-evidence-photos`, `generated-documents`, and `equipment-reference-documents` Storage buckets and policies. Use your normal Supabase CLI or SQL Editor deployment workflow. Do not run production migrations against an unbacked-up project.

## 3. Configure environment variables

Create a root `.env` file that is not committed:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
VITE_APP_URL=http://localhost:5173
```

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required for live data and authentication.
- `VITE_APP_URL` controls email-confirmation and recovery redirects. If omitted, the application uses `window.location.origin` in a browser and `/` outside a browser.
- Never store a Supabase service-role key in a `VITE_` variable; Vite embeds such variables in browser assets.

If the required Supabase values are absent, the client intentionally falls back to an unavailable-client proxy. The UI can render, but Supabase operations return a configuration error.

## 4. Configure authentication URLs

In Supabase Authentication URL settings:

- Set the Site URL to the active local or deployed origin.
- Allow `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password` for local development.
- Add the equivalent production URLs before deployment.
- Keep email confirmation enabled and review Secure email change for the intended policy.

See [authentication-deployment.md](authentication-deployment.md).

## 5. Run and verify

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Run the deterministic checks separately:

```bash
npm test
npm run build
```

`npm run preview` serves the completed production build locally. `npm run lint` is currently known to fail before inspecting source because an ESLint 9 flat-config file is absent; see [documentation.md](documentation.md#known-errors-and-limitations).

## Troubleshooting

- Configuration error on every data action: verify the two required `VITE_SUPABASE_*` values, then restart Vite.
- Confirmation/recovery returns to the wrong origin: set `VITE_APP_URL` and update Supabase's redirect allowlist.
- Permission errors after login: confirm all migrations and RLS policies were applied in order and that the user has a valid `profiles`/organization relationship.
- Storage upload or download errors: confirm migration-created buckets and object policies exist.
- Blank page after a production deploy: inspect the browser console and verify the host serves `index.html` for client-side routes.
