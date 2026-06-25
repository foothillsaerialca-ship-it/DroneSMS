alter table public.organizations
  add column if not exists service_commitment text,
  add column if not exists include_payment_terms_in_proposal boolean not null default true,
  add column if not exists include_service_commitment_in_proposal boolean not null default true,
  add column if not exists include_company_credentials_in_proposal boolean not null default true,
  add column if not exists include_materials_used_in_proposal boolean not null default true;

update public.organizations
set service_commitment = coalesce(nullif(trim(service_commitment), ''), nullif(trim(warranty), ''), 'We are committed to delivering the services described in this proposal safely, professionally, and in accordance with the agreed scope of work. If you believe any portion of the completed work does not reflect the agreed scope or was not performed to a professional standard, please contact us promptly. We will review the concern and, when appropriate, schedule corrective work. This commitment applies to workmanship only and does not extend to normal environmental conditions, weather, airborne contaminants, irrigation, construction activity, or conditions occurring after the completion of the work.')
where service_commitment is null or trim(service_commitment) = '';

comment on column public.organizations.service_commitment is 'Editable default proposal service commitment text. Existing custom warranty text is preserved during migration when present.';
comment on column public.organizations.include_payment_terms_in_proposal is 'Controls whether populated payment terms render in proposal PDFs.';
comment on column public.organizations.include_service_commitment_in_proposal is 'Controls whether populated service commitment text renders in proposal PDFs.';
comment on column public.organizations.include_company_credentials_in_proposal is 'Controls whether selected company credentials render in proposal PDF headers.';
comment on column public.organizations.include_materials_used_in_proposal is 'Controls whether assigned Chemical / Material equipment renders in proposal PDFs.';
