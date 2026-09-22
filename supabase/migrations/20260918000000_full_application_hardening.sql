-- Full application hardening pass.
-- This migration makes authorization and workflow invariants database-enforced so
-- a caller cannot bypass them by issuing PostgREST requests outside the UI.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Trusted organization membership and role model
-- ---------------------------------------------------------------------------

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'safety_manager', 'operator', 'read_only')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'revoked')),
  invited_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_user_active_idx
  on public.organization_memberships(user_id, organization_id)
  where status = 'active';

-- Owners are authoritative. Legacy profile links are imported as operators so
-- existing tenants remain usable; administrators must review this one-time list.
insert into public.organization_memberships(organization_id, user_id, role, status, accepted_at)
select id, owner_user_id, 'owner', 'active', created_at
from public.organizations
on conflict (organization_id, user_id) do update
set role = 'owner', status = 'active', accepted_at = coalesce(organization_memberships.accepted_at, excluded.accepted_at), updated_at = now();

insert into public.organization_memberships(organization_id, user_id, role, status, accepted_at)
select p.organization_id, p.id, 'operator', 'active', coalesce(p.created_at, now())
from public.profiles p
join public.organizations o on o.id = p.organization_id
where p.organization_id is not null and p.id <> o.owner_user_id
on conflict (organization_id, user_id) do nothing;

alter table public.organization_memberships enable row level security;

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select m.organization_id
      from public.organization_memberships m
      join public.profiles p on p.id = m.user_id and p.organization_id = m.organization_id
      where m.user_id = auth.uid() and m.status = 'active'
      order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at
      limit 1
    ),
    (
      select m.organization_id
      from public.organization_memberships m
      where m.user_id = auth.uid() and m.status = 'active'
      order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at
      limit 1
    )
  )
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  )
$$;

revoke all on function public.current_user_organization_id() from public, anon;
revoke all on function public.is_organization_member(uuid) from public, anon;
revoke all on function public.has_organization_role(uuid, text[]) from public, anon;
grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;

create or replace function public.is_organization_safety_manager(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.has_organization_role(target_organization_id, array['owner','admin','safety_manager']::text[])
    or exists (
      select 1
      from public.organization_safety_designations d
      join public.personnel p on p.id=d.personnel_id and p.organization_id=d.organization_id
      where d.organization_id=target_organization_id and p.user_id=auth.uid() and p.status='Active'
    )
$$;
revoke all on function public.is_organization_safety_manager(uuid) from public, anon;
grant execute on function public.is_organization_safety_manager(uuid) to authenticated;

drop policy if exists "Members view organization memberships" on public.organization_memberships;
create policy "Members view organization memberships"
  on public.organization_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_organization_role(organization_id, array['owner','admin']::text[])
  );

revoke insert, update, delete on public.organization_memberships from authenticated;
grant select on public.organization_memberships to authenticated;

create or replace function public.bootstrap_organization_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.organization_memberships(organization_id, user_id, role, status, accepted_at)
  values(new.id, new.owner_user_id, 'owner', 'active', now())
  on conflict (organization_id, user_id) do update
  set role = 'owner', status = 'active', accepted_at = coalesce(organization_memberships.accepted_at, now()), updated_at = now();
  return new;
end
$$;

drop trigger if exists bootstrap_organization_owner_membership on public.organizations;
create trigger bootstrap_organization_owner_membership
after insert on public.organizations
for each row execute function public.bootstrap_organization_owner_membership();

create or replace function public.protect_organization_owner()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
     and current_setting('app.organization_owner_transfer', true) is distinct from 'on' then
    raise exception 'Organization ownership must be transferred through the authorized transfer workflow.';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists protect_organization_owner on public.organizations;
create trigger protect_organization_owner
before update on public.organizations
for each row execute function public.protect_organization_owner();

create or replace function public.guard_profile_organization_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() = 'service_role' or (auth.uid() is null and auth.role() is null) then
    return new;
  end if;
  if current_setting('app.profile_membership_write', true) = 'on' then return new; end if;
  if new.id is distinct from auth.uid() then
    raise exception 'Profiles may only be written by their authenticated user.';
  end if;
  if new.organization_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.id
      and m.status = 'active'
  ) then
    raise exception 'An accepted organization membership is required.';
  end if;
  return new;
end
$$;

drop trigger if exists guard_profile_organization_membership_insert on public.profiles;
create trigger guard_profile_organization_membership_insert
before insert on public.profiles
for each row execute function public.guard_profile_organization_membership();
drop trigger if exists guard_profile_organization_membership_update on public.profiles;
create trigger guard_profile_organization_membership_update
before update of organization_id on public.profiles
for each row execute function public.guard_profile_organization_membership();

create or replace function public.enforce_organization_write_role()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare target_org uuid;
begin
  if current_user in ('postgres','service_role','supabase_admin') then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  target_org := coalesce(
    nullif(case when tg_op='DELETE' then to_jsonb(old)->>'organization_id' else to_jsonb(new)->>'organization_id' end,'')::uuid,
    public.current_user_organization_id()
  );
  if target_org is null or not public.has_organization_role(target_org, array['owner','admin','safety_manager','operator']::text[]) then
    raise exception 'Your organization role is read-only for this operation.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'jobs','jha_assessments','personnel','equipment','job_personnel','job_equipment',
    'proposals','generated_documents','job_hazard_photos','equipment_reference_documents',
    'job_safety_events','job_operation_readiness','job_operation_closeouts',
    'management_of_change','management_of_change_actions','management_of_change_activity',
    'hazard_library_reviews','hazard_library_review_actions','safety_assurance_reviews'
  ] loop
    execute format('drop trigger if exists enforce_organization_write_role on public.%I', table_name);
    execute format('create trigger enforce_organization_write_role before insert or update or delete on public.%I for each row execute function public.enforce_organization_write_role()', table_name);
  end loop;
end
$$;

drop policy if exists "Owners can update their organizations" on public.organizations;
create policy "Owners and admins can update their organizations"
  on public.organizations for update to authenticated
  using (public.has_organization_role(id, array['owner','admin']::text[]))
  with check (public.has_organization_role(id, array['owner','admin']::text[]));

drop policy if exists "Users can view their organizations" on public.organizations;
create policy "Members can view their organizations"
  on public.organizations for select to authenticated
  using (public.is_organization_member(id));

-- Invitation tokens are returned once to an administrator and only hashes are stored.
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'safety_manager', 'operator', 'read_only')),
  token_hash text not null unique,
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from authenticated, anon;

