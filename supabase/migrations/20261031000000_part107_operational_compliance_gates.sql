-- Add explicit Part 107 reportability evidence and operational go/no-go inputs.
-- These checks support operator decisions; they do not submit reports or replace
-- the RPIC's responsibility to verify current FAA and manufacturer requirements.

alter table public.jha_assessments
  add column if not exists visibility_distance_sm numeric,
  add column if not exists cloud_clearance_below_ft numeric,
  add column if not exists cloud_horizontal_distance_ft numeric,
  add column if not exists atc_authorization_status text,
  add column if not exists atc_authorization_reference text,
  add column if not exists atc_authorization_expires_at date;

alter table public.equipment
  add column if not exists airworthy_confirmed boolean,
  add column if not exists remote_id_status text,
  add column if not exists maximum_wind_speed_mph numeric;

alter table public.job_safety_events
  add column if not exists occurred_at date,
  add column if not exists serious_injury boolean,
  add column if not exists loss_of_consciousness boolean,
  add column if not exists non_suas_property_damage_cost_usd numeric,
  add column if not exists non_suas_property_total_loss boolean,
  add column if not exists non_suas_property_fair_market_value_usd numeric,
  add column if not exists faa_reportability_assessed boolean not null default false,
  add column if not exists faa_reported_at timestamptz,
  add column if not exists faa_report_reference text;

alter table public.job_safety_events
  add column if not exists faa_report_deadline date generated always as (
    case
      when occurred_at is not null and (
        coalesce(serious_injury, false)
        or coalesce(loss_of_consciousness, false)
        or (
          coalesce(non_suas_property_total_loss, false)
          and coalesce(non_suas_property_fair_market_value_usd, 0) > 500
        )
        or (
          not coalesce(non_suas_property_total_loss, false)
          and coalesce(non_suas_property_damage_cost_usd, 0) > 500
        )
      ) then occurred_at + 10
      else null
    end
  ) stored;

alter table public.equipment
  add constraint equipment_remote_id_status_check
  check (remote_id_status is null or remote_id_status in ('Compliant', 'FRIA', 'Not Applicable'));

alter table public.equipment
  add constraint equipment_maximum_wind_speed_check
  check (maximum_wind_speed_mph is null or maximum_wind_speed_mph > 0);

alter table public.job_safety_events
  add constraint job_safety_events_nonnegative_damage_check
  check (
    (non_suas_property_damage_cost_usd is null or non_suas_property_damage_cost_usd >= 0)
    and (non_suas_property_fair_market_value_usd is null or non_suas_property_fair_market_value_usd >= 0)
  );

create or replace function public.z_enforce_regulatory_jha_completion()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  requires_atc boolean;
begin
  if new.status is distinct from 'Complete' then return new; end if;

  if new.visibility_distance_sm is null or new.visibility_distance_sm < 3 then
    raise exception 'Part 107 requires at least 3 statute miles visibility from the control station.';
  end if;
  if new.cloud_clearance_below_ft is null or new.cloud_clearance_below_ft < 500
    or new.cloud_horizontal_distance_ft is null or new.cloud_horizontal_distance_ft < 2000 then
    raise exception 'Part 107 cloud clearance requires 500 feet below and 2,000 feet horizontally.';
  end if;

  requires_atc := new.faa_airspace_class in ('B', 'C', 'D')
    or (new.faa_airspace_class = 'E' and coalesce(new.additional_authorization_required, '') = 'Yes');
  if requires_atc and (
    coalesce(new.atc_authorization_status, '') <> 'Approved'
    or nullif(btrim(coalesce(new.atc_authorization_reference, '')), '') is null
    or (new.atc_authorization_expires_at is not null and new.atc_authorization_expires_at < coalesce(new.job_date, current_date))
  ) then
    raise exception 'Prior ATC authorization is required for this controlled airspace operation. Record the approved authorization and reference.';
  end if;

  return new;
end
$$;

drop trigger if exists zz_enforce_regulatory_jha_completion on public.jha_assessments;
create trigger zz_enforce_regulatory_jha_completion
  before insert or update on public.jha_assessments
  for each row execute function public.z_enforce_regulatory_jha_completion();
