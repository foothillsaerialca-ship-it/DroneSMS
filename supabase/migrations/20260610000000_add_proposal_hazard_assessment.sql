alter table public.proposals
  add column if not exists hazard_assessment jsonb not null default '[]'::jsonb;

comment on column public.proposals.hazard_assessment is 'Selected preliminary hazards, editable mitigations, and proposal-specific notes from the reusable hazard library.';
