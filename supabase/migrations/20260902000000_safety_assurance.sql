-- Durable, internal post-operation Safety Assurance records. These records are
-- intentionally separate from the client-facing operation closeout.
create table if not exists public.safety_assurance_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  closeout_id uuid not null references public.job_operation_closeouts(id) on delete cascade,
  control_effectiveness text not null check (control_effectiveness in ('Yes','Partially','No','Not Applicable')),
  effectiveness_narrative text,
  operational_action text,
  unexpected_issue boolean not null,
  unexpected_issue_narrative text,
  follow_up_required boolean not null default false,
  follow_up_areas text[] not null default '{}',
  related_jha_hazard_ids text[] not null default '{}',
  related_control_ids text[] not null default '{}',
  related_safety_event_ids uuid[] not null default '{}',
  review_status text not null check (review_status in ('Not Required','Open','Completed','Superseded')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  resulting_action_links jsonb not null default '[]'::jsonb,
  supersedes_review_id uuid references public.safety_assurance_reviews(id),
  service_type_snapshot text,
  job_name_snapshot text not null
  ,constraint safety_assurance_partial_narrative check (control_effectiveness <> 'Partially' or nullif(btrim(coalesce(effectiveness_narrative,'')),'') is not null)
  ,constraint safety_assurance_no_details check (control_effectiveness <> 'No' or (nullif(btrim(coalesce(effectiveness_narrative,'')),'') is not null and nullif(btrim(coalesce(operational_action,'')),'') is not null))
  ,constraint safety_assurance_unexpected_details check (not unexpected_issue or nullif(btrim(coalesce(unexpected_issue_narrative,'')),'') is not null)
  ,constraint safety_assurance_follow_up_areas check (not follow_up_required or cardinality(follow_up_areas)>0)
);
create index if not exists safety_assurance_reviews_org_date_idx on public.safety_assurance_reviews(organization_id, created_at desc);
create index if not exists safety_assurance_reviews_open_idx on public.safety_assurance_reviews(organization_id, review_status) where review_status = 'Open';
create index if not exists safety_assurance_reviews_job_idx on public.safety_assurance_reviews(job_id);
alter table public.safety_assurance_reviews enable row level security;
drop policy if exists "Organization members view Safety Assurance" on public.safety_assurance_reviews;
create policy "Organization members view Safety Assurance" on public.safety_assurance_reviews for select to authenticated using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.organization_id=safety_assurance_reviews.organization_id));
revoke all on public.safety_assurance_reviews from authenticated;
grant select on public.safety_assurance_reviews to authenticated;
comment on table public.safety_assurance_reviews is 'Internal SMS Safety Assurance history; excluded from standard client completion records.';
comment on column public.safety_assurance_reviews.supersedes_review_id is 'Prior immutable review revision when a closeout is corrected or resubmitted.';

create or replace function public.save_operation_closeout_with_assurance(
  target_job_id uuid, operation_result_value text, deviation_narrative_value text,
  control_effectiveness_value text, effectiveness_narrative_value text, operational_action_value text,
  unexpected_issue_value boolean, unexpected_issue_narrative_value text, follow_up_required_value boolean,
  follow_up_areas_value text[], related_jha_hazard_ids_value text[], related_control_ids_value text[], related_safety_event_ids_value uuid[]
) returns public.job_operation_closeouts language plpgsql security definer set search_path=public as $$
declare
  target_job public.jobs; saved_closeout public.job_operation_closeouts; previous_review_id uuid;
  jha_hazards jsonb := '[]'::jsonb; related_id text; should_open boolean;
