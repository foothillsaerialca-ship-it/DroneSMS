alter table public.proposals
  add column if not exists relevant_airport_heliport text,
  add column if not exists known_airspace_restrictions text;

comment on column public.proposals.relevant_airport_heliport is
  'Airport or heliport relevant to preliminary proposal-stage airspace due diligence.';
comment on column public.proposals.known_airspace_restrictions is
  'Known restrictions and TFR considerations identified during preliminary proposal-stage review.';

alter table public.jha_assessments
  add column if not exists relevant_airport_heliport text,
  add column if not exists known_airspace_restrictions text,
  add column if not exists additional_authorization_required text;

comment on column public.jha_assessments.relevant_airport_heliport is
  'Final editable operational airport or heliport information. The legacy nearby_airport_heliport column is read only as a compatibility fallback.';
comment on column public.jha_assessments.known_airspace_restrictions is
  'Final editable operational restrictions and TFR considerations.';
comment on column public.jha_assessments.additional_authorization_required is
  'Final operational determination of whether authorization beyond LAANC is required.';
