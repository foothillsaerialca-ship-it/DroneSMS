-- A structured, organization-scoped designation for future safety workflows.
create table if not exists public.organization_safety_designations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id) on delete restrict,
  designated_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  designated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_safety_designations_personnel_id_idx
  on public.organization_safety_designations(personnel_id);

create or replace function public.validate_safety_representative_membership()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.personnel
    where personnel.id = new.personnel_id
      and personnel.organization_id = new.organization_id
      and personnel.status = 'Active'
  ) then
    raise exception 'Safety representative must be an active member of the organization';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_safety_representative_membership on public.organization_safety_designations;
create trigger validate_safety_representative_membership
  before insert or update on public.organization_safety_designations
  for each row execute function public.validate_safety_representative_membership();

alter table public.organization_safety_designations enable row level security;

create policy "Members can view safety designation"
  on public.organization_safety_designations for select to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = organization_safety_designations.organization_id
  ));

create policy "Organization owners can create safety designation"
  on public.organization_safety_designations for insert to authenticated
  with check (exists (
    select 1 from public.organizations
    where organizations.id = organization_safety_designations.organization_id
      and organizations.owner_user_id = auth.uid()
  ));

create policy "Organization owners can update safety designation"
  on public.organization_safety_designations for update to authenticated
  using (exists (
    select 1 from public.organizations
    where organizations.id = organization_safety_designations.organization_id
      and organizations.owner_user_id = auth.uid()
  )) with check (exists (
    select 1 from public.organizations
    where organizations.id = organization_safety_designations.organization_id
      and organizations.owner_user_id = auth.uid()
  ));

grant select, insert, update on public.organization_safety_designations to authenticated;

comment on table public.organization_safety_designations is
  'Current organization Safety Manager / Safety Representative, linked to one existing personnel record for use by future workflows.';
