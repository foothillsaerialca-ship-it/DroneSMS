-- Durable, internal post-operation Safety Assurance records. These records are
-- intentionally separate from the client-facing operation closeout.
create table public.safety_assurance_reviews (
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
  review_status text not null check (review_status in ('Not Required','Open','Completed')),
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
create index safety_assurance_reviews_org_date_idx on public.safety_assurance_reviews(organization_id, created_at desc);
create index safety_assurance_reviews_open_idx on public.safety_assurance_reviews(organization_id, review_status) where review_status = 'Open';
create index safety_assurance_reviews_job_idx on public.safety_assurance_reviews(job_id);
alter table public.safety_assurance_reviews enable row level security;
create policy "Organization members view Safety Assurance" on public.safety_assurance_reviews for select to authenticated using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.organization_id=safety_assurance_reviews.organization_id));
create policy "Organization members create Safety Assurance" on public.safety_assurance_reviews for insert to authenticated with check (created_by=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.organization_id=safety_assurance_reviews.organization_id));
create policy "Safety Manager updates Safety Assurance" on public.safety_assurance_reviews for update to authenticated using (exists (select 1 from public.organization_safety_designations d join public.personnel pe on pe.id=d.personnel_id where d.organization_id=safety_assurance_reviews.organization_id and pe.user_id=auth.uid()));
grant select,insert,update on public.safety_assurance_reviews to authenticated;
comment on table public.safety_assurance_reviews is 'Internal SMS Safety Assurance history; excluded from standard client completion records.';
comment on column public.safety_assurance_reviews.supersedes_review_id is 'Prior immutable review revision when a closeout is corrected or resubmitted.';

create function public.complete_safety_assurance_review(target_review_id uuid, notes text, action_links jsonb default '[]'::jsonb)
returns public.safety_assurance_reviews language plpgsql security invoker set search_path=public as $$
declare result public.safety_assurance_reviews;
begin
  update public.safety_assurance_reviews set review_status='Completed', review_notes=nullif(btrim(notes),''), resulting_action_links=coalesce(action_links,'[]'), reviewed_by=auth.uid(), reviewed_at=now()
  where id=target_review_id and review_status='Open' returning * into result;
  if result.id is null then raise exception 'Only an open Safety Assurance review may be completed'; end if;
  return result;
end $$;
grant execute on function public.complete_safety_assurance_review(uuid,text,jsonb) to authenticated;
