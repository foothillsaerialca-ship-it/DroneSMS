-- Planning-only personnel snapshots. Operational authorization remains in job_personnel.
alter table public.proposals
  add column if not exists proposal_personnel jsonb not null default '[]'::jsonb;

comment on column public.proposals.proposal_personnel is
  'Proposal-stage staffing snapshots (Personnel ID, name, proposed role, and informational qualification summary). Copied to eligible job_personnel roles on conversion; later job changes do not rewrite this history.';
