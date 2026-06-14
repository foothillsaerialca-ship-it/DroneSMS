alter table public.proposals
  add column if not exists proposal_equipment jsonb not null default '[]'::jsonb;

comment on column public.proposals.proposal_equipment is 'Selected proposal equipment assignment snapshots including equipment ID, display name, make/model, status, type, and proposal-specific purpose for PDF generation and future job packet workflows.';
