alter table public.equipment
  add column if not exists product_category text,
  add column if not exists typical_mix_ratio text,
  add column if not exists application_notes text,
  add column if not exists epa_registration_number text,
  add column if not exists signal_word text,
  add column if not exists restricted_use_product boolean;

create index if not exists equipment_product_category_idx on public.equipment(product_category);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipment-reference-documents', 'equipment-reference-documents', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.equipment_reference_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  display_file_name text,
  storage_path text not null unique,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  constraint equipment_reference_documents_type_check check (document_type in ('Safety Data Sheet (SDS)', 'Product Label', 'Technical Data Sheet (TDS)'))
);

create index if not exists equipment_reference_documents_organization_id_idx on public.equipment_reference_documents(organization_id);
create index if not exists equipment_reference_documents_equipment_id_idx on public.equipment_reference_documents(equipment_id);
create index if not exists equipment_reference_documents_document_type_idx on public.equipment_reference_documents(document_type);

alter table public.equipment_reference_documents enable row level security;

drop policy if exists "Users can view organization equipment reference documents" on public.equipment_reference_documents;
create policy "Users can view organization equipment reference documents"
  on public.equipment_reference_documents for select to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id = equipment_reference_documents.organization_id));

drop policy if exists "Users can create organization equipment reference documents" on public.equipment_reference_documents;
create policy "Users can create organization equipment reference documents"
  on public.equipment_reference_documents for insert to authenticated
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id = equipment_reference_documents.organization_id)
    and exists (select 1 from public.equipment where equipment.id = equipment_reference_documents.equipment_id and equipment.organization_id = equipment_reference_documents.organization_id and equipment.equipment_type = 'Chemical / Material')
  );

drop policy if exists "Users can delete organization equipment reference documents" on public.equipment_reference_documents;
create policy "Users can delete organization equipment reference documents"
  on public.equipment_reference_documents for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id = equipment_reference_documents.organization_id));

grant select, insert, delete on public.equipment_reference_documents to authenticated;

drop policy if exists "Users can view organization equipment reference document files" on storage.objects;
create policy "Users can view organization equipment reference document files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'equipment-reference-documents'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id::text = (storage.foldername(name))[1])
  );

drop policy if exists "Users can upload organization equipment reference document files" on storage.objects;
create policy "Users can upload organization equipment reference document files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'equipment-reference-documents'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id::text = (storage.foldername(name))[1])
  );

drop policy if exists "Users can delete organization equipment reference document files" on storage.objects;
create policy "Users can delete organization equipment reference document files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'equipment-reference-documents'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.organization_id::text = (storage.foldername(name))[1])
  );

comment on table public.equipment_reference_documents is 'Reusable SDS, product label, and technical data sheet PDFs attached to Chemical / Material equipment records.';
