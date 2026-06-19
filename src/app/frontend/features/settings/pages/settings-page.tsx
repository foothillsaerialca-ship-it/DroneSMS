import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/components/use-auth';
import {
  DEFAULT_EMERGENCY_PROCEDURES_SUMMARY,
  DEFAULT_HAZARD_REPORTING_STATEMENT,
  DEFAULT_STOP_WORK_AUTHORITY_STATEMENT,
  defaultSmsValue
} from '../lib/sms-defaults';

type SettingsForm = {
  companyName: string;
  phoneNumber: string;
  emailAddress: string;
  websiteUrl: string;
  physicalAddress: string;
  primaryContact: string;
  companyStatement: string;
  isLicensed: string;
  isInsured: string;
  isBonded: string;
  defaultPaymentTerms: string;
  warranty: string;
  safetyManager: string;
  stopWorkAuthorityStatement: string;
  hazardReportingStatement: string;
  emergencyProceduresSummary: string;
  logoPath: string;
  logoUrl: string;
};

type EditableSection = 'organization' | 'safety';

const emptySettingsForm: SettingsForm = {
  companyName: '',
  phoneNumber: '',
  emailAddress: '',
  websiteUrl: '',
  physicalAddress: '',
  primaryContact: '',
  companyStatement: '',
  isLicensed: 'No',
  isInsured: 'No',
  isBonded: 'No',
  defaultPaymentTerms: '',
  warranty: '',
  safetyManager: '',
  stopWorkAuthorityStatement: '',
  hazardReportingStatement: '',
  emergencyProceduresSummary: '',
  logoPath: '',
  logoUrl: ''
};

const organizationFields = [
  { key: 'companyName', label: 'Company Name', type: 'text', autoComplete: 'organization' },
  { key: 'phoneNumber', label: 'Phone Number', type: 'tel', autoComplete: 'tel' },
  { key: 'emailAddress', label: 'Email Address', type: 'email', autoComplete: 'email' },
  { key: 'websiteUrl', label: 'Website', type: 'url', autoComplete: 'url' },
  { key: 'physicalAddress', label: 'Physical Address', type: 'text', autoComplete: 'street-address' },
  { key: 'primaryContact', label: 'Primary Contact', type: 'text', autoComplete: 'name' },
  { key: 'companyStatement', label: 'Company Statement', type: 'textarea', autoComplete: 'off' },
  { key: 'defaultPaymentTerms', label: 'Default Payment Terms', type: 'text', autoComplete: 'off' },
  { key: 'warranty', label: 'Warranty', type: 'textarea', autoComplete: 'off' }
] as const;

const safetyFields = [
  { key: 'safetyManager', label: 'Safety Manager', type: 'text' },
  { key: 'stopWorkAuthorityStatement', label: 'Stop-Work Authority Statement', type: 'textarea' },
  { key: 'hazardReportingStatement', label: 'Hazard Reporting Statement', type: 'textarea' },
  { key: 'emergencyProceduresSummary', label: 'Emergency Procedures Summary', type: 'textarea' }
] as const;

const smsCapabilityGroups = [
  {
    title: 'Safety Policy & Objectives',
    items: ['Safety Policy Statement', 'Safety Objectives']
  },
  {
    title: 'Safety Risk Management',
    items: ['Risk Acceptance Criteria', 'Risk Matrix Configuration']
  },
  {
    title: 'Safety Assurance',
    items: ['Internal Audit Program', 'Corrective Action Process']
  },
  {
    title: 'Safety Promotion',
    items: ['Training Program Summary', 'Safety Meeting Frequency']
  }
] as const;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeSettings(organization: Record<string, unknown> | null | undefined): SettingsForm {
  return {
    companyName: String(organization?.name ?? ''),
    phoneNumber: String(organization?.phone_number ?? ''),
    emailAddress: String(organization?.email_address ?? ''),
    websiteUrl: String(organization?.website_url ?? ''),
    physicalAddress: String(organization?.physical_address ?? ''),
    primaryContact: String(organization?.primary_contact ?? ''),
    companyStatement: String(organization?.company_statement ?? ''),
    isLicensed: organization?.is_licensed ? 'Yes' : 'No',
    isInsured: organization?.is_insured ? 'Yes' : 'No',
    isBonded: organization?.is_bonded ? 'Yes' : 'No',
    defaultPaymentTerms: String(organization?.default_payment_terms ?? ''),
    warranty: String(organization?.warranty ?? ''),
    safetyManager: String(organization?.safety_manager ?? ''),
    stopWorkAuthorityStatement: defaultSmsValue(organization?.stop_work_authority_statement, DEFAULT_STOP_WORK_AUTHORITY_STATEMENT),
    hazardReportingStatement: defaultSmsValue(organization?.hazard_reporting_statement, DEFAULT_HAZARD_REPORTING_STATEMENT),
    emergencyProceduresSummary: defaultSmsValue(organization?.emergency_procedures_summary, DEFAULT_EMERGENCY_PROCEDURES_SUMMARY),
    logoPath: String(organization?.logo_path ?? ''),
    logoUrl: String(organization?.logo_url ?? '')
  };
}

