-- Keep personnel roster reads consistent with membership-based personnel writes.
-- Legacy records directly bound to the signed-in user remain readable.
drop policy if exists "Users can view organization personnel" on public.personnel;
drop policy if exists "Members can view organization personnel" on public.personnel;

create policy "Members can view organization personnel"
  on public.personnel
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_organization_member(organization_id)
  );
