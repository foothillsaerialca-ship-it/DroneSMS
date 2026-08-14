-- MIGRATION: 20260524000000_create_organizations.sql
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  part_107_number text,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.profiles
  add column if not exists company_name text;

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Users can view their organizations" on public.organizations;
create policy "Users can view their organizations"
  on public.organizations
  for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organizations.id
    )
  );

drop policy if exists "Users can create their organizations" on public.organizations;
create policy "Users can create their organizations"
  on public.organizations
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "Owners can update their organizations" on public.organizations;
create policy "Owners can update their organizations"
  on public.organizations
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Users can view their profile" on public.profiles;
create policy "Users can view their profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update on public.profiles to authenticated;
-- END MIGRATION: 20260524000000_create_organizations.sql

-- MIGRATION: 20260525000000_create_jobs.sql
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
-- END MIGRATION: 20260525000000_create_jobs.sql

-- MIGRATION: 20260525010000_create_jha_assessments.sql
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
  relevant_airport_heliport text,
  known_airspace_restrictions text,
  additional_authorization_required text,
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
-- END MIGRATION: 20260525010000_create_jha_assessments.sql

-- MIGRATION: 202605280001_create_preflight_checklists.sql
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
-- END MIGRATION: 202605280001_create_preflight_checklists.sql

-- MIGRATION: 20260529000000_create_personnel.sql
create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'Crew Member',
  email text,
  phone text,
  part_107_certificate_number text,
  part_107_expiration_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  status text not null default 'Active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personnel_organization_id_idx on public.personnel(organization_id);
create index if not exists personnel_user_id_idx on public.personnel(user_id);
create index if not exists personnel_full_name_idx on public.personnel(full_name);
create index if not exists personnel_status_idx on public.personnel(status);

alter table public.personnel enable row level security;

drop policy if exists "Users can view organization personnel" on public.personnel;
create policy "Users can view organization personnel"
  on public.personnel
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = personnel.organization_id
    )
  );

drop policy if exists "Users can create organization personnel" on public.personnel;
create policy "Users can create organization personnel"
  on public.personnel
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = personnel.organization_id
    )
  );

drop policy if exists "Users can update organization personnel" on public.personnel;
create policy "Users can update organization personnel"
  on public.personnel
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = personnel.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = personnel.organization_id
    )
  );

grant select, insert, update on public.personnel to authenticated;
-- END MIGRATION: 20260529000000_create_personnel.sql

-- MIGRATION: 20260529010000_create_job_personnel.sql
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
-- END MIGRATION: 20260529010000_create_job_personnel.sql

-- MIGRATION: 20260529020000_create_equipment.sql
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  equipment_type text not null default 'Drone',
  make text,
  model text,
  serial_number text,
  faa_registration_number text,
  assigned_location text,
  status text not null default 'Available',
  maintenance_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_organization_id_idx on public.equipment(organization_id);
create index if not exists equipment_user_id_idx on public.equipment(user_id);
create index if not exists equipment_name_idx on public.equipment(name);
create index if not exists equipment_type_idx on public.equipment(equipment_type);
create index if not exists equipment_status_idx on public.equipment(status);
create index if not exists equipment_maintenance_due_date_idx on public.equipment(maintenance_due_date);
create unique index if not exists equipment_organization_serial_number_idx
  on public.equipment(organization_id, serial_number)
  where serial_number is not null;

alter table public.equipment enable row level security;

drop policy if exists "Users can view organization equipment" on public.equipment;
create policy "Users can view organization equipment"
  on public.equipment
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = equipment.organization_id
    )
  );

drop policy if exists "Users can create organization equipment" on public.equipment;
create policy "Users can create organization equipment"
  on public.equipment
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = equipment.organization_id
    )
  );

drop policy if exists "Users can update organization equipment" on public.equipment;
create policy "Users can update organization equipment"
  on public.equipment
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = equipment.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = equipment.organization_id
    )
  );

drop policy if exists "Users can delete organization equipment" on public.equipment;
create policy "Users can delete organization equipment"
  on public.equipment
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = equipment.organization_id
    )
  );

grant select, insert, update, delete on public.equipment to authenticated;
-- END MIGRATION: 20260529020000_create_equipment.sql

-- MIGRATION: 20260529030000_create_job_equipment.sql
create table if not exists public.job_equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint job_equipment_job_equipment_key unique (job_id, equipment_id)
);

create index if not exists job_equipment_organization_id_idx on public.job_equipment(organization_id);
create index if not exists job_equipment_job_id_idx on public.job_equipment(job_id);
create index if not exists job_equipment_equipment_id_idx on public.job_equipment(equipment_id);

alter table public.job_equipment enable row level security;

drop policy if exists "Users can view organization job equipment" on public.job_equipment;
create policy "Users can view organization job equipment"
  on public.job_equipment
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_equipment.organization_id
    )
  );

drop policy if exists "Users can create organization job equipment" on public.job_equipment;
create policy "Users can create organization job equipment"
  on public.job_equipment
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_equipment.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_equipment.job_id
        and jobs.organization_id = job_equipment.organization_id
    )
    and exists (
      select 1
      from public.equipment
      where equipment.id = job_equipment.equipment_id
        and equipment.organization_id = job_equipment.organization_id
    )
  );

drop policy if exists "Users can update organization job equipment" on public.job_equipment;
create policy "Users can update organization job equipment"
  on public.job_equipment
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_equipment.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_equipment.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_equipment.job_id
        and jobs.organization_id = job_equipment.organization_id
    )
    and exists (
      select 1
      from public.equipment
      where equipment.id = job_equipment.equipment_id
        and equipment.organization_id = job_equipment.organization_id
    )
  );

