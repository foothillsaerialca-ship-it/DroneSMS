-- Consolidated script for the optimization and anonymous-access migrations.
-- Source migrations are included in timestamp order:
--   20260906000000_optimize_organizations_update_policy.sql
--   20260906010000_optimize_profiles_insert_policy.sql
--   20260906020000_optimize_jobs_insert_policy.sql
--   20260906030000_optimize_jha_insert_policy.sql
--   20260906040000_optimize_preflight_insert_policy.sql
--   20260906050000_optimize_personnel_insert_policy.sql
--   20260906060000_optimize_equipment_insert_policy.sql
--   20260906070000_optimize_job_personnel_insert_policy.sql
--   20260906080000_optimize_job_equipment_insert_policy.sql
--   20260906090000_revoke_anonymous_crew_briefing_acknowledgment.sql
--   20260906100000_revoke_anonymous_crew_briefing_lookup.sql

begin;

-- 20260906000000_optimize_organizations_update_policy.sql
-- Evaluate auth.uid() once per statement instead of once per organizations row.
drop policy if exists "Owners can update their organizations" on public.organizations;

create policy "Owners can update their organizations"
  on public.organizations
  for update
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = organizations.id
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = organizations.id
    )
  );

-- 20260906010000_optimize_profiles_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per profiles row.
drop policy if exists "Users can create their profile" on public.profiles;

create policy "Users can create their profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

-- 20260906020000_optimize_jobs_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per jobs row.
drop policy if exists "Users can create their organization jobs" on public.jobs;

create policy "Users can create their organization jobs"
  on public.jobs
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = jobs.organization_id
    )
  );

-- 20260906030000_optimize_jha_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per JHA row.
drop policy if exists "Users can create organization JHA assessments" on public.jha_assessments;

create policy "Users can create organization JHA assessments"
  on public.jha_assessments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = jha_assessments.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = jha_assessments.job_id
        and jobs.organization_id = jha_assessments.organization_id
    )
  );

-- 20260906040000_optimize_preflight_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per preflight row.
drop policy if exists "Users can create organization preflight checklists" on public.preflight_checklists;

create policy "Users can create organization preflight checklists"
  on public.preflight_checklists
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = preflight_checklists.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = preflight_checklists.job_id
        and jobs.organization_id = preflight_checklists.organization_id
    )
  );

-- 20260906050000_optimize_personnel_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per personnel row.
drop policy if exists "Users can create organization personnel" on public.personnel;

create policy "Users can create organization personnel"
  on public.personnel
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = personnel.organization_id
    )
  );

-- 20260906060000_optimize_equipment_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per equipment row.
drop policy if exists "Users can create organization equipment" on public.equipment;

create policy "Users can create organization equipment"
  on public.equipment
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = equipment.organization_id
    )
  );

-- 20260906070000_optimize_job_personnel_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per job-personnel row.
drop policy if exists "Users can create organization job personnel" on public.job_personnel;

create policy "Users can create organization job personnel"
  on public.job_personnel
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.organization_id = job_personnel.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_personnel.job_id
        and jobs.organization_id = job_personnel.organization_id
    )
    and exists (
      select 1
      from public.personnel
      where personnel.id = job_personnel.personnel_id
        and personnel.organization_id = job_personnel.organization_id
    )
  );

-- 20260906080000_optimize_job_equipment_insert_policy.sql
-- Evaluate auth.uid() once per statement instead of once per job-equipment row.
drop policy if exists "Users can create organization job equipment" on public.job_equipment;

create policy "Users can create organization job equipment"
  on public.job_equipment
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
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

-- 20260906090000_revoke_anonymous_crew_briefing_acknowledgment.sql
-- Anonymous callers must not execute this SECURITY DEFINER RPC.
revoke execute on function public.acknowledge_public_crew_briefing(text, text) from anon;

-- Preserve the authenticated workflow explicitly.
grant execute on function public.acknowledge_public_crew_briefing(text, text) to authenticated;

-- 20260906100000_revoke_anonymous_crew_briefing_lookup.sql
-- Crew briefing tokens are no longer sufficient for anonymous RPC execution.
-- Keep the lookup available to signed-in users while removing the anon role.
revoke execute on function public.get_public_crew_briefing(text) from anon;
grant execute on function public.get_public_crew_briefing(text) to authenticated;

commit;
