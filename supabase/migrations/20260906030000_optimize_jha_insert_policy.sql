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
