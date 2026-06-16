# Install and Run Locally

This project is a frontend application built with React, TypeScript, Vite, and Supabase.

## Prerequisites

- Node.js 18+ installed
- npm 10+ installed
- A Supabase project and environment variables configured in your local environment

## Project dependency versions

The active package versions are defined in `package.json` and locked in `package-lock.json`.

**Runtime dependencies:**
- `react` `^18.3.1`
- `react-dom` `^18.3.1`
- `react-router-dom` `^6.30.1`
- `@supabase/supabase-js` `^2.49.8`
- `clean` `^4.0.2`

**Build and dev tools:**
- `vite` `^7.0.0`
- `@vitejs/plugin-react` `^4.0.0`
- `typescript` `^5.5.4`
- `tailwindcss` `^3.4.17`
- `autoprefixer` `^10.4.20`
- `postcss` `^8.4.49`
- `eslint` `^9.15.0`
- `rollup-plugin-license` `^3.7.1`
- `@types/react` `^18.3.11`
- `@types/react-dom` `^18.3.1`
- `@types/node` `^20.0.0`

## Install

1. Open a terminal in the project root:

2. Verify migrations are correct:

```bash
npm run build
```

3. Install dependencies:

```bash
npm install
```

## Run the app locally

```bash
npm run dev
```

Then open the local URL shown in the terminal (typically `http://localhost:5173`).

## Notes

- `docs/requirements.txt` is intentionally empty of Python dependencies because this repository uses Node.js and npm for package management.
- If you add Python-specific tooling later, list those packages in `docs/requirements.txt`.
 - `package.json` also includes a lodash override to force patched `^4.17.30` for transitive dependency security.
