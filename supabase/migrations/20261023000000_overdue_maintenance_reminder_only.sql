-- Overdue maintenance becomes a reminder instead of a Ready to Operate gate.
-- Beta feedback: a maintenance due date is a planning reminder for the operator, and it should not
-- stop a job or require a Safety Manager override. Equipment whose status is Maintenance, Inactive,
-- or Retired is still blocked, and expired training still needs an override.
--
-- confirm_job_ready_to_operate is recreated from 20261022000000_enforce_operational_safety_gates.sql
-- with only the overdue-maintenance check removed. Existing maintenance overrides are kept as history.

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
  -- Expired training needs a current Safety Manager override. Overdue maintenance is a reminder only.
  select p.full_name into blocked from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id
    where jp.job_id=target_job_id and p.training_expiration_date < current_date
      and not exists(select 1 from public.job_readiness_overrides o where o.job_id=target_job_id and o.item_type='training_expired' and o.item_id=p.id and o.item_date=p.training_expiration_date)
    order by p.full_name limit 1;
  if blocked is not null then raise exception '% has expired training and needs a Safety Manager override.', blocked; end if;

  insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason) values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),true,now(),false,null,null) on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,fitness_for_duty_confirmed=true,approved_at=now(),approval_stale=false,stale_at=null,stale_reason=null,updated_at=now() returning * into result; return result;
end $$;

revoke all on function public.confirm_job_ready_to_operate(uuid, boolean) from public, anon;
grant execute on function public.confirm_job_ready_to_operate(uuid, boolean) to authenticated;
