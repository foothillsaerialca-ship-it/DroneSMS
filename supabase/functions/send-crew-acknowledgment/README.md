# Crew briefing email function

Deploy with JWT verification enabled (the default). Configure `RESEND_API_KEY` and
`PUBLIC_APP_URL`; Supabase supplies its URL and anon key. No provider credential is
stored in source. Failed provider calls are recorded as `Email Failed`, never `Sent`.
