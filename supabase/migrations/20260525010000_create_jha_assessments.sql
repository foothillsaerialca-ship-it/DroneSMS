create table if not exists public.jha_assessments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operator_company text,
  jha_number text,
  remote_pilot_in_command text,
  date_prepared date,
  client_property_owner text,
  job_date date,
  site_address text,
  drone_platform text,
  job_type_scope text,
  crew_members text,
  weather_conditions text,
  faa_airspace_class text,
  surface_type text,
  building_height numeric,
  site_access text,
  wind_speed numeric,
  weather text,
  visibility text,
  public_presence boolean not null default false,
  exclusion_zone_planned boolean not null default false,
  exclusion_zone_description text,
  runoff_risk boolean not null default false,
  chemical_type text,
  containment_plan text,
  regulatory_citations text[] not null default '{}',
  water_body_proximity boolean not null default false,
  water_body_distance numeric,
  water_body_type text,
  secondary_containment_in_place boolean not null default false,
  reclamation_method text,
  reclamation_volume_estimate numeric,
  disposal_vendor_name_contact text,
  laanc_required text,
  hazard_entries jsonb not null default '[]'::jsonb,
  overall_risk_rating text not null default 'Low',
  ppe_requirements jsonb not null default '{}'::jsonb,
  nearest_hospital text,
  emergency_contact text,
  drone_incident_procedure text,
  crew_briefed boolean not null default false,
  controls_in_place boolean not null default false,
  stop_work_authority_acknowledged boolean not null default false,
  assessor_name text,
  assessment_date date,
  rpic_printed_name text,
  certified_at timestamptz,
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jha_assessments_job_id_key unique (job_id)
);

create index if not exists jha_assessments_job_id_idx on public.jha_assessments(job_id);
create index if not exists jha_assessments_organization_id_idx on public.jha_assessments(organization_id);
create index if not exists jha_assessments_user_id_idx on public.jha_assessments(user_id);

alter table public.jha_assessments enable row level security;

drop policy if exists "Users can view organization JHA assessments" on public.jha_assessments;
create policy "Users can view organization JHA assessments"
  on public.jha_assessments
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jha_assessments.organization_id
    )
  );

drop policy if exists "Users can create organization JHA assessments" on public.jha_assessments;
create policy "Users can create organization JHA assessments"
  on public.jha_assessments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jha_assessments.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = jha_assessments.job_id
        and jobs.organization_id = jha_assessments.organization_id
    )
  );

drop policy if exists "Users can update organization JHA assessments" on public.jha_assessments;
create policy "Users can update organization JHA assessments"
  on public.jha_assessments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jha_assessments.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = jha_assessments.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = jha_assessments.job_id
        and jobs.organization_id = jha_assessments.organization_id
    )
  );

grant select, insert, update on public.jha_assessments to authenticated;
