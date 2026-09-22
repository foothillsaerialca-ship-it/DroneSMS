-- Generated PDFs are now downloaded to the operator's device and are not retained in Supabase.
-- The generated_documents row remains as timestamped JSON form metadata and audit provenance.

alter table public.generated_documents
  alter column storage_path drop not null;

update public.generated_documents
set storage_path = null
where storage_path is not null;

drop policy if exists "Users can upload generated document files" on storage.objects;
drop policy if exists "Users can view organization generated document files" on storage.objects;

-- Existing Storage objects must be removed through the Storage API. Run
-- `npm run purge:generated-pdfs -- --confirm` once after applying this migration.

comment on column public.generated_documents.storage_path is
  'Always null for newly generated documents. Generated PDF bytes are downloaded locally and are not retained in Supabase; retained rows contain form_data JSONB metadata.';
