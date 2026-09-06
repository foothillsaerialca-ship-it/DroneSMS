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
