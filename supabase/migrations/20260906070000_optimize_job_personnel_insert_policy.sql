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
