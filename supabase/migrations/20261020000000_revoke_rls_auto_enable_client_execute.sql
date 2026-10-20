-- Purpose: Remove client EXECUTE from Supabase's rls_auto_enable() event-trigger helper.
-- The function is created by the Supabase dashboard (not these migrations) and backs
-- the ensure_rls event trigger, which turns on RLS for new public tables. Event
-- triggers run without checking EXECUTE, so revoking client roles does not change
-- that behavior; it only clears the Security Advisor anon/authenticated warnings.
-- Known limitation: guarded with to_regprocedure so a fresh deploy without the
-- dashboard-created function is a no-op.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
