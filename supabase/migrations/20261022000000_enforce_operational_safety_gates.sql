-- Enforce the operational safety gates in the database so the app cannot be bypassed.
-- A beta evaluation completed a job with an unregistered drone overdue for maintenance, an RPIC with
-- no Part 107 on record, expired crew training, no Ready to Operate approval, and a JHA marked
-- Complete without a Safety Manager Review. This migration closes each of those paths:
--   1. A JHA can only become Complete with the crew briefing and controls confirmed and a current
--      Safety Manager Review and RPIC Acceptance. A Complete JHA that stops meeting that drops to Draft.
--   2. Ready to Operate also requires a current Part 107 for the assigned RPIC, assigned equipment that
--      is not in Maintenance, Inactive, or Retired status, and an FAA registration for every drone.
--   3. Overdue maintenance and expired training block Ready to Operate unless the designated Safety
--      Manager records a written override for that item on that job.
--   4. Closeout requires a current Ready to Operate approval unless the result is Aborted or Delayed.
-- Existing rows are not rewritten; the rules apply to the next write.

-- 1. JHA completion -------------------------------------------------------------------------------

create or replace function public.z_enforce_jha_completion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.status is distinct from 'Complete' then return new; end if;
  if coalesce(new.crew_briefed, false) and coalesce(new.controls_in_place, false)
     and new.safety_manager_reviewed_at is not null and not coalesce(new.safety_manager_review_stale, false)
     and new.rpic_accepted_at is not null and not coalesce(new.rpic_acceptance_stale, false) then
    return new;
  end if;
  -- A JHA that was already Complete and no longer qualifies is no longer complete.
  if tg_op = 'UPDATE' and old.status = 'Complete' then
    new.status := 'Draft';
    new.certified_at := null;
    return new;
  end if;
  raise exception 'The JHA can only be marked Complete after the crew briefing and controls in place are confirmed and both the Safety Manager Review and RPIC Acceptance are current.';
end $$;

comment on function public.z_enforce_jha_completion() is
  'Trigger-only. Runs after the other BEFORE triggers on jha_assessments (name order) so staleness is already applied.';

drop trigger if exists z_enforce_jha_completion on public.jha_assessments;
create trigger z_enforce_jha_completion
  before insert or update on public.jha_assessments
  for each row execute function public.z_enforce_jha_completion();

revoke all on function public.z_enforce_jha_completion() from public, anon, authenticated;

-- 2 and 3. Readiness overrides ---------------------------------------------------------------------

create table if not exists public.job_readiness_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_type text not null check (item_type in ('maintenance_overdue', 'training_expired')),
  item_id uuid not null,
  item_name text not null,
  item_date date not null,
  reason text not null check (length(btrim(reason)) >= 10),
  approved_by_personnel_id uuid references public.personnel(id) on delete restrict,
  approved_by_user_id uuid,
  approved_by_name text not null,
  approved_at timestamptz not null default now(),
  unique (job_id, item_type, item_id)
);

comment on table public.job_readiness_overrides is
  'Safety Manager acceptance of an overdue-maintenance or expired-training item for one job. An override only applies while item_date still matches the record''s current due or expiration date.';

alter table public.job_readiness_overrides enable row level security;

drop policy if exists "Users can view organization readiness overrides" on public.job_readiness_overrides;
create policy "Users can view organization readiness overrides" on public.job_readiness_overrides
  for select to authenticated using (organization_id = public.current_user_organization_id());

revoke all on public.job_readiness_overrides from anon, authenticated;
grant select on public.job_readiness_overrides to authenticated;

create index if not exists job_readiness_overrides_job_idx on public.job_readiness_overrides(job_id);

create or replace function public.record_job_readiness_override(p_job_id uuid, p_item_type text, p_item_id uuid, p_reason text)
returns public.job_readiness_overrides
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  target_job public.jobs; reviewer public.personnel; result public.job_readiness_overrides;
  v_name text; v_date date;
