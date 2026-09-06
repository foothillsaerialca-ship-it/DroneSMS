-- Crew briefing tokens are no longer sufficient for anonymous RPC execution.
-- Keep the lookup available to signed-in users while removing the anon role.
revoke execute on function public.get_public_crew_briefing(text) from anon;
grant execute on function public.get_public_crew_briefing(text) to authenticated;
