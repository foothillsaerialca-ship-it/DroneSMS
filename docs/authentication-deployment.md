# Authentication deployment configuration

Before inviting beta users, configure the Supabase project Authentication URL settings:

- Set **Site URL** to the deployed DroneSMS origin (for example, `https://app.dronesms.app`).
- Add the deployed `/auth/callback` and `/reset-password` URLs to the **Redirect URL allowlist**.
- Keep the equivalent localhost URLs allowlisted for local development when needed.
- Keep email confirmation enabled and review **Secure email change** according to the beta security policy.

Set `VITE_APP_URL` to the deployed DroneSMS origin in the production build environment. When it is omitted, the frontend uses the current browser origin, which preserves local development and preview behavior. Never place a Supabase service-role key in a `VITE_` variable.
