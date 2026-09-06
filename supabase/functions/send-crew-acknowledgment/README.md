# Crew briefing email function

Deploy with JWT verification enabled (the default). Configure `RESEND_API_KEY`,
`RESEND_FROM` (a sender on a Resend-verified domain), and `PUBLIC_APP_URL` (the
public application origin, with no trailing path). Supabase supplies its URL and
anon key. No provider credential is stored in source. Failed provider calls are
recorded as `Email Failed`, never `Sent`.
