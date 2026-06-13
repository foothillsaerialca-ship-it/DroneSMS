-- Store organization website for branded client-facing proposal PDFs.

alter table public.organizations
  add column if not exists website_url text;

comment on column public.organizations.website_url is 'Organization website shown in branded proposal PDF headers and footers.';
