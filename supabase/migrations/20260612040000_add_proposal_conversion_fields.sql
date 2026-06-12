-- Track Proposal -> Job conversion without removing historical proposal records.
-- Proposals remain commercial records; jobs become the operational workspace.

alter table public.proposals
  add column if not exists converted_to_job boolean not null default false,
  add column if not exists converted_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists converted_at timestamptz;

create index if not exists proposals_converted_to_job_idx on public.proposals(converted_to_job);
create index if not exists proposals_converted_job_id_idx on public.proposals(converted_job_id);

comment on column public.proposals.converted_to_job is 'True when the proposal has been converted into an operational job record.';
comment on column public.proposals.converted_job_id is 'Operational job created from this proposal, if conversion completed.';
comment on column public.proposals.converted_at is 'Timestamp when the proposal was converted into a job.';