begin
  select * into target_job from public.jobs where id = p_job_id and organization_id = public.current_user_organization_id();
  if not found then raise exception 'Job not found in your organization.'; end if;
  select p.* into reviewer from public.organization_safety_designations d
    join public.personnel p on p.id = d.personnel_id and p.organization_id = d.organization_id
    where d.organization_id = target_job.organization_id and p.status = 'Active';
  if reviewer.id is null then raise exception 'Safety Manager not designated. Configure a Safety Manager in SMS.'; end if;
  if reviewer.user_id is distinct from auth.uid() then raise exception 'Only the designated Safety Manager can record an override.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'Explain why the operation can proceed (at least 10 characters).'; end if;

  if p_item_type = 'maintenance_overdue' then
    select e.name, e.maintenance_due_date into v_name, v_date from public.job_equipment je
      join public.equipment e on e.id = je.equipment_id
      where je.job_id = p_job_id and e.id = p_item_id and e.maintenance_due_date < current_date;
  elsif p_item_type = 'training_expired' then
    select p.full_name, p.training_expiration_date into v_name, v_date from public.job_personnel jp
      join public.personnel p on p.id = jp.personnel_id
      where jp.job_id = p_job_id and p.id = p_item_id and p.training_expiration_date < current_date
      limit 1;
  else
    raise exception 'Unknown override type.';
  end if;
  if v_name is null then raise exception 'That item does not need an override on this job.'; end if;

  insert into public.job_readiness_overrides(organization_id, job_id, item_type, item_id, item_name, item_date, reason, approved_by_personnel_id, approved_by_user_id, approved_by_name, approved_at)
  values (target_job.organization_id, p_job_id, p_item_type, p_item_id, v_name, v_date, btrim(p_reason), reviewer.id, auth.uid(), reviewer.full_name, now())
  on conflict (job_id, item_type, item_id) do update set item_name = excluded.item_name, item_date = excluded.item_date,
    reason = excluded.reason, approved_by_personnel_id = excluded.approved_by_personnel_id,
    approved_by_user_id = excluded.approved_by_user_id, approved_by_name = excluded.approved_by_name, approved_at = now()
  returning * into result;
  return result;
end $$;

revoke all on function public.record_job_readiness_override(uuid, text, uuid, text) from public, anon;
grant execute on function public.record_job_readiness_override(uuid, text, uuid, text) to authenticated;

