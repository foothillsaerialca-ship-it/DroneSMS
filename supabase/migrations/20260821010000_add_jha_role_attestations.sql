-- Persist the two independent Phase 3A acknowledgements on the existing JHA.
alter table public.jha_assessments
  add column if not exists safety_manager_personnel_id uuid references public.personnel(id) on delete restrict,
  add column if not exists safety_manager_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists safety_manager_name text,
  add column if not exists safety_manager_reviewed_at timestamptz,
  add column if not exists rpic_personnel_id uuid references public.personnel(id) on delete restrict,
  add column if not exists rpic_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists rpic_name text,
  add column if not exists rpic_accepted_at timestamptz;

comment on column public.jha_assessments.safety_manager_reviewed_at is
  'Intentional Operational JHA review performed by the organization-designated Safety Manager.';
comment on column public.jha_assessments.rpic_accepted_at is
  'Intentional Operational JHA acceptance performed by the job-assigned RPIC.';

-- These functions resolve the authoritative role at the moment of acknowledgement and
-- require its personnel record to be linked to the authenticated user. The two updates
-- deliberately touch separate columns so a dual-role person must perform both actions.
create or replace function public.review_operational_jha_as_safety_manager(p_job_id uuid)
returns public.jha_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer public.personnel;
  result public.jha_assessments;
begin
  select p.* into reviewer
  from public.organization_safety_designations d
  join public.jobs j on j.organization_id = d.organization_id
  join public.personnel p on p.id = d.personnel_id and p.organization_id = d.organization_id
  where j.id = p_job_id and p.status = 'Active';

  if reviewer.id is null then raise exception 'Safety Manager not designated. Configure a Safety Manager in SMS.'; end if;
  if reviewer.user_id <> auth.uid() then raise exception 'Only the designated Safety Manager can complete this review.'; end if;

  update public.jha_assessments set
    safety_manager_personnel_id = reviewer.id,
    safety_manager_user_id = auth.uid(),
    safety_manager_name = reviewer.full_name,
    safety_manager_reviewed_at = now(),
    updated_at = now()
  where job_id = p_job_id and organization_id = reviewer.organization_id
  returning * into result;
  if result.id is null then raise exception 'Save the Operational JHA before reviewing it.'; end if;
  return result;
end;
$$;

create or replace function public.accept_operational_jha_as_rpic(p_job_id uuid)
returns public.jha_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  accepting_rpic public.personnel;
  result public.jha_assessments;
begin
  select p.* into accepting_rpic
  from public.job_personnel jp
  join public.personnel p on p.id = jp.personnel_id and p.organization_id = jp.organization_id
  where jp.job_id = p_job_id and jp.assigned_role = 'RPIC' and p.status = 'Active'
  order by jp.created_at
  limit 1;

  if accepting_rpic.id is null then raise exception 'RPIC not assigned to this job.'; end if;
  if accepting_rpic.user_id <> auth.uid() then raise exception 'Only the assigned RPIC can complete this acceptance.'; end if;

  update public.jha_assessments set
    rpic_personnel_id = accepting_rpic.id,
    rpic_user_id = auth.uid(),
    rpic_name = accepting_rpic.full_name,
    rpic_accepted_at = now(),
    updated_at = now()
  where job_id = p_job_id and organization_id = accepting_rpic.organization_id
  returning * into result;
  if result.id is null then raise exception 'Save the Operational JHA before accepting it.'; end if;
  return result;
end;
$$;

revoke all on function public.review_operational_jha_as_safety_manager(uuid) from public;
revoke all on function public.accept_operational_jha_as_rpic(uuid) from public;
grant execute on function public.review_operational_jha_as_safety_manager(uuid) to authenticated;
grant execute on function public.accept_operational_jha_as_rpic(uuid) to authenticated;

-- Update Phase 1 user-facing language without renaming its established technical objects.
create or replace function public.validate_safety_representative_membership()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.personnel
    where personnel.id = new.personnel_id
      and personnel.organization_id = new.organization_id
      and personnel.status = 'Active'
  ) then
    raise exception 'Safety Manager must be an active member of the organization';
  end if;
  return new;
end;
$$;

comment on table public.organization_safety_designations is
  'Current organization Safety Manager, linked to one existing personnel record for use by safety workflows.';
