alter table public.proposals
  add column if not exists proposal_number text,
  add column if not exists company_name text,
  add column if not exists site_name text,
  add column if not exists site_city text,
  add column if not exists site_state text,
  add column if not exists site_zip text,
  add column if not exists scope_of_work text,
  add column if not exists estimated_duration text,
  add column if not exists crew_size integer,
  add column if not exists estimated_price numeric(12, 2),
  add column if not exists expiration_date date,
  add column if not exists planned_equipment text,
  add column if not exists planned_crew text,
  add column if not exists hazard_selections text[] not null default '{}',
  add column if not exists hazard_notes text,
  add column if not exists preliminary_mitigations text[] not null default '{}',
  add column if not exists converted_job_id uuid,
  add column if not exists converted_at timestamptz;

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check check (status in ('Draft', 'Sent', 'Under Review', 'Awarded', 'Declined', 'Expired', 'Accepted')) not valid;

update public.proposals
set
  company_name = coalesce(company_name, client_name),
  site_name = coalesce(site_name, proposal_name),
  site_city = coalesce(site_city, ''),
  site_state = coalesce(site_state, ''),
  site_zip = coalesce(site_zip, ''),
  scope_of_work = coalesce(scope_of_work, description),
  estimated_price = coalesce(estimated_price, proposal_amount),
  expiration_date = coalesce(expiration_date, valid_until),
  planned_equipment = coalesce(planned_equipment, proposed_aircraft),
  planned_crew = coalesce(planned_crew, proposed_crew),
  hazard_selections = case when hazard is not null and hazard <> '' and hazard_selections = '{}' then array[hazard] else hazard_selections end,
  preliminary_mitigations = case when proposed_mitigation is not null and proposed_mitigation <> '' and preliminary_mitigations = '{}' then array[proposed_mitigation] else preliminary_mitigations end,
  status = case when status = 'Accepted' then 'Awarded' else status end;

alter table public.proposals
  alter column company_name set not null,
  alter column site_name set not null,
  alter column site_city set not null,
  alter column site_state set not null,
  alter column site_zip set not null,
  alter column scope_of_work set not null;

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check check (status in ('Draft', 'Sent', 'Under Review', 'Awarded', 'Declined', 'Expired'));

create unique index if not exists proposals_proposal_number_key on public.proposals(proposal_number) where proposal_number is not null;

create or replace function public.set_proposal_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.proposal_number is null then
    new.proposal_number := 'PROP-' || upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists set_proposal_number_before_insert on public.proposals;
create trigger set_proposal_number_before_insert
  before insert on public.proposals
  for each row
  execute function public.set_proposal_number();

alter table public.jobs
  add column if not exists proposal_id uuid,
  add column if not exists client_name text,
  add column if not exists client_company_name text,
  add column if not exists client_contact_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists site_name text,
  add column if not exists site_address text,
  add column if not exists site_city text,
  add column if not exists site_state text,
  add column if not exists site_zip text,
  add column if not exists scope_of_work text,
  add column if not exists hazard_selections text[] not null default '{}',
  add column if not exists preliminary_mitigations text[] not null default '{}',
  add column if not exists planned_crew text,
  add column if not exists planned_equipment text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_proposal_id_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_proposal_id_fkey foreign key (proposal_id) references public.proposals(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'proposals_converted_job_id_fkey'
  ) then
    alter table public.proposals
      add constraint proposals_converted_job_id_fkey foreign key (converted_job_id) references public.jobs(id) on delete set null;
  end if;
end $$;

create index if not exists jobs_proposal_id_idx on public.jobs(proposal_id);
