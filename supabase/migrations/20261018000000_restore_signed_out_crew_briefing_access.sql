-- Purpose: Restore signed-out access to the two crew briefing token RPCs.
-- 20260906090000 and 20260906100000 revoked anon EXECUTE, but crew members open the
-- emailed acknowledgment link without a DroneSMS account, and 20261014000000 documents
-- that these grants are intentionally kept. The hosted database already grants anon;
-- this makes a fresh deploy from migrations match it.
-- Token possession is the authorization: tokens are hashed, single-use, and expire.
-- Known limitation: PUBLIC stays revoked; only anon and authenticated may execute.

revoke all on function public.get_public_crew_briefing(text) from public;
grant execute on function public.get_public_crew_briefing(text) to anon, authenticated;

revoke all on function public.acknowledge_public_crew_briefing(text, text) from public;
grant execute on function public.acknowledge_public_crew_briefing(text, text) to anon, authenticated;
