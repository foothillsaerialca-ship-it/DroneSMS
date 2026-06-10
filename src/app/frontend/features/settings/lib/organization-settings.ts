import { supabase } from '@frontend/lib/supabase';

export const SETTINGS_NOT_PROVIDED = 'Not provided in Settings';

export type OrganizationSettings = {
  id: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  primaryContact: string;
  emergencyContact: string;
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
    address: String(data.physical_address ?? ''),
    primaryContact: String(data.primary_contact ?? ''),
    emergencyContact: String(data.emergency_contact ?? ''),
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
    .select('id, name, phone_number, email_address, physical_address, primary_contact, emergency_contact, logo_path, logo_url')
    .eq('id', profile.organization_id)
    .maybeSingle();

  if (organizationError) throw organizationError;

  return normalizeOrganizationSettings(organization as Record<string, unknown> | null | undefined);
}

export async function loadOrganizationSettingsById(organizationId: string) {
  const { data: organization, error } = await supabase
    .from('organizations')
    .select('id, name, phone_number, email_address, physical_address, primary_contact, emergency_contact, logo_path, logo_url')
    .eq('id', organizationId)
    .maybeSingle();

  if (error) throw error;

  return normalizeOrganizationSettings(organization as Record<string, unknown> | null | undefined);
}
