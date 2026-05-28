create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null,
  part107_certificate_number text,
  part107_expiration_date date,
  training_expiration_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personnel_organization_id_idx on public.personnel(organization_id);
create index if not exists personnel_user_id_idx on public.personnel(user_id);
create index if not exists personnel_full_name_idx on public.personnel(full_name);

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
