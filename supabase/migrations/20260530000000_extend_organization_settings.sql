alter table public.organizations
  add column if not exists phone_number text,
  add column if not exists email_address text,
  add column if not exists physical_address text,
  add column if not exists primary_contact text,
  add column if not exists emergency_contact text,
  add column if not exists safety_manager text,
  add column if not exists stop_work_authority_statement text,
  add column if not exists hazard_reporting_statement text,
  add column if not exists emergency_procedures_summary text,
  add column if not exists logo_path text,
  add column if not exists logo_url text;

drop policy if exists "Owners can update their organizations" on public.organizations;
create policy "Owners can update their organizations"
  on public.organizations
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organizations.id
    )
  )
  with check (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organizations.id
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view organization logos" on storage.objects;
create policy "Users can view organization logos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'organization-logos');

drop policy if exists "Users can upload organization logos" on storage.objects;
create policy "Users can upload organization logos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can update organization logos" on storage.objects;
create policy "Users can update organization logos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can delete organization logos" on storage.objects;
create policy "Users can delete organization logos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );
