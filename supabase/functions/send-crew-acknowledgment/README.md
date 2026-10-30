# Crew briefing email function

Deploy with JWT verification enabled (the default). Configure `RESEND_API_KEY`,
`RESEND_FROM` (a sender on a Resend-verified domain), and `PUBLIC_APP_URL` (the
public application origin, with no trailing path). Supabase supplies its URL and
anon and service-role keys. The function verifies the caller's JWT, then uses
the service role for invitation creation and delivery status updates. These
RPCs are not callable by browser clients, so the raw acknowledgment token is
only sent to the crew member's email address. No provider credential is stored
in source. Failed provider calls are recorded as `Email Failed`, never `Sent`.
