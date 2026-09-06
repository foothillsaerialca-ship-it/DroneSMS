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
