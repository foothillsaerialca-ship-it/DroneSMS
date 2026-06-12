insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-evidence-photos',
  'job-evidence-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.job_hazard_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  hazard_id text,
  hazard_name text not null,
  photo_url text not null,
  thumbnail_url text,
  caption text,
  include_in_packet boolean not null default true,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists job_hazard_photos_organization_id_idx on public.job_hazard_photos(organization_id);
create index if not exists job_hazard_photos_job_id_idx on public.job_hazard_photos(job_id);
create index if not exists job_hazard_photos_hazard_id_idx on public.job_hazard_photos(hazard_id);
create index if not exists job_hazard_photos_deleted_at_idx on public.job_hazard_photos(deleted_at);

alter table public.job_hazard_photos enable row level security;

drop policy if exists "Users can view organization hazard photos" on public.job_hazard_photos;
create policy "Users can view organization hazard photos"
  on public.job_hazard_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
  );

drop policy if exists "Users can create organization hazard photos" on public.job_hazard_photos;
create policy "Users can create organization hazard photos"
  on public.job_hazard_photos
  for insert
  to authenticated
  with check (
    (uploaded_by is null or uploaded_by = auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_hazard_photos.job_id
        and jobs.organization_id = job_hazard_photos.organization_id
    )
  );

drop policy if exists "Users can update organization hazard photos" on public.job_hazard_photos;
create policy "Users can update organization hazard photos"
  on public.job_hazard_photos
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = job_hazard_photos.organization_id
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_hazard_photos.job_id
        and jobs.organization_id = job_hazard_photos.organization_id
    )
  );

grant select, insert, update on public.job_hazard_photos to authenticated;

drop policy if exists "Users can view organization hazard photo files" on storage.objects;
create policy "Users can view organization hazard photo files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can upload organization hazard photo files" on storage.objects;
create policy "Users can upload organization hazard photo files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Users can update organization hazard photo files" on storage.objects;
create policy "Users can update organization hazard photo files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'job-evidence-photos'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id::text = (storage.foldername(name))[1]
    )
  );
