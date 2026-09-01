-- Final, attributed operational decision. This stores no medical details.
create table public.job_operation_readiness (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rpic_personnel_id uuid references public.personnel(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  fitness_for_duty_confirmed boolean not null default false,
  approved_at timestamptz,
  approval_stale boolean not null default false,
  stale_at timestamptz,
  stale_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approved_at is null or (fitness_for_duty_confirmed and rpic_personnel_id is not null and approved_by_user_id is not null))
);

comment on table public.job_operation_readiness is 'Final assigned-RPIC Ready to Operate decision; legacy jobs may have no row.';
comment on column public.job_operation_readiness.fitness_for_duty_confirmed is 'Confirmation only; no diagnosis, medication name, history, or other health detail is collected.';

alter table public.job_operation_readiness enable row level security;
create policy "Organization members can view operation readiness" on public.job_operation_readiness for select to authenticated
using (organization_id = public.current_user_organization_id());
grant select on public.job_operation_readiness to authenticated;

create or replace function public.mark_job_operation_readiness_stale(target_job_id uuid, reason text)
returns void language sql security definer set search_path = public as $$
  update public.job_operation_readiness
  set approval_stale = true, stale_at = now(), stale_reason = reason, updated_at = now()
  where job_id = target_job_id and approved_at is not null and approval_stale = false;
$$;

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

create or replace function public.invalidate_readiness_from_jha() returns trigger language plpgsql set search_path=public as $$
begin
  if new.status <> 'Complete' or new.safety_manager_review_stale or new.rpic_acceptance_stale or not new.controls_in_place
     or new.updated_at is distinct from old.updated_at then
    perform public.mark_job_operation_readiness_stale(new.job_id, 'JHA or its required attestations changed');
  end if;
  return new;
end $$;
create trigger invalidate_readiness_from_jha after update on public.jha_assessments for each row execute function public.invalidate_readiness_from_jha();

create or replace function public.invalidate_readiness_from_preflight() returns trigger language plpgsql set search_path=public as $$
begin perform public.mark_job_operation_readiness_stale(new.job_id, 'Pre-flight checklist changed or returned to Draft'); return new; end $$;
create trigger invalidate_readiness_from_preflight after update on public.preflight_checklists for each row
when (old.status is distinct from new.status or old.checklist_states is distinct from new.checklist_states)
execute function public.invalidate_readiness_from_preflight();

create or replace function public.invalidate_readiness_from_assignment() returns trigger language plpgsql set search_path=public as $$
begin
  if (tg_op='DELETE' and old.assigned_role='RPIC') then perform public.mark_job_operation_readiness_stale(old.job_id,'Assigned RPIC changed'); return old;
  elsif (tg_op<>'DELETE' and (new.assigned_role='RPIC' or (tg_op='UPDATE' and old.assigned_role='RPIC'))) then perform public.mark_job_operation_readiness_stale(new.job_id,'Assigned RPIC changed'); end if;
  return new;
end $$;
create trigger invalidate_readiness_from_assignment after insert or update or delete on public.job_personnel for each row execute function public.invalidate_readiness_from_assignment();

create or replace function public.invalidate_readiness_from_equipment() returns trigger language plpgsql set search_path=public as $$
begin perform public.mark_job_operation_readiness_stale(case when tg_op='DELETE' then old.job_id else new.job_id end,'Aircraft or capability assignment changed'); return case when tg_op='DELETE' then old else new end; end $$;
create trigger invalidate_readiness_from_equipment after insert or update or delete on public.job_equipment for each row execute function public.invalidate_readiness_from_equipment();