drop policy if exists "Users can delete organization job equipment" on public.job_equipment;
create policy "Users can delete organization job equipment"
  on public.job_equipment
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_equipment.organization_id
    )
  );

grant select, insert, update, delete on public.job_equipment to authenticated;
-- END MIGRATION: 20260529030000_create_job_equipment.sql

-- MIGRATION: 20260529040000_create_job_safety_events.sql
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
-- END MIGRATION: 20260529040000_create_job_safety_events.sql

-- MIGRATION: 20260530000000_extend_organization_settings.sql
alter table public.organizations
  add column if not exists phone_number text,
  add column if not exists email_address text,
  add column if not exists physical_address text,
  add column if not exists primary_contact text,
  add column if not exists company_statement text,
  add column if not exists emergency_contact text,
  add column if not exists safety_manager text,
  add column if not exists stop_work_authority_statement text,
  add column if not exists hazard_reporting_statement text,
  add column if not exists emergency_procedures_summary text,
  add column if not exists logo_path text,
  add column if not exists logo_url text;

drop policy if exists "Owners can update their organizations" on public.organizations;
create policy "Owners can update their organizations"
  on public.organizations
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organizations.id
    )
  )
  with check (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organizations.id
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view organization logos" on storage.objects;
create policy "Users can view organization logos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'organization-logos');

drop policy if exists "Users can upload organization logos" on storage.objects;
create policy "Users can upload organization logos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can update organization logos" on storage.objects;
create policy "Users can update organization logos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can delete organization logos" on storage.objects;
create policy "Users can delete organization logos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );
-- END MIGRATION: 20260530000000_extend_organization_settings.sql

-- MIGRATION: 20260530010000_create_proposals.sql
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  contact_name text,
  phone text,
  email text,
  proposal_name text not null,
  service_type text not null,
  site_address text not null,
  description text,
  proposed_rpic text,
  proposed_crew text,
  proposed_aircraft text,
  airspace_class text,
  relevant_airport_heliport text,
  known_airspace_restrictions text,
  laanc_required boolean not null default false,
  additional_authorization_required boolean not null default false,
  hazard text,
  risk text,
  proposed_mitigation text,
  proposal_amount numeric(12, 2),
  valid_until date,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Under Review', 'Accepted', 'Declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_organization_id_idx on public.proposals(organization_id);
create index if not exists proposals_user_id_idx on public.proposals(user_id);
create index if not exists proposals_created_at_idx on public.proposals(created_at);
create index if not exists proposals_status_idx on public.proposals(status);

alter table public.proposals enable row level security;

drop policy if exists "Users can view organization proposals" on public.proposals;
create policy "Users can view organization proposals"
  on public.proposals
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = proposals.organization_id
    )
  );

drop policy if exists "Users can create their organization proposals" on public.proposals;
create policy "Users can create their organization proposals"
  on public.proposals
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = proposals.organization_id
    )
  );

drop policy if exists "Users can update their organization proposals" on public.proposals;
create policy "Users can update their organization proposals"
  on public.proposals
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = proposals.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = proposals.organization_id
    )
  );

grant select, insert, update on public.proposals to authenticated;
-- END MIGRATION: 20260530010000_create_proposals.sql

-- MIGRATION: 20260603000000_add_user_profile_fields.sql
-- Add personal profile fields to profiles table
alter table public.profiles
  add column if not exists first_name text;

alter table public.profiles
  add column if not exists last_name text;

alter table public.profiles
  add column if not exists faa_part_number text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
  ) then
    update public.profiles
    set
      first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
      last_name = coalesce(last_name, nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''))
    where full_name is not null;
  end if;
end $$;

-- Update RLS policies to allow users to update their own profile
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());
-- END MIGRATION: 20260603000000_add_user_profile_fields.sql

-- MIGRATION: 20260610000000_add_proposal_hazard_assessment.sql
alter table public.proposals
  add column if not exists hazard_assessment jsonb not null default '[]'::jsonb;

comment on column public.proposals.hazard_assessment is 'Selected preliminary hazards, editable mitigations, and proposal-specific notes from the reusable hazard library.';
-- END MIGRATION: 20260610000000_add_proposal_hazard_assessment.sql

-- MIGRATION: 20260610010000_repair_proposals_schema.sql
-- Keep the proposals table aligned with the current Proposal form/save logic.
-- Audit source: Proposal creation insert, proposal status update, Proposal
-- TypeScript list type, and proposal list select/render paths.
-- The audited application fields are all represented below; there are no
-- application-referenced proposal columns intentionally omitted from this
-- migration. This migration is additive and preserves existing RLS policies.

alter table public.proposals
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists client_name text,
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists proposal_name text,
  add column if not exists service_type text,
  add column if not exists site_address text,
  add column if not exists description text,
  add column if not exists proposed_rpic text,
  add column if not exists proposed_crew text,
  add column if not exists proposed_aircraft text,
  add column if not exists airspace_class text,
  add column if not exists laanc_required boolean not null default false,
  add column if not exists additional_authorization_required boolean not null default false,
  add column if not exists hazard text,
  add column if not exists risk text,
  add column if not exists proposed_mitigation text,
  add column if not exists hazard_assessment jsonb not null default '[]'::jsonb,
  add column if not exists proposal_amount numeric(12, 2),
  add column if not exists valid_until date,
  add column if not exists status text not null default 'Draft',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.proposals'::regclass
      and conname = 'proposals_status_check'
  ) then
    alter table public.proposals
      add constraint proposals_status_check
      check (status in ('Draft', 'Sent', 'Under Review', 'Accepted', 'Declined'))
      not valid;
  end if;
