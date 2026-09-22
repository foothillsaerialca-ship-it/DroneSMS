# Security and operations runbook

This runbook covers controls that cannot be made effective by browser code or SQL alone. Complete it for staging and production and record the evidence with each release.

## Release gate

1. Run `npm ci`, `npm run audit:production`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Run `supabase start`, `supabase db reset --local`, `supabase db lint --local --level warning`, and `supabase test db` against the complete migration history.
3. Review `supabase migration list` on the linked project, take a restorable database backup, then apply migrations with `supabase db push`.
4. Deploy `send-crew-acknowledgment` and `process-storage-cleanup`, set their secrets, and send one staging crew acknowledgment end to end.
5. Verify the deployed CSP, HSTS, Referrer-Policy, Permissions-Policy, and `X-Content-Type-Options` headers. `_headers` covers compatible static hosts; `vercel.json` covers Vercel.
6. Perform authenticated browser smoke tests for registration/confirmation, password recovery, MFA, invitation acceptance, proposal conversion, JHA attestations, RPIC preflight approval, ready-to-operate, closeout/assurance, and MOC transitions.

## Supabase Auth

- Require email confirmation and double confirmation for email changes.
- Enable secure password changes and leaked-password protection.
- Enable TOTP MFA. Owners must reach AAL2 before an ownership transfer is accepted.
- Configure CAPTCHA for registration, password recovery, and other public abuse-prone forms. The CAPTCHA provider secret belongs in Supabase, never a `VITE_` variable.
- Set conservative sign-in, signup, email, OTP, and token-verification rate limits and alert on sustained throttling.
- Allow only exact production and staging callback/recovery URLs. Remove preview origins when they expire.
- Review SMTP reputation, bounce, complaint, and delivery metrics. Do not log recovery, invitation, or crew capability tokens.

## Edge Functions and scheduled cleanup

Set server-side secrets with `supabase secrets set`: `PUBLIC_APP_URL`, `ALLOWED_ORIGINS`, `RESEND_API_KEY`, `RESEND_FROM`, and a randomly generated `STORAGE_CLEANUP_SECRET`. Supabase supplies the project URL and service-role key to hosted functions; never expose the service-role key to Vite.

Invoke `process-storage-cleanup` daily with `POST` and `x-cleanup-secret`. Alert on failed items, five attempts, queue age over 48 hours, or unexpected retained-byte growth. The queue intentionally provides a recovery grace period. Safety evidence uses the retention policy recorded in `artifact_retention_policies`; a documented legal hold always overrides purge.

## Upload scanning

The application performs byte-count, magic-signature, MIME allowlist, and image-dimension checks, and Storage repeats byte/MIME limits. Before accepting uploads in a regulated or hostile environment, connect Storage object-created events to a malware-scanning service. Quarantine new objects until clean, reject password-protected/unscannable documents according to policy, and record only scan status and engine/version—not file contents—in telemetry.

## Backups and restore drills

- Retain provider database backups and Storage backups according to the organization’s contractual and legal obligations.
- Quarterly, restore the latest backup into an isolated project, apply any later migrations, and verify tenant RLS plus one complete safety record and attachment.
- Record recovery-point and recovery-time results. A backup is not considered verified until the restore drill passes.

## Monitoring and privacy

- Send browser telemetry only to a first-party endpoint permitted by CSP. Accepted fields are event name, error type, route path, time, correlation ID, and a small allowlisted context.
- Alert on Edge Function error/latency, authentication anomalies, RLS denials, database/storage growth, cleanup backlog, email failures, and repeated public-token failures.
- Never collect URL fragments/query tokens, passwords, JWTs, full form snapshots, uploaded file content, customer/site descriptions, or personnel contact details in logs.
- Rotate API keys and cleanup secrets after suspected disclosure and at the organization’s normal secret-rotation interval.
