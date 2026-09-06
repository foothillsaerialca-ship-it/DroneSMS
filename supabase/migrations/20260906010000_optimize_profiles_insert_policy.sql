-- Evaluate auth.uid() once per statement instead of once per profiles row.
drop policy if exists "Users can create their profile" on public.profiles;

create policy "Users can create their profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));
