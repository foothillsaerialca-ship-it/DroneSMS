create table if not exists public.preflight_checklists (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  aircraft_selected boolean not null default false,
  battery_condition boolean not null default false,
  propeller_inspection boolean not null default false,
  firmware_app_status boolean not null default false,
  gps_signal_confirmed boolean not null default false,
  home_point_verified boolean not null default false,
  storage_check boolean not null default false,
  weather_verified boolean not null default false,
  wind_conditions_acceptable boolean not null default false,
  airspace_reviewed boolean not null default false,
  laanc_confirmed_if_required boolean not null default false,
  notam_tfr_check_completed boolean not null default false,
  visual_observer_assigned boolean not null default false,
  emergency_procedures_reviewed boolean not null default false,
  crew_communications_confirmed boolean not null default false,
  rpic_final_approval boolean not null default false,
  notes text not null default '',
  is_complete boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preflight_checklists_one_per_job unique (job_id),
  constraint preflight_checklists_completion_requirements check (
    is_complete = false
    or (rpic_final_approval and airspace_reviewed and weather_verified)
  )
);

create index if not exists preflight_checklists_job_id_idx on public.preflight_checklists(job_id);
create index if not exists preflight_checklists_organization_id_idx on public.preflight_checklists(organization_id);
create index if not exists preflight_checklists_user_id_idx on public.preflight_checklists(user_id);

alter table public.preflight_checklists enable row level security;

create policy "Users can view organization preflight checklists"
  on public.preflight_checklists
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
  );

create policy "Users can insert organization preflight checklists"
  on public.preflight_checklists
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
  );

create policy "Users can update organization preflight checklists"
  on public.preflight_checklists
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = preflight_checklists.organization_id
    )
  );
