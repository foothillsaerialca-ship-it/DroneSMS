alter table public.jha_assessments
  add column if not exists nearby_airport_heliport text,
  add column if not exists emergency_facility_address text;

comment on column public.jha_assessments.nearby_airport_heliport is
  'Manual or Smart Site-populated nearby airport or heliport name or identifier.';

comment on column public.jha_assessments.emergency_facility_address is
  'Manual or Smart Site-populated address for the nearest emergency facility.';
