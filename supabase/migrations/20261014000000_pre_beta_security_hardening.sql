-- Pre-beta hardening: organization membership, ownership, safety attestation,
-- generated-document upload, crew email rate limit, logo MIME, and grant cleanup.
-- Test on a Supabase branch or a copy of production before applying.
--
-- How the guards work: direct browser writes through the API run as the
-- database role "authenticated" (or "anon"). The app's SECURITY DEFINER
-- functions (JHA review/acceptance, MOC approval, readiness, crew briefing)
-- run as their owner ("postgres"). Each guard below only restricts the
-- browser roles, so the official server functions keep working unchanged.


-- =====================================================================
-- 1. C1 - Users must not be able to join another organization
-- =====================================================================
-- A browser write may set profiles.organization_id only to NULL or to an
-- organization the caller owns. This keeps the existing onboarding and
-- auth-provider recovery flows working (both link the user's own org).
-- Future multi-user invites must go through a SECURITY DEFINER function.
create or replace function public.guard_profile_organization()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.id is distinct from auth.uid() then
    raise exception 'Profiles can only be written by their owner.';
  end if;
  if new.organization_id is not null
     and (tg_op = 'INSERT' or new.organization_id is distinct from old.organization_id)
     and not exists (
       select 1 from public.organizations o
       where o.id = new.organization_id and o.owner_user_id = auth.uid()
     ) then
    raise exception 'You cannot link your profile to an organization you do not own.';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_organization on public.profiles;
create trigger guard_profile_organization
  before insert or update on public.profiles
  for each row execute function public.guard_profile_organization();

-- =====================================================================
-- 2. H1 - Ownership cannot be changed from the browser
-- =====================================================================
create or replace function public.guard_organization_ownership()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.owner_user_id is distinct from old.owner_user_id or new.id is distinct from old.id) then
    raise exception 'Organization ownership cannot be changed here.';
  end if;
  return new;
end $$;

drop trigger if exists guard_organization_ownership on public.organizations;
create trigger guard_organization_ownership
  before update on public.organizations
  for each row execute function public.guard_organization_ownership();

-- =====================================================================
-- 3. H2 - Safety sign-offs can only be written by the server functions
-- =====================================================================
-- 3a. JHA attestation columns. The trigger name starts with "a0_" so it runs
-- BEFORE the existing stale-marking / briefing-version triggers (PostgreSQL
-- fires same-event triggers in name order) and only sees the browser's values.
create or replace function public.a0_guard_jha_attestations()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.safety_manager_personnel_id := null; new.safety_manager_user_id := null;
    new.safety_manager_name := null;         new.safety_manager_reviewed_at := null;
    new.safety_manager_review_stale := false; new.safety_manager_role_label := null;
    new.rpic_personnel_id := null;           new.rpic_user_id := null;
    new.rpic_name := null;                   new.rpic_accepted_at := null;
    new.rpic_acceptance_stale := false;      new.rpic_role_label := null;
    new.briefing_version := 1;
    return new;
  end if;
  if row(new.safety_manager_personnel_id, new.safety_manager_user_id, new.safety_manager_name,
         new.safety_manager_reviewed_at, new.safety_manager_review_stale, new.safety_manager_role_label,
         new.rpic_personnel_id, new.rpic_user_id, new.rpic_name, new.rpic_accepted_at,
         new.rpic_acceptance_stale, new.rpic_role_label, new.briefing_version)
     is distinct from
     row(old.safety_manager_personnel_id, old.safety_manager_user_id, old.safety_manager_name,
         old.safety_manager_reviewed_at, old.safety_manager_review_stale, old.safety_manager_role_label,
         old.rpic_personnel_id, old.rpic_user_id, old.rpic_name, old.rpic_accepted_at,
         old.rpic_acceptance_stale, old.rpic_role_label, old.briefing_version) then
    raise exception 'Safety Manager review and RPIC acceptance can only be recorded through the review and acceptance actions.';
  end if;
  return new;
end $$;

drop trigger if exists a0_guard_jha_attestations on public.jha_assessments;
create trigger a0_guard_jha_attestations
  before insert or update on public.jha_assessments
  for each row execute function public.a0_guard_jha_attestations();

-- 3b. Management of Change approval. The MOC page legitimately sets
-- 'Actions Required' / 'Returned for changes', 'Cancelled', and moves an
-- approved MOC to 'Monitoring' / 'Complete'. Approval itself must go through
-- approve_management_of_change(), which checks the required actions.
create or replace function public.guard_moc_approval()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.status = 'Approved for Operational Use' and old.status is distinct from 'Approved for Operational Use' then
    raise exception 'Use the approval action to approve a Management of Change.';
  end if;
  if new.status in ('Monitoring', 'Complete') and old.status not in ('Approved for Operational Use', 'Monitoring', 'Complete') then
    raise exception 'A Management of Change must be approved before monitoring or completion.';
  end if;
  if new.safety_review_decision = 'Accepted' and old.safety_review_decision is distinct from 'Accepted' then
    raise exception 'Use the approval action to accept a Management of Change.';
  end if;
  if row(new.approved_at, new.safety_reviewer_id, new.operational_accepted_by,
         new.operational_acceptance_role, new.operational_accepted_at)
     is distinct from
     row(old.approved_at, old.safety_reviewer_id, old.operational_accepted_by,
         old.operational_acceptance_role, old.operational_accepted_at) then
    raise exception 'Approval details can only be recorded by the approval action.';
  end if;
  return new;