-- Ready to Operate, with the resource checks added before approval is written.
create or replace function public.confirm_job_ready_to_operate(target_job_id uuid, fitness_confirmed boolean)
returns public.job_operation_readiness
language plpgsql security definer set search_path = pg_catalog, public as $$
declare target_job public.jobs; jha public.jha_assessments; preflight public.preflight_checklists; assigned_rpic public.personnel; result public.job_operation_readiness; blocked text;
begin
  select * into target_job from public.jobs where id=target_job_id and organization_id=public.current_user_organization_id(); if not found then raise exception 'Job not found in your organization.'; end if;
  select p.* into assigned_rpic from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id and p.organization_id=jp.organization_id where jp.job_id=target_job_id and jp.assigned_role='RPIC' and p.status='Active' order by jp.created_at limit 1;
  if assigned_rpic.id is null then raise exception 'Assign an active RPIC before recording readiness.'; end if; if assigned_rpic.user_id<>auth.uid() then raise exception 'Only the assigned RPIC can record Ready to Operate.'; end if;
  if not fitness_confirmed then insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason) values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),false,null,false,null,null) on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,fitness_for_duty_confirmed=false,approved_at=null,approval_stale=false,stale_at=null,stale_reason=null,updated_at=now() returning * into result; return result; end if;
  select * into jha from public.jha_assessments where job_id=target_job_id; if jha.id is null or jha.status<>'Complete' then raise exception 'Complete the JHA before Ready to Operate.'; end if;
  if jha.safety_manager_reviewed_at is null or jha.safety_manager_review_stale then raise exception 'Current Safety Manager Review is required.'; end if; if jha.rpic_accepted_at is null or jha.rpic_acceptance_stale or jha.rpic_personnel_id<>assigned_rpic.id then raise exception 'Current acceptance by the assigned RPIC is required.'; end if; if not jha.controls_in_place then raise exception 'Confirm required controls are in place.'; end if;
  select * into preflight from public.preflight_checklists where job_id=target_job_id; if preflight.id is null or preflight.status<>'Complete' or not public.preflight_states_allow_completion(preflight.checklist_states) then raise exception 'Complete the pre-flight checklist.'; end if;
  if target_job.crew_acknowledgment_required_at is not null and exists(select 1 from public.job_personnel a join public.personnel p on p.id=a.personnel_id where a.job_id=target_job_id and a.assigned_role in ('Pilot','Visual Observer','Payload Operator','Ground Crew') and p.status<>'Inactive' and not exists(select 1 from public.crew_briefing_acknowledgments c where c.assignment_id=a.id and c.assigned_role=a.assigned_role and c.briefing_version=jha.briefing_version and c.status in ('Acknowledged','Manual Field Briefing'))) then raise exception 'Every assigned non-RPIC operational crew member needs a current Crew Briefing acknowledgment or Manual Field Briefing.'; end if;

  -- RPIC currency is a regulatory requirement and cannot be overridden.
  if nullif(btrim(coalesce(assigned_rpic.part_107_certificate_number,'')),'') is null or assigned_rpic.part_107_expiration_date is null or assigned_rpic.part_107_expiration_date < current_date then
    raise exception 'The assigned RPIC needs a current Part 107 certificate number and expiration date in Personnel.';
  end if;
  -- Equipment that is not available, or a drone without FAA registration, cannot be overridden.
  select e.name || ' is marked ' || e.status into blocked from public.job_equipment je join public.equipment e on e.id=je.equipment_id
    where je.job_id=target_job_id and e.status in ('Maintenance','Inactive','Retired') order by e.name limit 1;
  if blocked is not null then raise exception '%. Remove it from the job or update its status.', blocked; end if;
  select e.name into blocked from public.job_equipment je join public.equipment e on e.id=je.equipment_id
    where je.job_id=target_job_id and e.equipment_type='Drone' and nullif(btrim(coalesce(e.faa_registration_number,'')),'') is null order by e.name limit 1;
  if blocked is not null then raise exception '% needs an FAA registration number in Equipment.', blocked; end if;
  -- Overdue maintenance and expired training need a current Safety Manager override.
  select e.name into blocked from public.job_equipment je join public.equipment e on e.id=je.equipment_id
    where je.job_id=target_job_id and e.maintenance_due_date < current_date
      and not exists(select 1 from public.job_readiness_overrides o where o.job_id=target_job_id and o.item_type='maintenance_overdue' and o.item_id=e.id and o.item_date=e.maintenance_due_date)
    order by e.name limit 1;
  if blocked is not null then raise exception '% is overdue for maintenance and needs a Safety Manager override.', blocked; end if;
  select p.full_name into blocked from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id
    where jp.job_id=target_job_id and p.training_expiration_date < current_date
      and not exists(select 1 from public.job_readiness_overrides o where o.job_id=target_job_id and o.item_type='training_expired' and o.item_id=p.id and o.item_date=p.training_expiration_date)
    order by p.full_name limit 1;
  if blocked is not null then raise exception '% has expired training and needs a Safety Manager override.', blocked; end if;

  insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason) values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),true,now(),false,null,null) on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,fitness_for_duty_confirmed=true,approved_at=now(),approval_stale=false,stale_at=null,stale_reason=null,updated_at=now() returning * into result; return result;
end $$;

revoke all on function public.confirm_job_ready_to_operate(uuid, boolean) from public, anon;
grant execute on function public.confirm_job_ready_to_operate(uuid, boolean) to authenticated;

-- 4. Closeout requires Ready to Operate unless the job never operated -------------------------------

create or replace function public.save_operation_closeout_with_assurance(target_job_id uuid, operation_result_value text, deviation_narrative_value text, control_effectiveness_value text, effectiveness_narrative_value text, operational_action_value text, unexpected_issue_value boolean, unexpected_issue_narrative_value text, follow_up_required_value boolean, follow_up_areas_value text[], related_jha_hazard_ids_value text[], related_control_ids_value text[], related_safety_event_ids_value uuid[])
returns public.job_operation_closeouts
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  target_job public.jobs; saved_closeout public.job_operation_closeouts; previous_review_id uuid;
  jha_hazards jsonb := '[]'::jsonb; related_id text; should_open boolean;
