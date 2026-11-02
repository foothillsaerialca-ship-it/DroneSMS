# DroneSMS

DroneSMS is a React and Supabase safety-management application for commercial drone operations. The current `0.1.0` application supports organization onboarding, proposals, jobs, personnel and equipment readiness, job hazard analyses (JHAs), pre-flight checklists, safety events, closeout records, and browser-generated PDF records.

## Document status

The runnable application and ordered migrations under `supabase/migrations/` are the source
of truth for implemented behavior. `DroneSMS Scope v3.docx`, `DroneSMS Lovable Prompt v2.pdf`,
`DroneSMS_Developer_Brief_Smart_Site_Intelligence.docx`, and `DroneSMS JHA Template.docx` are
retained planning/reference artifacts and are not current operator instructions or active
templates. Some contain superseded scored-risk and matrix concepts. The implemented product
does not ask operators to assign severity/likelihood values, numerical or residual-risk scores,
or Low/Medium/High operational risk ratings. Current behavior uses guided hazard identification,
documented controls, controls-in-place confirmation, role-based review and acceptance, and
Ready to Operate checks. Legitimate Safety Risk Management and hazard-analysis terminology
remains applicable.

## Infrastructure

Production deployment: `https://7067bf63.dronesms-app.pages.dev/`

## Current release

- Application version: `0.1.0`
- Documentation audit date: 2026-10-31
- Runtime: React 18, React Router 7, Supabase JS 2, TypeScript, Vite 7, and Tailwind CSS 3
- Backend: hosted Supabase Authentication, Postgres, Storage, row-level security, and RPC functions
- Package source of truth: `package.json`; exact resolved dependency tree: `package-lock.json`

The August 2026 schema history added expanded JHA site-planning fields, proposal/JHA airspace workflow fields, organization Safety Manager designation, and independent Safety Manager/RPIC attestations. See [documentation.md](documentation.md) for the complete implementation history, file/function notes, verification results, and known errors.

The authenticated application gates access on current, versioned Privacy Policy and Terms of Service acceptance. The documents are available in [privacy-policy.md](privacy-policy.md) and [terms-of-service.md](terms-of-service.md), and can be reopened through Settings. The versioned dependency inventory is in [licenses.md](licenses.md); production builds also publish full notices at `/vendor-licenses.txt`.

Regenerate the dependency inventory after changing npm dependencies with `npm run licenses:generate`.

## Implemented application areas

- Email/password registration, confirmation callback, login, password recovery, password change, and secure email-change requests
- Organization onboarding, identity, branding, operational settings, and SMS program language
- Dashboard workflow summaries and attention indicators
- Proposal authoring, service-scope defaults, hazard selection, personnel/equipment selection, PDF generation, and conversion to jobs
- Job details, assignments, readiness summaries, safety events, operation closeout, and closeout packet export
- Personnel and equipment repositories, including credential, maintenance, chemical-material, and reference-document tracking
- Multi-step operational JHA with airspace, environmental, hazard, PPE, photo evidence, Part 107 visibility/cloud-clearance checks, ATC authorization evidence, and role-attestation workflows
- Pre-flight checklist persistence and completion validation
- Safety Event Part 107 reportability assessment with the 10-calendar-day deadline and manual FAA filing evidence
- Aircraft registration, condition-for-safe-operation, Remote ID pathway, and manufacturer wind-limit readiness checks
- Required account-level Privacy Policy and Terms of Service acceptance with version-resettable database flags

Reports and several future account-management controls are currently placeholder interfaces. Billing, subscriptions, broader account administration, external smart-site intelligence, and offline synchronization are planned rather than implemented.

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
npm run test:all
npm run build
npm run lint
npm run audit:production
```

See [documentation.md](documentation.md) for the latest Part 107 implementation notes and verification status. Run the commands above against the current checkout before release.

## Documentation

- [Complete documentation and history](documentation.md)
- [Installation and local setup](install.md)
- [Authentication deployment configuration](authentication-deployment.md)
- [MVP build phases](mvp-build-phases.md)
- [Technical implementation plan](implementation-plan.md)

`docs/requirements.txt` intentionally contains no Python packages; this application uses Node.js and npm.
Runtime and build configuration lives in `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `vite.config.ts`, and `vitest.config.ts`.
