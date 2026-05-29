# Install and Run Locally

This project is a frontend application built with React, TypeScript, Vite, and Supabase.

## Prerequisites

- Node.js 18+ installed
- npm 10+ installed
- A Supabase project and environment variables configured in your local environment

## Project dependency versions

The active package versions are defined in `package.json` and locked in `package-lock.json`.

- `vite` `^8.0.14`
- `@vitejs/plugin-react` `^6.0.2`
 - `rollup-plugin-license` `^3.7.1`
- `typescript` `^6.0.0`
- `tailwindcss` `^3.4.17`
- `eslint` `^9.15.0`
- `react` `^18.3.1`
- `react-dom` `^18.3.1`
- `react-router-dom` `^6.30.1`
- `@supabase/supabase-js` `^2.49.8`

## Install

1. Open a terminal in the project root:


2. Install dependencies:

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
