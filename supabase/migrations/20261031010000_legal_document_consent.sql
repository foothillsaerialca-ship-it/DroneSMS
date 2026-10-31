alter table public.profiles
  add column if not exists terms_of_service_accepted boolean not null default false,
  add column if not exists terms_of_service_accepted_at timestamptz,
  add column if not exists terms_of_service_accepted_version text,
  add column if not exists privacy_policy_accepted boolean not null default false,
  add column if not exists privacy_policy_accepted_at timestamptz,
  add column if not exists privacy_policy_accepted_version text;

alter table public.profiles
  drop constraint if exists profiles_terms_acceptance_consistent,
  drop constraint if exists profiles_privacy_acceptance_consistent;

alter table public.profiles
  add constraint profiles_terms_acceptance_consistent check (
    (terms_of_service_accepted and terms_of_service_accepted_at is not null and terms_of_service_accepted_version is not null)
    or (not terms_of_service_accepted and terms_of_service_accepted_at is null and terms_of_service_accepted_version is null)
  ),
  add constraint profiles_privacy_acceptance_consistent check (
    (privacy_policy_accepted and privacy_policy_accepted_at is not null and privacy_policy_accepted_version is not null)
    or (not privacy_policy_accepted and privacy_policy_accepted_at is null and privacy_policy_accepted_version is null)
  );

create table if not exists public.legal_document_versions (
  id smallint primary key default 1 check (id = 1),
  terms_of_service_version text not null,
  privacy_policy_version text not null,
  updated_at timestamptz not null default now()
);

alter table public.legal_document_versions enable row level security;
revoke all on public.legal_document_versions from public, anon, authenticated;
grant select on public.legal_document_versions to authenticated;

drop policy if exists "Authenticated users can view legal document versions" on public.legal_document_versions;
create policy "Authenticated users can view legal document versions"
  on public.legal_document_versions for select to authenticated using (true);

create or replace function public.reset_changed_legal_document_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.terms_of_service_version is distinct from old.terms_of_service_version then
    perform set_config('app.legal_consent_write', 'on', true);
    update public.profiles
    set terms_of_service_accepted = false,
        terms_of_service_accepted_at = null,
        terms_of_service_accepted_version = null,
        updated_at = now();
  end if;

  if new.privacy_policy_version is distinct from old.privacy_policy_version then
    perform set_config('app.legal_consent_write', 'on', true);
    update public.profiles
    set privacy_policy_accepted = false,
        privacy_policy_accepted_at = null,
        privacy_policy_accepted_version = null,
        updated_at = now();
  end if;

  return new;
end
$$;

drop trigger if exists reset_changed_legal_document_acceptance on public.legal_document_versions;
create trigger reset_changed_legal_document_acceptance
  before update on public.legal_document_versions
  for each row execute function public.reset_changed_legal_document_acceptance();
revoke all on function public.reset_changed_legal_document_acceptance() from public, anon, authenticated;

create or replace function public.guard_profile_legal_acceptance()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_setting('app.legal_consent_write', true) = 'on' then return new; end if;

  if tg_op = 'INSERT' and (
    new.terms_of_service_accepted
    or new.terms_of_service_accepted_at is not null
    or new.terms_of_service_accepted_version is not null
    or new.privacy_policy_accepted
    or new.privacy_policy_accepted_at is not null
    or new.privacy_policy_accepted_version is not null
  ) then
    raise exception 'Legal document acceptance must be recorded through the acceptance workflow.';
  end if;

  if tg_op = 'UPDATE' and (
    new.terms_of_service_accepted is distinct from old.terms_of_service_accepted
    or new.terms_of_service_accepted_at is distinct from old.terms_of_service_accepted_at
    or new.terms_of_service_accepted_version is distinct from old.terms_of_service_accepted_version
    or new.privacy_policy_accepted is distinct from old.privacy_policy_accepted
    or new.privacy_policy_accepted_at is distinct from old.privacy_policy_accepted_at
    or new.privacy_policy_accepted_version is distinct from old.privacy_policy_accepted_version
  ) then
    raise exception 'Legal document acceptance must be recorded through the acceptance workflow.';
  end if;

  return new;
end
$$;

drop trigger if exists guard_profile_legal_acceptance_insert on public.profiles;
create trigger guard_profile_legal_acceptance_insert
  before insert on public.profiles
  for each row execute function public.guard_profile_legal_acceptance();
drop trigger if exists guard_profile_legal_acceptance_update on public.profiles;
create trigger guard_profile_legal_acceptance_update
  before update on public.profiles
  for each row execute function public.guard_profile_legal_acceptance();
revoke all on function public.guard_profile_legal_acceptance() from public, anon, authenticated;

create or replace function public.get_legal_consent_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_versions public.legal_document_versions;
  current_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  select * into current_versions from public.legal_document_versions where id = 1;
  if not found then raise exception 'Current legal document versions are not configured.'; end if;

  select * into current_profile from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'terms_version', current_versions.terms_of_service_version,
    'privacy_version', current_versions.privacy_policy_version,
    'terms_accepted', coalesce(current_profile.terms_of_service_accepted, false)
      and current_profile.terms_of_service_accepted_version = current_versions.terms_of_service_version,
    'privacy_accepted', coalesce(current_profile.privacy_policy_accepted, false)
      and current_profile.privacy_policy_accepted_version = current_versions.privacy_policy_version,
    'terms_accepted_at', current_profile.terms_of_service_accepted_at,
    'privacy_accepted_at', current_profile.privacy_policy_accepted_at
  );
end
$$;

create or replace function public.accept_current_legal_documents(
  expected_terms_version text,
  expected_privacy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_versions public.legal_document_versions;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  select * into current_versions from public.legal_document_versions where id = 1 for share;
  if not found then raise exception 'Current legal document versions are not configured.'; end if;
  if expected_terms_version is distinct from current_versions.terms_of_service_version
    or expected_privacy_version is distinct from current_versions.privacy_policy_version then
    raise exception 'The legal documents changed during review. Reload and review the current versions.';
  end if;

  perform set_config('app.legal_consent_write', 'on', true);
  insert into public.profiles (id)
  values (auth.uid())
  on conflict (id) do nothing;

  update public.profiles
  set terms_of_service_accepted = true,
      terms_of_service_accepted_at = now(),
      terms_of_service_accepted_version = current_versions.terms_of_service_version,
      privacy_policy_accepted = true,
      privacy_policy_accepted_at = now(),
      privacy_policy_accepted_version = current_versions.privacy_policy_version,
      updated_at = now()
  where id = auth.uid();

  return public.get_legal_consent_status();
end
$$;

revoke all on function public.get_legal_consent_status() from public, anon;
revoke all on function public.accept_current_legal_documents(text, text) from public, anon;
grant execute on function public.get_legal_consent_status() to authenticated;
grant execute on function public.accept_current_legal_documents(text, text) to authenticated;

insert into public.legal_document_versions (id, terms_of_service_version, privacy_policy_version)
values (1, '2026-10-30-v1', '2026-10-30-v1')
on conflict (id) do nothing;
