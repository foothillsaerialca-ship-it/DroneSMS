-- Lightweight, operator-declared public right-of-way permit planning on the existing JHA.
alter table public.jha_assessments
  add column if not exists public_right_of_way_restriction_required boolean,
  add column if not exists permit_authorization_required boolean,
  add column if not exists permit_issuing_authority text,
  add column if not exists permit_authorization_number text,
  add column if not exists permit_authorization_status text,
  add column if not exists permit_approval_date date,
  add column if not exists permit_expiration_date date;

alter table public.jha_assessments
  add constraint jha_permit_authorization_status_check
  check (permit_authorization_status is null or permit_authorization_status in ('Pending', 'Approved'));

comment on column public.jha_assessments.public_right_of_way_restriction_required is 'Operator answer: maintaining the exclusion zone requires closing or restricting a public right-of-way.';
comment on column public.jha_assessments.permit_authorization_required is 'Operator determination only; DroneSMS does not determine legal permit requirements.';
comment on column public.jha_assessments.permit_authorization_status is 'Planning status used to block Ready to Operate only when the operator declared a permit required.';

create or replace function public.confirm_job_ready_to_operate(target_job_id uuid, fitness_confirmed boolean)
returns public.job_operation_readiness language plpgsql security definer set search_path = public as $$
declare target_job public.jobs; jha public.jha_assessments; preflight public.preflight_checklists; assigned_rpic public.personnel; result public.job_operation_readiness;
begin
  select * into target_job from public.jobs where id = target_job_id and organization_id = public.current_user_organization_id();
  if not found then raise exception 'Job not found in your organization.'; end if;
  select p.* into assigned_rpic from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id and p.organization_id=jp.organization_id
    where jp.job_id=target_job_id and jp.assigned_role='RPIC' and p.status='Active' order by jp.created_at limit 1;
  if assigned_rpic.id is null then raise exception 'Assign an active RPIC before recording readiness.'; end if;
  if assigned_rpic.user_id <> auth.uid() then raise exception 'Only the assigned RPIC can record Ready to Operate.'; end if;

  if not fitness_confirmed then
    insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason)
    values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),false,null,false,null,null)
    on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id, approved_by_user_id=excluded.approved_by_user_id,
      fitness_for_duty_confirmed=false, approved_at=null, approval_stale=false, stale_at=null, stale_reason=null, updated_at=now()
    returning * into result;
    return result;
  end if;

  select * into jha from public.jha_assessments where job_id=target_job_id;
  if jha.id is null or jha.status <> 'Complete' then raise exception 'Complete the JHA before Ready to Operate.'; end if;
  if jha.safety_manager_reviewed_at is null or jha.safety_manager_review_stale then raise exception 'Current Safety Manager Review is required.'; end if;
  if jha.rpic_accepted_at is null or jha.rpic_acceptance_stale or jha.rpic_personnel_id <> assigned_rpic.id then raise exception 'Current acceptance by the assigned RPIC is required.'; end if;
  if not jha.controls_in_place then raise exception 'Confirm required controls are in place.'; end if;
  if jha.permit_authorization_required is true and jha.permit_authorization_status is distinct from 'Approved' then raise exception 'Required public right-of-way permit or authorization must be Approved.'; end if;
  select * into preflight from public.preflight_checklists where job_id=target_job_id;
  if preflight.id is null or preflight.status <> 'Complete' or not public.preflight_states_allow_completion(preflight.checklist_states) then raise exception 'Complete the pre-flight checklist.'; end if;

  insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason)
  values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),true,now(),false,null,null)
  on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id, approved_by_user_id=excluded.approved_by_user_id,
    fitness_for_duty_confirmed=true, approved_at=now(), approval_stale=false, stale_at=null, stale_reason=null, updated_at=now()
  returning * into result;
  return result;
end; $$;


revoke all on function public.confirm_job_ready_to_operate(uuid,boolean) from public;
grant execute on function public.confirm_job_ready_to_operate(uuid,boolean) to authenticated;
