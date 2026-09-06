-- Anonymous callers must not execute this SECURITY DEFINER RPC.
revoke execute on function public.acknowledge_public_crew_briefing(text, text) from anon;

-- Preserve the authenticated workflow explicitly.
grant execute on function public.acknowledge_public_crew_briefing(text, text) to authenticated;
