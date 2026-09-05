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
