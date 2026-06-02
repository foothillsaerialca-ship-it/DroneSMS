import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';

const serviceTypes = [
  'Cleaning Operations',
  'Thermal Inspection',
  'Roof Inspection',
  'Agricultural',
  'Mapping / Surveying',
  'Construction Progress',
  'Real Estate / Property Media',
  'Custom Operation'
];

const proposalStatuses = ['Draft', 'Sent', 'Under Review', 'Accepted', 'Declined'];
const airspaceClasses = ['Not reviewed', 'Class B', 'Class C', 'Class D', 'Class E', 'Class G'];

const initialFormState = {
  clientName: '',
  contactName: '',
  phone: '',
  email: '',
  proposalName: '',
  serviceType: serviceTypes[0],
  siteAddress: '',
  description: '',
  proposedRpic: '',
  proposedCrew: '',
  proposedAircraft: '',
  airspaceClass: airspaceClasses[0],
  laancRequired: 'No',
  additionalAuthorizationRequired: 'No',
  hazard: '',
  risk: '',
  proposedMitigation: '',
  proposalAmount: '',
  validUntil: '',
  status: proposalStatuses[0]
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to save proposal. Please try again.';
}

async function getCurrentOrganizationId(userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return profile?.organization_id ?? null;
}

function toBoolean(value: string) {
  return value === 'Yes';
}

export function NewProposalPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateField(field: keyof typeof initialFormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    if (!formData.clientName.trim()) return 'Client name is required.';
    if (!formData.proposalName.trim()) return 'Proposal name is required.';
    if (!formData.serviceType) return 'Service type is required.';
    if (!formData.siteAddress.trim()) return 'Site address is required.';
    if (formData.proposalAmount && Number.isNaN(Number(formData.proposalAmount))) {
      return 'Proposal amount must be a valid number.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to save a proposal.');

      const organizationId = await getCurrentOrganizationId(userData.user.id);

      if (!organizationId) {
        throw new Error('Finish company onboarding before creating proposals.');
      }

      const { error: proposalError } = await supabase.from('proposals').insert({
        organization_id: organizationId,
        user_id: userData.user.id,
        client_name: formData.clientName.trim(),
        contact_name: formData.contactName.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        proposal_name: formData.proposalName.trim(),
        service_type: formData.serviceType,
        site_address: formData.siteAddress.trim(),
        description: formData.description.trim() || null,
        proposed_rpic: formData.proposedRpic.trim() || null,
        proposed_crew: formData.proposedCrew.trim() || null,
        proposed_aircraft: formData.proposedAircraft.trim() || null,
        airspace_class: formData.airspaceClass === 'Not reviewed' ? null : formData.airspaceClass,
        laanc_required: toBoolean(formData.laancRequired),
        additional_authorization_required: toBoolean(formData.additionalAuthorizationRequired),
        hazard: formData.hazard.trim() || null,
        risk: formData.risk.trim() || null,
        proposed_mitigation: formData.proposedMitigation.trim() || null,
        proposal_amount: formData.proposalAmount ? Number(formData.proposalAmount) : null,
        valid_until: formData.validUntil || null,
        status: formData.status
      });

      if (proposalError) throw proposalError;

      navigate('/jobs?tab=proposals', { replace: true });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to="/jobs">
        Back to Jobs
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Proposals</p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-900">Create Proposal</h1>
          <p className="mt-2 text-sm text-slate-600">
            Capture the first stage of the operational lifecycle before creating a job.
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormSection title="Client Information">
          <TextField label="Client Name" value={formData.clientName} onChange={(value) => updateField('clientName', value)} disabled={isSaving} required />
          <TextField label="Contact Name" value={formData.contactName} onChange={(value) => updateField('contactName', value)} disabled={isSaving} />
          <TextField label="Phone" type="tel" value={formData.phone} onChange={(value) => updateField('phone', value)} disabled={isSaving} />
          <TextField label="Email" type="email" value={formData.email} onChange={(value) => updateField('email', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Project Information">
          <TextField label="Proposal Name" value={formData.proposalName} onChange={(value) => updateField('proposalName', value)} disabled={isSaving} required />
          <SelectField label="Service Type" value={formData.serviceType} options={serviceTypes} onChange={(value) => updateField('serviceType', value)} disabled={isSaving} />
          <TextField label="Site Address" value={formData.siteAddress} onChange={(value) => updateField('siteAddress', value)} disabled={isSaving} required />
          <TextAreaField label="Description" value={formData.description} onChange={(value) => updateField('description', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Operational Planning">
          <TextField label="Proposed RPIC" value={formData.proposedRpic} onChange={(value) => updateField('proposedRpic', value)} disabled={isSaving} />
          <TextAreaField label="Proposed Crew" value={formData.proposedCrew} onChange={(value) => updateField('proposedCrew', value)} disabled={isSaving} />
          <TextField label="Proposed Aircraft" value={formData.proposedAircraft} onChange={(value) => updateField('proposedAircraft', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Airspace Review">
          <SelectField label="Airspace Class" value={formData.airspaceClass} options={airspaceClasses} onChange={(value) => updateField('airspaceClass', value)} disabled={isSaving} />
          <SelectField label="LAANC Required" value={formData.laancRequired} options={['No', 'Yes']} onChange={(value) => updateField('laancRequired', value)} disabled={isSaving} />
          <SelectField label="Additional Authorization Required" value={formData.additionalAuthorizationRequired} options={['No', 'Yes']} onChange={(value) => updateField('additionalAuthorizationRequired', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Preliminary Hazard Assessment">
          <TextAreaField label="Hazard" value={formData.hazard} onChange={(value) => updateField('hazard', value)} disabled={isSaving} />
          <TextAreaField label="Risk" value={formData.risk} onChange={(value) => updateField('risk', value)} disabled={isSaving} />
          <TextAreaField label="Proposed Mitigation" value={formData.proposedMitigation} onChange={(value) => updateField('proposedMitigation', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Pricing">
          <TextField label="Proposal Amount" type="number" value={formData.proposalAmount} onChange={(value) => updateField('proposalAmount', value)} disabled={isSaving} />
          <TextField label="Proposal Valid Until Date" type="date" value={formData.validUntil} onChange={(value) => updateField('validUntil', value)} disabled={isSaving} />
          <SelectField label="Status" value={formData.status} options={proposalStatuses} onChange={(value) => updateField('status', value)} disabled={isSaving} />
        </FormSection>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Proposal'}
          </button>
        </div>
      </form>
    </section>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <legend className="px-1 text-base font-semibold text-brand-900">{title}</legend>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        step={type === 'number' ? '0.01' : undefined}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
      {label}
      <textarea
        className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
