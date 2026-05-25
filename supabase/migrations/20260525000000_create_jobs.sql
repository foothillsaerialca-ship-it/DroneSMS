create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  service_type text not null,
  location text not null,
  planned_date date not null,
  notes text,
  status text not null default 'Planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_organization_id_idx on public.jobs(organization_id);
create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_planned_date_idx on public.jobs(planned_date);

alter table public.jobs enable row level security;

drop policy if exists "Users can view organization jobs" on public.jobs;
create policy "Users can view organization jobs"
  on public.jobs
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jobs.organization_id
    )
  );

drop policy if exists "Users can create their organization jobs" on public.jobs;
create policy "Users can create their organization jobs"
  on public.jobs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jobs.organization_id
    )
  );

drop policy if exists "Users can update their organization jobs" on public.jobs;
create policy "Users can update their organization jobs"
  on public.jobs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jobs.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jobs.organization_id
    )
  );

grant select, insert, update on public.jobs to authenticated;
