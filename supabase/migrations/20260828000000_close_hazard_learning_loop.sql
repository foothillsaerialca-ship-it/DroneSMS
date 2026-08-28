-- Close the safety-learning loop while preserving operational records as immutable snapshots.
create or replace function public.current_user_organization_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

alter table public.hazard_library
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists description text,
  add column if not exists mitigations text[] not null default '{}',
  add column if not exists is_active boolean not null default true,
  add column if not exists source_review_id uuid;

drop index if exists public.hazard_library_hazard_name_key;
create unique index if not exists hazard_library_system_name_key
  on public.hazard_library (lower(hazard_name)) where organization_id is null;
create unique index if not exists hazard_library_organization_name_key
  on public.hazard_library (organization_id, lower(hazard_name)) where organization_id is not null and is_active;
update public.hazard_library set mitigations = array[default_mitigation] where cardinality(mitigations) = 0;

drop policy if exists "Authenticated users can view system hazard library" on public.hazard_library;
create policy "Users can view available hazard library"
  on public.hazard_library for select to authenticated
  using (is_active and (organization_id is null or organization_id = public.current_user_organization_id()));
create policy "Users can manage organization hazard library"
  on public.hazard_library for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id() and is_system_hazard = false);
grant select, insert, update on public.hazard_library to authenticated;
revoke delete on public.hazard_library from authenticated;

create table public.hazard_library_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_type text not null check (source_type in ('Custom Hazard', 'Safety Event')),
  source_job_id uuid not null references public.jobs(id) on delete restrict,
  source_jha_id uuid references public.jha_assessments(id) on delete restrict,
  source_entry_id text,
  safety_event_id uuid references public.job_safety_events(id) on delete restrict,
  hazard_name_snapshot text,
  description_snapshot text,
  category_snapshot text,
  mitigations_snapshot text[] not null default '{}',
  rpic_name_snapshot text,
  status text not null default 'Pending' check (status in ('Pending', 'Reviewed')),
  resolution text check (resolution in ('Added to Hazard Library', 'Linked to Existing', 'No Library Action')),
  resolved_hazard_id uuid references public.hazard_library(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_jha_id, source_entry_id),
  unique (safety_event_id)
);

create table public.hazard_library_review_actions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.hazard_library_reviews(id) on delete restrict,
  hazard_id uuid references public.hazard_library(id) on delete restrict,
  action_type text not null check (action_type in ('Created Hazard', 'Linked Hazard', 'Added Mitigation', 'No Library Action')),
  mitigation_added text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.hazard_library_reviews enable row level security;
alter table public.hazard_library_review_actions enable row level security;
create policy "Users can view organization hazard reviews" on public.hazard_library_reviews for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "Users can update organization hazard reviews" on public.hazard_library_reviews for update to authenticated using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());
create policy "Users can view organization review actions" on public.hazard_library_review_actions for select to authenticated using (exists (select 1 from public.hazard_library_reviews r where r.id = review_id and r.organization_id = public.current_user_organization_id()));
create policy "Users can create organization review actions" on public.hazard_library_review_actions for insert to authenticated with check (exists (select 1 from public.hazard_library_reviews r where r.id = review_id and r.organization_id = public.current_user_organization_id()));
grant select, update on public.hazard_library_reviews to authenticated;
grant select, insert on public.hazard_library_review_actions to authenticated;

create or replace function public.capture_custom_hazard_reviews() returns trigger language plpgsql security definer set search_path = public as $$
declare item jsonb; assigned_rpic text;
begin
  select p.full_name into assigned_rpic from public.job_personnel jp join public.personnel p on p.id = jp.personnel_id where jp.job_id = new.job_id and jp.assigned_role = 'RPIC' limit 1;
  for item in select * from jsonb_array_elements(coalesce(new.hazard_entries, '[]'::jsonb)) loop
    if item->>'sourceType' = 'Custom Hazard' and nullif(trim(item->>'description'), '') is not null then
      insert into public.hazard_library_reviews (organization_id, source_type, source_job_id, source_jha_id, source_entry_id, hazard_name_snapshot, description_snapshot, category_snapshot, mitigations_snapshot, rpic_name_snapshot)
      values (new.organization_id, 'Custom Hazard', new.job_id, new.id, item->>'id', item->>'description', nullif(item->>'notes', ''), nullif(item->>'category', ''), array_remove(array[item->>'mitigation'], null), assigned_rpic)
      on conflict (source_jha_id, source_entry_id) do nothing;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists capture_custom_hazard_reviews on public.jha_assessments;
create trigger capture_custom_hazard_reviews after insert or update of hazard_entries on public.jha_assessments for each row execute function public.capture_custom_hazard_reviews();

create or replace function public.capture_safety_event_review() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.hazard_library_reviews (organization_id, source_type, source_job_id, safety_event_id)
  values (new.organization_id, 'Safety Event', new.job_id, new.id) on conflict (safety_event_id) do nothing;
  return new;
end $$;
drop trigger if exists capture_safety_event_review on public.job_safety_events;
create trigger capture_safety_event_review after insert on public.job_safety_events for each row execute function public.capture_safety_event_review();

-- Submitted events are historical records. Review status and learning actions live in the review tables.
revoke update, delete on public.job_safety_events from authenticated;

comment on table public.hazard_library_reviews is 'Immutable source snapshots awaiting Safety Manager Review.';
comment on column public.hazard_library.source_review_id is 'Traceability to the review that created this reusable organizational hazard.';
