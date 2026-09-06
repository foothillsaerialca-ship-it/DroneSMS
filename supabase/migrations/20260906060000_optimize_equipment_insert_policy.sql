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