end $$;

create index if not exists proposals_organization_id_idx on public.proposals(organization_id);
create index if not exists proposals_user_id_idx on public.proposals(user_id);
create index if not exists proposals_created_at_idx on public.proposals(created_at);
create index if not exists proposals_status_idx on public.proposals(status);

comment on column public.proposals.hazard_assessment is 'Selected preliminary hazards, editable mitigations, and proposal-specific notes stored directly on proposals as JSONB by the Proposal form.';
-- END MIGRATION: 20260610010000_repair_proposals_schema.sql

-- MIGRATION: 20260612000000_integrate_proposal_personnel_workflow.sql
-- Integrate Personnel snapshots into Proposal creation and prepare Proposal -> Job handoff.

alter table public.personnel
  add column if not exists professional_bio text,
  add column if not exists certifications_summary text,
  add column if not exists profile_photo_url text;

comment on column public.personnel.professional_bio is 'Multi-line professional biography used to auto-populate proposal RPIC snapshots.';
comment on column public.personnel.certifications_summary is 'Multi-line certifications and credentials summary used to auto-populate proposal RPIC snapshots.';
comment on column public.personnel.profile_photo_url is 'Future-use profile image URL or upload placeholder for personnel records.';

alter table public.proposals
  add column if not exists proposal_number text,
  add column if not exists proposed_rpic_id uuid references public.personnel(id) on delete set null,
  add column if not exists proposed_rpic_name text,
  add column if not exists proposed_rpic_credentials text,
  add column if not exists proposed_rpic_bio text;

create index if not exists proposals_proposal_number_idx on public.proposals(proposal_number);
create index if not exists proposals_proposed_rpic_id_idx on public.proposals(proposed_rpic_id);

comment on column public.proposals.proposal_number is 'Human-readable proposal number generated by the application for proposal-to-job handoff.';
comment on column public.proposals.proposed_rpic_id is 'Selected personnel record ID for the proposed RPIC at proposal creation time.';
comment on column public.proposals.proposed_rpic_name is 'Snapshot of the selected RPIC name at proposal creation time.';
comment on column public.proposals.proposed_rpic_credentials is 'Snapshot of the selected RPIC certifications summary at proposal creation time.';
comment on column public.proposals.proposed_rpic_bio is 'Snapshot of the selected RPIC professional bio at proposal creation time.';

alter table public.jobs
  add column if not exists source_proposal_id uuid references public.proposals(id) on delete set null,
  add column if not exists source_proposal_number text,
  add column if not exists client_name text,
  add column if not exists contact_name text,
  add column if not exists client_phone text,
  add column if not exists client_email text,
  add column if not exists site_address text,
  add column if not exists preliminary_hazards jsonb not null default '[]'::jsonb,
  add column if not exists proposed_rpic_id uuid references public.personnel(id) on delete set null,
  add column if not exists proposed_rpic_name text,
  add column if not exists proposed_rpic_credentials text,
  add column if not exists proposed_rpic_bio text;

create index if not exists jobs_source_proposal_id_idx on public.jobs(source_proposal_id);
create index if not exists jobs_proposed_rpic_id_idx on public.jobs(proposed_rpic_id);

comment on column public.jobs.source_proposal_id is 'Proposal record that was converted into this job, if applicable.';
comment on column public.jobs.source_proposal_number is 'Proposal number carried forward from the source proposal.';
comment on column public.jobs.client_name is 'Client name carried forward from the source proposal for mission planning context.';
comment on column public.jobs.site_address is 'Site address carried forward from the source proposal for mission planning context.';
comment on column public.jobs.preliminary_hazards is 'Preliminary proposal hazard assessment carried into the job for later JHA refinement.';
comment on column public.jobs.proposed_rpic_id is 'Proposed RPIC personnel ID carried forward from the source proposal; later crew assignments remain editable in JHA.';
-- END MIGRATION: 20260612000000_integrate_proposal_personnel_workflow.sql

-- MIGRATION: 20260612010000_add_soft_delete_to_proposals_and_jobs.sql
-- Add soft-delete markers for workspace visibility without destroying operational history.
-- Future Archive and Locked Record workflows can build on this nullable timestamp
-- without changing the underlying operational records.

alter table public.proposals
  add column if not exists deleted_at timestamptz;

alter table public.jobs
  add column if not exists deleted_at timestamptz;

create index if not exists proposals_deleted_at_idx on public.proposals(deleted_at);
create index if not exists jobs_deleted_at_idx on public.jobs(deleted_at);

-- Authenticated users keep update access through existing organization-scoped RLS policies;
-- no delete policy is added because workspace removal is implemented as a soft delete.
revoke delete on table public.proposals from authenticated;
revoke delete on table public.jobs from authenticated;

comment on column public.proposals.deleted_at is 'Soft-delete timestamp used to hide proposals from the active workspace while preserving records for future archive/locked-record workflows.';
comment on column public.jobs.deleted_at is 'Soft-delete timestamp used to hide jobs from the active workspace while preserving operational records for future archive/locked-record workflows.';
-- END MIGRATION: 20260612010000_add_soft_delete_to_proposals_and_jobs.sql

