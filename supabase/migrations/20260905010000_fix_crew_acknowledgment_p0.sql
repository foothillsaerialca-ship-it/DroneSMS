-- Repair the manual briefing RPC contract used by the job hub. The original
-- five-argument function relied on PostgREST resolving an omitted defaulted
-- timestamp. Use the exact four-argument API invoked by existing clients and
-- stamp evidence on the server.
drop function if exists public.record_manual_field_briefing(uuid,text,text,boolean,timestamptz);

alter table public.crew_briefing_acknowledgments
  add column if not exists attested_by_rpic_personnel_id uuid references public.personnel(id) on delete set null;

with unambiguous_job_rpics as (
  select
    c.id as acknowledgment_id,
    (array_agg(distinct jp.personnel_id))[1] as personnel_id
  from public.crew_briefing_acknowledgments c
  join public.job_personnel jp
    on jp.job_id = c.job_id
    and jp.organization_id = c.organization_id
    and jp.assigned_role = 'RPIC'
  join public.personnel r
    on r.id = jp.personnel_id
    and r.organization_id = c.organization_id
    and r.user_id = c.created_by_user_id
  where c.acknowledgment_method = 'Manual Field Briefing'
    and c.attested_by_rpic_personnel_id is null
  group by c.id
  having count(distinct jp.personnel_id) = 1
)
update public.crew_briefing_acknowledgments c
set attested_by_rpic_personnel_id = rpic.personnel_id
from unambiguous_job_rpics rpic
where c.id = rpic.acknowledgment_id
  and c.attested_by_rpic_personnel_id is null;

create or replace function public.record_manual_field_briefing(
  p_assignment_id uuid,
  p_reason text,
  p_reason_detail text,
  p_attested boolean
)
returns public.crew_briefing_acknowledgments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  a public.job_personnel;
  j public.jobs;
  h public.jha_assessments;
  r public.personnel;
  result public.crew_briefing_acknowledgments;
begin
  select * into a from public.job_personnel where id = p_assignment_id;
  select * into j from public.jobs
    where id = a.job_id and organization_id = public.current_user_organization_id();
  select * into r from public.crew_briefing_assigned_rpic(a.job_id);
  select * into h from public.jha_assessments where job_id = a.job_id;

  if j.id is null or r.id is null or r.user_id is distinct from auth.uid() then
    raise exception 'Only the assigned RPIC can record a Manual Field Briefing.';
  end if;
  if a.organization_id <> j.organization_id or a.assigned_role not in ('Pilot','Visual Observer','Payload Operator','Ground Crew') then
    raise exception 'This assignment does not require crew acknowledgment.';
  end if;
  if h.id is null then raise exception 'Save the Operational JHA first.'; end if;
  if not p_attested
    or p_reason not in ('No internet/cellular service','Crew member unable to access email','Device/access issue','Other')
    or (p_reason = 'Other' and nullif(btrim(p_reason_detail), '') is null) then
    raise exception 'A valid reason and RPIC attestation are required.';
  end if;

  update public.crew_briefing_acknowledgments
  set status = 'Superseded', token_hash = null, updated_at = now()
  where assignment_id = a.id and briefing_version = h.briefing_version
    and status in ('Invited','Sent');

  insert into public.crew_briefing_acknowledgments(
    organization_id, job_id, personnel_id, assignment_id, assigned_role,
    briefing_version, acknowledgment_method, status, field_briefed_at,
    manual_reason, manual_reason_detail, rpic_attested, created_by_user_id,
    attested_by_rpic_personnel_id
  ) values (
    j.organization_id, j.id, a.personnel_id, a.id, a.assigned_role,
    h.briefing_version, 'Manual Field Briefing', 'Manual Field Briefing', now(),
    p_reason, nullif(btrim(p_reason_detail), ''), true, auth.uid(), r.id
  ) returning * into result;

  -- This opts an already-existing blocked operation into the same gate as a new
  -- job without recreating its job, assignment, or JHA.
  update public.jobs
  set crew_acknowledgment_required_at = coalesce(crew_acknowledgment_required_at, now())
  where id = j.id;
  return result;
end $$;

revoke all on function public.record_manual_field_briefing(uuid,text,text,boolean) from public, anon;
grant execute on function public.record_manual_field_briefing(uuid,text,text,boolean) to authenticated;
