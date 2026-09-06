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
