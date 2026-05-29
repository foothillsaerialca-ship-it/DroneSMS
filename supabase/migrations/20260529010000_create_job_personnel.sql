alter table public.personnel
  add column if not exists training_expiration_date date;

create table if not exists public.job_personnel (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_role text not null,
  created_at timestamptz not null default now(),
  constraint job_personnel_job_personnel_role_key unique (job_id, personnel_id, assigned_role),
  constraint job_personnel_assigned_role_check check (
    assigned_role in ('RPIC', 'Pilot', 'Visual Observer', 'Payload Operator', 'Ground Crew')
  )
);

create index if not exists job_personnel_job_id_idx on public.job_personnel(job_id);
create index if not exists job_personnel_personnel_id_idx on public.job_personnel(personnel_id);
create index if not exists job_personnel_organization_id_idx on public.job_personnel(organization_id);

alter table public.job_personnel enable row level security;

drop policy if exists "Users can view organization job personnel" on public.job_personnel;
create policy "Users can view organization job personnel"
  on public.job_personnel
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_personnel.organization_id
    )
  );

drop policy if exists "Users can create organization job personnel" on public.job_personnel;
create policy "Users can create organization job personnel"
  on public.job_personnel
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_personnel.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_personnel.job_id
        and jobs.organization_id = job_personnel.organization_id
    )
    and exists (
      select 1
      from public.personnel
      where personnel.id = job_personnel.personnel_id
        and personnel.organization_id = job_personnel.organization_id
    )
  );

drop policy if exists "Users can update organization job personnel" on public.job_personnel;
create policy "Users can update organization job personnel"
  on public.job_personnel
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_personnel.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_personnel.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_personnel.job_id
        and jobs.organization_id = job_personnel.organization_id
    )
    and exists (
      select 1
      from public.personnel
      where personnel.id = job_personnel.personnel_id
        and personnel.organization_id = job_personnel.organization_id
    )
  );

drop policy if exists "Users can delete organization job personnel" on public.job_personnel;
create policy "Users can delete organization job personnel"
  on public.job_personnel
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_personnel.organization_id
    )
  );

grant select, insert, update, delete on public.job_personnel to authenticated;
