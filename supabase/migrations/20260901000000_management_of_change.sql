-- Management of Change is an organization-level Safety Assurance record. It links
-- operational records rather than copying them and is intentionally separate from field workflows.
create sequence if not exists public.management_of_change_number_seq;

create table public.operational_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  description text,
  status text not null default 'Proposed' check (status in ('Proposed', 'Under Review', 'Established')),
  established_at timestamptz,
  established_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.management_of_change (
  id uuid primary key default gen_random_uuid(),
  moc_number bigint not null default nextval('public.management_of_change_number_seq') unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 120),
  description text,
  source text not null check (source in ('Equipment', 'Safety Event', 'Manual')),
  change_type text not null check (change_type in ('New operational capability', 'Equipment or configuration change', 'Change resulting from a safety event', 'Organizational change', 'Other safety-relevant change')),
  status text not null default 'Draft' check (status in ('Draft', 'Under Review', 'Actions Required', 'Approved for Operational Use', 'Monitoring', 'Complete', 'Cancelled')),
  initiated_by uuid not null references auth.users(id) on delete restrict,
  capability_id uuid references public.operational_capabilities(id) on delete restrict,
  equipment_id uuid references public.equipment(id) on delete restrict,
  safety_event_id uuid references public.job_safety_events(id) on delete restrict,
  impact_review jsonb not null default '{}'::jsonb,
  external_documents_reviewed boolean,
  external_document_notes text,
  external_document_reference text,
  people_informed text,
  safety_review_decision text check (safety_review_decision in ('Accepted', 'Returned for changes')),
  safety_reviewer_id uuid references auth.users(id) on delete set null,
  safety_reviewed_at timestamptz,
  safety_review_comments text,
  operational_accepted_by uuid references auth.users(id) on delete set null,
  operational_acceptance_role text,
  operational_accepted_at timestamptz,
  follow_up_required boolean,
  follow_up_date date,
  follow_up_responsible_id uuid references public.personnel(id) on delete set null,
  follow_up_unnecessary_reason text,
  change_worked_as_intended text,
  controls_effective text,
  unexpected_hazards_or_events text,
  additional_corrective_actions text,
  final_closure_decision text,
  approved_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index management_of_change_equipment_capability_once
  on public.management_of_change(equipment_id, capability_id)
  where equipment_id is not null and capability_id is not null and status <> 'Cancelled';
create index management_of_change_register_idx on public.management_of_change(organization_id, status, created_at desc);

create table public.management_of_change_hazard_links (
  id uuid primary key default gen_random_uuid(),
  moc_id uuid not null references public.management_of_change(id) on delete restrict,
  hazard_id uuid references public.hazard_library(id) on delete restrict,
  link_type text not null check (link_type in ('Existing Hazard', 'Candidate Hazard', 'Existing Control', 'Control Requiring Review')),
  control_text text,
  candidate_hazard_name text,
  candidate_hazard_notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (hazard_id is not null or nullif(trim(candidate_hazard_name), '') is not null)
);

