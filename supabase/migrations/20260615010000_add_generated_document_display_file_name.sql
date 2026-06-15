alter table public.generated_documents
  add column if not exists display_file_name text;

comment on column public.generated_documents.display_file_name is 'User-facing filename for generated document display and downloads. The file_name column remains the unique internal storage object filename.';
