-- Purpose: Adds platform admin accounts (trusted DroneSMS staff) and app-wide settings
-- that admins manage from inside the app instead of editing Supabase directly.
--
-- How access works:
--   * platform_admins lists the trusted accounts. Browser roles have no table access;
--     membership is read through is_platform_admin() and changed only through the
--     admin RPCs below, which check is_platform_admin() first.
--   * app_settings holds non-sensitive app-wide switches (e.g. the beta welcome
--     banner). Anyone can read them, because signed-out pages need them too; only
--     set_app_setting() can change them. Never store secrets here.
--   * platform_admin_audit records every admin change. Admins can read it.
--
-- Bootstrap: the first admin must be added once with the SQL editor, recording the
-- grant in the audit log like every later one, e.g.
--   with granted as (
--     insert into public.platform_admins (user_id, note)
--     select id, 'Initial admin' from auth.users where lower(email) = lower('you@example.com')
--     on conflict (user_id) do nothing
--     returning user_id
--   )
--   insert into public.platform_admin_audit (action, actor_email, target_user_id, target_email)
--   select 'Granted admin', 'SQL editor (initial setup)', g.user_id, u.email
--   from granted g join auth.users u on u.id = g.user_id;
-- After that, admins add and remove each other from the Admin page.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  note text
);

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;

create table if not exists public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on table public.app_settings from public, anon, authenticated;
grant select on table public.app_settings to anon, authenticated;

drop policy if exists "App settings are readable by everyone" on public.app_settings;
create policy "App settings are readable by everyone"
  on public.app_settings for select to anon, authenticated
  using (true);

insert into public.app_settings (key, value)
values ('beta_welcome_enabled', 'true'::jsonb)
on conflict (key) do nothing;

create table if not exists public.platform_admin_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('Granted admin', 'Revoked admin', 'Changed setting')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  setting_key text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_audit_created_at_idx on public.platform_admin_audit (created_at desc);

alter table public.platform_admin_audit enable row level security;
revoke all on table public.platform_admin_audit from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin check shared by every admin policy and RPC.
-- ---------------------------------------------------------------------
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

grant select on table public.platform_admin_audit to authenticated;
drop policy if exists "Platform admins can read the admin audit log" on public.platform_admin_audit;
create policy "Platform admins can read the admin audit log"
  on public.platform_admin_audit for select to authenticated
  using ((select public.is_platform_admin()));

-- ---------------------------------------------------------------------
-- Admin RPCs. Each refuses non-admins before doing anything.
-- ---------------------------------------------------------------------
create or replace function public.list_platform_admins()
returns table (user_id uuid, email text, granted_at timestamptz, granted_by_email text, note text)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_platform_admin() then raise exception 'Only platform admins can do this.'; end if;
  return query
    select pa.user_id, u.email::text, pa.granted_at, g.email::text, pa.note
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
    left join auth.users g on g.id = pa.granted_by
    order by pa.granted_at;
end $$;

create or replace function public.grant_platform_admin(target_email text, grant_note text default null)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  target_id uuid;
  target_address text;
begin
  if not public.is_platform_admin() then raise exception 'Only platform admins can do this.'; end if;

  select u.id, u.email into target_id, target_address
  from auth.users u where lower(u.email) = lower(btrim(target_email));
  if target_id is null then raise exception 'No DroneSMS account uses that email. They need to register first.'; end if;
  if exists (select 1 from public.platform_admins where user_id = target_id) then
    raise exception 'That account is already an admin.';
  end if;

  insert into public.platform_admins (user_id, granted_by, note)
  values (target_id, auth.uid(), nullif(btrim(grant_note), ''));

  insert into public.platform_admin_audit (action, actor_user_id, actor_email, target_user_id, target_email)
  values ('Granted admin', auth.uid(), (select email from auth.users where id = auth.uid()), target_id, target_address);

  return target_id;
end $$;

create or replace function public.revoke_platform_admin(target_user_id uuid)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_platform_admin() then raise exception 'Only platform admins can do this.'; end if;

  -- Serialize concurrent revokes so two admins cannot remove each other at once.
  lock table public.platform_admins in share row exclusive mode;

  if not exists (select 1 from public.platform_admins where user_id = target_user_id) then
    raise exception 'That account is not an admin.';
  end if;
  if (select count(*) from public.platform_admins) <= 1 then
    raise exception 'You cannot remove the last admin.';
  end if;

  delete from public.platform_admins where user_id = target_user_id;

  insert into public.platform_admin_audit (action, actor_user_id, actor_email, target_user_id, target_email)
  values ('Revoked admin', auth.uid(), (select email from auth.users where id = auth.uid()),
          target_user_id, (select email from auth.users where id = target_user_id));
end $$;

create or replace function public.set_app_setting(setting_key text, setting_value jsonb)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  previous jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Only platform admins can do this.'; end if;
  if setting_value is null then raise exception 'A setting value is required.'; end if;

  select value into previous from public.app_settings where key = setting_key for update;

  insert into public.app_settings (key, value, updated_by, updated_at)
  values (setting_key, setting_value, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into public.platform_admin_audit (action, actor_user_id, actor_email, setting_key, old_value, new_value)
  values ('Changed setting', auth.uid(), (select email from auth.users where id = auth.uid()), setting_key, previous, setting_value);
end $$;

revoke all on function public.list_platform_admins() from public, anon;
grant execute on function public.list_platform_admins() to authenticated;
revoke all on function public.grant_platform_admin(text, text) from public, anon;
grant execute on function public.grant_platform_admin(text, text) to authenticated;
revoke all on function public.revoke_platform_admin(uuid) from public, anon;
grant execute on function public.revoke_platform_admin(uuid) to authenticated;
revoke all on function public.set_app_setting(text, jsonb) from public, anon;
grant execute on function public.set_app_setting(text, jsonb) to authenticated;
