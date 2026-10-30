alter table public.organization_safety_designations
  alter column designated_by drop not null;

alter table public.organization_safety_designations
  drop constraint organization_safety_designations_designated_by_fkey;

alter table public.organization_safety_designations
  add constraint organization_safety_designations_designated_by_fkey
  foreign key (designated_by)
  references auth.users(id)
  on delete set null;
