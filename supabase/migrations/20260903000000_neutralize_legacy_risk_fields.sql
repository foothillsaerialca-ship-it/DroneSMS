-- DroneSMS now documents hazards and controls without assigning scored or
-- classified operational risk. Preserve historical values for compatibility,
-- but ensure newly inserted JHAs cannot acquire a classification by default.
alter table public.jha_assessments
  alter column overall_risk_rating drop default,
  alter column overall_risk_rating drop not null;

comment on column public.jha_assessments.overall_risk_rating is
  'Legacy-only historical value. New JHAs do not populate or use this field for completion, attestations, readiness, or exports.';

-- These scalar proposal fields predate hazard_assessment. They remain nullable
-- so historical proposals and mixed-version environments remain readable. The
-- current proposal form, conversion, and PDF paths do not read or write them.
comment on column public.proposals.risk is
  'Legacy-only historical proposal value. New proposals do not populate or display this field.';
