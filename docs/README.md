# DroneSMS

DroneSMS is a React and Supabase safety-management application for commercial drone operations. The current `0.1.0` application supports organization onboarding, proposals, jobs, personnel and equipment readiness, job hazard analyses (JHAs), pre-flight checklists, safety events, closeout records, and browser-generated PDF records.

Production deployment: `https://7067bf63.dronesms-app.pages.dev/`

## Current release

- Application version: `0.1.0`
- Documentation audit date: 2026-08-25
- Runtime: React 18, React Router 6, Supabase JS 2, TypeScript, Vite 7, and Tailwind CSS 3
- Backend: hosted Supabase Authentication, Postgres, Storage, row-level security, and RPC functions
- Package source of truth: `package.json`; exact resolved dependency tree: `package-lock.json`

The August 2026 schema history added expanded JHA site-planning fields, proposal/JHA airspace workflow fields, organization Safety Manager designation, and independent Safety Manager/RPIC attestations. See [documentation.md](documentation.md) for the complete implementation history, file/function notes, verification results, and known errors.

## Implemented application areas

- Email/password registration, confirmation callback, login, password recovery, password change, and secure email-change requests
- Organization onboarding, identity, branding, operational settings, and SMS program language
- Dashboard workflow summaries and attention indicators
- Proposal authoring, service-scope defaults, hazard selection, personnel/equipment selection, PDF generation, and conversion to jobs
- Job details, assignments, readiness summaries, safety events, operation closeout, and closeout packet export
- Personnel and equipment repositories, including credential, maintenance, chemical-material, and reference-document tracking
- Multi-step operational JHA with airspace, environmental, hazard, PPE, photo evidence, and role-attestation workflows
- Pre-flight checklist persistence and completion validation

Reports and several future account-management controls are currently placeholder interfaces. Billing, subscriptions, administrative tooling, external smart-site intelligence, and offline synchronization are planned rather than implemented.

## Repository map

```text
src/app/router.tsx                  Application routes
src/app/frontend/                  React entry, shell, styles, and feature modules
src/app/backend/lib/               Environment access
src/app/backend/integrations/      Supabase client adapter and shared types
supabase/migrations/               Ordered database, RLS, RPC, and storage history
docs/                              Product, installation, deployment, and history documentation
```

## Local development

```bash
npm install
npm run dev
```

Required client variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `VITE_APP_URL` is recommended for deployed authentication redirects and otherwise falls back to the current browser origin. Never expose a Supabase service-role key through a `VITE_` variable.

See [install.md](install.md) for database and authentication setup.

## Verification commands

```bash
npm test
npm run build
npm run lint
```

At the 2026-08-25 audit, all 17 unit tests passed and the production build completed. Linting is a known broken verification path because the repository has no ESLint 9 flat configuration. The build also reports a non-fatal bundle-size warning. Both are documented, not fixed, in [documentation.md](documentation.md#known-errors-and-limitations).

## Documentation

- [Complete documentation and history](documentation.md)
- [Installation and local setup](install.md)
- [Authentication deployment configuration](authentication-deployment.md)
- [MVP build phases](mvp-build-phases.md)
- [Technical implementation plan](implementation-plan.md)

`docs/requirements.txt` intentionally contains no Python packages; this application uses Node.js and npm.
