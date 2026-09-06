-- Store explicit tri-state decisions without changing the meaning of legacy booleans.
alter table public.preflight_checklists
  add column if not exists checklist_states jsonb not null default '{}'::jsonb;

-- A legacy true is positive confirmation. A legacy false remains absent/unresolved.
update public.preflight_checklists p
set checklist_states = (
  select coalesce(jsonb_object_agg(item.key, '"confirmed"'::jsonb), '{}'::jsonb)
  from (values
    ('aircraft_selected', p.aircraft_selected), ('battery_condition_checked', p.battery_condition_checked),
    ('propellers_inspected', p.propellers_inspected), ('firmware_app_status_checked', p.firmware_app_status_checked),
    ('gps_signal_confirmed', p.gps_signal_confirmed), ('home_point_verified', p.home_point_verified),
    ('storage_media_checked', p.storage_media_checked), ('weather_verified', p.weather_verified),
    ('wind_conditions_acceptable', p.wind_conditions_acceptable), ('airspace_reviewed', p.airspace_reviewed),
    ('laanc_confirmed_if_required', p.laanc_confirmed_if_required), ('notam_tfr_checked', p.notam_tfr_checked),
    ('visual_observer_assigned_if_needed', p.visual_observer_assigned_if_needed),
    ('emergency_procedures_reviewed', p.emergency_procedures_reviewed),
    ('crew_communications_confirmed', p.crew_communications_confirmed), ('final_rpic_approval', p.final_rpic_approval)
  ) as item(key, is_confirmed)
  where item.is_confirmed
)
where p.checklist_states = '{}'::jsonb;

create or replace function public.preflight_states_allow_completion(states jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(states->>'final_rpic_approval' = 'confirmed'
    and (select count(*) = 16 from jsonb_each_text(states) item
         where item.key = any (array[
           'aircraft_selected','battery_condition_checked','propellers_inspected','firmware_app_status_checked',
           'gps_signal_confirmed','home_point_verified','storage_media_checked','weather_verified',
           'wind_conditions_acceptable','airspace_reviewed','laanc_confirmed_if_required','notam_tfr_checked',
           'visual_observer_assigned_if_needed','emergency_procedures_reviewed','crew_communications_confirmed','final_rpic_approval'
         ]) and item.value in ('confirmed', 'not_applicable')), false);
$$;

-- Previously completed rows that do not satisfy the new rule become drafts. No
-- unchecked legacy value is guessed to be Not Applicable. Using the same helper
-- as the constraint avoids relying on an unsupported JSON object-size function.
update public.preflight_checklists
set status = 'Draft'
where status = 'Complete'
  and not public.preflight_states_allow_completion(checklist_states);

alter table public.preflight_checklists
  drop constraint if exists preflight_checklists_complete_states_check;

alter table public.preflight_checklists
  add constraint preflight_checklists_complete_states_check
  check (status <> 'Complete' or public.preflight_states_allow_completion(checklist_states));