end $$;

drop trigger if exists guard_moc_approval on public.management_of_change;
create trigger guard_moc_approval
  before update on public.management_of_change
  for each row execute function public.guard_moc_approval();

-- 3c. Generated documents: the browser may only archive.
create or replace function public.guard_generated_document_update()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user in ('authenticated', 'anon')
     and (to_jsonb(new) - 'archived_at' - 'archived_by_user_id')
         is distinct from (to_jsonb(old) - 'archived_at' - 'archived_by_user_id') then
    raise exception 'Generated documents can only be archived.';
  end if;
  return new;
end $$;

drop trigger if exists guard_generated_document_update on public.generated_documents;
create trigger guard_generated_document_update
  before update on public.generated_documents
  for each row execute function public.guard_generated_document_update();

-- =====================================================================
-- 4. H3 - personnel.user_id (the Safety Manager / RPIC identity link) is fixed
-- =====================================================================
-- The insert policy already forces user_id = the creator. This stops anyone
-- re-pointing an existing record at themselves. Longer term: add a separate
-- linked_user_id set only through a verified invite.
create or replace function public.guard_personnel_user_link()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user in ('authenticated', 'anon') and new.user_id is distinct from old.user_id then
    raise exception 'The user linked to a personnel record cannot be changed here.';
  end if;
  return new;
end $$;

drop trigger if exists guard_personnel_user_link on public.personnel;
create trigger guard_personnel_user_link
  before update on public.personnel
  for each row execute function public.guard_personnel_user_link();

-- Guard functions are trigger-only; nobody should call them through the API.
revoke all on function public.guard_profile_organization() from public, anon, authenticated;
revoke all on function public.guard_organization_ownership() from public, anon, authenticated;
revoke all on function public.a0_guard_jha_attestations() from public, anon, authenticated;
revoke all on function public.guard_moc_approval() from public, anon, authenticated;
revoke all on function public.guard_generated_document_update() from public, anon, authenticated;
revoke all on function public.guard_personnel_user_link() from public, anon, authenticated;

-- =====================================================================
-- 7. M1 - Generated-document uploads must belong to the uploader's org
-- =====================================================================
-- Matches the paths the app already uses: proposal/<proposal id>/<file>.pdf
-- and job/<job id>/<file>.pdf. No frontend change needed.
drop policy if exists "Users can upload generated document files" on storage.objects;
create policy "Users can upload generated document files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'generated-documents'
    and lower(right(name, 4)) = '.pdf'
    and (
      ((storage.foldername(name))[1] = 'proposal' and exists (
        select 1 from public.proposals p
        where p.id::text = (storage.foldername(name))[2]
          and p.organization_id = public.current_user_organization_id()))
      or
      ((storage.foldername(name))[1] = 'job' and exists (
        select 1 from public.jobs j
        where j.id::text = (storage.foldername(name))[2]
          and j.organization_id = public.current_user_organization_id()))
    )
  );

-- =====================================================================
-- 8. M2 - Rate-limit crew briefing emails (20 per hour, 100 per day per user)
-- =====================================================================
create or replace function public.limit_crew_briefing_invitations()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.acknowledgment_method = 'Electronic' and new.created_by_user_id is not null then
    if (select count(*) from public.crew_briefing_acknowledgments
        where created_by_user_id = new.created_by_user_id and acknowledgment_method = 'Electronic'
          and created_at > now() - interval '1 hour') >= 20
    or (select count(*) from public.crew_briefing_acknowledgments
        where created_by_user_id = new.created_by_user_id and acknowledgment_method = 'Electronic'
          and created_at > now() - interval '1 day') >= 100 then
      raise exception 'Too many crew briefing emails. Please try again later.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists limit_crew_briefing_invitations on public.crew_briefing_acknowledgments;
create trigger limit_crew_briefing_invitations
  before insert on public.crew_briefing_acknowledgments
  for each row execute function public.limit_crew_briefing_invitations();
revoke all on function public.limit_crew_briefing_invitations() from public, anon, authenticated;

-- =====================================================================
-- 10. M4 - Stop accepting SVG logos (existing files are not touched)
-- =====================================================================
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'organization-logos';

-- =====================================================================
-- 13. Defense in depth - remove table permissions nothing uses
-- =====================================================================
-- Signed-out visitors never read or write tables directly (their only access
-- is the two crew-briefing functions, which are not affected by this).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- DELETE grants on tables that have no delete policy (deletes are already
-- blocked by RLS; this is the second lock).
revoke delete on
  public.organizations, public.profiles, public.personnel, public.jha_assessments,
  public.preflight_checklists, public.job_operation_closeouts, public.job_operation_readiness,
  public.job_hazard_photos, public.generated_documents, public.crew_briefing_acknowledgments,
  public.organization_safety_designations, public.operational_capabilities,
  public.management_of_change, public.management_of_change_activity,
  public.hazard_library_reviews, public.hazard_library_review_actions
from authenticated;

-- Signed-out crew-briefing links remain intentionally available:
-- get_public_crew_briefing and acknowledge_public_crew_briefing keep their anon
-- EXECUTE grant (token possession is the authorization; tokens are hashed,
-- single-use, and expire after 7 days). The table-level anon revokes above do
-- not affect these SECURITY DEFINER functions.
