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
