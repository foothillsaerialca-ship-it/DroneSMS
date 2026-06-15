alter table public.generated_documents
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists generated_documents_archived_at_idx
  on public.generated_documents(archived_at);

drop policy if exists "Users can archive organization generated documents" on public.generated_documents;
create policy "Users can archive organization generated documents"
  on public.generated_documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  )
  with check (
    archived_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = generated_documents.organization_id
    )
  );

grant update on public.generated_documents to authenticated;

comment on column public.generated_documents.archived_at is 'Timestamp when a generated document was hidden from default document lists without deleting the audit row or storage object.';
comment on column public.generated_documents.archived_by_user_id is 'User who hid the generated document from default document lists.';