begin
  select * into target_job from public.jobs where id=target_job_id;
  if target_job.id is null or not exists (select 1 from public.profiles p where p.id=auth.uid() and p.organization_id=target_job.organization_id) then raise exception 'Job is not available to this organization'; end if;
  if operation_result_value not in ('Aborted','Delayed') and not exists (
    select 1 from public.job_operation_readiness r
    where r.job_id=target_job.id and r.approved_at is not null and not r.approval_stale and r.fitness_for_duty_confirmed
  ) then
    raise exception 'Approve Ready to Operate before closing out a job that operated. A job that was aborted or delayed can be closed out without it.';
  end if;
  select coalesce(hazard_entries,'[]'::jsonb) into jha_hazards from public.jha_assessments where job_id=target_job.id;
  foreach related_id in array coalesce(related_jha_hazard_ids_value, array[]::text[]) loop
    if not exists (select 1 from jsonb_array_elements(jha_hazards) item where item->>'id'=related_id) then raise exception 'Related JHA hazard is not part of this job'; end if;
  end loop;
  foreach related_id in array coalesce(related_control_ids_value, array[]::text[]) loop
    if right(related_id,8) <> ':control' or not exists (select 1 from jsonb_array_elements(jha_hazards) item where item->>'id'=left(related_id,-8) and nullif(btrim(item->>'mitigation'),'') is not null) then raise exception 'Related control is not part of this job'; end if;
  end loop;
  if exists (select 1 from unnest(coalesce(related_safety_event_ids_value, array[]::uuid[])) as related(event_id) left join public.job_safety_events safety_event on safety_event.id=related.event_id where safety_event.id is null or safety_event.job_id<>target_job.id or safety_event.organization_id<>target_job.organization_id) then raise exception 'Related safety event is not part of this job'; end if;

  insert into public.job_operation_closeouts(job_id,organization_id,user_id,operation_result,deviation_narrative,updated_at)
  values(target_job.id,target_job.organization_id,auth.uid(),operation_result_value,nullif(btrim(deviation_narrative_value),''),now())
  on conflict(job_id) do update set user_id=auth.uid(),operation_result=excluded.operation_result,deviation_narrative=excluded.deviation_narrative,updated_at=now()
  returning * into saved_closeout;
  select id into previous_review_id from public.safety_assurance_reviews where closeout_id=saved_closeout.id order by created_at desc limit 1;
  update public.safety_assurance_reviews set review_status='Superseded' where closeout_id=saved_closeout.id and review_status='Open';
  should_open := control_effectiveness_value='No' or (control_effectiveness_value='Partially' and follow_up_required_value) or unexpected_issue_value;
  insert into public.safety_assurance_reviews(organization_id,job_id,closeout_id,control_effectiveness,effectiveness_narrative,operational_action,unexpected_issue,unexpected_issue_narrative,follow_up_required,follow_up_areas,related_jha_hazard_ids,related_control_ids,related_safety_event_ids,review_status,created_by,supersedes_review_id,service_type_snapshot,job_name_snapshot)
  values(target_job.organization_id,target_job.id,saved_closeout.id,control_effectiveness_value,nullif(btrim(effectiveness_narrative_value),''),nullif(btrim(operational_action_value),''),unexpected_issue_value,nullif(btrim(unexpected_issue_narrative_value),''),follow_up_required_value,coalesce(follow_up_areas_value,array[]::text[]),coalesce(related_jha_hazard_ids_value,array[]::text[]),coalesce(related_control_ids_value,array[]::text[]),coalesce(related_safety_event_ids_value,array[]::uuid[]),case when should_open then 'Open' else 'Not Required' end,auth.uid(),previous_review_id,target_job.service_type,target_job.name);
  return saved_closeout;
end $$;

revoke all on function public.save_operation_closeout_with_assurance(uuid,text,text,text,text,text,boolean,text,boolean,text[],text[],text[],uuid[]) from public, anon;
grant execute on function public.save_operation_closeout_with_assurance(uuid,text,text,text,text,text,boolean,text,boolean,text[],text[],text[],uuid[]) to authenticated;
