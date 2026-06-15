insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-documents',
  'generated-documents',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  record_type text not null,
  record_id uuid not null,
  generated_by_user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  display_file_name text,
  storage_path text not null unique,
  file_size bigint,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint generated_documents_document_type_check check (
    document_type in (
      'proposal_pdf',
      'job_packet_pdf',
      'completion_report_pdf',
      'incident_report_pdf',
      'safety_export_pdf',
      'airspace_package_pdf',
      'preflight_packet_pdf',
      'jha_packet_pdf'
    )
  ),
  constraint generated_documents_record_type_check check (
    record_type in (
      'proposal',
      'job',
      'incident',
      'organization'
    )
  )
);

create index if not exists generated_documents_record_generated_at_idx
  on public.generated_documents(record_type, record_id, generated_at desc);
create index if not exists generated_documents_organization_generated_at_idx
  on public.generated_documents(organization_id, generated_at desc);
create index if not exists generated_documents_generated_by_user_id_idx
  on public.generated_documents(generated_by_user_id);
create index if not exists generated_documents_document_type_idx
  on public.generated_documents(document_type);

alter table public.generated_documents enable row level security;

drop policy if exists "Users can view organization generated documents" on public.generated_documents;
create policy "Users can view organization generated documents"
  on public.generated_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  );

drop policy if exists "Users can create organization generated documents" on public.generated_documents;
create policy "Users can create organization generated documents"
  on public.generated_documents
  for insert
  to authenticated
  with check (
    generated_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
    and (
      record_type <> 'proposal'
      or exists (
        select 1
        from public.proposals
        where proposals.id = generated_documents.record_id
          and proposals.organization_id = generated_documents.organization_id
      )
    )
    and (
      record_type <> 'job'
      or exists (
        select 1
        from public.jobs
        where jobs.id = generated_documents.record_id
          and jobs.organization_id = generated_documents.organization_id
      )
    )
  );

grant select, insert on public.generated_documents to authenticated;

drop policy if exists "Users can view organization generated document files" on storage.objects;
create policy "Users can view organization generated document files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'generated-documents'
    and exists (
      select 1
      from public.generated_documents
      join public.profiles on profiles.organization_id = generated_documents.organization_id
      where profiles.id = auth.uid()
        and generated_documents.storage_path = storage.objects.name
    )
  );

drop policy if exists "Users can upload generated document files" on storage.objects;
create policy "Users can upload generated document files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'generated-documents'
    and lower(right(name, 4)) = '.pdf'
    and (storage.foldername(name))[1] in ('proposal', 'job', 'incident', 'organization')
  );
