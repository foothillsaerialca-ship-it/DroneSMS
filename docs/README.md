DroneSMS project documents and development briefs.
Server: `https://7067bf63.dronesms-app.pages.dev/`

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

- **Supabase**
  - Database and authentication backend.
  - Client library: `@supabase/supabase-js` version `^2.49.8`.
  - Local project migrations are stored under `supabase/migrations/`.
  - Example infrastructure entities: organizations, jobs, JHA assessments, preflight checklists, personnel, job personnel, equipment, and job equipment.

- **Frontend stack**
  - Framework: React
  - Build tool: Vite
  - Styling: Tailwind CSS
  - PostCSS
  - Linting: ESLint

- **Key dependency versions**
  - `react` `^18.3.1`
  - `react-dom` `^18.3.1`
  - `react-router-dom` `^6.30.1`
  - `@supabase/supabase-js` `^2.49.8`
  - `vite` `^7.0.0`
  - `@vitejs/plugin-react` `^4.0.0`
  - `typescript` `^5.5.4`
  - `tailwindcss` `^3.4.17`
  - `autoprefixer` `^10.4.20`
  - `postcss` `^8.4.49`
  - `eslint` `^9.15.0`
  - `rollup-plugin-license` `^3.7.1`

## Languages Involved

- **TypeScript** — primary application language for the frontend and app logic.
- **HTML** — used in `index.html` and rendered by React.
- **CSS** — global styles and Tailwind-generated styling in `src/styles/globals.css`.
- **SQL** — Supabase database schema and migrations under `supabase/migrations/`.

## Notes

- The app uses Supabase as the backend service for data persistence and auth.
- Frontend source files live under `src/` with app routing, features, and integration code.
- Environment and runtime configuration is managed through `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, and `vite.config.ts`.
 - A `lodash` override is applied in `package.json` to ensure the dependency tree uses a patched `4.17.30` release.