revoke all on function public.z_enforce_regulatory_jha_completion() from public, anon, authenticated;

create or replace function public.zy_invalidate_regulatory_jha_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.visibility_distance_sm is distinct from old.visibility_distance_sm
    or new.cloud_clearance_below_ft is distinct from old.cloud_clearance_below_ft
    or new.cloud_horizontal_distance_ft is distinct from old.cloud_horizontal_distance_ft
    or new.atc_authorization_status is distinct from old.atc_authorization_status
    or new.atc_authorization_reference is distinct from old.atc_authorization_reference
    or new.atc_authorization_expires_at is distinct from old.atc_authorization_expires_at
  ) then
    if old.status = 'Complete' then
      new.status := 'Draft';
      new.certified_at := null;
      new.safety_manager_review_stale := true;
      new.rpic_acceptance_stale := true;
    end if;
    update public.job_operation_readiness
    set approval_stale = true, stale_at = now(),
        stale_reason = 'Part 107 weather or authorization data changed.',
        updated_at = now()
    where job_id = old.job_id and approved_at is not null;
  end if;
  return new;
end
$$;

drop trigger if exists zy_invalidate_regulatory_jha_review on public.jha_assessments;
create trigger zy_invalidate_regulatory_jha_review
  before update on public.jha_assessments
  for each row execute function public.zy_invalidate_regulatory_jha_review();
revoke all on function public.zy_invalidate_regulatory_jha_review() from public, anon, authenticated;

create or replace function public.z_enforce_regulatory_readiness()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_jha public.jha_assessments;
  blocked_equipment text;
begin
  if new.approved_at is null or not coalesce(new.fitness_for_duty_confirmed, false) then return new; end if;

  select * into target_jha from public.jha_assessments where job_id = new.job_id;
  if target_jha.id is null or target_jha.status <> 'Complete' then
    raise exception 'Complete the JHA before Ready to Operate.';
  end if;
  if target_jha.visibility_distance_sm is null or target_jha.visibility_distance_sm < 3
    or target_jha.cloud_clearance_below_ft is null or target_jha.cloud_clearance_below_ft < 500
    or target_jha.cloud_horizontal_distance_ft is null or target_jha.cloud_horizontal_distance_ft < 2000
    or target_jha.wind_speed is null then
    raise exception 'The operation does not meet the recorded Part 107 visibility and cloud-clearance minimums.';
  end if;
  if (target_jha.faa_airspace_class in ('B', 'C', 'D')
      or (target_jha.faa_airspace_class = 'E' and coalesce(target_jha.additional_authorization_required, '') = 'Yes'))
    and (coalesce(target_jha.atc_authorization_status, '') <> 'Approved'
      or nullif(btrim(coalesce(target_jha.atc_authorization_reference, '')), '') is null
      or (target_jha.atc_authorization_expires_at is not null and target_jha.atc_authorization_expires_at < coalesce(target_jha.job_date, current_date))) then
    raise exception 'Prior ATC authorization is required for this controlled airspace operation. Record the approved authorization and reference.';
  end if;

  select e.name into blocked_equipment
  from public.job_equipment je
  join public.equipment e on e.id = je.equipment_id
  where je.job_id = new.job_id and e.equipment_type = 'Drone'
    and (e.airworthy_confirmed is distinct from true
      or e.remote_id_status is null
      or (e.maximum_wind_speed_mph is not null and target_jha.wind_speed > e.maximum_wind_speed_mph))
  order by e.name
  limit 1;
  if blocked_equipment is not null then
    raise exception '% needs an airworthiness confirmation and Remote ID determination, and the recorded wind must be within its manufacturer limit before flight.', blocked_equipment;
  end if;

  return new;
end
$$;

drop trigger if exists zz_enforce_regulatory_readiness on public.job_operation_readiness;
create trigger zz_enforce_regulatory_readiness
  before insert or update on public.job_operation_readiness
  for each row execute function public.z_enforce_regulatory_readiness();
revoke all on function public.z_enforce_regulatory_readiness() from public, anon, authenticated;