function displayValue(value: string) {
  return value.trim() || 'Not provided';
}

function buildLogoPath(organizationId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `${organizationId}/logo-${Date.now()}.${extension}`;
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  const isEmpty = !value.trim();

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 whitespace-pre-wrap text-sm ${isEmpty ? 'text-slate-400' : 'text-slate-800'}`}>
        {displayValue(value)}
      </dd>
    </div>
  );
}


function ComingSoonRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Coming Soon</span>
    </div>
  );
}

function SettingsInput({
  label,
  name,
  value,
  type,
  autoComplete,
  disabled,
  onChange
}: {
  label: string;
  name: keyof SettingsForm;
  value: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea';
  autoComplete?: string;
  disabled: boolean;
  onChange: (name: keyof SettingsForm, value: string) => void;
}) {
  const baseClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500 sm:py-2 sm:text-sm';

  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {type === 'textarea' ? (
        <textarea
          className={`${baseClass} min-h-28 resize-y`}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
        />
      ) : (
        <input
          className={baseClass}
          type={type}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
        />
      )}
    </label>
  );
}


function CheckboxField({ label, name, value, disabled, onChange }: { label: string; name: keyof SettingsForm; value: string; disabled: boolean; onChange: (name: keyof SettingsForm, value: string) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
      <input className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-100" type="checkbox" checked={value === 'Yes'} onChange={(event) => onChange(name, event.target.checked ? 'Yes' : 'No')} disabled={disabled} />
      {label}
    </label>
  );
}

export function SettingsPage() {
  const { session } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsForm>(emptySettingsForm);
  const [draft, setDraft] = useState<SettingsForm>(emptySettingsForm);
  const [editingSection, setEditingSection] = useState<EditableSection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentLogoUrl = settings.logoUrl || (settings.logoPath ? supabase.storage.from('organization-logos').getPublicUrl(settings.logoPath).data.publicUrl : '');

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!session?.user.id) return;

      setIsLoading(true);
      setError(null);
      setMessage(null);

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile?.organization_id) throw new Error('Company setup is required before settings can be edited.');

        const { data: organization, error: organizationError } = await supabase
          .from('organizations')
          .select(
            'id, name, phone_number, email_address, website_url, physical_address, primary_contact, company_statement, is_licensed, is_insured, is_bonded, default_payment_terms, warranty, safety_manager, stop_work_authority_statement, hazard_reporting_statement, emergency_procedures_summary, logo_path, logo_url'
          )
          .eq('id', profile.organization_id)
          .maybeSingle();

        if (organizationError) throw organizationError;
        if (!organization) throw new Error('Unable to find your organization settings.');

        if (!isMounted) return;

        const normalizedSettings = normalizeSettings(organization);
        setOrganizationId(organization.id as string);
        setSettings(normalizedSettings);
        setDraft(normalizedSettings);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, 'Unable to load settings.'));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [session?.user.id]);

  function beginEdit(section: EditableSection) {
    setDraft(settings);
    setEditingSection(section);
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setDraft(settings);
    setEditingSection(null);
    setError(null);
    setMessage(null);
  }

  function updateDraft(name: keyof SettingsForm, value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, [name]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSection) return;

    const companyName = draft.companyName.trim();
    if (editingSection === 'organization' && !companyName) {
      setError('Company name is required.');
      return;
    }

    if (editingSection === 'organization' && !organizationId) return;
    if (editingSection === 'safety' && !organizationId) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      let updatedSettings = draft;

      {
        const changes =
          editingSection === 'organization'
            ? {
                name: companyName,
                phone_number: draft.phoneNumber.trim() || null,
                email_address: draft.emailAddress.trim() || null,
                website_url: draft.websiteUrl.trim() || null,
                physical_address: draft.physicalAddress.trim() || null,
                primary_contact: draft.primaryContact.trim() || null,
                company_statement: draft.companyStatement.trim() || null,
                is_licensed: draft.isLicensed === 'Yes',
                is_insured: draft.isInsured === 'Yes',
                is_bonded: draft.isBonded === 'Yes',
                default_payment_terms: draft.defaultPaymentTerms.trim() || null,
                warranty: draft.warranty.trim() || null,
                updated_at: new Date().toISOString()
              }
            : {
                safety_manager: draft.safetyManager.trim() || null,
                stop_work_authority_statement: draft.stopWorkAuthorityStatement.trim() || null,
                hazard_reporting_statement: draft.hazardReportingStatement.trim() || null,
                emergency_procedures_summary: draft.emergencyProceduresSummary.trim() || null,
                updated_at: new Date().toISOString()
              };

        const { data, error: updateError } = await supabase
          .from('organizations')
          .update(changes)
          .eq('id', organizationId)
          .select(
            'id, name, phone_number, email_address, website_url, physical_address, primary_contact, company_statement, is_licensed, is_insured, is_bonded, default_payment_terms, warranty, safety_manager, stop_work_authority_statement, hazard_reporting_statement, emergency_procedures_summary, logo_path, logo_url'
          )
          .single();

        if (updateError) throw updateError;

        updatedSettings = normalizeSettings(data);
      }

      setSettings(updatedSettings);
      setDraft(updatedSettings);
      setEditingSection(null);
      setMessage('Settings saved.');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save settings.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !organizationId) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for your organization logo.');
      return;
    }

    setIsUploadingLogo(true);
    setError(null);
    setMessage(null);

    try {
      const logoPath = buildLogoPath(organizationId, file);
      const { error: uploadError } = await supabase.storage.from('organization-logos').upload(logoPath, file, {
        cacheControl: '3600',
        upsert: true
      });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('organization-logos').getPublicUrl(logoPath);
      const logoUrl = publicUrlData.publicUrl;

      const { data, error: updateError } = await supabase
        .from('organizations')
        .update({ logo_path: logoPath, logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('id', organizationId)
        .select(
          'id, name, phone_number, email_address, website_url, physical_address, primary_contact, company_statement, is_licensed, is_insured, is_bonded, default_payment_terms, warranty, safety_manager, stop_work_authority_statement, hazard_reporting_statement, emergency_procedures_summary, logo_path, logo_url'
        )
        .single();

      if (updateError) throw updateError;

      if (settings.logoPath && settings.logoPath !== logoPath) {
        await supabase.storage.from('organization-logos').remove([settings.logoPath]);
      }

      const updatedSettings = normalizeSettings(data);
      setSettings(updatedSettings);
      setDraft(updatedSettings);
      setMessage('Logo updated.');
    } catch (logoError) {
      setError(getErrorMessage(logoError, 'Unable to upload logo.'));
    } finally {
      setIsUploadingLogo(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">Organization Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Manage organization details, account access, SMS language, and branding.</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading settings...</div>
      ) : (
        <>
          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-50 px-4 py-6 sm:px-6">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                {currentLogoUrl ? (
                  <img className="h-24 w-full rounded-lg object-contain" src={currentLogoUrl} alt={`${settings.companyName || 'Organization'} logo`} />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                    No logo uploaded
                  </div>
                )}
              </div>
              {editingSection === 'organization' && (
                <>
                  <label className="mt-3 block">
                    <span className="sr-only">Upload organization logo</span>
                    <input
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-3 file:text-sm file:font-medium file:text-white hover:file:bg-brand-800 disabled:cursor-not-allowed disabled:file:bg-slate-400"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={isUploadingLogo || !organizationId}
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">{isUploadingLogo ? 'Uploading logo...' : 'Choosing a new image replaces the current logo.'}</p>
                </>
              )}
            </div>

            <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-brand-900">Organization</h2>
                  <p className="mt-1 text-sm text-slate-600">Company details and statement.</p>
                </div>
                {editingSection !== 'organization' ? (
                  <button
                    type="button"
                    className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                    onClick={() => beginEdit('organization')}
                    disabled={Boolean(editingSection)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {editingSection === 'organization' ? (
                <form className="mt-4" onSubmit={handleSave}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {organizationFields.map((field) => (
                      <div
                        key={field.key}
                        className={field.key === 'companyStatement' ? 'sm:col-span-2' : ''}
                      >
                        <SettingsInput
                          label={field.label}
                          name={field.key}
                          value={draft[field.key]}
                          type={field.type}
                          autoComplete={field.autoComplete}
                          disabled={isSaving}
                          onChange={updateDraft}
                        />
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-slate-700">Company Credentials</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <CheckboxField label="Licensed" name="isLicensed" value={draft.isLicensed} disabled={isSaving} onChange={updateDraft} />
                        <CheckboxField label="Insured" name="isInsured" value={draft.isInsured} disabled={isSaving} onChange={updateDraft} />
                        <CheckboxField label="Bonded" name="isBonded" value={draft.isBonded} disabled={isSaving} onChange={updateDraft} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="submit"
                      className="min-h-11 rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-slate-300 px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 sm:py-2"
                      onClick={cancelEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {organizationFields.map((field) => (
                    <div
                      key={field.key}
                      className={field.key === 'companyStatement' ? 'sm:col-span-2' : ''}
                    >
                      <FieldDisplay label={field.label} value={settings[field.key]} />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <FieldDisplay label="Company Credentials" value={[settings.isLicensed === 'Yes' ? 'Licensed' : '', settings.isInsured === 'Yes' ? 'Insured' : '', settings.isBonded === 'Yes' ? 'Bonded' : ''].filter(Boolean).join(' • ')} />
                  </div>
                </dl>
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">Account Settings</h2>
              <p className="mt-1 text-sm text-slate-600">Manage the authenticated user’s account access and security.</p>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3">
              <FieldDisplay label="Email Address" value={session?.user.email ?? ''} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Change Password</dt>
                <dd className="mt-1 text-sm text-slate-500">Coming soon: self-service password management.</dd>
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Multi-Factor Authentication</dt>
                <dd className="mt-1 text-sm text-slate-500">Coming soon.</dd>
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Sessions</dt>
                <dd className="mt-1 text-sm text-slate-500">Coming soon.</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-brand-900">Safety Management System (SMS)</h2>
                <p className="mt-1 text-sm text-slate-600">Manage organization-wide safety policies, responsibilities, and operational standards.</p>
              </div>
              {editingSection !== 'safety' ? (
                <button
                  type="button"
                  className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                  onClick={() => beginEdit('safety')}
                  disabled={Boolean(editingSection)}
                >
                  Edit
                </button>
              ) : null}
            </div>

            {editingSection === 'safety' ? (
              <form className="mt-4 space-y-4" onSubmit={handleSave}>
                {safetyFields.map((field) => (
                  <SettingsInput
                    key={field.key}
                    label={field.label}
                    name={field.key}
                    value={draft[field.key]}
                    type={field.type}
                    disabled={isSaving}
                    onChange={updateDraft}
                  />
                ))}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-slate-300 px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 sm:py-2"
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <dl className="mt-4 grid grid-cols-1 gap-3">
                  {safetyFields.map((field) => (
                    <FieldDisplay key={field.key} label={field.label} value={settings[field.key]} />
                  ))}
                </dl>
                <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
                  <div>
                    <h3 className="text-base font-semibold text-brand-900">Future SMS Capabilities</h3>
                    <p className="mt-1 text-sm text-slate-600">Planned SMS modules are shown as placeholders and do not affect current settings.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {smsCapabilityGroups.map((group) => (
                      <section key={group.title} className="rounded-lg border border-slate-200 bg-white p-3">
                        <h4 className="text-sm font-semibold text-slate-800">{group.title}</h4>
                        <div className="mt-3 space-y-2">
                          {group.items.map((item) => (
                            <ComingSoonRow key={item} label={item} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </>
            )}
          </article>
        </>
      )}
    </section>
  );
}
