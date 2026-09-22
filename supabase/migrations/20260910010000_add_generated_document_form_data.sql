-- Store the source form values for each generated document as compact JSONB.
-- PDF bytes are downloaded locally; this table stores searchable/auditable form provenance.
alter table public.generated_documents
  add column if not exists form_data jsonb not null default '{}'::jsonb;

comment on column public.generated_documents.form_data is
  'Compact immutable snapshot of the input fields and selected values used to generate this document. Empty values are omitted; generation metadata remains in generated_by_user_id and generated_at.';