create or replace function public.z_invalidate_aircraft_readiness()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.faa_registration_number is distinct from old.faa_registration_number
    or new.airworthy_confirmed is distinct from old.airworthy_confirmed
    or new.remote_id_status is distinct from old.remote_id_status
    or new.maximum_wind_speed_mph is distinct from old.maximum_wind_speed_mph then
    update public.job_operation_readiness r
    set approval_stale = true, stale_at = now(),
        stale_reason = 'Aircraft registration, airworthiness, Remote ID, or wind limits changed.',
        updated_at = now()
    where r.approved_at is not null
      and r.job_id in (
        select je.job_id from public.job_equipment je where je.equipment_id = new.id
      );
  end if;
  return new;
end
$$;

drop trigger if exists z_invalidate_aircraft_readiness on public.equipment;
create trigger z_invalidate_aircraft_readiness
  after update of faa_registration_number, airworthy_confirmed, remote_id_status, maximum_wind_speed_mph
  on public.equipment
  for each row execute function public.z_invalidate_aircraft_readiness();
revoke all on function public.z_invalidate_aircraft_readiness() from public, anon, authenticated;

create or replace function public.z_enforce_moc_impact_review()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  answer text;
  question_index integer;
begin
  if new.status <> 'Approved for Operational Use' then return new; end if;
  for question_index in 0..9 loop
    answer := new.impact_review ->> (question_index::text);
    if answer is null or answer not in ('Yes', 'No', 'Unsure') then
      raise exception 'Answer every impact review question before approving this change.';
    end if;
    if answer in ('No', 'Unsure') and nullif(btrim(coalesce(new.safety_review_comments, '')), '') is null then
      raise exception 'Reviewer comments are required for every No or Unsure impact review answer.';
    end if;
  end loop;
  return new;
end
$$;

drop trigger if exists zz_enforce_moc_impact_review on public.management_of_change;
create trigger zz_enforce_moc_impact_review
  before insert or update on public.management_of_change
  for each row execute function public.z_enforce_moc_impact_review();
revoke all on function public.z_enforce_moc_impact_review() from public, anon, authenticated;

create or replace function public.z_validate_safety_event_reportability()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not coalesce(new.faa_reportability_assessed, false) then
    raise exception 'Assess Part 107 reportability before creating a Safety Event.';
  end if;
  if new.faa_reportability_assessed and (
    new.occurred_at is null
    or new.serious_injury is null
    or new.loss_of_consciousness is null
    or new.non_suas_property_total_loss is null
    or new.non_suas_property_damage_cost_usd is null
    or (new.non_suas_property_total_loss and new.non_suas_property_fair_market_value_usd is null)
  ) then
    raise exception 'Record the event date and each reportability answer before saving the Safety Event.';
  end if;
  if new.faa_reported_at is not null and new.faa_report_deadline is null then
    raise exception 'This event does not meet the recorded Part 107 reportability criteria.';
  end if;
  return new;
end
$$;

drop trigger if exists zz_validate_safety_event_reportability on public.job_safety_events;
create trigger zz_validate_safety_event_reportability
  before insert or update on public.job_safety_events
  for each row execute function public.z_validate_safety_event_reportability();
revoke all on function public.z_validate_safety_event_reportability() from public, anon, authenticated;

