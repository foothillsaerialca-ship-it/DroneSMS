create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  equipment_type text not null,
  equipment_name text not null,
  manufacturer text,
  model text,
  serial_number text,
  status text not null default 'Active',
  faa_registration text,
  remote_id text,
  battery_identifier text,
  battery_cycle_count integer,
  controller_identifier text,
  last_inspection_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_type_check check (equipment_type in ('Aircraft', 'Battery', 'Controller', 'Support Equipment')),
  constraint equipment_status_check check (status in ('Active', 'Maintenance', 'Out of Service', 'Retired')),
  constraint equipment_battery_cycle_count_check check (battery_cycle_count is null or battery_cycle_count >= 0)
);

create index if not exists equipment_organization_id_idx on public.equipment(organization_id);
create index if not exists equipment_created_by_idx on public.equipment(created_by);
create index if not exists equipment_type_idx on public.equipment(equipment_type);
create index if not exists equipment_status_idx on public.equipment(status);
create index if not exists equipment_name_idx on public.equipment(equipment_name);

alter table public.equipment enable row level security;

drop policy if exists "Users can view organization equipment" on public.equipment;
create policy "Users can view organization equipment"
  on public.equipment
  for select
  to authenticated
  using (
    created_by = auth.uid()
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
    created_by = auth.uid()
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