-- MIGRATION: 20260612020000_create_hazard_library.sql
create table if not exists public.hazard_library (
  id uuid primary key default gen_random_uuid(),
  hazard_name text not null,
  category text not null,
  default_mitigation text not null,
  service_types text[] not null default '{}',
  is_universal boolean not null default false,
  is_system_hazard boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hazard_library_hazard_name_key on public.hazard_library (lower(hazard_name));
create index if not exists hazard_library_service_types_idx on public.hazard_library using gin (service_types);
create index if not exists hazard_library_is_universal_idx on public.hazard_library (is_universal);
create index if not exists hazard_library_category_idx on public.hazard_library (category);

alter table public.hazard_library enable row level security;

drop policy if exists "Authenticated users can view system hazard library" on public.hazard_library;
create policy "Authenticated users can view system hazard library"
  on public.hazard_library
  for select
  to authenticated
  using (is_system_hazard = true);

grant select on public.hazard_library to authenticated;

insert into public.hazard_library (hazard_name, category, default_mitigation, service_types, is_universal, is_system_hazard)
select hazard_name, category, default_mitigation, service_types, is_universal, true
from (
  values
    ('Airspace Restrictions', 'Airspace', 'Review current airspace, TFRs, NOTAMs, and site restrictions before flight. Confirm the mission remains inside approved operating limits before launch.', '{}'::text[], true),
    ('Weather Conditions', 'Environmental', 'Review forecast and on-site weather before operations. Delay or stop work when precipitation, visibility, temperature, or other weather conditions exceed aircraft or crew limits.', '{}'::text[], true),
    ('Wind Conditions', 'Environmental', 'Check forecast and on-site wind at the operating area. Operate within aircraft limits and pause operations if gusts or direction changes reduce control margins.', '{}'::text[], true),
    ('Wildlife Activity', 'Environmental', 'Scan the area for wildlife before launch. Avoid disturbing animals and pause operations if wildlife enters the work area.', '{}'::text[], true),
    ('Pedestrian Traffic', 'Ground / Site', 'Establish a controlled work area with cones, signage, barriers, or a ground monitor where needed. Pause operations if pedestrians enter the operating area.', '{}'::text[], true),
    ('Vehicle Traffic', 'Ground / Site', 'Separate the operation from vehicle paths. Use spotters or traffic controls where appropriate and pause flight when vehicles enter the operating area.', '{}'::text[], true),
    ('Power Lines', 'Infrastructure', 'Identify and brief power line locations before launch. Maintain conservative standoff distance and use visual observer support when operating near utilities.', '{}'::text[], true),
    ('Loss of Link', 'Aircraft / Systems', 'Confirm control link quality, return-to-home settings, lost-link behavior, and emergency landing areas before flight. Brief crew on lost-link response.', '{}'::text[], true),
    ('Battery Failure', 'Aircraft / Systems', 'Inspect batteries before use, verify charge state and health, and set conservative return and landing thresholds. Keep spare batteries managed and protected.', '{}'::text[], true),
    ('Crew Communication Failure', 'Crew Coordination', 'Brief communication roles, hand signals, radio channels, and lost-communication procedures before work begins. Stop operations if crew coordination is lost.', '{}'::text[], true),

    ('Water Runoff', 'Cleaning Operations', 'Identify runoff paths before work. Control or capture wash water where required and prevent uncontrolled discharge from the operating area.', array['Cleaning Operations']::text[], false),
    ('Storm Drain Nearby', 'Cleaning Operations', 'Locate storm drains before work. Use drain protection where required and prevent wash water or chemicals from entering drains.', array['Cleaning Operations']::text[], false),
    ('Overspray', 'Cleaning Operations', 'Identify overspray exposure areas. Protect people, vehicles, sensitive surfaces, and adjacent properties. Adjust spray pattern or pause for wind.', array['Cleaning Operations']::text[], false),
    ('Hose / Tether Snag', 'Cleaning Operations', 'Assign ground crew for hose or tether management. Keep lines clear of pedestrians, vehicles, vegetation, structures, and aircraft flight paths.', array['Cleaning Operations']::text[], false),
    ('Sensitive Landscaping', 'Cleaning Operations', 'Identify sensitive plants, soil areas, and irrigation components. Limit overspray and runoff exposure with barriers or alternate workflow as needed.', array['Cleaning Operations']::text[], false),
    ('Building Occupants', 'Cleaning Operations', 'Coordinate with the client before work. Keep occupants clear of affected doors, windows, balconies, and work zones during cleaning operations.', array['Cleaning Operations']::text[], false),
    ('Public Roadway Exposure', 'Ground / Site', 'Maintain safe standoff from roadways. Prevent equipment, aircraft, debris, or runoff from entering traffic lanes and use a ground monitor near public access points.', array['Cleaning Operations','Roof Inspection','Agricultural','Mapping / Surveying','Real Estate / Property Media']::text[], false),

    ('Roof Access', 'Working at Height', 'Coordinate safe roof access with the client or site representative. Keep drone crew away from unprotected edges unless qualified controls are in place.', array['Thermal Inspection','Roof Inspection']::text[], false),
    ('Early Morning / Low Light Operations', 'Environmental', 'Confirm lighting is sufficient for safe setup, visual line of sight, obstacle awareness, and crew movement. Use supplemental lighting where appropriate.', array['Thermal Inspection']::text[], false),
    ('Heat Loading on Aircraft', 'Aircraft / Systems', 'Monitor aircraft, payload, and battery temperature limits. Plan rest periods and avoid extended operations when thermal loading reduces safe margins.', array['Thermal Inspection']::text[], false),
    ('Visual Line of Sight Limitations', 'Flight Operations', 'Plan flight paths that preserve unaided visual line of sight. Use visual observers, reposition launch points, or reduce mission scope when needed.', array['Thermal Inspection','Mapping / Surveying','Real Estate / Property Media']::text[], false),
    ('Controlled Airspace', 'Airspace', 'Review airspace classification and determine whether LAANC or additional authorization is required. Confirm authorization before flight and brief limits.', array['Thermal Inspection','Agricultural','Mapping / Surveying','Construction Progress']::text[], false),

    ('Ladder Use', 'Working at Height', 'Use ladders only when necessary and in accordance with site safety practices. Maintain three points of contact and keep drone tasks separate from ladder movement.', array['Roof Inspection']::text[], false),
    ('Fall Hazard', 'Working at Height', 'Identify fall exposures before work. Maintain safe distance from roof edges and coordinate with qualified personnel for any work requiring fall protection.', array['Roof Inspection']::text[], false),
    ('Fragile Roofing Materials', 'Working at Height', 'Identify fragile roof materials before access or close inspection. Avoid contact and document areas that require special handling or client controls.', array['Roof Inspection']::text[], false),
    ('Heat Stress', 'Environmental', 'Plan hydration, shade, and rest breaks. Monitor crew for heat stress symptoms and stop work when conditions become unsafe.', array['Roof Inspection']::text[], false),

    ('Chemical Exposure', 'Agricultural', 'Review chemical application history and SDS information when available. Use required PPE and avoid contact with treated areas until safe entry is confirmed.', array['Agricultural']::text[], false),
    ('Livestock Activity', 'Agricultural', 'Coordinate with the landowner regarding livestock location and behavior. Maintain distance and pause operations if animals become stressed or enter the work area.', array['Agricultural']::text[], false),
    ('Wind Drift', 'Agricultural', 'Evaluate wind direction and drift potential before flight. Adjust operating area or delay work when drift could affect people, property, crops, or livestock.', array['Agricultural']::text[], false),
    ('Irrigation Equipment', 'Agricultural', 'Identify pivots, pumps, risers, hoses, and lines before launch. Maintain clearance and coordinate with the landowner before operating near active equipment.', array['Agricultural']::text[], false),
    ('Remote Operating Area', 'Agricultural', 'Confirm communications, access, emergency response location, and battery logistics for remote sites. Brief crew on check-in and emergency procedures.', array['Agricultural']::text[], false),

    ('Extended Flight Operations', 'Flight Operations', 'Plan battery rotations, crew breaks, data capture intervals, and emergency landing options. Monitor fatigue and aircraft status throughout the mission.', array['Mapping / Surveying']::text[], false),
    ('Multiple Takeoff Locations', 'Flight Operations', 'Assess each launch and recovery area before use. Re-brief hazards, airspace, emergency landing areas, and crew positions when relocating.', array['Mapping / Surveying']::text[], false),
    ('Battery Management', 'Aircraft / Systems', 'Track battery assignment, charge state, temperature, and cycle condition. Use conservative reserves for mapping legs and recovery to the launch area.', array['Mapping / Surveying']::text[], false),
    ('Public Access Areas', 'Ground / Site', 'Identify trails, parks, sidewalks, and other public access points. Use signs, cones, observers, or alternate timing to keep people clear of operations.', array['Mapping / Surveying']::text[], false),
    ('Terrain Obstacles', 'Ground / Site', 'Review terrain, trees, slopes, towers, and other obstacles before flight. Set safe altitudes and update flight paths as terrain changes.', array['Mapping / Surveying']::text[], false),

    ('Cranes', 'Construction Progress', 'Coordinate with site supervision regarding crane location and movement. Maintain standoff distance and stop operations during conflicting crane activity.', array['Construction Progress']::text[], false),
    ('Suspended Loads', 'Construction Progress', 'Avoid flight and crew activity near suspended loads. Coordinate timing with site supervision and pause operations when lifting activity is present.', array['Construction Progress']::text[], false),
    ('Active Equipment', 'Construction Progress', 'Identify active equipment routes and exclusion zones. Maintain separation from moving machinery and use a site escort or observer when needed.', array['Construction Progress']::text[], false),
    ('Multiple Contractors', 'Construction Progress', 'Coordinate with the site supervisor and communicate planned drone activity to affected contractors. Reassess hazards as work crews change.', array['Construction Progress']::text[], false),
    ('Dust', 'Construction Progress', 'Monitor dust that could affect visibility, aircraft systems, or crew exposure. Delay or reposition operations when dust reduces safe margins.', array['Construction Progress']::text[], false),
    ('Dynamic Work Area', 'Construction Progress', 'Treat the site as changing throughout the mission. Reassess traffic, equipment, personnel, and obstacles before each flight segment.', array['Construction Progress']::text[], false),

    ('Privacy Concerns', 'Real Estate / Property Media', 'Review camera angles, neighboring properties, and client expectations before flight. Avoid unnecessary capture of private areas and follow applicable privacy requirements.', array['Real Estate / Property Media']::text[], false)
) as seed(hazard_name, category, default_mitigation, service_types, is_universal)
where not exists (
  select 1
  from public.hazard_library existing
  where lower(existing.hazard_name) = lower(seed.hazard_name)
);
-- END MIGRATION: 20260612020000_create_hazard_library.sql

-- MIGRATION: 20260612030000_create_job_hazard_photos.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-evidence-photos',
  'job-evidence-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.job_hazard_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  hazard_id text,
  hazard_name text not null,
  photo_url text not null,
  thumbnail_url text,
  caption text,
  include_in_packet boolean not null default true,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists job_hazard_photos_organization_id_idx on public.job_hazard_photos(organization_id);
create index if not exists job_hazard_photos_job_id_idx on public.job_hazard_photos(job_id);
create index if not exists job_hazard_photos_hazard_id_idx on public.job_hazard_photos(hazard_id);
create index if not exists job_hazard_photos_deleted_at_idx on public.job_hazard_photos(deleted_at);

alter table public.job_hazard_photos enable row level security;

drop policy if exists "Users can view organization hazard photos" on public.job_hazard_photos;
create policy "Users can view organization hazard photos"
  on public.job_hazard_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
  );

