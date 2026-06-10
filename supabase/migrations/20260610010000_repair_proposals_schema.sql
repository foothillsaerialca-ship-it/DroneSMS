-- Keep the proposals table aligned with the current Proposal form/save logic.
-- Audit source: Proposal creation insert, proposal status update, Proposal
-- TypeScript list type, and proposal list select/render paths.
-- The audited application fields are all represented below; there are no
-- application-referenced proposal columns intentionally omitted from this
-- migration. This migration is additive and preserves existing RLS policies.

alter table public.proposals
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists client_name text,
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists proposal_name text,
  add column if not exists service_type text,
  add column if not exists site_address text,
  add column if not exists description text,
  add column if not exists proposed_rpic text,
  add column if not exists proposed_crew text,
  add column if not exists proposed_aircraft text,
  add column if not exists airspace_class text,
  add column if not exists laanc_required boolean not null default false,
  add column if not exists additional_authorization_required boolean not null default false,
  add column if not exists hazard text,
  add column if not exists risk text,
  add column if not exists proposed_mitigation text,
  add column if not exists hazard_assessment jsonb not null default '[]'::jsonb,
  add column if not exists proposal_amount numeric(12, 2),
  add column if not exists valid_until date,
  add column if not exists status text not null default 'Draft',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.proposals'::regclass
      and conname = 'proposals_status_check'
  ) then
    alter table public.proposals
      add constraint proposals_status_check
      check (status in ('Draft', 'Sent', 'Under Review', 'Accepted', 'Declined'))
      not valid;
  end if;
end $$;

create index if not exists proposals_organization_id_idx on public.proposals(organization_id);
create index if not exists proposals_user_id_idx on public.proposals(user_id);
create index if not exists proposals_created_at_idx on public.proposals(created_at);
create index if not exists proposals_status_idx on public.proposals(status);

comment on column public.proposals.hazard_assessment is 'Selected preliminary hazards, editable mitigations, and proposal-specific notes stored directly on proposals as JSONB by the Proposal form.';