begin
  select * into target_job from public.jobs where id=target_job_id;
  if target_job.id is null or not exists (select 1 from public.profiles p where p.id=auth.uid() and p.organization_id=target_job.organization_id) then raise exception 'Job is not available to this organization'; end if;
  select coalesce(hazard_entries,'[]'::jsonb) into jha_hazards from public.jha_assessments where job_id=target_job.id;
  foreach related_id in array coalesce(related_jha_hazard_ids_value, array[]::text[]) loop
    if not exists (select 1 from jsonb_array_elements(jha_hazards) item where item->>'id'=related_id) then raise exception 'Related JHA hazard is not part of this job'; end if;
  end loop;
  foreach related_id in array coalesce(related_control_ids_value, array[]::text[]) loop
    if right(related_id,8) <> ':control' or not exists (select 1 from jsonb_array_elements(jha_hazards) item where item->>'id'=left(related_id,-8) and nullif(btrim(item->>'mitigation'),'') is not null) then raise exception 'Related control is not part of this job'; end if;
  end loop;
  if exists (select 1 from unnest(coalesce(related_safety_event_ids_value, array[]::uuid[])) as related(event_id) left join public.job_safety_events safety_event on safety_event.id=related.event_id where safety_event.id is null or safety_event.job_id<>target_job.id or safety_event.organization_id<>target_job.organization_id) then raise exception 'Related safety event is not part of this job'; end if;

  insert into public.job_operation_closeouts(job_id,organization_id,user_id,operation_result,deviation_narrative,updated_at)
  values(target_job.id,target_job.organization_id,auth.uid(),operation_result_value,nullif(btrim(deviation_narrative_value),''),now())
  on conflict(job_id) do update set user_id=auth.uid(),operation_result=excluded.operation_result,deviation_narrative=excluded.deviation_narrative,updated_at=now()
  returning * into saved_closeout;
  select id into previous_review_id from public.safety_assurance_reviews where closeout_id=saved_closeout.id order by created_at desc limit 1;
  update public.safety_assurance_reviews set review_status='Superseded' where closeout_id=saved_closeout.id and review_status='Open';
  should_open := control_effectiveness_value='No' or (control_effectiveness_value='Partially' and follow_up_required_value) or unexpected_issue_value;
  insert into public.safety_assurance_reviews(organization_id,job_id,closeout_id,control_effectiveness,effectiveness_narrative,operational_action,unexpected_issue,unexpected_issue_narrative,follow_up_required,follow_up_areas,related_jha_hazard_ids,related_control_ids,related_safety_event_ids,review_status,created_by,supersedes_review_id,service_type_snapshot,job_name_snapshot)
  values(target_job.organization_id,target_job.id,saved_closeout.id,control_effectiveness_value,nullif(btrim(effectiveness_narrative_value),''),nullif(btrim(operational_action_value),''),unexpected_issue_value,nullif(btrim(unexpected_issue_narrative_value),''),follow_up_required_value,coalesce(follow_up_areas_value,array[]::text[]),coalesce(related_jha_hazard_ids_value,array[]::text[]),coalesce(related_control_ids_value,array[]::text[]),coalesce(related_safety_event_ids_value,array[]::uuid[]),case when should_open then 'Open' else 'Not Required' end,auth.uid(),previous_review_id,target_job.service_type,target_job.name);
  return saved_closeout;
end $$;
grant execute on function public.save_operation_closeout_with_assurance(uuid,text,text,text,text,text,boolean,text,boolean,text[],text[],text[],uuid[]) to authenticated;

create or replace function public.complete_safety_assurance_review(target_review_id uuid, notes text, action_links jsonb default '[]'::jsonb)
returns public.safety_assurance_reviews language plpgsql security definer set search_path=public as $$
declare result public.safety_assurance_reviews;
begin
  if not exists (select 1 from public.safety_assurance_reviews review join public.organization_safety_designations designation on designation.organization_id=review.organization_id join public.personnel person on person.id=designation.personnel_id where review.id=target_review_id and person.user_id=auth.uid()) then raise exception 'Only the designated Safety Manager may complete this review'; end if;
  update public.safety_assurance_reviews set review_status='Completed', review_notes=nullif(btrim(notes),''), resulting_action_links=coalesce(action_links,'[]'), reviewed_by=auth.uid(), reviewed_at=now()
  where id=target_review_id and review_status='Open' returning * into result;
  if result.id is null then raise exception 'Only an open Safety Assurance review may be completed'; end if;
  return result;
end $$;
grant execute on function public.complete_safety_assurance_review(uuid,text,jsonb) to authenticated;