create or replace function public.create_organization_invitation(invitee_email text, invited_role text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  target_org uuid := public.current_user_organization_id();
  raw_token text;
  invitation public.organization_invitations;
begin
  if target_org is null or not public.has_organization_role(target_org, array['owner','admin']::text[]) then
    raise exception 'Owner or administrator access is required.';
  end if;
  if lower(trim(invitee_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required.';
  end if;
  if invited_role not in ('admin','safety_manager','operator','read_only') then
    raise exception 'Unsupported organization role.';
  end if;
  update public.organization_invitations
  set revoked_at = now()
  where organization_id = target_org and lower(email) = lower(trim(invitee_email))
    and accepted_at is null and revoked_at is null;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.organization_invitations(
    organization_id, email, role, token_hash, invited_by_user_id, expires_at
  ) values (
    target_org, lower(trim(invitee_email)), invited_role,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'), auth.uid(), now() + interval '72 hours'
  ) returning * into invitation;
  return jsonb_build_object('invitation_id', invitation.id, 'token', raw_token, 'email', invitation.email, 'role', invitation.role, 'expires_at', invitation.expires_at);
end
$$;

create or replace function public.accept_organization_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  invitation public.organization_invitations;
  jwt_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  select * into invitation
  from public.organization_invitations
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  for update;
  if invitation.id is null or invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at <= now() then
    raise exception 'This invitation is invalid or expired.';
  end if;
  if jwt_email = '' or jwt_email <> lower(invitation.email) then
    raise exception 'Sign in with the email address that received this invitation.';
  end if;
  insert into public.organization_memberships(organization_id, user_id, role, status, invited_by_user_id, accepted_at)
  values(invitation.organization_id, auth.uid(), invitation.role, 'active', invitation.invited_by_user_id, now())
  on conflict (organization_id, user_id) do update
  set role = excluded.role, status = 'active', invited_by_user_id = excluded.invited_by_user_id,
      accepted_at = now(), updated_at = now();
  update public.organization_invitations set accepted_at = now(), token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex') where id = invitation.id;
  insert into public.profiles(id, organization_id, company_name, updated_at)
  select auth.uid(), o.id, o.name, now() from public.organizations o where o.id = invitation.organization_id
  on conflict (id) do update set organization_id = excluded.organization_id, company_name = excluded.company_name, updated_at = now();
  return invitation.organization_id;
end
$$;

revoke all on function public.create_organization_invitation(text,text) from public, anon;
revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.create_organization_invitation(text,text) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;

create table if not exists public.organization_membership_audit (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately do not cascade identity deletion into the audit trail. UUIDs
  -- remain as pseudonymous evidence after an account or tenant is removed.
  organization_id uuid not null,
  member_user_id uuid not null,
  actor_user_id uuid not null,
  action text not null check (action in ('role_changed','status_changed','ownership_transferred')),
  previous_role text,
  new_role text,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);
alter table public.organization_membership_audit enable row level security;
revoke all on public.organization_membership_audit from authenticated, anon;
grant select on public.organization_membership_audit to authenticated;
create policy "Administrators view membership audit"
  on public.organization_membership_audit for select to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin']::text[]));

create or replace function public.list_organization_members()
returns table (
  user_id uuid,
  email text,
  role text,
  status text,
  accepted_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare target_org uuid := public.current_user_organization_id();
begin
  if target_org is null or not public.has_organization_role(target_org, array['owner','admin']::text[]) then
    raise exception 'Owner or administrator access is required.';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.status, m.accepted_at, m.created_at
    from public.organization_memberships m
    join auth.users u on u.id=m.user_id
    where m.organization_id=target_org
    order by case m.role when 'owner' then 0 when 'admin' then 1 when 'safety_manager' then 2 when 'operator' then 3 else 4 end,
      lower(coalesce(u.email,''));
end
$$;

create or replace function public.update_organization_member(
  member_user_id uuid,
  requested_role text,
  requested_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_org uuid := public.current_user_organization_id();
  actor_role text;
  member public.organization_memberships;
begin
  select role into actor_role from public.organization_memberships
  where organization_id=target_org and user_id=auth.uid() and status='active';
  if actor_role not in ('owner','admin') then raise exception 'Owner or administrator access is required.'; end if;
  if requested_role not in ('admin','safety_manager','operator','read_only') then raise exception 'Unsupported organization role.'; end if;
  if requested_status not in ('active','suspended','revoked') then raise exception 'Unsupported membership status.'; end if;

  select * into member from public.organization_memberships
  where organization_id=target_org and user_id=member_user_id for update;
  if member.id is null then raise exception 'Organization member not found.'; end if;
  if member.role='owner' then raise exception 'Use the ownership-transfer workflow to change the owner.'; end if;
  if actor_role='admin' and member.role='admin' then raise exception 'Only the owner can manage another administrator.'; end if;
  if member_user_id=auth.uid() then raise exception 'You cannot change your own membership.'; end if;

  update public.organization_memberships
  set role=requested_role, status=requested_status, updated_at=now()
  where id=member.id;
  if member.role is distinct from requested_role then
    insert into public.organization_membership_audit(
      organization_id,member_user_id,actor_user_id,action,previous_role,new_role,previous_status,new_status
    ) values (target_org,member_user_id,auth.uid(),'role_changed',member.role,requested_role,member.status,member.status);
  end if;
  if member.status is distinct from requested_status then
    insert into public.organization_membership_audit(
      organization_id,member_user_id,actor_user_id,action,previous_role,new_role,previous_status,new_status
    ) values (target_org,member_user_id,auth.uid(),'status_changed',requested_role,requested_role,member.status,requested_status);
  end if;
  if requested_status <> 'active' then
    perform set_config('app.profile_membership_write','on',true);
    update public.profiles set organization_id=null,updated_at=now()
    where id=member_user_id and organization_id=target_org;
  end if;
end
$$;

create or replace function public.transfer_organization_ownership(new_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_org uuid := public.current_user_organization_id();
  current_owner uuid;
  target_member public.organization_memberships;
begin
  select owner_user_id into current_owner from public.organizations where id=target_org for update;
  if current_owner is distinct from auth.uid() then raise exception 'Only the current owner can transfer ownership.'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'Multi-factor reauthentication is required for ownership transfer.'; end if;
  if new_owner_user_id=auth.uid() then raise exception 'This account already owns the organization.'; end if;
  select * into target_member from public.organization_memberships
  where organization_id=target_org and user_id=new_owner_user_id and status='active' for update;
  if target_member.id is null then raise exception 'The new owner must be an active organization member.'; end if;

  update public.organization_memberships set role='admin',updated_at=now()
  where organization_id=target_org and user_id=auth.uid();
  update public.organization_memberships set role='owner',updated_at=now()
  where id=target_member.id;
  perform set_config('app.organization_owner_transfer','on',true);
  update public.organizations set owner_user_id=new_owner_user_id where id=target_org;
  insert into public.organization_membership_audit(
    organization_id,member_user_id,actor_user_id,action,previous_role,new_role,previous_status,new_status
  ) values
    (target_org,current_owner,auth.uid(),'ownership_transferred','owner','admin','active','active'),
    (target_org,new_owner_user_id,auth.uid(),'ownership_transferred',target_member.role,'owner',target_member.status,'active');
end
$$;

revoke all on function public.list_organization_members() from public, anon;
revoke all on function public.update_organization_member(uuid,text,text) from public, anon;
revoke all on function public.transfer_organization_ownership(uuid) from public, anon;
grant execute on function public.list_organization_members() to authenticated;
grant execute on function public.update_organization_member(uuid,text,text) to authenticated;
grant execute on function public.transfer_organization_ownership(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Personnel identity binding and one-RPIC invariant
-- ---------------------------------------------------------------------------

alter table public.personnel
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;
alter table public.personnel alter column user_id drop not null;
update public.personnel set created_by_user_id = user_id where created_by_user_id is null;

-- A legacy binding is retained only when the personnel email matches the auth
-- identity email. Duplicate matches are cleared rather than guessed.
update public.personnel p
set user_id = null
where p.user_id is not null and not exists (
  select 1 from auth.users u
  where u.id = p.user_id and p.email is not null and lower(u.email) = lower(p.email)
);

with ranked as (
  select id, row_number() over(partition by organization_id, user_id order by created_at, id) as ordinal
  from public.personnel where user_id is not null
)
update public.personnel p set user_id = null
from ranked r where p.id = r.id and r.ordinal > 1;

create unique index if not exists personnel_verified_identity_unique
  on public.personnel(organization_id, user_id) where user_id is not null;

create or replace function public.protect_personnel_identity_binding()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.user_id is distinct from old.user_id
     and current_setting('app.personnel_identity_write', true) is distinct from 'on' then
    raise exception 'Personnel account identity must be changed through the verified claim workflow.';
  end if;
  new.organization_id := old.organization_id;
  new.created_by_user_id := old.created_by_user_id;
  return new;
end
$$;

drop trigger if exists protect_personnel_identity_binding on public.personnel;
create trigger protect_personnel_identity_binding
before update on public.personnel
for each row execute function public.protect_personnel_identity_binding();

create or replace function public.claim_personnel_identity(target_personnel_id uuid)
returns public.personnel
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target public.personnel;
  jwt_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  select * into target from public.personnel where id = target_personnel_id for update;
  if target.id is null or not public.is_organization_member(target.organization_id) then raise exception 'Personnel record not found.'; end if;
  if target.email is null or jwt_email = '' or lower(target.email) <> jwt_email then raise exception 'Your verified account email must match the personnel email.'; end if;
  if target.user_id is not null and target.user_id <> auth.uid() then raise exception 'This personnel record is already linked to another account.'; end if;
  perform set_config('app.personnel_identity_write', 'on', true);
  update public.personnel set user_id = auth.uid(), updated_at = now() where id = target.id returning * into target;
  return target;
end
$$;

revoke all on function public.claim_personnel_identity(uuid) from public, anon;
grant execute on function public.claim_personnel_identity(uuid) to authenticated;

drop policy if exists "Users can create organization personnel" on public.personnel;
create policy "Writers can create organization personnel"
  on public.personnel for insert to authenticated
  with check (
    user_id is null
    and created_by_user_id = auth.uid()
    and public.has_organization_role(organization_id, array['owner','admin','safety_manager','operator']::text[])
  );

drop policy if exists "Users can update organization personnel" on public.personnel;
create policy "Writers can update organization personnel"
  on public.personnel for update to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin','safety_manager','operator']::text[]))
  with check (public.has_organization_role(organization_id, array['owner','admin','safety_manager','operator']::text[]));

create table if not exists public.job_personnel_assignment_history (
  id uuid primary key default gen_random_uuid(),
  original_assignment_id uuid not null unique,
  job_id uuid not null references public.jobs(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_role text not null,
  assigned_at timestamptz not null,
  ended_at timestamptz not null default now(),
  reason text not null
);
alter table public.job_personnel_assignment_history enable row level security;
create policy "Members view personnel assignment history"
  on public.job_personnel_assignment_history for select to authenticated
  using (public.is_organization_member(organization_id));
grant select on public.job_personnel_assignment_history to authenticated;

with ranked as (
  select jp.*, row_number() over(partition by job_id order by created_at, id) as ordinal
  from public.job_personnel jp where assigned_role = 'RPIC'
)
insert into public.job_personnel_assignment_history(
  original_assignment_id, job_id, personnel_id, organization_id, assigned_role, assigned_at, reason
)
select id, job_id, personnel_id, organization_id, assigned_role, created_at,
       'Archived during one-RPIC integrity migration; earliest assignment retained'
from ranked where ordinal > 1
on conflict do nothing;

with ranked as (
  select id, row_number() over(partition by job_id order by created_at, id) as ordinal
  from public.job_personnel where assigned_role = 'RPIC'
)
delete from public.job_personnel jp using ranked r where jp.id = r.id and r.ordinal > 1;

create unique index if not exists job_personnel_one_rpic_per_job
  on public.job_personnel(job_id) where assigned_role = 'RPIC';

-- ---------------------------------------------------------------------------
-- Transactional proposal conversion and database domain validation
-- ---------------------------------------------------------------------------

with ranked as (
  select id,source_proposal_id,row_number() over(partition by source_proposal_id order by created_at,id) as ordinal
  from public.jobs where source_proposal_id is not null
)
update public.jobs j
set notes=concat_ws(E'\n',j.notes,'Legacy duplicate proposal link removed during integrity migration: '||j.source_proposal_id::text),
    source_proposal_id=null,updated_at=now()
from ranked r where j.id=r.id and r.ordinal>1;

create unique index if not exists jobs_one_source_proposal
  on public.jobs(source_proposal_id) where source_proposal_id is not null;

-- Preserve every repaired legacy value before applying strict domains. Unknown
-- workflow values become conservative review/inactive states rather than being
-- silently left outside the supported application model.
create table if not exists public.data_normalization_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_table text not null,
  record_id uuid not null,
  field_name text not null,
  previous_value text,
  replacement_value text not null,
  migration_key text not null,
  normalized_at timestamptz not null default now(),
  unique(organization_id,source_table,record_id,field_name,migration_key)
);
alter table public.data_normalization_audit enable row level security;
revoke all on public.data_normalization_audit from authenticated, anon;
grant select on public.data_normalization_audit to authenticated;
create policy "Administrators view data normalization audit"
  on public.data_normalization_audit for select to authenticated
  using (public.has_organization_role(organization_id, array['owner','admin']::text[]));

insert into public.data_normalization_audit(organization_id,source_table,record_id,field_name,previous_value,replacement_value,migration_key)
select organization_id,'jobs',id,'status',status,'Needs Review','20260918-domain-hardening'
from public.jobs where status is null or status not in ('Planned','In Progress','Needs Review','Complete')
on conflict do nothing;
update public.jobs set status='Needs Review',updated_at=now()
where status is null or status not in ('Planned','In Progress','Needs Review','Complete');

insert into public.data_normalization_audit(organization_id,source_table,record_id,field_name,previous_value,replacement_value,migration_key)
select organization_id,'personnel',id,'role',role,'Crew Member','20260918-domain-hardening'
from public.personnel where role is null or role not in ('Remote Pilot in Command','Visual Observer','Crew Member','Payload Operator','Safety Manager')
on conflict do nothing;
update public.personnel set role='Crew Member',updated_at=now()
where role is null or role not in ('Remote Pilot in Command','Visual Observer','Crew Member','Payload Operator','Safety Manager');

insert into public.data_normalization_audit(organization_id,source_table,record_id,field_name,previous_value,replacement_value,migration_key)
select organization_id,'personnel',id,'status',status,'Inactive','20260918-domain-hardening'
from public.personnel where status is null or status not in ('Active','Training','Inactive')
on conflict do nothing;
update public.personnel set status='Inactive',updated_at=now()
where status is null or status not in ('Active','Training','Inactive');

insert into public.data_normalization_audit(organization_id,source_table,record_id,field_name,previous_value,replacement_value,migration_key)
select organization_id,'equipment',id,'equipment_type',equipment_type,'Other','20260918-domain-hardening'
from public.equipment where equipment_type is null or equipment_type not in ('Drone','Controller','Battery','Payload','Ground Support','Filtration / Water System','Camera / Sensor','Charger','Safety Kit','Chemical / Material','Other')
on conflict do nothing;
update public.equipment set equipment_type='Other',updated_at=now()
where equipment_type is null or equipment_type not in ('Drone','Controller','Battery','Payload','Ground Support','Filtration / Water System','Camera / Sensor','Charger','Safety Kit','Chemical / Material','Other');

insert into public.data_normalization_audit(organization_id,source_table,record_id,field_name,previous_value,replacement_value,migration_key)
select organization_id,'equipment',id,'status',status,'Inactive','20260918-domain-hardening'
from public.equipment where status is null or status not in ('Available','In Use','Maintenance','Inactive','Retired')
on conflict do nothing;
update public.equipment set status='Inactive',updated_at=now()
where status is null or status not in ('Available','In Use','Maintenance','Inactive','Retired');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_status_domain_check' and conrelid = 'public.jobs'::regclass) then
    alter table public.jobs add constraint jobs_status_domain_check
      check (status in ('Planned','In Progress','Needs Review','Complete'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personnel_role_domain_check' and conrelid = 'public.personnel'::regclass) then
    alter table public.personnel add constraint personnel_role_domain_check
      check (role in ('Remote Pilot in Command','Visual Observer','Crew Member','Payload Operator','Safety Manager'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personnel_status_domain_check' and conrelid = 'public.personnel'::regclass) then
    alter table public.personnel add constraint personnel_status_domain_check
      check (status in ('Active','Training','Inactive'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_type_domain_check' and conrelid = 'public.equipment'::regclass) then
    alter table public.equipment add constraint equipment_type_domain_check
      check (equipment_type in ('Drone','Controller','Battery','Payload','Ground Support','Filtration / Water System','Camera / Sensor','Charger','Safety Kit','Chemical / Material','Other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_status_domain_check' and conrelid = 'public.equipment'::regclass) then
    alter table public.equipment add constraint equipment_status_domain_check
      check (status in ('Available','In Use','Maintenance','Inactive','Retired'));
  end if;
end
$$;

alter table public.jobs validate constraint jobs_status_domain_check;
alter table public.personnel validate constraint personnel_role_domain_check;
alter table public.personnel validate constraint personnel_status_domain_check;
alter table public.equipment validate constraint equipment_type_domain_check;
alter table public.equipment validate constraint equipment_status_domain_check;

create or replace function public.convert_proposal_to_job(target_proposal_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  source public.proposals;
  result public.jobs;
  proposal_number_value text;
begin
  select * into source
  from public.proposals
  where id = target_proposal_id and organization_id = public.current_user_organization_id()
  for update;
  if source.id is null then raise exception 'Proposal not found in your organization.'; end if;
  if not public.has_organization_role(source.organization_id, array['owner','admin','safety_manager','operator']::text[]) then
    raise exception 'Your organization role cannot convert proposals.';
  end if;
  select * into result from public.jobs where source_proposal_id = source.id limit 1;
  if result.id is not null then return result; end if;

  proposal_number_value := coalesce(nullif(source.proposal_number, ''), upper(left(source.id::text, 8)));
  insert into public.jobs(
    organization_id, user_id, name, service_type, location, planned_date, notes, status,
    source_proposal_id, source_proposal_number, client_name, contact_name, client_phone,
    client_email, site_address, preliminary_hazards, proposed_rpic_id,
    proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio
  ) values (
    source.organization_id, auth.uid(), source.proposal_name, source.service_type,
    coalesce(nullif(source.site_address,''), source.client_name), current_date,
    'Created from proposal ' || proposal_number_value || '. Confirm planned date during Mission Planning / JHA.',
    'Planned', source.id, proposal_number_value, source.client_name, source.contact_name,
    source.phone, source.email, source.site_address, coalesce(source.hazard_assessment, '[]'::jsonb),
    source.proposed_rpic_id, source.proposed_rpic_name, source.proposed_rpic_credentials, source.proposed_rpic_bio
  ) returning * into result;

  insert into public.job_personnel(job_id, organization_id, personnel_id, assigned_role)
  select result.id, source.organization_id, p.id, item->>'proposed_role'
  from jsonb_array_elements(case when jsonb_typeof(source.proposal_personnel)='array' then source.proposal_personnel else '[]'::jsonb end) with ordinality entries(item, ordinal)
  join public.personnel p on p.id::text = item->>'personnel_id' and p.organization_id = source.organization_id
  where item->>'proposed_role' in ('Pilot','Visual Observer','Payload Operator','Ground Crew')
  on conflict do nothing;

  insert into public.job_personnel(job_id, organization_id, personnel_id, assigned_role)
  select result.id, source.organization_id, p.id, 'RPIC'
  from jsonb_array_elements(case when jsonb_typeof(source.proposal_personnel)='array' then source.proposal_personnel else '[]'::jsonb end) with ordinality entries(item, ordinal)
  join public.personnel p on p.id::text = item->>'personnel_id' and p.organization_id = source.organization_id
  where item->>'proposed_role' = 'RPIC'
  order by ordinal limit 1
  on conflict do nothing;

  if not exists(select 1 from public.job_personnel where job_id=result.id and assigned_role='RPIC') and source.proposed_rpic_id is not null then
    insert into public.job_personnel(job_id, organization_id, personnel_id, assigned_role)
    select result.id, source.organization_id, p.id, 'RPIC'
    from public.personnel p where p.id=source.proposed_rpic_id and p.organization_id=source.organization_id
    on conflict do nothing;
  end if;

  insert into public.job_equipment(job_id, organization_id, equipment_id)
  select result.id, source.organization_id, e.id
  from jsonb_array_elements(case when jsonb_typeof(source.proposal_equipment)='array' then source.proposal_equipment else '[]'::jsonb end) entries(item)
  join public.equipment e on e.id::text = item->>'equipment_id' and e.organization_id = source.organization_id
  on conflict do nothing;

  update public.proposals
  set converted_to_job=true, converted_job_id=result.id, converted_at=now(), status='Accepted', updated_at=now()
  where id=source.id;
  return result;
end
$$;

revoke all on function public.convert_proposal_to_job(uuid) from public, anon;
grant execute on function public.convert_proposal_to_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Protected safety attestations, preflight approval, closeout, and MOC
-- ---------------------------------------------------------------------------

create or replace function public.guard_jha_protected_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') and (
    new.organization_id is distinct from old.organization_id or new.job_id is distinct from old.job_id or
    new.user_id is distinct from old.user_id or
    new.safety_manager_personnel_id is distinct from old.safety_manager_personnel_id or
    new.safety_manager_user_id is distinct from old.safety_manager_user_id or
    new.safety_manager_name is distinct from old.safety_manager_name or
    new.safety_manager_reviewed_at is distinct from old.safety_manager_reviewed_at or
    new.safety_manager_review_stale is distinct from old.safety_manager_review_stale or
    new.safety_manager_role_label is distinct from old.safety_manager_role_label or
    new.rpic_personnel_id is distinct from old.rpic_personnel_id or
    new.rpic_user_id is distinct from old.rpic_user_id or
    new.rpic_name is distinct from old.rpic_name or
    new.rpic_accepted_at is distinct from old.rpic_accepted_at or
    new.rpic_acceptance_stale is distinct from old.rpic_acceptance_stale or
    new.rpic_role_label is distinct from old.rpic_role_label
  ) then
    raise exception 'JHA identity and attestation fields are server-managed.';
  end if;
  return new;
end
$$;

drop trigger if exists a_guard_jha_protected_fields on public.jha_assessments;
create trigger a_guard_jha_protected_fields
before update on public.jha_assessments
for each row execute function public.guard_jha_protected_fields();

create table if not exists public.jha_attestation_history (
  id uuid primary key default gen_random_uuid(),
  jha_id uuid not null references public.jha_assessments(id) on delete restrict,
  organization_id uuid not null,
  attestation_type text not null check(attestation_type in ('safety_manager','rpic')),
  personnel_id uuid,
  user_id uuid,
  attested_name text,
  attested_at timestamptz,
  stale boolean not null,
  event_type text not null check(event_type in ('attested','invalidated','cleared','changed')),
  recorded_at timestamptz not null default now()
);
alter table public.jha_attestation_history enable row level security;
revoke all on public.jha_attestation_history from authenticated, anon;
grant select on public.jha_attestation_history to authenticated;
create policy "Members view JHA attestation history"
  on public.jha_attestation_history for select to authenticated
  using (public.is_organization_member(organization_id));

insert into public.jha_attestation_history(
  jha_id,organization_id,attestation_type,personnel_id,user_id,attested_name,attested_at,stale,event_type
)
select id,organization_id,'safety_manager',safety_manager_personnel_id,safety_manager_user_id,
  safety_manager_name,safety_manager_reviewed_at,safety_manager_review_stale,
  case when safety_manager_review_stale then 'invalidated' else 'attested' end
from public.jha_assessments where safety_manager_reviewed_at is not null;

insert into public.jha_attestation_history(
  jha_id,organization_id,attestation_type,personnel_id,user_id,attested_name,attested_at,stale,event_type
)
select id,organization_id,'rpic',rpic_personnel_id,rpic_user_id,rpic_name,rpic_accepted_at,rpic_acceptance_stale,
  case when rpic_acceptance_stale then 'invalidated' else 'attested' end
from public.jha_assessments where rpic_accepted_at is not null;

create or replace function public.record_jha_attestation_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if row(new.safety_manager_personnel_id,new.safety_manager_user_id,new.safety_manager_name,new.safety_manager_reviewed_at,new.safety_manager_review_stale)
     is distinct from row(old.safety_manager_personnel_id,old.safety_manager_user_id,old.safety_manager_name,old.safety_manager_reviewed_at,old.safety_manager_review_stale) then
    insert into public.jha_attestation_history(jha_id,organization_id,attestation_type,personnel_id,user_id,attested_name,attested_at,stale,event_type)
    values(new.id,new.organization_id,'safety_manager',new.safety_manager_personnel_id,new.safety_manager_user_id,new.safety_manager_name,new.safety_manager_reviewed_at,new.safety_manager_review_stale,
      case when new.safety_manager_reviewed_at is null then 'cleared' when new.safety_manager_review_stale then 'invalidated' when old.safety_manager_reviewed_at is null or old.safety_manager_review_stale then 'attested' else 'changed' end);
  end if;
  if row(new.rpic_personnel_id,new.rpic_user_id,new.rpic_name,new.rpic_accepted_at,new.rpic_acceptance_stale)
     is distinct from row(old.rpic_personnel_id,old.rpic_user_id,old.rpic_name,old.rpic_accepted_at,old.rpic_acceptance_stale) then
    insert into public.jha_attestation_history(jha_id,organization_id,attestation_type,personnel_id,user_id,attested_name,attested_at,stale,event_type)
    values(new.id,new.organization_id,'rpic',new.rpic_personnel_id,new.rpic_user_id,new.rpic_name,new.rpic_accepted_at,new.rpic_acceptance_stale,
      case when new.rpic_accepted_at is null then 'cleared' when new.rpic_acceptance_stale then 'invalidated' when old.rpic_accepted_at is null or old.rpic_acceptance_stale then 'attested' else 'changed' end);
  end if;
  return new;
end
$$;

drop trigger if exists record_jha_attestation_history on public.jha_assessments;
create trigger record_jha_attestation_history
after update on public.jha_assessments
for each row execute function public.record_jha_attestation_history();

alter table public.preflight_checklists
  add column if not exists rpic_personnel_id uuid references public.personnel(id) on delete set null,
  add column if not exists approved_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_stale boolean not null default false;

create or replace function public.save_preflight_checklist(
  target_job_id uuid, states jsonb, checklist_notes text, requested_status text
)
returns public.preflight_checklists
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_job public.jobs;
  assigned_rpic public.personnel;
  result public.preflight_checklists;
  completing boolean := requested_status = 'Complete';
begin
  select * into target_job from public.jobs
  where id=target_job_id and organization_id=public.current_user_organization_id();
  if target_job.id is null then raise exception 'Job not found in your organization.'; end if;
  if requested_status not in ('Draft','Complete') then raise exception 'Unsupported checklist status.'; end if;
  if not public.has_organization_role(target_job.organization_id, array['owner','admin','safety_manager','operator']::text[]) then
    raise exception 'Your organization role cannot edit preflight checklists.';
  end if;
  if jsonb_typeof(states) <> 'object' or exists (
    select 1 from jsonb_each_text(states) item
    where item.key <> all(array[
      'aircraft_selected','battery_condition_checked','propellers_inspected','firmware_app_status_checked',
      'gps_signal_confirmed','home_point_verified','storage_media_checked','weather_verified',
      'wind_conditions_acceptable','airspace_reviewed','laanc_confirmed_if_required','notam_tfr_checked',
      'visual_observer_assigned_if_needed','emergency_procedures_reviewed','crew_communications_confirmed','final_rpic_approval'
    ]) or item.value not in ('confirmed','not_applicable','unresolved')
  ) then raise exception 'Checklist states contain unsupported keys or values.'; end if;

  select p.* into assigned_rpic
  from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id and p.organization_id=jp.organization_id
  where jp.job_id=target_job_id and jp.assigned_role='RPIC' and p.status='Active';
  if completing then
    if not public.preflight_states_allow_completion(states) then raise exception 'Resolve every checklist item before completion.'; end if;
    if assigned_rpic.id is null or assigned_rpic.user_id is distinct from auth.uid() then
      raise exception 'Only the verified assigned RPIC can complete final preflight approval.';
    end if;
  end if;

  insert into public.preflight_checklists(
    job_id,organization_id,user_id,aircraft_selected,battery_condition_checked,propellers_inspected,
    firmware_app_status_checked,gps_signal_confirmed,home_point_verified,storage_media_checked,
    weather_verified,wind_conditions_acceptable,airspace_reviewed,laanc_confirmed_if_required,
    notam_tfr_checked,visual_observer_assigned_if_needed,emergency_procedures_reviewed,
    crew_communications_confirmed,final_rpic_approval,checklist_states,notes,status,
    rpic_personnel_id,approved_by_user_id,approved_at,approval_stale,updated_at
  ) values (
    target_job.id,target_job.organization_id,auth.uid(),states->>'aircraft_selected'='confirmed',states->>'battery_condition_checked'='confirmed',states->>'propellers_inspected'='confirmed',
    states->>'firmware_app_status_checked'='confirmed',states->>'gps_signal_confirmed'='confirmed',states->>'home_point_verified'='confirmed',states->>'storage_media_checked'='confirmed',
    states->>'weather_verified'='confirmed',states->>'wind_conditions_acceptable'='confirmed',states->>'airspace_reviewed'='confirmed',states->>'laanc_confirmed_if_required'='confirmed',
    states->>'notam_tfr_checked'='confirmed',states->>'visual_observer_assigned_if_needed'='confirmed',states->>'emergency_procedures_reviewed'='confirmed',
    states->>'crew_communications_confirmed'='confirmed',states->>'final_rpic_approval'='confirmed',states,nullif(trim(checklist_notes),''),requested_status,
    case when completing then assigned_rpic.id else null end, case when completing then auth.uid() else null end,
    case when completing then now() else null end,false,now()
  ) on conflict(job_id) do update set
    user_id=auth.uid(),aircraft_selected=excluded.aircraft_selected,battery_condition_checked=excluded.battery_condition_checked,
    propellers_inspected=excluded.propellers_inspected,firmware_app_status_checked=excluded.firmware_app_status_checked,
    gps_signal_confirmed=excluded.gps_signal_confirmed,home_point_verified=excluded.home_point_verified,
    storage_media_checked=excluded.storage_media_checked,weather_verified=excluded.weather_verified,
    wind_conditions_acceptable=excluded.wind_conditions_acceptable,airspace_reviewed=excluded.airspace_reviewed,
    laanc_confirmed_if_required=excluded.laanc_confirmed_if_required,notam_tfr_checked=excluded.notam_tfr_checked,
    visual_observer_assigned_if_needed=excluded.visual_observer_assigned_if_needed,
    emergency_procedures_reviewed=excluded.emergency_procedures_reviewed,
    crew_communications_confirmed=excluded.crew_communications_confirmed,final_rpic_approval=excluded.final_rpic_approval,
    checklist_states=excluded.checklist_states,notes=excluded.notes,status=excluded.status,
    rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,
    approved_at=excluded.approved_at,approval_stale=false,updated_at=now()
  returning * into result;
  return result;
end
$$;

revoke insert, update, delete on public.preflight_checklists from authenticated;
revoke all on function public.save_preflight_checklist(uuid,jsonb,text,text) from public, anon;
grant execute on function public.save_preflight_checklist(uuid,jsonb,text,text) to authenticated;

-- A closeout may only be written by the transaction that also creates its assurance revision.
revoke insert, update, delete on public.job_operation_closeouts from authenticated;

create or replace function public.guard_moc_workflow_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') and (
    new.status is distinct from old.status or new.safety_review_decision is distinct from old.safety_review_decision or
    new.safety_reviewer_id is distinct from old.safety_reviewer_id or new.safety_reviewed_at is distinct from old.safety_reviewed_at or
    new.operational_accepted_by is distinct from old.operational_accepted_by or new.operational_acceptance_role is distinct from old.operational_acceptance_role or
    new.operational_accepted_at is distinct from old.operational_accepted_at or new.approved_at is distinct from old.approved_at or
    new.completed_at is distinct from old.completed_at or new.cancelled_at is distinct from old.cancelled_at
  ) then raise exception 'MOC workflow fields must be changed through an authorized transition.'; end if;
  return new;
end
$$;

drop trigger if exists a_guard_moc_workflow_fields on public.management_of_change;
create trigger a_guard_moc_workflow_fields
before update on public.management_of_change
for each row execute function public.guard_moc_workflow_fields();

revoke delete on public.management_of_change from authenticated;

create or replace function public.transition_management_of_change(
  target_moc_id uuid, requested_status text, transition_note text default null
)
returns public.management_of_change
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result public.management_of_change;
begin
  select * into result from public.management_of_change
  where id=target_moc_id and organization_id=public.current_user_organization_id() for update;
  if result.id is null or not public.is_organization_safety_manager(result.organization_id) then raise exception 'Safety Manager access required.'; end if;
  if result.status in ('Complete','Cancelled') then raise exception 'This MOC is locked.'; end if;
  if requested_status = 'Actions Required' then
    update public.management_of_change set status='Actions Required', safety_review_decision='Returned for changes',
      safety_reviewer_id=auth.uid(), safety_reviewed_at=now(), safety_review_comments=coalesce(nullif(trim(transition_note),''),safety_review_comments), updated_at=now()
      where id=result.id returning * into result;
  elsif requested_status = 'Cancelled' then
    update public.management_of_change set status='Cancelled', cancelled_at=now(), updated_at=now()
      where id=result.id returning * into result;
  elsif requested_status = 'Monitoring' and result.status = 'Approved for Operational Use' then
    update public.management_of_change set status='Monitoring', updated_at=now()
      where id=result.id returning * into result;
  elsif requested_status = 'Complete' and result.status in ('Approved for Operational Use','Monitoring') then
    if exists(select 1 from public.management_of_change_actions where moc_id=result.id and status not in ('Complete','Cancelled')) then
      raise exception 'Complete or cancel every action before closing this MOC.';
    end if;
    update public.management_of_change set status='Complete', completed_at=now(), updated_at=now()
      where id=result.id returning * into result;
  else raise exception 'Invalid MOC transition from % to %.', result.status, requested_status;
  end if;
  return result;
end
$$;

revoke all on function public.transition_management_of_change(uuid,text,text) from public, anon;
grant execute on function public.transition_management_of_change(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ready-to-operate combines every protected approval in one server decision.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_job_ready_to_operate(target_job_id uuid, fitness_confirmed boolean)
returns public.job_operation_readiness
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare target_job public.jobs; jha public.jha_assessments; preflight public.preflight_checklists; assigned_rpic public.personnel; result public.job_operation_readiness;
begin
  select * into target_job from public.jobs where id=target_job_id and organization_id=public.current_user_organization_id();
  if target_job.id is null then raise exception 'Job not found in your organization.'; end if;
  select p.* into assigned_rpic from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id and p.organization_id=jp.organization_id
    where jp.job_id=target_job_id and jp.assigned_role='RPIC' and p.status='Active';
  if assigned_rpic.id is null then raise exception 'Assign an active RPIC before recording readiness.'; end if;
  if assigned_rpic.user_id is distinct from auth.uid() then raise exception 'Only the verified assigned RPIC can record Ready to Operate.'; end if;
  if not fitness_confirmed then
    insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason)
    values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),false,null,false,null,null)
    on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,
      fitness_for_duty_confirmed=false,approved_at=null,approval_stale=false,stale_at=null,stale_reason=null,updated_at=now()
    returning * into result; return result;
  end if;
  select * into jha from public.jha_assessments where job_id=target_job_id;
  if jha.id is null or jha.status<>'Complete' then raise exception 'Complete the JHA before Ready to Operate.'; end if;
  if jha.safety_manager_reviewed_at is null or jha.safety_manager_review_stale then raise exception 'Current Safety Manager Review is required.'; end if;
  if jha.rpic_accepted_at is null or jha.rpic_acceptance_stale or jha.rpic_personnel_id<>assigned_rpic.id or jha.rpic_user_id<>auth.uid() then raise exception 'Current acceptance by the assigned RPIC is required.'; end if;
  if not jha.controls_in_place then raise exception 'Confirm required controls are in place.'; end if;
  if jha.permit_authorization_required is true and jha.permit_authorization_status is distinct from 'Approved' then raise exception 'Required public right-of-way permit or authorization must be Approved.'; end if;
  select * into preflight from public.preflight_checklists where job_id=target_job_id;
  if preflight.id is null or preflight.status<>'Complete' or not public.preflight_states_allow_completion(preflight.checklist_states)
     or preflight.rpic_personnel_id<>assigned_rpic.id or preflight.approved_by_user_id<>auth.uid() or preflight.approved_at is null or preflight.approval_stale then
    raise exception 'Current final preflight approval by the assigned RPIC is required.';
  end if;
  if target_job.crew_acknowledgment_required_at is not null and exists(
    select 1 from public.job_personnel a join public.personnel p on p.id=a.personnel_id
    where a.job_id=target_job_id and a.assigned_role in ('Pilot','Visual Observer','Payload Operator','Ground Crew') and p.status<>'Inactive'
      and not exists(select 1 from public.crew_briefing_acknowledgments c where c.assignment_id=a.id and c.assigned_role=a.assigned_role and c.briefing_version=jha.briefing_version and c.status in ('Acknowledged','Manual Field Briefing'))
  ) then raise exception 'Every assigned non-RPIC operational crew member needs a current Crew Briefing acknowledgment or Manual Field Briefing.'; end if;
  insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason)
  values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),true,now(),false,null,null)
  on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,
    fitness_for_duty_confirmed=true,approved_at=now(),approval_stale=false,stale_at=null,stale_reason=null,updated_at=now()
  returning * into result; return result;
end
$$;

revoke all on function public.confirm_job_ready_to_operate(uuid,boolean) from public, anon;
grant execute on function public.confirm_job_ready_to_operate(uuid,boolean) to authenticated;

-- Public crew links use one-use hashed capability tokens. Invitations are
-- throttled per assignment to contain spam/cost abuse.
create or replace function public.create_crew_briefing_invitation(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare a public.job_personnel; p public.personnel; j public.jobs; h public.jha_assessments; r public.personnel; raw_token text; result public.crew_briefing_acknowledgments;
begin
  select * into a from public.job_personnel where id=p_assignment_id for update;
  select * into j from public.jobs where id=a.job_id and organization_id=public.current_user_organization_id();
  select * into r from public.crew_briefing_assigned_rpic(a.job_id);
  if j.id is null or r.id is null or r.user_id is distinct from auth.uid() then raise exception 'Only the verified assigned RPIC can send crew acknowledgments.'; end if;
  if exists(select 1 from public.crew_briefing_acknowledgments where assignment_id=a.id and invitation_created_at > now()-interval '2 minutes') then raise exception 'Please wait before sending another acknowledgment request.'; end if;
  if (select count(*) from public.crew_briefing_acknowledgments where assignment_id=a.id and invitation_created_at > now()-interval '24 hours') >= 5 then raise exception 'Daily acknowledgment request limit reached for this crew member.'; end if;
  if a.assigned_role not in ('Pilot','Visual Observer','Payload Operator','Ground Crew') then raise exception 'This assignment does not require crew acknowledgment.'; end if;
  select * into p from public.personnel where id=a.personnel_id and organization_id=j.organization_id;
  if p.email is null or p.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Add a usable email to this personnel record before sending.'; end if;
  select * into h from public.jha_assessments where job_id=j.id;
  if h.id is null then raise exception 'Save the Operational JHA before sending crew acknowledgments.'; end if;
  update public.crew_briefing_acknowledgments set status='Superseded',token_hash=null,updated_at=now()
    where assignment_id=a.id and briefing_version=h.briefing_version and status in ('Invited','Sent','Email Failed');
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.crew_briefing_acknowledgments(organization_id,job_id,personnel_id,assignment_id,assigned_role,email_used,briefing_version,token_hash,token_expires_at,invitation_created_at,acknowledgment_method,status,created_by_user_id)
  values(j.organization_id,j.id,p.id,a.id,a.assigned_role,lower(p.email),h.briefing_version,encode(extensions.digest(raw_token,'sha256'),'hex'),now()+interval '72 hours',now(),'Electronic','Invited',auth.uid()) returning * into result;
  update public.jobs set crew_acknowledgment_required_at=coalesce(crew_acknowledgment_required_at,now()) where id=j.id;
  return jsonb_build_object('invitation_id',result.id,'token',raw_token,'email',result.email_used,'job_name',j.name,'site',j.location,'role',a.assigned_role,'rpic_name',r.full_name);
end
$$;

revoke all on function public.create_crew_briefing_invitation(uuid) from public, anon;
grant execute on function public.create_crew_briefing_invitation(uuid) to authenticated;
grant execute on function public.get_public_crew_briefing(text) to anon, authenticated;
grant execute on function public.acknowledge_public_crew_briefing(text,text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deduplicated generated-document snapshots and recoverable storage cleanup
-- ---------------------------------------------------------------------------

create table if not exists public.generated_document_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  data_hash text not null,
  form_data jsonb not null,
  created_at timestamptz not null default now(),
  last_referenced_at timestamptz not null default now(),
  unique(organization_id, record_type, record_id, data_hash)
);
alter table public.generated_document_snapshots enable row level security;
create policy "Members view generated document snapshots"
  on public.generated_document_snapshots for select to authenticated
  using (public.is_organization_member(organization_id));
grant select on public.generated_document_snapshots to authenticated;

alter table public.generated_documents
  add column if not exists snapshot_id uuid references public.generated_document_snapshots(id) on delete restrict;

insert into public.generated_document_snapshots(organization_id,record_type,record_id,data_hash,form_data)
select distinct on (organization_id,record_type,record_id,encode(extensions.digest(form_data::text,'sha256'),'hex'))
  organization_id,record_type,record_id,encode(extensions.digest(form_data::text,'sha256'),'hex'),form_data
from public.generated_documents where form_data <> '{}'::jsonb
on conflict(organization_id,record_type,record_id,data_hash) do nothing;

update public.generated_documents d set snapshot_id=s.id, form_data='{}'::jsonb
from public.generated_document_snapshots s
where d.snapshot_id is null and s.organization_id=d.organization_id and s.record_type=d.record_type and s.record_id=d.record_id
  and s.data_hash=encode(extensions.digest(d.form_data::text,'sha256'),'hex');

create or replace function public.attach_generated_document_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare snapshot_uuid uuid; snapshot_hash text;
begin
  if new.snapshot_id is null then
    snapshot_hash := encode(extensions.digest(coalesce(new.form_data,'{}'::jsonb)::text,'sha256'),'hex');
    insert into public.generated_document_snapshots(organization_id,record_type,record_id,data_hash,form_data)
    values(new.organization_id,new.record_type,new.record_id,snapshot_hash,coalesce(new.form_data,'{}'::jsonb))
    on conflict(organization_id,record_type,record_id,data_hash) do update set last_referenced_at=now()
    returning id into snapshot_uuid;
    new.snapshot_id := snapshot_uuid;
  end if;
  new.form_data := '{}'::jsonb;
  return new;
end
$$;

drop trigger if exists attach_generated_document_snapshot on public.generated_documents;
create trigger attach_generated_document_snapshot
before insert on public.generated_documents
for each row execute function public.attach_generated_document_snapshot();

create table if not exists public.storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_path text not null,
  reason text not null,
  delete_after timestamptz not null,
  status text not null default 'pending' check(status in ('pending','processing','deleted','failed','cancelled')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(bucket_id, object_path, status)
);
alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from authenticated, anon;
create index if not exists storage_cleanup_queue_due_idx on public.storage_cleanup_queue(delete_after) where status in ('pending','failed');

create or replace function public.claim_storage_cleanup_batch(p_batch_limit integer default 100)
returns table(id uuid,bucket_id text,object_path text,attempts integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service-role access is required.'; end if;
  return query
    with due as (
      select q.id from public.storage_cleanup_queue q
      where q.status in ('pending','failed') and q.delete_after<=now() and q.attempts<5
      order by q.delete_after
      for update skip locked
      limit greatest(1,least(coalesce(p_batch_limit,100),100))
    )
    update public.storage_cleanup_queue q
    set status='processing',attempts=q.attempts+1,last_error=null
    from due where q.id=due.id
    returning q.id,q.bucket_id,q.object_path,q.attempts;
end
$$;
revoke all on function public.claim_storage_cleanup_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_storage_cleanup_batch(integer) to service_role;

-- Storage enforces the same byte and media allowlists as the client. File
-- signature validation still runs before upload; production malware scanning is
-- an operational integration described in the deployment runbook.
update storage.buckets set file_size_limit=5242880,
  allowed_mime_types=array['image/png','image/jpeg','image/webp']
where id='organization-logos';
update storage.buckets set file_size_limit=12582912,
  allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='job-evidence-photos';
update storage.buckets set file_size_limit=20971520,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp']
where id='equipment-reference-documents';

create table if not exists public.artifact_retention_policies (
  artifact_class text primary key,
  active_retention_days integer check(active_retention_days is null or active_retention_days > 0),
  recovery_grace_days integer not null check(recovery_grace_days >= 0),
  disposition text not null check(disposition in ('retain','archive','purge')),
  rationale text not null,
  updated_at timestamptz not null default now()
);
insert into public.artifact_retention_policies(artifact_class,active_retention_days,recovery_grace_days,disposition,rationale) values
  ('organization_logo',null,7,'purge','Retain the current logo; purge replaced versions after recovery grace.'),
  ('equipment_reference',null,7,'purge','Retain while referenced; purge after the equipment or metadata is removed.'),
  ('hazard_evidence',2555,30,'archive','Seven-year default safety-evidence retention; legal holds override automated disposition.'),
  ('generated_document_event',2555,0,'archive','Retain generation metadata and immutable snapshots without duplicate PDF bytes.')
on conflict(artifact_class) do nothing;
alter table public.artifact_retention_policies enable row level security;
revoke all on public.artifact_retention_policies from authenticated, anon;
grant select on public.artifact_retention_policies to authenticated;
create policy "Members view retention policies" on public.artifact_retention_policies
for select to authenticated using (public.current_user_organization_id() is not null);

create or replace function public.enqueue_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name='equipment_reference_documents' and tg_op='DELETE' then
    insert into public.storage_cleanup_queue(bucket_id,object_path,reason,delete_after)
    values('equipment-reference-documents',old.storage_path,'Reference metadata deleted',now()+interval '7 days') on conflict do nothing;
    return old;
  elsif tg_table_name='job_hazard_photos' and tg_op='UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    insert into public.storage_cleanup_queue(bucket_id,object_path,reason,delete_after)
    values('job-evidence-photos',new.photo_url,'Hazard evidence retention elapsed',now()+interval '2585 days') on conflict do nothing;
    if new.thumbnail_url is not null then
      insert into public.storage_cleanup_queue(bucket_id,object_path,reason,delete_after)
      values('job-evidence-photos',new.thumbnail_url,'Hazard thumbnail retention elapsed',now()+interval '2585 days') on conflict do nothing;
    end if;
    return new;
  elsif tg_table_name='organizations' and tg_op='UPDATE' and old.logo_path is not null and old.logo_path is distinct from new.logo_path then
    insert into public.storage_cleanup_queue(bucket_id,object_path,reason,delete_after)
    values('organization-logos',old.logo_path,'Organization logo replaced',now()+interval '7 days') on conflict do nothing;
    return new;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists enqueue_equipment_reference_cleanup on public.equipment_reference_documents;
create trigger enqueue_equipment_reference_cleanup before delete on public.equipment_reference_documents
for each row execute function public.enqueue_storage_cleanup();
drop trigger if exists enqueue_hazard_photo_cleanup on public.job_hazard_photos;
create trigger enqueue_hazard_photo_cleanup after update of deleted_at on public.job_hazard_photos
for each row execute function public.enqueue_storage_cleanup();
drop trigger if exists enqueue_organization_logo_cleanup on public.organizations;
create trigger enqueue_organization_logo_cleanup after update of logo_path on public.organizations
for each row execute function public.enqueue_storage_cleanup();

-- Explicitly bounded/high-frequency access paths.
create index if not exists personnel_org_status_name_idx on public.personnel(organization_id,status,full_name);
create index if not exists equipment_org_status_name_idx on public.equipment(organization_id,status,name);
create index if not exists moc_org_created_idx on public.management_of_change(organization_id,created_at desc);

comment on table public.organization_memberships is 'Authoritative tenant membership and least-privilege role source. profiles.organization_id is only the selected membership mirror.';
comment on column public.personnel.user_id is 'Verified auth identity; nullable and writable only by the email-matched claim workflow.';
comment on table public.storage_cleanup_queue is 'Recoverable delayed cleanup queue processed by the privileged storage-cleanup Edge Function.';
