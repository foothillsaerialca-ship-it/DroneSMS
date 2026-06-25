import { supabase } from '@frontend/lib/supabase';

export const SETTINGS_NOT_PROVIDED = 'Not provided in Settings';

export const DEFAULT_SERVICE_COMMITMENT = 'We are committed to delivering the services described in this proposal safely, professionally, and in accordance with the agreed scope of work. If you believe any portion of the completed work does not reflect the agreed scope or was not performed to a professional standard, please contact us promptly. We will review the concern and, when appropriate, schedule corrective work. This commitment applies to workmanship only and does not extend to normal environmental conditions, weather, airborne contaminants, irrigation, construction activity, or conditions occurring after the completion of the work.';

export type OrganizationSettings = {
  id: string;
  companyName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  primaryContact: string;
  companyStatement: string;
  isLicensed: boolean;
  isInsured: boolean;
  isBonded: boolean;
  defaultPaymentTerms: string;
  serviceCommitment: string;
  includePaymentTermsInProposal: boolean;
  includeServiceCommitmentInProposal: boolean;
  includeCompanyCredentialsInProposal: boolean;
  includeMaterialsUsedInProposal: boolean;
  logoPath: string;
  logoUrl: string;
};

export function normalizeOrganizationSettings(data: Record<string, unknown> | null | undefined): OrganizationSettings | null {
  if (!data?.id) return null;

  return {
    id: String(data.id),
    companyName: String(data.name ?? ''),
    phone: String(data.phone_number ?? ''),
    email: String(data.email_address ?? ''),
    website: String(data.website_url ?? ''),
    address: String(data.physical_address ?? ''),
    primaryContact: String(data.primary_contact ?? ''),
    companyStatement: String(data.company_statement ?? ''),
    isLicensed: Boolean(data.is_licensed),
    isInsured: Boolean(data.is_insured),
    isBonded: Boolean(data.is_bonded),
    defaultPaymentTerms: String(data.default_payment_terms ?? ''),
    serviceCommitment: String(data.service_commitment ?? data.warranty ?? DEFAULT_SERVICE_COMMITMENT),
    includePaymentTermsInProposal: data.include_payment_terms_in_proposal !== false,
    includeServiceCommitmentInProposal: data.include_service_commitment_in_proposal !== false,
    includeCompanyCredentialsInProposal: data.include_company_credentials_in_proposal !== false,
    includeMaterialsUsedInProposal: data.include_materials_used_in_proposal !== false,
    logoPath: String(data.logo_path ?? ''),
    logoUrl: String(data.logo_url ?? '')
  };
}

export function displayOrganizationValue(value: string) {
  return value.trim() || SETTINGS_NOT_PROVIDED;
}

export function getOrganizationLogoUrl(settings: OrganizationSettings | null) {
  if (!settings) return '';
  if (settings.logoUrl.trim()) return settings.logoUrl;
  if (!settings.logoPath.trim()) return '';
  return supabase.storage.from('organization-logos').getPublicUrl(settings.logoPath).data.publicUrl;
}

export async function loadOrganizationSettingsForUser(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.organization_id) return null;

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, phone_number, email_address, website_url, physical_address, primary_contact, company_statement, is_licensed, is_insured, is_bonded, default_payment_terms, service_commitment, include_payment_terms_in_proposal, include_service_commitment_in_proposal, include_company_credentials_in_proposal, include_materials_used_in_proposal, logo_path, logo_url')
    .eq('id', profile.organization_id)
    .maybeSingle();

  if (organizationError) throw organizationError;

  return normalizeOrganizationSettings(organization as Record<string, unknown> | null | undefined);
}

export async function loadOrganizationSettingsById(organizationId: string) {
  const { data: organization, error } = await supabase
    .from('organizations')
    .select('id, name, phone_number, email_address, website_url, physical_address, primary_contact, company_statement, is_licensed, is_insured, is_bonded, default_payment_terms, service_commitment, include_payment_terms_in_proposal, include_service_commitment_in_proposal, include_company_credentials_in_proposal, include_materials_used_in_proposal, logo_path, logo_url')
    .eq('id', organizationId)
    .maybeSingle();

  if (error) throw error;

  return normalizeOrganizationSettings(organization as Record<string, unknown> | null | undefined);
}
