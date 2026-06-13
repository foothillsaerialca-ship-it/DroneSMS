create table if not exists public.job_operation_closeouts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_result text not null default 'Completed as Planned',
  deviation_narrative text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_operation_closeouts_job_id_key unique (job_id),
  constraint job_operation_closeouts_operation_result_check check (
    operation_result in ('Completed as Planned', 'Completed with Changes', 'Delayed', 'Aborted', 'Incident Occurred')
  ),
  constraint job_operation_closeouts_deviation_narrative_required_check check (
    operation_result = 'Completed as Planned'
    or nullif(btrim(coalesce(deviation_narrative, '')), '') is not null
  )
);

create index if not exists job_operation_closeouts_job_id_idx on public.job_operation_closeouts(job_id);
create index if not exists job_operation_closeouts_organization_id_idx on public.job_operation_closeouts(organization_id);
create index if not exists job_operation_closeouts_user_id_idx on public.job_operation_closeouts(user_id);

alter table public.job_operation_closeouts enable row level security;

drop policy if exists "Users can view organization operation closeouts" on public.job_operation_closeouts;
create policy "Users can view organization operation closeouts"
  on public.job_operation_closeouts
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_operation_closeouts.organization_id
    )
  );

drop policy if exists "Users can create organization operation closeouts" on public.job_operation_closeouts;
create policy "Users can create organization operation closeouts"
  on public.job_operation_closeouts
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_operation_closeouts.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_operation_closeouts.job_id
        and jobs.organization_id = job_operation_closeouts.organization_id
    )
  );

drop policy if exists "Users can update organization operation closeouts" on public.job_operation_closeouts;
create policy "Users can update organization operation closeouts"
  on public.job_operation_closeouts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_operation_closeouts.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_operation_closeouts.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_operation_closeouts.job_id
        and jobs.organization_id = job_operation_closeouts.organization_id
    )
  );

grant select, insert, update on public.job_operation_closeouts to authenticated;
