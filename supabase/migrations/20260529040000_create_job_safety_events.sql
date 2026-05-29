create table if not exists public.job_safety_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('Operational', 'Environmental', 'Equipment', 'Personnel', 'Public')),
  description text not null,
  immediate_actions_taken text,
  outcome text not null check (outcome in ('Resolved', 'Operation Paused', 'Operation Terminated')),
  promote_to_hazard_library boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists job_safety_events_organization_id_idx on public.job_safety_events(organization_id);
create index if not exists job_safety_events_job_id_idx on public.job_safety_events(job_id);
create index if not exists job_safety_events_created_by_idx on public.job_safety_events(created_by);
create index if not exists job_safety_events_category_idx on public.job_safety_events(category);
create index if not exists job_safety_events_outcome_idx on public.job_safety_events(outcome);
create index if not exists job_safety_events_created_at_idx on public.job_safety_events(created_at);

alter table public.job_safety_events enable row level security;

drop policy if exists "Users can view organization job safety events" on public.job_safety_events;
create policy "Users can view organization job safety events"
  on public.job_safety_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_safety_events.organization_id
    )
  );

drop policy if exists "Users can create organization job safety events" on public.job_safety_events;
create policy "Users can create organization job safety events"
  on public.job_safety_events
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_safety_events.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_safety_events.job_id
        and jobs.organization_id = job_safety_events.organization_id
    )
  );

drop policy if exists "Users can update organization job safety events" on public.job_safety_events;
create policy "Users can update organization job safety events"
  on public.job_safety_events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_safety_events.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_safety_events.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_safety_events.job_id
        and jobs.organization_id = job_safety_events.organization_id
    )
  );

drop policy if exists "Users can delete organization job safety events" on public.job_safety_events;
create policy "Users can delete organization job safety events"
  on public.job_safety_events
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_safety_events.organization_id
    )
  );

grant select, insert, update, delete on public.job_safety_events to authenticated;
