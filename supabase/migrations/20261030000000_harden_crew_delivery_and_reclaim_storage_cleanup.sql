-- Keep invitation tokens and delivery evidence inside the trusted email service.
-- A caller's identity is verified by the Edge Function before it invokes this
-- service-role-only RPC; the database checks that identity against the job.
create or replace function public.create_crew_briefing_invitation(
  p_assignment_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  a public.job_personnel;
  p public.personnel;
  j public.jobs;
  h public.jha_assessments;
  r public.personnel;
  raw_token text;
  result public.crew_briefing_acknowledgments;
begin
  if auth.role() is distinct from 'service_role' or p_actor_user_id is null then
    raise exception 'Service-role access and a verified actor are required.';
  end if;

  select * into a from public.job_personnel where id = p_assignment_id for update;
  select * into j from public.jobs
    where id = a.job_id and organization_id = a.organization_id;
  select * into r from public.crew_briefing_assigned_rpic(a.job_id);
  if j.id is null or r.id is null or r.user_id is distinct from p_actor_user_id
    or not exists (
      select 1 from public.organization_memberships m
      where m.organization_id = j.organization_id
        and m.user_id = p_actor_user_id and m.status = 'active'
    ) then
    raise exception 'Only the assigned RPIC can send crew acknowledgments.';
  end if;
  if exists (
    select 1 from public.crew_briefing_acknowledgments
    where assignment_id = a.id and invitation_created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Please wait before sending another acknowledgment request.';
  end if;
  if (
    select count(*) from public.crew_briefing_acknowledgments
    where assignment_id = a.id and invitation_created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'Daily acknowledgment request limit reached for this crew member.';
  end if;
  if a.assigned_role not in ('Pilot', 'Visual Observer', 'Payload Operator', 'Ground Crew') then
    raise exception 'This assignment does not require crew acknowledgment.';
  end if;

  select * into p from public.personnel
    where id = a.personnel_id and organization_id = j.organization_id;
  if p.email is null or p.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Add a usable email to this personnel record before sending.';
  end if;
  select * into h from public.jha_assessments where job_id = j.id;
  if h.id is null then raise exception 'Save the Operational JHA before sending crew acknowledgments.'; end if;

  update public.crew_briefing_acknowledgments
  set status = 'Superseded', token_hash = null, updated_at = now()
  where assignment_id = a.id and briefing_version = h.briefing_version
    and status in ('Invited', 'Sent', 'Email Failed');

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.crew_briefing_acknowledgments(
    organization_id, job_id, personnel_id, assignment_id, assigned_role,
    email_used, briefing_version, token_hash, token_expires_at,
    invitation_created_at, acknowledgment_method, status, created_by_user_id
  ) values (
    j.organization_id, j.id, p.id, a.id, a.assigned_role,
    lower(p.email), h.briefing_version,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    now() + interval '72 hours', now(), 'Electronic', 'Invited', p_actor_user_id
  ) returning * into result;

  update public.jobs
  set crew_acknowledgment_required_at = coalesce(crew_acknowledgment_required_at, now())
  where id = j.id;

  return jsonb_build_object(
    'invitation_id', result.id, 'token', raw_token, 'email', result.email_used,
    'job_name', j.name, 'site', j.location, 'role', a.assigned_role,
    'rpic_name', r.full_name
  );
end
$$;

revoke all on function public.create_crew_briefing_invitation(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.create_crew_briefing_invitation(uuid,uuid) to service_role;
drop function public.create_crew_briefing_invitation(uuid);

create or replace function public.mark_crew_briefing_email_result(
  p_invitation_id uuid,
  p_sent boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;
  if p_sent is null then raise exception 'A delivery result is required.'; end if;

  update public.crew_briefing_acknowledgments
  set status = case when p_sent then 'Sent' else 'Email Failed' end,
      email_sent_at = case when p_sent then now() else null end,
      token_hash = case when p_sent then token_hash else null end,
      updated_at = now()
  where id = p_invitation_id and status = 'Invited';
  if not found then raise exception 'Invitation is no longer awaiting delivery.'; end if;
end
$$;

revoke all on function public.mark_crew_briefing_email_result(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.mark_crew_briefing_email_result(uuid,boolean)
  to service_role;

-- A worker may terminate after claiming work. Reclaim its abandoned rows after
-- a lease expires; attempt numbers let workers reject stale completion writes.
alter table public.storage_cleanup_queue
  add column if not exists claimed_at timestamptz;

create index if not exists storage_cleanup_queue_stale_claim_idx
  on public.storage_cleanup_queue(claimed_at)
  where status = 'processing' and attempts < 5;

create or replace function public.claim_storage_cleanup_batch(p_batch_limit integer default 100)
returns table(id uuid, bucket_id text, object_path text, attempts integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role access is required.';
  end if;

  return query
    with due as (
      select q.id from public.storage_cleanup_queue q
      where q.attempts < 5
        and (
          (q.status in ('pending', 'failed') and q.delete_after <= now())
          or (q.status = 'processing'
            and coalesce(q.claimed_at, q.delete_after) <= now() - interval '15 minutes')
        )
      order by q.delete_after, q.id
      for update skip locked
      limit greatest(1, least(coalesce(p_batch_limit, 100), 100))
    )
    update public.storage_cleanup_queue q
    set status = 'processing', attempts = q.attempts + 1,
        claimed_at = now(), last_error = null
    from due where q.id = due.id
    returning q.id, q.bucket_id, q.object_path, q.attempts;
end
$$;

revoke all on function public.claim_storage_cleanup_batch(integer)
  from public, anon, authenticated;
grant execute on function public.claim_storage_cleanup_batch(integer) to service_role;

-- Proposal conversion owns all assignment copying in one transaction. Keep its
-- role mapping aligned with the proposal staffing options used by the client.
create or replace function public.convert_proposal_to_job(target_proposal_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  source public.proposals;
  result public.jobs;
  proposal_number_value text;
begin
  select * into source
  from public.proposals
  where id = target_proposal_id and organization_id = public.current_user_organization_id()
  for update;
  if source.id is null then raise exception 'Proposal not found in your organization.'; end if;
  if not public.has_organization_role(source.organization_id, array['owner','admin','safety_manager','operator']::text[]) then
    raise exception 'Your organization role cannot convert proposals.';
  end if;
  select * into result from public.jobs where source_proposal_id = source.id limit 1;
  if result.id is not null then return result; end if;

  proposal_number_value := coalesce(nullif(source.proposal_number, ''), upper(left(source.id::text, 8)));
  insert into public.jobs(
    organization_id, user_id, name, service_type, location, planned_date, notes, status,
    source_proposal_id, source_proposal_number, client_name, contact_name, client_phone,
    client_email, site_address, preliminary_hazards, proposed_rpic_id,
    proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio
  ) values (
    source.organization_id, auth.uid(), source.proposal_name, source.service_type,
    coalesce(nullif(source.site_address,''), source.client_name), current_date,
    'Created from proposal ' || proposal_number_value || '. Confirm planned date during Mission Planning / JHA.',
    'Planned', source.id, proposal_number_value, source.client_name, source.contact_name,
    source.phone, source.email, source.site_address, coalesce(source.hazard_assessment, '[]'::jsonb),
    source.proposed_rpic_id, source.proposed_rpic_name, source.proposed_rpic_credentials, source.proposed_rpic_bio
  ) returning * into result;

  insert into public.job_personnel(job_id, organization_id, personnel_id, assigned_role)
  select result.id, source.organization_id, p.id,
    case when item->>'proposed_role' in ('Crew Member', 'Safety Support', 'Other')
      then 'Ground Crew' else item->>'proposed_role' end
  from jsonb_array_elements(
    case when jsonb_typeof(source.proposal_personnel) = 'array'
      then source.proposal_personnel else '[]'::jsonb end
  ) entries(item)
  join public.personnel p on p.id::text = item->>'personnel_id'
    and p.organization_id = source.organization_id
  where item->>'proposed_role' in (
    'Pilot', 'Visual Observer', 'Payload Operator', 'Ground Crew',
    'Crew Member', 'Safety Support', 'Other'
  )
  on conflict do nothing;

  insert into public.job_personnel(job_id, organization_id, personnel_id, assigned_role)
  select result.id, source.organization_id, p.id, 'RPIC'
  from jsonb_array_elements(
    case when jsonb_typeof(source.proposal_personnel) = 'array'
      then source.proposal_personnel else '[]'::jsonb end
  ) with ordinality entries(item, ordinal)
  join public.personnel p on p.id::text = item->>'personnel_id'
    and p.organization_id = source.organization_id
  where item->>'proposed_role' = 'RPIC'
  order by ordinal limit 1
  on conflict do nothing;

  if not exists(select 1 from public.job_personnel where job_id = result.id and assigned_role = 'RPIC')
    and source.proposed_rpic_id is not null then
    insert into public.job_personnel(job_id, organization_id, personnel_id, assigned_role)
    select result.id, source.organization_id, p.id, 'RPIC'
    from public.personnel p
    where p.id = source.proposed_rpic_id and p.organization_id = source.organization_id
    on conflict do nothing;
  end if;

  insert into public.job_equipment(job_id, organization_id, equipment_id)
  select result.id, source.organization_id, e.id
  from jsonb_array_elements(
    case when jsonb_typeof(source.proposal_equipment) = 'array'
      then source.proposal_equipment else '[]'::jsonb end
  ) entries(item)
  join public.equipment e on e.id::text = item->>'equipment_id'
    and e.organization_id = source.organization_id
  on conflict do nothing;

  update public.proposals
  set converted_to_job = true, converted_job_id = result.id, converted_at = now(),
      status = 'Accepted', updated_at = now()
  where id = source.id;
  return result;
end
$$;

revoke all on function public.convert_proposal_to_job(uuid) from public, anon;
grant execute on function public.convert_proposal_to_job(uuid) to authenticated;
