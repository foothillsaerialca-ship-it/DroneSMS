-- Renaming a job is an administrative correction, not a change to the operation the crew
-- was briefed on. Only location, planned date, and service type remain briefing substance that
-- advances the briefing version and stales Ready to Operate.
-- Security attributes from 20260904000000_harden_readiness_invalidation.sql are restated
-- because CREATE OR REPLACE resets them.
create or replace function public.advance_crew_briefing_version_from_job() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if row(new.location,new.planned_date,new.service_type) is distinct from row(old.location,old.planned_date,old.service_type) then
    update public.jha_assessments set briefing_version=briefing_version+1 where job_id=new.id;
    new.crew_acknowledgment_required_at := coalesce(new.crew_acknowledgment_required_at,now());
    perform public.mark_job_operation_readiness_stale(new.id,'Operation briefing content changed');
  end if;
  return new;
end $$;

revoke all on function public.advance_crew_briefing_version_from_job() from public, anon, authenticated;
