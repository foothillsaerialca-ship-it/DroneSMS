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