create table public.management_of_change_actions (
  id uuid primary key default gen_random_uuid(),
  moc_id uuid not null references public.management_of_change(id) on delete restrict,
  description text not null,
  owner_id uuid references public.personnel(id) on delete set null,
  due_date date,
  required_before_operational_use boolean not null default false,
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Complete', 'Cancelled')),
  completion_date date,
  notes_or_evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.management_of_change_activity (
  id uuid primary key default gen_random_uuid(),
  moc_id uuid not null references public.management_of_change(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.hazard_library_reviews
  add column if not exists known_hazard_answer text check (known_hazard_answer in ('Yes', 'No', 'Unsure')),
  add column if not exists existing_control_answer text check (existing_control_answer in ('Yes', 'No', 'Unsure')),
  add column if not exists control_result text,
  add column if not exists new_hazard_or_control text check (new_hazard_or_control in ('Yes', 'No', 'Further review needed')),
  add column if not exists change_needed text,
  add column if not exists investigation_notes text,
  add column if not exists linked_moc_id uuid references public.management_of_change(id) on delete restrict;

alter table public.operational_capabilities enable row level security;
alter table public.management_of_change enable row level security;
alter table public.management_of_change_hazard_links enable row level security;
alter table public.management_of_change_actions enable row level security;
alter table public.management_of_change_activity enable row level security;

create or replace function public.is_organization_safety_manager(target_organization_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organizations o where o.id = target_organization_id and o.owner_user_id = auth.uid())
    or exists(select 1 from public.organization_safety_designations d join public.personnel p on p.id = d.personnel_id
      where d.organization_id = target_organization_id and p.user_id = auth.uid())
$$;

create policy "Members view capabilities" on public.operational_capabilities for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "Members create capabilities" on public.operational_capabilities for insert to authenticated with check (organization_id = public.current_user_organization_id());
create policy "Safety managers update capabilities" on public.operational_capabilities for update to authenticated using (organization_id = public.current_user_organization_id() and public.is_organization_safety_manager(organization_id)) with check (organization_id = public.current_user_organization_id());
create policy "Members view MOC" on public.management_of_change for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "Members create MOC" on public.management_of_change for insert to authenticated with check (organization_id = public.current_user_organization_id() and initiated_by = auth.uid());
create policy "Safety managers update MOC" on public.management_of_change for update to authenticated using (organization_id = public.current_user_organization_id() and public.is_organization_safety_manager(organization_id)) with check (organization_id = public.current_user_organization_id());
create policy "Members view MOC hazard links" on public.management_of_change_hazard_links for select to authenticated using (exists(select 1 from public.management_of_change m where m.id = moc_id and m.organization_id = public.current_user_organization_id()));
create policy "Safety managers manage MOC hazard links" on public.management_of_change_hazard_links for all to authenticated using (exists(select 1 from public.management_of_change m where m.id = moc_id and public.is_organization_safety_manager(m.organization_id) and m.status not in ('Complete','Cancelled'))) with check (exists(select 1 from public.management_of_change m where m.id = moc_id and public.is_organization_safety_manager(m.organization_id) and m.status not in ('Complete','Cancelled')));
create policy "Members view MOC actions" on public.management_of_change_actions for select to authenticated using (exists(select 1 from public.management_of_change m where m.id = moc_id and m.organization_id = public.current_user_organization_id()));
create policy "Safety managers manage MOC actions" on public.management_of_change_actions for all to authenticated using (exists(select 1 from public.management_of_change m where m.id = moc_id and public.is_organization_safety_manager(m.organization_id) and m.status not in ('Complete','Cancelled'))) with check (exists(select 1 from public.management_of_change m where m.id = moc_id and public.is_organization_safety_manager(m.organization_id) and m.status not in ('Complete','Cancelled')));
create policy "Members view MOC activity" on public.management_of_change_activity for select to authenticated using (organization_id = public.current_user_organization_id());

grant select, insert on public.operational_capabilities to authenticated;
grant update on public.operational_capabilities to authenticated;
grant select, insert, update on public.management_of_change to authenticated;
grant select, insert, update, delete on public.management_of_change_hazard_links to authenticated;
grant select, insert, update on public.management_of_change_actions to authenticated;
grant select on public.management_of_change_activity to authenticated;

create or replace function public.log_moc_change() returns trigger language plpgsql security definer set search_path = public as $$
declare label text; info jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then label := 'MOC created';
  elsif old.title is distinct from new.title then label := 'Title changed'; info := jsonb_build_object('from', old.title, 'to', new.title);
  elsif old.status is distinct from new.status then label := 'Status changed'; info := jsonb_build_object('from', old.status, 'to', new.status);
  else label := 'MOC updated'; end if;
  insert into public.management_of_change_activity(moc_id, organization_id, action, details, performed_by)
    values(new.id, new.organization_id, label, info, auth.uid());
  return new;
end $$;
create trigger log_moc_change after insert or update on public.management_of_change for each row execute function public.log_moc_change();

create or replace function public.protect_closed_moc() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('Complete','Cancelled') and current_setting('app.moc_admin_correction', true) <> 'on' then raise exception 'Completed or cancelled MOC records require an attributed administrative correction.'; end if;
  new.moc_number := old.moc_number; new.organization_id := old.organization_id; new.initiated_by := old.initiated_by; new.created_at := old.created_at;
  new.updated_at := now(); return new;
end $$;
create trigger protect_closed_moc before update on public.management_of_change for each row execute function public.protect_closed_moc();

create or replace function public.log_moc_child_change() returns trigger language plpgsql security definer set search_path = public as $$
declare parent public.management_of_change; label text; target_moc uuid; detail jsonb;
begin
  if tg_op='DELETE' then target_moc:=old.moc_id; detail:=to_jsonb(old); else target_moc:=new.moc_id; detail:=to_jsonb(new); end if;
  select * into parent from public.management_of_change where id=target_moc;
  label := case when tg_table_name='management_of_change_actions' then
    case when tg_op='INSERT' then 'Action assigned' when old.status is distinct from new.status and new.status='Complete' then 'Action completed' else 'Action updated' end
    else 'Linked record changed' end;
  insert into public.management_of_change_activity(moc_id,organization_id,action,details,performed_by) values(parent.id,parent.organization_id,label,detail,auth.uid());
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger log_moc_action after insert or update on public.management_of_change_actions for each row execute function public.log_moc_child_change();
create trigger log_moc_hazard_link after insert or update or delete on public.management_of_change_hazard_links for each row execute function public.log_moc_child_change();

create or replace function public.correct_completed_management_of_change(target_moc_id uuid, correction_fields jsonb, correction_reason text)
returns public.management_of_change language plpgsql security definer set search_path = public as $$
declare result public.management_of_change;
begin
  select * into result from public.management_of_change where id=target_moc_id and organization_id=public.current_user_organization_id();
  if not found or not public.is_organization_safety_manager(result.organization_id) then raise exception 'Safety Manager access required'; end if;
  if result.status not in ('Complete','Cancelled') or nullif(trim(correction_reason),'') is null then raise exception 'A reason is required for corrections to closed records'; end if;
  perform set_config('app.moc_admin_correction','on',true);
  update public.management_of_change set
    title=coalesce(correction_fields->>'title',title), description=coalesce(correction_fields->>'description',description), updated_at=now()
    where id=target_moc_id returning * into result;
  insert into public.management_of_change_activity(moc_id,organization_id,action,details,performed_by)
    values(result.id,result.organization_id,'Administrative correction',jsonb_build_object('reason',correction_reason,'fields',correction_fields),auth.uid());
  return result;
end $$;

create or replace function public.start_management_of_change(
  change_title text, change_description text, change_source text, requested_change_type text,
  linked_equipment_id uuid default null, linked_safety_event_id uuid default null,
  capability_name text default null, linked_capability_id uuid default null
) returns public.management_of_change language plpgsql security definer set search_path = public as $$
declare org_id uuid; capability uuid := linked_capability_id; result public.management_of_change;
begin
  org_id := public.current_user_organization_id();
  if org_id is null then raise exception 'Organization setup is required'; end if;
  if linked_equipment_id is not null and not exists(select 1 from public.equipment where id=linked_equipment_id and organization_id=org_id) then raise exception 'Equipment is outside your organization'; end if;
  if linked_safety_event_id is not null and not exists(select 1 from public.job_safety_events where id=linked_safety_event_id and organization_id=org_id) then raise exception 'Safety event is outside your organization'; end if;
  if capability is not null and not exists(select 1 from public.operational_capabilities where id=capability and organization_id=org_id) then raise exception 'Capability is outside your organization'; end if;
  if capability is null and nullif(trim(capability_name),'') is not null then
    insert into public.operational_capabilities(organization_id,name,status) values(org_id,trim(capability_name),'Under Review')
    on conflict(organization_id,name) do update set status=case when operational_capabilities.status='Established' then 'Established' else 'Under Review' end, updated_at=now()
    returning id into capability;
  end if;
  if linked_equipment_id is not null and capability is not null then
    select * into result from public.management_of_change where equipment_id=linked_equipment_id and capability_id=capability and status <> 'Cancelled' limit 1;
    if found then return result; end if;
  end if;
  insert into public.management_of_change(organization_id,title,description,source,change_type,initiated_by,capability_id,equipment_id,safety_event_id,status)
    values(org_id,left(trim(change_title),120),nullif(trim(change_description),''),change_source,requested_change_type,auth.uid(),capability,linked_equipment_id,linked_safety_event_id,'Draft') returning * into result;
  return result;
end $$;

create or replace function public.approve_management_of_change(target_moc_id uuid, acceptance_role text, review_comments text default null)
returns public.management_of_change language plpgsql security definer set search_path = public as $$
declare result public.management_of_change;
begin
  select * into result from public.management_of_change where id=target_moc_id and organization_id=public.current_user_organization_id() for update;
  if not found or not public.is_organization_safety_manager(result.organization_id) then raise exception 'Safety Manager access required'; end if;
  if result.status in ('Complete','Cancelled') then raise exception 'This MOC is locked'; end if;
  if exists(select 1 from public.management_of_change_actions where moc_id=target_moc_id and required_before_operational_use and status not in ('Complete','Cancelled')) then raise exception 'Complete all actions required before operational use before approval'; end if;
  update public.management_of_change set status='Approved for Operational Use', safety_review_decision='Accepted', safety_reviewer_id=auth.uid(), safety_reviewed_at=now(), safety_review_comments=review_comments,
    operational_accepted_by=auth.uid(), operational_acceptance_role=nullif(trim(acceptance_role),''), operational_accepted_at=now(), approved_at=now(), updated_at=now()
    where id=target_moc_id returning * into result;
  if result.capability_id is not null then
    update public.operational_capabilities set status='Established', established_at=now(), established_by=auth.uid(), updated_at=now() where id=result.capability_id;
    insert into public.management_of_change_activity(moc_id,organization_id,action,performed_by) values(result.id,result.organization_id,'Capability became Established',auth.uid());
  end if;
  return result;
end $$;

grant execute on function public.start_management_of_change(text,text,text,text,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.approve_management_of_change(uuid,text,text) to authenticated;
grant execute on function public.correct_completed_management_of_change(uuid,jsonb,text) to authenticated;

comment on table public.management_of_change is 'Permanent Safety Assurance review of an organizational or operational change; not an operational procedure record.';
