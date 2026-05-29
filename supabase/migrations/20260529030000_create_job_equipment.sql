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
