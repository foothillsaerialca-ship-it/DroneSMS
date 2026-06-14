-- Store editable client-facing scope deliverables and exclusions on proposals.
alter table public.proposals
  add column if not exists deliverables text,
  add column if not exists exclusions text;

comment on column public.proposals.deliverables is 'Editable proposal-level client deliverables used as the source of truth for Proposal PDF Scope of Work.';
comment on column public.proposals.exclusions is 'Editable proposal-level exclusions used as the source of truth for Proposal PDF Scope of Work.';
