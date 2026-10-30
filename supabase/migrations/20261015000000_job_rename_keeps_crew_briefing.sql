-- Renaming a job is an administrative correction, not a change to the operation the crew
-- was briefed on. Only location, planned date, and service type remain briefing substance that
-- advances the briefing version and stales Ready to Operate.

-- 1. The JHA's job_type_scope is a locked Mission Basics copy derived as
-- "<service type> - <job name>". Service-type changes already advance the briefing version through
-- the jobs trigger below, so comparing the derived copy here only re-introduced rename
-- invalidation on the next JHA save. All other briefing fields and attributes are unchanged from
-- 20260903010000_crew_briefing_acknowledgments.sql.
create or replace function public.advance_crew_briefing_version() returns trigger language plpgsql set search_path=public as $$
begin
  if row(new.hazard_entries,new.ppe_requirements,new.crew_members,new.nearest_hospital,
    new.emergency_facility_address,new.emergency_contact,new.drone_incident_procedure,new.site_access,
    new.exclusion_zone_description,new.known_airspace_restrictions)
    is distinct from row(old.hazard_entries,old.ppe_requirements,old.crew_members,old.nearest_hospital,
    old.emergency_facility_address,old.emergency_contact,old.drone_incident_procedure,old.site_access,
    old.exclusion_zone_description,old.known_airspace_restrictions) then
    new.briefing_version := old.briefing_version+1;
    update public.jobs set crew_acknowledgment_required_at=coalesce(crew_acknowledgment_required_at,now()) where id=new.job_id;
  end if;
  return new;
end $$;

-- 2. A rename keeps the stored derived scope in step with the job without advancing the briefing
-- version, so the JHA page sees no Mission Basics difference and does not rewrite the row.
-- Scopes that no longer match the old derived value (legacy free text) are left untouched.
-- Security attributes from 20260904000000_harden_readiness_invalidation.sql are restated
-- because CREATE OR REPLACE resets them.
create or replace function public.advance_crew_briefing_version_from_job() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.name is distinct from old.name then
    update public.jha_assessments set job_type_scope=new.service_type||' - '||new.name
      where job_id=new.id and job_type_scope=old.service_type||' - '||old.name;
  end if;
  if row(new.location,new.planned_date,new.service_type) is distinct from row(old.location,old.planned_date,old.service_type) then
    update public.jha_assessments set briefing_version=briefing_version+1 where job_id=new.id;
    new.crew_acknowledgment_required_at := coalesce(new.crew_acknowledgment_required_at,now());
    perform public.mark_job_operation_readiness_stale(new.id,'Operation briefing content changed');
  end if;
  return new;
end $$;

revoke all on function public.advance_crew_briefing_version_from_job() from public, anon, authenticated;
