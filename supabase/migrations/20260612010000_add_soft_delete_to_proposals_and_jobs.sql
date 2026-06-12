-- Add soft-delete markers for workspace visibility without destroying operational history.
-- Future Archive and Locked Record workflows can build on this nullable timestamp
-- without changing the underlying operational records.

alter table public.proposals
  add column if not exists deleted_at timestamptz;

alter table public.jobs
  add column if not exists deleted_at timestamptz;

create index if not exists proposals_deleted_at_idx on public.proposals(deleted_at);
create index if not exists jobs_deleted_at_idx on public.jobs(deleted_at);

-- Authenticated users keep update access through existing organization-scoped RLS policies;
-- no delete policy is added because workspace removal is implemented as a soft delete.
revoke delete on table public.proposals from authenticated;
revoke delete on table public.jobs from authenticated;

comment on column public.proposals.deleted_at is 'Soft-delete timestamp used to hide proposals from the active workspace while preserving records for future archive/locked-record workflows.';
comment on column public.jobs.deleted_at is 'Soft-delete timestamp used to hide jobs from the active workspace while preserving operational records for future archive/locked-record workflows.';
