-- Archive personnel and jobs instead of deleting them.
-- Personnel cannot be deleted: JHA attestations, safety representative designations, and crew
-- briefing acknowledgments reference them with ON DELETE RESTRICT, and the signed record must keep
-- showing who signed. Archiving hides a record from the roster and pickers while history keeps it.
-- Completed jobs are archived to keep the Jobs list short. Archived jobs stay readable and can be
-- restored. deleted_at remains the separate "removed from workspace" soft delete.
-- Both columns are written through the existing organization update policies; no new grants.

alter table public.personnel add column if not exists archived_at timestamptz;
alter table public.jobs add column if not exists archived_at timestamptz;

comment on column public.personnel.archived_at is
  'When set, the person is hidden from the roster and crew pickers. Historical records still reference them.';
comment on column public.jobs.archived_at is
  'When set, the job is moved to the Archived tab. Restoring clears it.';
