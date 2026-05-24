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
