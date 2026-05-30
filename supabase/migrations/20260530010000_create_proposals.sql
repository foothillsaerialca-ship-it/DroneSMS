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
