-- Individual crew-briefing evidence. Existing jobs retain NULL opt-in so historical
-- records are readable; new jobs and active jobs whose crew/JHA is materially edited opt in.
alter table public.jobs add column if not exists crew_acknowledgment_required_at timestamptz;
alter table public.jobs alter column crew_acknowledgment_required_at set default now();
alter table public.jha_assessments add column if not exists briefing_version integer not null default 1 check (briefing_version > 0);

create table public.crew_briefing_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id) on delete restrict,
  assignment_id uuid references public.job_personnel(id) on delete set null,
  assigned_role text not null,
  email_used text,
  briefing_version integer not null check (briefing_version > 0),
  token_hash text,
  token_expires_at timestamptz,
  invitation_created_at timestamptz,
  email_sent_at timestamptz,
  acknowledged_at timestamptz,
  typed_name text,
  acknowledgment_method text not null check (acknowledgment_method in ('Electronic', 'Manual Field Briefing')),
  status text not null check (status in ('Invited', 'Sent', 'Acknowledged', 'Manual Field Briefing', 'Email Failed', 'Superseded')),
  field_briefed_at timestamptz,
  manual_reason text,
  manual_reason_detail text,
  rpic_attested boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((acknowledgment_method = 'Electronic' and email_used is not null and (token_hash is not null or status in ('Acknowledged','Email Failed','Superseded')))
    or (acknowledgment_method = 'Manual Field Briefing' and field_briefed_at is not null and manual_reason is not null and rpic_attested)),
  check (manual_reason is null or manual_reason in ('No internet/cellular service','Crew member unable to access email','Device/access issue','Other')),
  check (manual_reason <> 'Other' or nullif(btrim(manual_reason_detail), '') is not null)
);
create index crew_briefing_ack_job_idx on public.crew_briefing_acknowledgments(job_id, briefing_version);
create index crew_briefing_ack_assignment_idx on public.crew_briefing_acknowledgments(assignment_id);
create unique index crew_briefing_one_active_invitation on public.crew_briefing_acknowledgments(assignment_id, briefing_version)
  where status in ('Invited', 'Sent');
alter table public.crew_briefing_acknowledgments enable row level security;
create policy "Organization members can view crew briefing evidence" on public.crew_briefing_acknowledgments
  for select to authenticated using (organization_id = public.current_user_organization_id());
grant select on public.crew_briefing_acknowledgments to authenticated;

create or replace function public.crew_briefing_assigned_rpic(p_job_id uuid)
returns public.personnel language sql stable security definer set search_path=public as $$
  select p.* from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id and p.organization_id=jp.organization_id
  where jp.job_id=p_job_id and jp.assigned_role='RPIC' and p.status='Active' order by jp.created_at limit 1
$$;
revoke all on function public.crew_briefing_assigned_rpic(uuid) from public;

