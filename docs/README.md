DroneSMS project documents and development briefs.
Server: `https://109b8de1.dronesms-app.pages.dev/`

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
  - `@vitejs/plugin-react` `^6.0.2`
  - `rollup-plugin-license` `^3.7.1`
  - `typescript` `^6.0.0`
  - `vite` `^8.0.14`
  - `tailwindcss` `^3.4.17`
  - `eslint` `^9.15.0`

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

