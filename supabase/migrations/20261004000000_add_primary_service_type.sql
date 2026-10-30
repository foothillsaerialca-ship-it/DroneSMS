-- Stores an optional organization preference used only to initialize future new-job forms.
alter table public.organizations
  add column if not exists primary_service_type text;
