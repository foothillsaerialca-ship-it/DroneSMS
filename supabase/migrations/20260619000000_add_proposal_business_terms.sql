alter table public.organizations
  add column if not exists is_licensed boolean not null default false,
  add column if not exists is_insured boolean not null default false,
  add column if not exists is_bonded boolean not null default false,
  add column if not exists default_payment_terms text,
  add column if not exists warranty text;

alter table public.proposals
  add column if not exists estimated_duration text,
  add column if not exists payment_terms text;

alter table public.equipment
  add column if not exists purpose text;