drop policy if exists "Users can create organization hazard photos" on public.job_hazard_photos;
create policy "Users can create organization hazard photos"
  on public.job_hazard_photos
  for insert
  to authenticated
  with check (
    (uploaded_by is null or uploaded_by = auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_hazard_photos.job_id
        and jobs.organization_id = job_hazard_photos.organization_id
    )
  );

drop policy if exists "Users can update organization hazard photos" on public.job_hazard_photos;
create policy "Users can update organization hazard photos"
  on public.job_hazard_photos
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_hazard_photos.job_id
        and jobs.organization_id = job_hazard_photos.organization_id
    )
  );

grant select, insert, update on public.job_hazard_photos to authenticated;

drop policy if exists "Users can view organization hazard photo files" on storage.objects;
create policy "Users can view organization hazard photo files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can upload organization hazard photo files" on storage.objects;
create policy "Users can upload organization hazard photo files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can update organization hazard photo files" on storage.objects;
create policy "Users can update organization hazard photo files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );
-- END MIGRATION: 20260612030000_create_job_hazard_photos.sql

-- MIGRATION: 20260612040000_add_proposal_conversion_fields.sql
-- Track Proposal -> Job conversion without removing historical proposal records.
-- Proposals remain commercial records; jobs become the operational workspace.

