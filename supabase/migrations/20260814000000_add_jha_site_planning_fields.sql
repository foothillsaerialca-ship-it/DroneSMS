-- File purpose: Adds JHA site-planning, emergency-facility, surface, and environmental workflow fields.
-- Fallback/error behavior: IF NOT EXISTS preserves existing columns; incompatible existing types or insufficient privileges stop the migration.
-- Known issues: reviewed statically but not applied to a disposable Supabase instance during the 2026-08-25 audit.
alter table public.jha_assessments
  add column if not exists nearby_airport_heliport text,
  add column if not exists emergency_facility_address text;

comment on column public.jha_assessments.nearby_airport_heliport is
  'Manual or Smart Site-populated nearby airport or heliport name or identifier.';

comment on column public.jha_assessments.emergency_facility_address is
  'Manual or Smart Site-populated address for the nearest emergency facility.';
