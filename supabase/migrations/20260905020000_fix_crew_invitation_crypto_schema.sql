-- Supabase installs pgcrypto in the extensions schema. Keep this SECURITY DEFINER
-- function's search_path restricted and resolve its cryptographic primitives explicitly.
create extension if not exists pgcrypto with schema extensions;

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
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.crew_briefing_acknowledgments(organization_id,job_id,personnel_id,assignment_id,assigned_role,email_used,briefing_version,token_hash,token_expires_at,invitation_created_at,acknowledgment_method,status,created_by_user_id)
  values(j.organization_id,j.id,p.id,a.id,a.assigned_role,lower(p.email),h.briefing_version,encode(extensions.digest(raw_token,'sha256'),'hex'),now()+interval '7 days',now(),'Electronic','Invited',auth.uid()) returning * into result;
  update public.jobs set crew_acknowledgment_required_at=coalesce(crew_acknowledgment_required_at,now()) where id=j.id;
  return jsonb_build_object('invitation_id',result.id,'token',raw_token,'email',result.email_used,'job_name',j.name,'site',j.location,'role',a.assigned_role,'rpic_name',r.full_name);
end $$;

revoke all on function public.create_crew_briefing_invitation(uuid) from public;
grant execute on function public.create_crew_briefing_invitation(uuid) to authenticated;

create or replace function public.get_public_crew_briefing(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.crew_briefing_acknowledgments; j public.jobs; h public.jha_assessments;
begin
  select * into c from public.crew_briefing_acknowledgments where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and status='Sent';
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
  select * into c from public.crew_briefing_acknowledgments where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if c.id is null or c.status<>'Sent' or c.token_expires_at is null or c.token_expires_at<=now() then raise exception 'This acknowledgment link is invalid, expired, or already used.'; end if;
  select * into h from public.jha_assessments where job_id=c.job_id;
  if h.briefing_version<>c.briefing_version or not exists(select 1 from public.job_personnel where id=c.assignment_id and job_id=c.job_id and personnel_id=c.personnel_id and assigned_role=c.assigned_role) then raise exception 'The briefing or crew assignment has changed. Ask the RPIC for a new request.'; end if;
  update public.crew_briefing_acknowledgments set status='Acknowledged',acknowledged_at=now(),typed_name=btrim(p_typed_name),token_hash=null,updated_at=now() where id=c.id;
  return jsonb_build_object('acknowledged',true,'acknowledged_at',now());
end $$;
revoke all on function public.acknowledge_public_crew_briefing(text,text) from public;
grant execute on function public.acknowledge_public_crew_briefing(text,text) to anon, authenticated;