alter table public.proposals
  add column if not exists converted_to_job boolean not null default false,
  add column if not exists converted_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists converted_at timestamptz;

create index if not exists proposals_converted_to_job_idx on public.proposals(converted_to_job);
create index if not exists proposals_converted_job_id_idx on public.proposals(converted_job_id);

comment on column public.proposals.converted_to_job is 'True when the proposal has been converted into an operational job record.';
comment on column public.proposals.converted_job_id is 'Operational job created from this proposal, if conversion completed.';
comment on column public.proposals.converted_at is 'Timestamp when the proposal was converted into a job.';
-- END MIGRATION: 20260612040000_add_proposal_conversion_fields.sql

-- MIGRATION: 20260612050000_create_job_operation_closeouts.sql
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
-- END MIGRATION: 20260612050000_create_job_operation_closeouts.sql

-- MIGRATION: 20260613010000_add_organization_website_url.sql
-- Store organization website for branded client-facing proposal PDFs.

alter table public.organizations
  add column if not exists website_url text;

comment on column public.organizations.website_url is 'Organization website shown in branded proposal PDF headers and footers.';
-- END MIGRATION: 20260613010000_add_organization_website_url.sql

-- MIGRATION: 20260614000000_add_proposal_equipment.sql
alter table public.proposals
  add column if not exists proposal_equipment jsonb not null default '[]'::jsonb;

comment on column public.proposals.proposal_equipment is 'Selected proposal equipment assignment snapshots including equipment ID, display name, make/model, status, type, and proposal-specific purpose for PDF generation and future job packet workflows.';
-- END MIGRATION: 20260614000000_add_proposal_equipment.sql

-- MIGRATION: 20260614010000_add_proposal_scope_fields.sql
-- Store editable client-facing scope deliverables and exclusions on proposals.
alter table public.proposals
  add column if not exists deliverables text,
  add column if not exists exclusions text;

comment on column public.proposals.deliverables is 'Editable proposal-level client deliverables used as the source of truth for Proposal PDF Scope of Work.';
comment on column public.proposals.exclusions is 'Editable proposal-level exclusions used as the source of truth for Proposal PDF Scope of Work.';
-- END MIGRATION: 20260614010000_add_proposal_scope_fields.sql

-- MIGRATION: 20260615000000_create_generated_documents.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-documents',
  'generated-documents',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  record_type text not null,
  record_id uuid not null,
  generated_by_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archived_by_user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  display_file_name text,
  storage_path text not null unique,
  file_size bigint,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint generated_documents_document_type_check check (
    document_type in (
      'proposal_pdf',
      'job_packet_pdf',
      'completion_report_pdf',
      'incident_report_pdf',
      'safety_export_pdf',
      'airspace_package_pdf',
      'preflight_packet_pdf',
      'jha_packet_pdf'
    )
  ),
  constraint generated_documents_record_type_check check (
    record_type in (
      'proposal',
      'job',
      'incident',
      'organization'
    )
  )
);

create index if not exists generated_documents_record_generated_at_idx
  on public.generated_documents(record_type, record_id, generated_at desc);
create index if not exists generated_documents_organization_generated_at_idx
  on public.generated_documents(organization_id, generated_at desc);
create index if not exists generated_documents_generated_by_user_id_idx
  on public.generated_documents(generated_by_user_id);
create index if not exists generated_documents_document_type_idx
  on public.generated_documents(document_type);
create index if not exists generated_documents_archived_at_idx
  on public.generated_documents(archived_at);

alter table public.generated_documents enable row level security;

