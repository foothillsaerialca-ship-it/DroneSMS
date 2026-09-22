-- Protect generated-document provenance and improve the high-frequency tenant queries.

-- Generated-document rows are immutable except for the existing archive action.
revoke update on public.generated_documents from authenticated;
grant update (archived_at, archived_by_user_id) on public.generated_documents to authenticated;

-- Partial/compound indexes keep active tenant lists and packet joins bounded by the useful predicates.
create index if not exists jobs_active_organization_schedule_idx
  on public.jobs(organization_id, planned_date, created_at desc)
  where deleted_at is null;

create index if not exists proposals_active_organization_created_idx
  on public.proposals(organization_id, created_at desc)
  where deleted_at is null;

create index if not exists generated_documents_active_record_generated_idx
  on public.generated_documents(record_type, record_id, generated_at desc)
  where archived_at is null;

create index if not exists job_personnel_job_created_idx
  on public.job_personnel(job_id, created_at);

create index if not exists job_equipment_job_created_idx
  on public.job_equipment(job_id, created_at);

create index if not exists job_hazard_photos_packet_job_created_idx
  on public.job_hazard_photos(job_id, created_at)
  where deleted_at is null and include_in_packet = true;