-- A remote pilot certificate does not expire. The legacy part_107_expiration_date
-- field is treated as the RPIC's recurrent-training due date, with no override.
create or replace function public.confirm_job_ready_to_operate(target_job_id uuid, fitness_confirmed boolean)
returns public.job_operation_readiness
language plpgsql security definer set search_path = pg_catalog, public as $$
declare target_job public.jobs; jha public.jha_assessments; preflight public.preflight_checklists; assigned_rpic public.personnel; result public.job_operation_readiness; blocked text;
begin
  select * into target_job from public.jobs where id=target_job_id and organization_id=public.current_user_organization_id(); if not found then raise exception 'Job not found in your organization.'; end if;
  select p.* into assigned_rpic from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id and p.organization_id=jp.organization_id where jp.job_id=target_job_id and jp.assigned_role='RPIC' and p.status='Active' order by jp.created_at limit 1;
  if assigned_rpic.id is null then raise exception 'Assign an active RPIC before recording readiness.'; end if; if assigned_rpic.user_id<>auth.uid() then raise exception 'Only the assigned RPIC can record Ready to Operate.'; end if;
  if not fitness_confirmed then insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason) values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),false,null,false,null,null) on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,fitness_for_duty_confirmed=false,approved_at=null,approval_stale=false,stale_at=null,stale_reason=null,updated_at=now() returning * into result; return result; end if;
  select * into jha from public.jha_assessments where job_id=target_job_id; if jha.id is null or jha.status<>'Complete' then raise exception 'Complete the JHA before Ready to Operate.'; end if;
  if jha.safety_manager_reviewed_at is null or jha.safety_manager_review_stale then raise exception 'Current Safety Manager Review is required.'; end if; if jha.rpic_accepted_at is null or jha.rpic_acceptance_stale or jha.rpic_personnel_id<>assigned_rpic.id then raise exception 'Current acceptance by the assigned RPIC is required.'; end if; if not jha.controls_in_place then raise exception 'Confirm required controls are in place.'; end if;
  select * into preflight from public.preflight_checklists where job_id=target_job_id; if preflight.id is null or preflight.status<>'Complete' or not public.preflight_states_allow_completion(preflight.checklist_states) then raise exception 'Complete the pre-flight checklist.'; end if;
  if target_job.crew_acknowledgment_required_at is not null and exists(select 1 from public.job_personnel a join public.personnel p on p.id=a.personnel_id where a.job_id=target_job_id and a.assigned_role in ('Pilot','Visual Observer','Payload Operator','Ground Crew') and p.status<>'Inactive' and not exists(select 1 from public.crew_briefing_acknowledgments c where c.assignment_id=a.id and c.assigned_role=a.assigned_role and c.briefing_version=jha.briefing_version and c.status in ('Acknowledged','Manual Field Briefing'))) then raise exception 'Every assigned non-RPIC operational crew member needs a current Crew Briefing acknowledgment or Manual Field Briefing.'; end if;

  if nullif(btrim(coalesce(assigned_rpic.part_107_certificate_number,'')),'') is null then
    raise exception 'The assigned RPIC needs a Part 107 certificate number in Personnel.';
  end if;
  if assigned_rpic.part_107_expiration_date is null or assigned_rpic.part_107_expiration_date < current_date then
    raise exception 'The assigned RPIC needs a current Part 107 recurrent-training due date in Personnel.';
  end if;
  select e.name || ' is marked ' || e.status into blocked from public.job_equipment je join public.equipment e on e.id=je.equipment_id
    where je.job_id=target_job_id and e.status in ('Maintenance','Inactive','Retired') order by e.name limit 1;
  if blocked is not null then raise exception '%. Remove it from the job or update its status.', blocked; end if;
  select e.name into blocked from public.job_equipment je join public.equipment e on e.id=je.equipment_id
    where je.job_id=target_job_id and e.equipment_type='Drone' and nullif(btrim(coalesce(e.faa_registration_number,'')),'') is null order by e.name limit 1;
  if blocked is not null then raise exception '% needs an FAA registration number in Equipment.', blocked; end if;
  select p.full_name into blocked from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id
    where jp.job_id=target_job_id and p.training_expiration_date < current_date
      and not exists(select 1 from public.job_readiness_overrides o where o.job_id=target_job_id and o.item_type='training_expired' and o.item_id=p.id and o.item_date=p.training_expiration_date)
    order by p.full_name limit 1;
  if blocked is not null then raise exception '% has expired training and needs a Safety Manager override.', blocked; end if;

  insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason) values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),true,now(),false,null,null) on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,fitness_for_duty_confirmed=true,approved_at=now(),approval_stale=false,stale_at=null,stale_reason=null,updated_at=now() returning * into result; return result;
end $$;

revoke all on function public.confirm_job_ready_to_operate(uuid, boolean) from public, anon;
grant execute on function public.confirm_job_ready_to_operate(uuid, boolean) to authenticated;