create or replace function public.create_crew_briefing_invitation(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.job_personnel; p public.personnel; j public.jobs; h public.jha_assessments; r public.personnel; raw_token text; result public.crew_briefing_acknowledgments;
begin
  select * into a from public.job_personnel where id=p_assignment_id;
  select * into j from public.jobs where id=a.job_id and organization_id=public.current_user_organization_id();
  select * into r from public.crew_briefing_assigned_rpic(a.job_id);
  if j.id is null or r.id is null or r.user_id is distinct from auth.uid() then raise exception 'Only the assigned RPIC can send crew acknowledgments.'; end if;
  if a.assigned_role not in ('Pilot','Visual Observer','Payload Operator','Ground Crew') then raise exception 'This assignment does not require crew acknowledgment.'; end if;
  select * into p from public.personnel where id=a.personnel_id and organization_id=j.organization_id;
  if p.email is null or p.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Add a usable email to this personnel record before sending.'; end if;
  select * into h from public.jha_assessments where job_id=j.id;
  if h.id is null then raise exception 'Save the Operational JHA before sending crew acknowledgments.'; end if;
  update public.crew_briefing_acknowledgments set status='Superseded', token_hash=null, updated_at=now()
    where assignment_id=a.id and briefing_version=h.briefing_version and status in ('Invited','Sent','Email Failed');
  raw_token := encode(gen_random_bytes(32), 'hex');
  insert into public.crew_briefing_acknowledgments(organization_id,job_id,personnel_id,assignment_id,assigned_role,email_used,briefing_version,token_hash,token_expires_at,invitation_created_at,acknowledgment_method,status,created_by_user_id)
  values(j.organization_id,j.id,p.id,a.id,a.assigned_role,lower(p.email),h.briefing_version,encode(digest(raw_token,'sha256'),'hex'),now()+interval '7 days',now(),'Electronic','Invited',auth.uid()) returning * into result;
  update public.jobs set crew_acknowledgment_required_at=coalesce(crew_acknowledgment_required_at,now()) where id=j.id;
  return jsonb_build_object('invitation_id',result.id,'token',raw_token,'email',result.email_used,'job_name',j.name,'site',j.location,'role',a.assigned_role,'rpic_name',r.full_name);
end $$;
revoke all on function public.create_crew_briefing_invitation(uuid) from public;
grant execute on function public.create_crew_briefing_invitation(uuid) to authenticated;

create or replace function public.mark_crew_briefing_email_result(p_invitation_id uuid, p_sent boolean)
returns void language plpgsql security definer set search_path=public as $$
declare c public.crew_briefing_acknowledgments; r public.personnel;
begin
  select * into c from public.crew_briefing_acknowledgments where id=p_invitation_id;
  if c.id is not null then select * into r from public.crew_briefing_assigned_rpic(c.job_id); end if;
  if c.id is null or r.id is null or r.user_id is distinct from auth.uid() then raise exception 'Only the assigned RPIC can update crew acknowledgment delivery.'; end if;
  update public.crew_briefing_acknowledgments set status=case when p_sent then 'Sent' else 'Email Failed' end,
    email_sent_at=case when p_sent then now() else null end, token_hash=case when p_sent then token_hash else null end, updated_at=now() where id=p_invitation_id and status='Invited';
end $$;
revoke all on function public.mark_crew_briefing_email_result(uuid,boolean) from public;
grant execute on function public.mark_crew_briefing_email_result(uuid,boolean) to authenticated;

create or replace function public.record_manual_field_briefing(p_assignment_id uuid,p_reason text,p_reason_detail text,p_attested boolean,p_briefed_at timestamptz default now())
returns public.crew_briefing_acknowledgments language plpgsql security definer set search_path=public as $$
declare a public.job_personnel; j public.jobs; h public.jha_assessments; r public.personnel; result public.crew_briefing_acknowledgments;
begin
  select * into a from public.job_personnel where id=p_assignment_id;
  select * into j from public.jobs where id=a.job_id and organization_id=public.current_user_organization_id();
  select * into r from public.crew_briefing_assigned_rpic(a.job_id);
  select * into h from public.jha_assessments where job_id=a.job_id;
  if j.id is null or r.id is null or r.user_id is distinct from auth.uid() then raise exception 'Only the assigned RPIC can record a Manual Field Briefing.'; end if;
  if a.assigned_role not in ('Pilot','Visual Observer','Payload Operator','Ground Crew') then raise exception 'This assignment does not require crew acknowledgment.'; end if;
  if h.id is null then raise exception 'Save the Operational JHA first.'; end if;
  if not p_attested or p_reason not in ('No internet/cellular service','Crew member unable to access email','Device/access issue','Other') or (p_reason='Other' and nullif(btrim(p_reason_detail),'') is null) then raise exception 'A valid reason and RPIC attestation are required.'; end if;
  update public.crew_briefing_acknowledgments set status='Superseded',token_hash=null,updated_at=now() where assignment_id=a.id and briefing_version=h.briefing_version and status in ('Invited','Sent');
  insert into public.crew_briefing_acknowledgments(organization_id,job_id,personnel_id,assignment_id,assigned_role,briefing_version,acknowledgment_method,status,field_briefed_at,manual_reason,manual_reason_detail,rpic_attested,created_by_user_id)
  values(j.organization_id,j.id,a.personnel_id,a.id,a.assigned_role,h.briefing_version,'Manual Field Briefing','Manual Field Briefing',p_briefed_at,p_reason,nullif(btrim(p_reason_detail),''),true,auth.uid()) returning * into result;
  update public.jobs set crew_acknowledgment_required_at=coalesce(crew_acknowledgment_required_at,now()) where id=j.id;
  return result;
end $$;
revoke all on function public.record_manual_field_briefing(uuid,text,text,boolean,timestamptz) from public;
grant execute on function public.record_manual_field_briefing(uuid,text,text,boolean,timestamptz) to authenticated;

create or replace function public.get_public_crew_briefing(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.crew_briefing_acknowledgments; j public.jobs; h public.jha_assessments;
begin
  select * into c from public.crew_briefing_acknowledgments where token_hash=encode(digest(p_token,'sha256'),'hex') and status='Sent';
  if c.id is null or c.token_expires_at is null or c.token_expires_at <= now() then raise exception 'This acknowledgment link is invalid or expired.'; end if;
  select * into j from public.jobs where id=c.job_id and organization_id=c.organization_id;
  select * into h from public.jha_assessments where job_id=c.job_id;
  if not exists(select 1 from public.job_personnel where id=c.assignment_id and job_id=c.job_id and personnel_id=c.personnel_id and assigned_role=c.assigned_role) then raise exception 'This crew assignment is no longer current.'; end if;
  if h.briefing_version<>c.briefing_version then raise exception 'The briefing has changed. Ask the RPIC for a new acknowledgment request.'; end if;
  return jsonb_build_object('already_acknowledged',false,'operation',jsonb_build_object('name',j.name,'site',j.location,'planned_date',j.planned_date),
    'recipient',(select jsonb_build_object('name',full_name,'role',c.assigned_role) from public.personnel where id=c.personnel_id),
    'crew',(select coalesce(jsonb_agg(jsonb_build_object('name',p.full_name,'role',a.assigned_role) order by a.created_at),'[]') from public.job_personnel a join public.personnel p on p.id=a.personnel_id where a.job_id=c.job_id and a.assigned_role in ('RPIC','Pilot','Visual Observer','Payload Operator','Ground Crew')),
    'rpic',(select p.full_name from public.job_personnel a join public.personnel p on p.id=a.personnel_id where a.job_id=c.job_id and a.assigned_role='RPIC' order by a.created_at limit 1),
    'briefing',jsonb_build_object('scope',h.job_type_scope,'hazards',h.hazard_entries,'ppe',h.ppe_requirements,'communications',h.crew_members,'emergency_facility',h.nearest_hospital,'emergency_facility_address',h.emergency_facility_address,'emergency_contact',h.emergency_contact,'emergency_actions',h.drone_incident_procedure,'site_constraints',h.site_access,'exclusion_zone',h.exclusion_zone_description,'airspace_restrictions',h.known_airspace_restrictions));
end $$;
revoke all on function public.get_public_crew_briefing(text) from public;
grant execute on function public.get_public_crew_briefing(text) to anon, authenticated;

create or replace function public.acknowledge_public_crew_briefing(p_token text,p_typed_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.crew_briefing_acknowledgments; h public.jha_assessments;
begin
  if nullif(btrim(p_typed_name),'') is null then raise exception 'Typed full name is required.'; end if;
  select * into c from public.crew_briefing_acknowledgments where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if c.id is null or c.status<>'Sent' or c.token_expires_at is null or c.token_expires_at<=now() then raise exception 'This acknowledgment link is invalid, expired, or already used.'; end if;
  select * into h from public.jha_assessments where job_id=c.job_id;
  if h.briefing_version<>c.briefing_version or not exists(select 1 from public.job_personnel where id=c.assignment_id and job_id=c.job_id and personnel_id=c.personnel_id and assigned_role=c.assigned_role) then raise exception 'The briefing or crew assignment has changed. Ask the RPIC for a new request.'; end if;
  update public.crew_briefing_acknowledgments set status='Acknowledged',acknowledged_at=now(),typed_name=btrim(p_typed_name),token_hash=null,updated_at=now() where id=c.id;
  return jsonb_build_object('acknowledged',true,'acknowledged_at',now());
end $$;
revoke all on function public.acknowledge_public_crew_briefing(text,text) from public;
grant execute on function public.acknowledge_public_crew_briefing(text,text) to anon, authenticated;

-- Version every substantive JHA field exposed by get_public_crew_briefing. This is
-- independent of attestation state, so repeated Draft/stale edits each advance it.
create or replace function public.advance_crew_briefing_version() returns trigger language plpgsql set search_path=public as $$
begin
  if row(new.job_type_scope,new.hazard_entries,new.ppe_requirements,new.crew_members,new.nearest_hospital,
    new.emergency_facility_address,new.emergency_contact,new.drone_incident_procedure,new.site_access,
    new.exclusion_zone_description,new.known_airspace_restrictions)
    is distinct from row(old.job_type_scope,old.hazard_entries,old.ppe_requirements,old.crew_members,old.nearest_hospital,
    old.emergency_facility_address,old.emergency_contact,old.drone_incident_procedure,old.site_access,
    old.exclusion_zone_description,old.known_airspace_restrictions) then
    new.briefing_version := old.briefing_version+1;
    update public.jobs set crew_acknowledgment_required_at=coalesce(crew_acknowledgment_required_at,now()) where id=new.job_id;
  end if;
  return new;
end $$;
create trigger advance_crew_briefing_version_before_material_change before update on public.jha_assessments
for each row execute function public.advance_crew_briefing_version();

-- Job identity/site/date/service changes are also displayed briefing substance.
create or replace function public.advance_crew_briefing_version_from_job() returns trigger language plpgsql set search_path=public as $$
begin
  if row(new.name,new.location,new.planned_date,new.service_type) is distinct from row(old.name,old.location,old.planned_date,old.service_type) then
    update public.jha_assessments set briefing_version=briefing_version+1 where job_id=new.id;
    new.crew_acknowledgment_required_at := coalesce(new.crew_acknowledgment_required_at,now());
    perform public.mark_job_operation_readiness_stale(new.id,'Operation briefing content changed');
  end if;
  return new;
end $$;
create trigger advance_crew_briefing_version_from_job before update on public.jobs
for each row execute function public.advance_crew_briefing_version_from_job();

-- Operational crew and role snapshots are displayed briefing substance. Preserve
-- evidence on delete, advance the version, and stale any prior readiness approval.
create or replace function public.advance_crew_briefing_version_from_assignment() returns trigger language plpgsql set search_path=public as $$
declare target_job_id uuid; material boolean;
begin
  target_job_id := case when tg_op='DELETE' then old.job_id else new.job_id end;
  material := case
    when tg_op='INSERT' then new.assigned_role in ('RPIC','Pilot','Visual Observer','Payload Operator','Ground Crew')
    when tg_op='DELETE' then old.assigned_role in ('RPIC','Pilot','Visual Observer','Payload Operator','Ground Crew')
    else old.personnel_id is distinct from new.personnel_id or old.assigned_role is distinct from new.assigned_role
  end;
  if material then
    update public.jha_assessments set briefing_version=briefing_version+1 where job_id=target_job_id;
    update public.jobs set crew_acknowledgment_required_at=coalesce(crew_acknowledgment_required_at,now()) where id=target_job_id;
    perform public.mark_job_operation_readiness_stale(target_job_id,'Operational crew assignment changed');
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger advance_crew_briefing_version_from_assignment after insert or update or delete on public.job_personnel
for each row execute function public.advance_crew_briefing_version_from_assignment();

-- Replace the narrow readiness RPC to add one server-side prerequisite without changing existing checks.
create or replace function public.confirm_job_ready_to_operate(target_job_id uuid, fitness_confirmed boolean)
returns public.job_operation_readiness language plpgsql security definer set search_path = public as $$
declare target_job public.jobs; jha public.jha_assessments; preflight public.preflight_checklists; assigned_rpic public.personnel; result public.job_operation_readiness;
begin
  select * into target_job from public.jobs where id=target_job_id and organization_id=public.current_user_organization_id(); if not found then raise exception 'Job not found in your organization.'; end if;
  select p.* into assigned_rpic from public.job_personnel jp join public.personnel p on p.id=jp.personnel_id and p.organization_id=jp.organization_id where jp.job_id=target_job_id and jp.assigned_role='RPIC' and p.status='Active' order by jp.created_at limit 1;
  if assigned_rpic.id is null then raise exception 'Assign an active RPIC before recording readiness.'; end if; if assigned_rpic.user_id<>auth.uid() then raise exception 'Only the assigned RPIC can record Ready to Operate.'; end if;
  if not fitness_confirmed then insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason) values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),false,null,false,null,null) on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,fitness_for_duty_confirmed=false,approved_at=null,approval_stale=false,stale_at=null,stale_reason=null,updated_at=now() returning * into result; return result; end if;
  select * into jha from public.jha_assessments where job_id=target_job_id; if jha.id is null or jha.status<>'Complete' then raise exception 'Complete the JHA before Ready to Operate.'; end if;
  if jha.safety_manager_reviewed_at is null or jha.safety_manager_review_stale then raise exception 'Current Safety Manager Review is required.'; end if; if jha.rpic_accepted_at is null or jha.rpic_acceptance_stale or jha.rpic_personnel_id<>assigned_rpic.id then raise exception 'Current acceptance by the assigned RPIC is required.'; end if; if not jha.controls_in_place then raise exception 'Confirm required controls are in place.'; end if;
  select * into preflight from public.preflight_checklists where job_id=target_job_id; if preflight.id is null or preflight.status<>'Complete' or not public.preflight_states_allow_completion(preflight.checklist_states) then raise exception 'Complete the pre-flight checklist.'; end if;
  if target_job.crew_acknowledgment_required_at is not null and exists(select 1 from public.job_personnel a join public.personnel p on p.id=a.personnel_id where a.job_id=target_job_id and a.assigned_role in ('Pilot','Visual Observer','Payload Operator','Ground Crew') and p.status<>'Inactive' and not exists(select 1 from public.crew_briefing_acknowledgments c where c.assignment_id=a.id and c.assigned_role=a.assigned_role and c.briefing_version=jha.briefing_version and c.status in ('Acknowledged','Manual Field Briefing'))) then raise exception 'Every assigned non-RPIC operational crew member needs a current Crew Briefing acknowledgment or Manual Field Briefing.'; end if;
  insert into public.job_operation_readiness(job_id,organization_id,rpic_personnel_id,approved_by_user_id,fitness_for_duty_confirmed,approved_at,approval_stale,stale_at,stale_reason) values(target_job_id,target_job.organization_id,assigned_rpic.id,auth.uid(),true,now(),false,null,null) on conflict(job_id) do update set rpic_personnel_id=excluded.rpic_personnel_id,approved_by_user_id=excluded.approved_by_user_id,fitness_for_duty_confirmed=true,approved_at=now(),approval_stale=false,stale_at=null,stale_reason=null,updated_at=now() returning * into result; return result;
end $$;
revoke all on function public.confirm_job_ready_to_operate(uuid,boolean) from public; grant execute on function public.confirm_job_ready_to_operate(uuid,boolean) to authenticated;
