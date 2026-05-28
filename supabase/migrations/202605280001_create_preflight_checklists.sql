create table if not exists public.preflight_checklists (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  aircraft_selected boolean not null default false,
  battery_condition_checked boolean not null default false,
  propellers_inspected boolean not null default false,
  firmware_app_status_checked boolean not null default false,
  gps_signal_confirmed boolean not null default false,
  home_point_verified boolean not null default false,
  storage_media_checked boolean not null default false,
  weather_verified boolean not null default false,
  wind_conditions_acceptable boolean not null default false,
  airspace_reviewed boolean not null default false,
  laanc_confirmed_if_required boolean not null default false,
  notam_tfr_checked boolean not null default false,
  visual_observer_assigned_if_needed boolean not null default false,
  emergency_procedures_reviewed boolean not null default false,
  crew_communications_confirmed boolean not null default false,
  final_rpic_approval boolean not null default false,
  notes text,
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preflight_checklists_job_id_key unique (job_id)
);

create index if not exists preflight_checklists_job_id_idx on public.preflight_checklists(job_id);
create index if not exists preflight_checklists_organization_id_idx on public.preflight_checklists(organization_id);
create index if not exists preflight_checklists_user_id_idx on public.preflight_checklists(user_id);

alter table public.preflight_checklists enable row level security;

drop policy if exists "Users can view organization preflight checklists" on public.preflight_checklists;
create policy "Users can view organization preflight checklists"
  on public.preflight_checklists
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
  );

drop policy if exists "Users can create organization preflight checklists" on public.preflight_checklists;
create policy "Users can create organization preflight checklists"
  on public.preflight_checklists
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = preflight_checklists.job_id
        and jobs.organization_id = preflight_checklists.organization_id
    )
  );

drop policy if exists "Users can update organization preflight checklists" on public.preflight_checklists;
create policy "Users can update organization preflight checklists"
  on public.preflight_checklists
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = preflight_checklists.job_id
        and jobs.organization_id = preflight_checklists.organization_id
    )
  );

grant select, insert, update on public.preflight_checklists to authenticated;
