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
