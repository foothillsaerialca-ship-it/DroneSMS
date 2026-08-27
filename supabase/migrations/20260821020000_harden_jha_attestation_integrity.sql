-- Phase 3B keeps the original attestation identity/timestamp as an audit record while
-- explicitly marking it stale when reviewed Operational JHA safety content changes.
alter table public.jha_assessments
  add column if not exists safety_manager_review_stale boolean not null default false,
  add column if not exists rpic_acceptance_stale boolean not null default false,
  add column if not exists safety_manager_role_label text,
  add column if not exists rpic_role_label text;

comment on column public.jha_assessments.safety_manager_review_stale is
  'True when material JHA content changed after the recorded Safety Manager Review.';
comment on column public.jha_assessments.rpic_acceptance_stale is
  'True when material JHA content changed after the recorded RPIC Acceptance.';

create or replace function public.invalidate_operational_jha_attestations_on_material_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if row(
    new.weather_conditions, new.faa_airspace_class, new.surface_type, new.building_height,
    new.site_access, new.wind_speed, new.weather, new.visibility, new.public_presence,
    new.exclusion_zone_planned, new.exclusion_zone_description, new.runoff_risk,
    new.chemical_type, new.containment_plan, new.regulatory_citations,
    new.water_body_proximity, new.water_body_distance, new.water_body_type,
    new.secondary_containment_in_place, new.reclamation_method,
    new.reclamation_volume_estimate, new.disposal_vendor_name_contact,
    new.laanc_required, new.relevant_airport_heliport, new.known_airspace_restrictions,
    new.additional_authorization_required, new.hazard_entries, new.ppe_requirements,
    new.nearest_hospital, new.emergency_facility_address, new.emergency_contact,
    new.drone_incident_procedure, new.crew_briefed, new.controls_in_place
  ) is distinct from row(
    old.weather_conditions, old.faa_airspace_class, old.surface_type, old.building_height,
    old.site_access, old.wind_speed, old.weather, old.visibility, old.public_presence,
    old.exclusion_zone_planned, old.exclusion_zone_description, old.runoff_risk,
    old.chemical_type, old.containment_plan, old.regulatory_citations,
    old.water_body_proximity, old.water_body_distance, old.water_body_type,
    old.secondary_containment_in_place, old.reclamation_method,
    old.reclamation_volume_estimate, old.disposal_vendor_name_contact,
    old.laanc_required, old.relevant_airport_heliport, old.known_airspace_restrictions,
    old.additional_authorization_required, old.hazard_entries, old.ppe_requirements,
    old.nearest_hospital, old.emergency_facility_address, old.emergency_contact,
    old.drone_incident_procedure, old.crew_briefed, old.controls_in_place
  ) then
    new.safety_manager_review_stale := old.safety_manager_reviewed_at is not null;
    new.rpic_acceptance_stale := old.rpic_accepted_at is not null;
    if new.safety_manager_review_stale or new.rpic_acceptance_stale then
      new.status := 'Draft';
      new.certified_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invalidate_operational_jha_attestations_on_material_change on public.jha_assessments;
create trigger invalidate_operational_jha_attestations_on_material_change
before update on public.jha_assessments
for each row execute function public.invalidate_operational_jha_attestations_on_material_change();

-- Re-attesting updates only the relevant role. The other role remains stale, including
-- when one person legitimately holds both roles.
create or replace function public.review_operational_jha_as_safety_manager(p_job_id uuid)
returns public.jha_assessments language plpgsql security definer set search_path = public as $$
declare reviewer public.personnel; result public.jha_assessments;
begin
  select p.* into reviewer from public.organization_safety_designations d
  join public.jobs j on j.organization_id = d.organization_id
  join public.personnel p on p.id = d.personnel_id and p.organization_id = d.organization_id
  where j.id = p_job_id and p.status = 'Active';
  if reviewer.id is null then raise exception 'Safety Manager not designated. Configure a Safety Manager in SMS.'; end if;
  if reviewer.user_id <> auth.uid() then raise exception 'Only the designated Safety Manager can complete this review.'; end if;
  update public.jha_assessments set safety_manager_personnel_id = reviewer.id,
    safety_manager_user_id = auth.uid(), safety_manager_name = reviewer.full_name,
    safety_manager_reviewed_at = now(), safety_manager_review_stale = false,
    safety_manager_role_label = case when exists (select 1 from public.job_personnel jp where jp.job_id = p_job_id and jp.personnel_id = reviewer.id and jp.assigned_role = 'RPIC') then 'Safety Manager / RPIC' else 'Safety Manager' end, updated_at = now()
  where job_id = p_job_id and organization_id = reviewer.organization_id returning * into result;
  if result.id is null then raise exception 'Save the Operational JHA before reviewing it.'; end if;
  return result;
end; $$;

create or replace function public.accept_operational_jha_as_rpic(p_job_id uuid)
returns public.jha_assessments language plpgsql security definer set search_path = public as $$
declare accepting_rpic public.personnel; result public.jha_assessments;
begin
  select p.* into accepting_rpic from public.job_personnel jp
  join public.personnel p on p.id = jp.personnel_id and p.organization_id = jp.organization_id
  where jp.job_id = p_job_id and jp.assigned_role = 'RPIC' and p.status = 'Active'
  order by jp.created_at limit 1;
  if accepting_rpic.id is null then raise exception 'RPIC not assigned to this job.'; end if;
  if accepting_rpic.user_id <> auth.uid() then raise exception 'Only the assigned RPIC can complete this acceptance.'; end if;
  update public.jha_assessments set rpic_personnel_id = accepting_rpic.id,
    rpic_user_id = auth.uid(), rpic_name = accepting_rpic.full_name,
    rpic_accepted_at = now(), rpic_acceptance_stale = false, rpic_role_label = 'RPIC', updated_at = now()
  where job_id = p_job_id and organization_id = accepting_rpic.organization_id returning * into result;
  if result.id is null then raise exception 'Save the Operational JHA before accepting it.'; end if;
  return result;
end; $$;

revoke all on function public.review_operational_jha_as_safety_manager(uuid) from public;
revoke all on function public.accept_operational_jha_as_rpic(uuid) from public;
grant execute on function public.review_operational_jha_as_safety_manager(uuid) to authenticated;
grant execute on function public.accept_operational_jha_as_rpic(uuid) to authenticated;