drop policy if exists "Users can view organization generated documents" on public.generated_documents;
create policy "Users can view organization generated documents"
  on public.generated_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  );

drop policy if exists "Users can create organization generated documents" on public.generated_documents;
create policy "Users can create organization generated documents"
  on public.generated_documents
  for insert
  to authenticated
  with check (
    generated_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
    and (
      record_type <> 'proposal'
      or exists (
        select 1
        from public.proposals
        where proposals.id = generated_documents.record_id
          and proposals.organization_id = generated_documents.organization_id
      )
    )
    and (
      record_type <> 'job'
      or exists (
        select 1
        from public.jobs
        where jobs.id = generated_documents.record_id
          and jobs.organization_id = generated_documents.organization_id
      )
    )
  );

drop policy if exists "Users can archive organization generated documents" on public.generated_documents;
create policy "Users can archive organization generated documents"
  on public.generated_documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  )
  with check (
    archived_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  );

grant select, insert, update on public.generated_documents to authenticated;

drop policy if exists "Users can view organization generated document files" on storage.objects;
create policy "Users can view organization generated document files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'generated-documents'
    and exists (
      select 1
      from public.generated_documents
      join public.profiles on profiles.organization_id = generated_documents.organization_id
      where profiles.id = auth.uid()
        and generated_documents.storage_path = storage.objects.name
    )
  );

drop policy if exists "Users can upload generated document files" on storage.objects;
create policy "Users can upload generated document files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'generated-documents'
    and lower(right(name, 4)) = '.pdf'
    and (storage.foldername(name))[1] in ('proposal', 'job', 'incident', 'organization')
  );
-- END MIGRATION: 20260615000000_create_generated_documents.sql

-- MIGRATION: 20260615010000_add_generated_document_display_file_name.sql
alter table public.generated_documents
  add column if not exists display_file_name text;

comment on column public.generated_documents.display_file_name is 'User-facing filename for generated document display and downloads. The file_name column remains the unique internal storage object filename.';
-- END MIGRATION: 20260615010000_add_generated_document_display_file_name.sql

-- MIGRATION: 20260615020000_add_generated_document_archive_fields.sql
alter table public.generated_documents
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists generated_documents_archived_at_idx
  on public.generated_documents(archived_at);

drop policy if exists "Users can archive organization generated documents" on public.generated_documents;
create policy "Users can archive organization generated documents"
  on public.generated_documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  )
  with check (
    archived_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  );

grant update on public.generated_documents to authenticated;

comment on column public.generated_documents.archived_at is 'Timestamp when a generated document was hidden from default document lists without deleting the audit row or storage object.';
comment on column public.generated_documents.archived_by_user_id is 'User who hid the generated document from default document lists.';
-- END MIGRATION: 20260615020000_add_generated_document_archive_fields.sql

-- MIGRATION: 20260616000000_add_profile_first_last_name.sql
alter table public.profiles
  add column if not exists first_name text;

alter table public.profiles
  add column if not exists last_name text;

alter table public.profiles
  add column if not exists faa_part_number text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
  ) then
    update public.profiles
    set
      first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
      last_name = coalesce(last_name, nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''))
    where full_name is not null;
  end if;
end $$;
-- END MIGRATION: 20260616000000_add_profile_first_last_name.sql

-- MIGRATION: 20260616010000_add_organization_company_statement.sql
alter table public.organizations
  add column if not exists company_statement text;
-- END MIGRATION: 20260616010000_add_organization_company_statement.sql

-- MIGRATION: 20260618000000_add_chemical_material_equipment.sql
alter table public.equipment
  add column if not exists product_category text,
  add column if not exists typical_mix_ratio text,
  add column if not exists application_notes text,
  add column if not exists epa_registration_number text,
  add column if not exists signal_word text,
  add column if not exists restricted_use_product boolean;

create index if not exists equipment_product_category_idx on public.equipment(product_category);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipment-reference-documents', 'equipment-reference-documents', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.equipment_reference_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  display_file_name text,
  storage_path text not null unique,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  constraint equipment_reference_documents_type_check check (document_type in ('Safety Data Sheet (SDS)', 'Product Label', 'Technical Data Sheet (TDS)'))
);

create index if not exists equipment_reference_documents_organization_id_idx on public.equipment_reference_documents(organization_id);
create index if not exists equipment_reference_documents_equipment_id_idx on public.equipment_reference_documents(equipment_id);
create index if not exists equipment_reference_documents_document_type_idx on public.equipment_reference_documents(document_type);

alter table public.equipment_reference_documents enable row level security;

drop policy if exists "Users can view organization equipment reference documents" on public.equipment_reference_documents;
create policy "Users can view organization equipment reference documents"
  on public.equipment_reference_documents for select to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id = equipment_reference_documents.organization_id));

drop policy if exists "Users can create organization equipment reference documents" on public.equipment_reference_documents;
create policy "Users can create organization equipment reference documents"
  on public.equipment_reference_documents for insert to authenticated
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id = equipment_reference_documents.organization_id)
    and exists (select 1 from public.equipment where equipment.id = equipment_reference_documents.equipment_id and equipment.organization_id = equipment_reference_documents.organization_id and equipment.equipment_type = 'Chemical / Material')
  );

drop policy if exists "Users can delete organization equipment reference documents" on public.equipment_reference_documents;
create policy "Users can delete organization equipment reference documents"
  on public.equipment_reference_documents for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id = equipment_reference_documents.organization_id));

grant select, insert, delete on public.equipment_reference_documents to authenticated;

