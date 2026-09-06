-- Keep readiness invalidation behind trusted trigger execution. The helper accepts
-- an arbitrary job UUID and stale reason, so it must never be a client RPC.
revoke all on function public.mark_job_operation_readiness_stale(uuid, text) from public;
revoke all on function public.mark_job_operation_readiness_stale(uuid, text) from anon, authenticated;

-- These zero-argument trigger functions are the complete set of callers of the
-- internal helper. Run them as their migration owner so authenticated table
-- updates can still invalidate readiness after the helper's client ACL is removed.
-- Trigger wiring and function bodies (including stale reasons) remain unchanged.
alter function public.invalidate_readiness_from_jha() security definer;
alter function public.invalidate_readiness_from_jha() set search_path = pg_catalog, public;

alter function public.invalidate_readiness_from_preflight() security definer;
alter function public.invalidate_readiness_from_preflight() set search_path = pg_catalog, public;

alter function public.invalidate_readiness_from_assignment() security definer;
alter function public.invalidate_readiness_from_assignment() set search_path = pg_catalog, public;

alter function public.invalidate_readiness_from_equipment() security definer;
alter function public.invalidate_readiness_from_equipment() set search_path = pg_catalog, public;

alter function public.advance_crew_briefing_version_from_job() security definer;
alter function public.advance_crew_briefing_version_from_job() set search_path = pg_catalog, public;

alter function public.advance_crew_briefing_version_from_assignment() security definer;
alter function public.advance_crew_briefing_version_from_assignment() set search_path = pg_catalog, public;

-- Trigger functions do not need RPC privileges. Explicit revocation prevents the
-- wrappers from becoming a replacement client-callable path if PostgreSQL's
-- trigger-only invocation restriction ever changes or a gateway exposes them.
revoke all on function public.invalidate_readiness_from_jha() from public, anon, authenticated;
revoke all on function public.invalidate_readiness_from_preflight() from public, anon, authenticated;
revoke all on function public.invalidate_readiness_from_assignment() from public, anon, authenticated;
revoke all on function public.invalidate_readiness_from_equipment() from public, anon, authenticated;
revoke all on function public.advance_crew_briefing_version_from_job() from public, anon, authenticated;
revoke all on function public.advance_crew_briefing_version_from_assignment() from public, anon, authenticated;