drop policy if exists "Users can view organization equipment reference document files" on storage.objects;
create policy "Users can view organization equipment reference document files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'equipment-reference-documents'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id::text = (storage.foldername(name))[1])
  );

drop policy if exists "Users can upload organization equipment reference document files" on storage.objects;
create policy "Users can upload organization equipment reference document files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'equipment-reference-documents'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id::text = (storage.foldername(name))[1])
  );

drop policy if exists "Users can delete organization equipment reference document files" on storage.objects;
create policy "Users can delete organization equipment reference document files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'equipment-reference-documents'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id::text = (storage.foldername(name))[1])
  );

comment on table public.equipment_reference_documents is 'Reusable SDS, product label, and technical data sheet PDFs attached to Chemical / Material equipment records.';
-- END MIGRATION: 20260618000000_add_chemical_material_equipment.sql

-- MIGRATION: 20260619000000_add_proposal_business_terms.sql
alter table public.organizations
  add column if not exists is_licensed boolean not null default false,
  add column if not exists is_insured boolean not null default false,
  add column if not exists is_bonded boolean not null default false,
  add column if not exists default_payment_terms text,
  add column if not exists warranty text;

alter table public.proposals
  add column if not exists estimated_duration text,
  add column if not exists payment_terms text;

alter table public.equipment
  add column if not exists purpose text;
-- END MIGRATION: 20260619000000_add_proposal_business_terms.sql

-- MIGRATION: 20260619010000_default_sms_policy_statements.sql
alter table public.organizations
  alter column stop_work_authority_statement set default 'Every crew member has the authority and responsibility to immediately stop work whenever an unsafe condition, unforeseen hazard, equipment malfunction, regulatory concern, or environmental risk is identified. Operations will not resume until the hazard has been evaluated and appropriate controls have been implemented or the risk has been reduced to an acceptable level.',
  alter column hazard_reporting_statement set default 'All personnel are expected to promptly report hazards, near misses, equipment deficiencies, procedural concerns, and safety observations. Hazard reports are used to improve operations through corrective action and continuous learning, not to assign blame. Timely reporting supports a proactive safety culture and strengthens operational decision-making.',
  alter column emergency_procedures_summary set default 'In the event of an emergency, operations shall cease immediately. Personnel will prioritize the protection of life, notify emergency services when required, secure the operating area, and preserve the scene when appropriate. The Remote Pilot in Command will document the event, notify affected parties as required, and initiate post-event review and corrective actions before operations resume.';

update public.organizations
set stop_work_authority_statement = 'Every crew member has the authority and responsibility to immediately stop work whenever an unsafe condition, unforeseen hazard, equipment malfunction, regulatory concern, or environmental risk is identified. Operations will not resume until the hazard has been evaluated and appropriate controls have been implemented or the risk has been reduced to an acceptable level.'
where nullif(btrim(stop_work_authority_statement), '') is null;

update public.organizations
set hazard_reporting_statement = 'All personnel are expected to promptly report hazards, near misses, equipment deficiencies, procedural concerns, and safety observations. Hazard reports are used to improve operations through corrective action and continuous learning, not to assign blame. Timely reporting supports a proactive safety culture and strengthens operational decision-making.'
where nullif(btrim(hazard_reporting_statement), '') is null;

update public.organizations
set emergency_procedures_summary = 'In the event of an emergency, operations shall cease immediately. Personnel will prioritize the protection of life, notify emergency services when required, secure the operating area, and preserve the scene when appropriate. The Remote Pilot in Command will document the event, notify affected parties as required, and initiate post-event review and corrective actions before operations resume.'
where nullif(btrim(emergency_procedures_summary), '') is null;
-- END MIGRATION: 20260619010000_default_sms_policy_statements.sql

-- MIGRATION: 20260625000000_replace_warranty_with_service_commitment.sql
alter table public.organizations
  add column if not exists service_commitment text,
  add column if not exists include_payment_terms_in_proposal boolean not null default true,
  add column if not exists include_service_commitment_in_proposal boolean not null default true,
  add column if not exists include_company_credentials_in_proposal boolean not null default true,
  add column if not exists include_materials_used_in_proposal boolean not null default true;

update public.organizations
set service_commitment = coalesce(nullif(trim(service_commitment), ''), nullif(trim(warranty), ''), 'We are committed to delivering the services described in this proposal safely, professionally, and in accordance with the agreed scope of work. If you believe any portion of the completed work does not reflect the agreed scope or was not performed to a professional standard, please contact us promptly. We will review the concern and, when appropriate, schedule corrective work. This commitment applies to workmanship only and does not extend to normal environmental conditions, weather, airborne contaminants, irrigation, construction activity, or conditions occurring after the completion of the work.')
where service_commitment is null or trim(service_commitment) = '';

comment on column public.organizations.service_commitment is 'Editable default proposal service commitment text. Existing custom warranty text is preserved during migration when present.';
comment on column public.organizations.include_payment_terms_in_proposal is 'Controls whether populated payment terms render in proposal PDFs.';
comment on column public.organizations.include_service_commitment_in_proposal is 'Controls whether populated service commitment text renders in proposal PDFs.';
comment on column public.organizations.include_company_credentials_in_proposal is 'Controls whether selected company credentials render in proposal PDF headers.';
comment on column public.organizations.include_materials_used_in_proposal is 'Controls whether assigned Chemical / Material equipment renders in proposal PDFs.';
-- END MIGRATION: 20260625000000_replace_warranty_with_service_commitment.sql
