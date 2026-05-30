import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { getMitigationsForHazards, hazardLibrary, proposalServiceTypes, proposalStatuses } from '../proposals';

const initialFormState = {
  clientName: '',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  siteName: '',
  siteAddress: '',
  city: '',
  state: '',
  zip: '',
  proposalName: '',
  serviceType: proposalServiceTypes[0],
  scopeOfWork: '',
  estimatedDuration: '',
  crewSize: '',
  estimatedPrice: '',
  expirationDate: '',
  plannedEquipment: '',
  plannedCrew: '',
  hazardNotes: '',
  mitigations: '',
  status: proposalStatuses[0]
};

type FormState = typeof initialFormState;

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

export function NewProposalPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const standardMitigations = useMemo(() => getMitigationsForHazards(selectedHazards), [selectedHazards]);

  function updateField(field: keyof FormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function toggleHazard(hazard: string) {
    setSelectedHazards((current) => {
      const next = current.includes(hazard) ? current.filter((item) => item !== hazard) : [...current, hazard];
      setFormData((currentForm) => ({ ...currentForm, mitigations: getMitigationsForHazards(next).join('\n') }));
      return next;
    });
  }

  function validateForm() {
    if (!formData.clientName.trim()) return 'Client name is required.';
    if (!formData.companyName.trim()) return 'Company name is required.';
    if (!formData.proposalName.trim()) return 'Proposal name is required.';
    if (!formData.siteName.trim()) return 'Site name is required.';
    if (!formData.siteAddress.trim()) return 'Site address is required.';
    if (!formData.city.trim()) return 'City is required.';
    if (!formData.state.trim()) return 'State is required.';
    if (!formData.zip.trim()) return 'ZIP is required.';
    if (!formData.scopeOfWork.trim()) return 'Scope of work is required.';
    if (formData.estimatedPrice && Number.isNaN(Number(formData.estimatedPrice))) return 'Estimated price must be a valid number.';
    if (formData.crewSize && Number.isNaN(Number(formData.crewSize))) return 'Crew size must be a valid number.';
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
      if (!organizationId) throw new Error('Finish company onboarding before creating proposals.');

      const { error: proposalError } = await supabase.from('proposals').insert({
        organization_id: organizationId,
        user_id: userData.user.id,
        client_name: formData.clientName.trim(),
        company_name: formData.companyName.trim(),
        contact_name: formData.contactName.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        proposal_name: formData.proposalName.trim(),
        service_type: formData.serviceType,
        site_name: formData.siteName.trim(),
        site_address: formData.siteAddress.trim(),
        site_city: formData.city.trim(),
        site_state: formData.state.trim(),
        site_zip: formData.zip.trim(),
        scope_of_work: formData.scopeOfWork.trim(),
        estimated_duration: formData.estimatedDuration.trim() || null,
        crew_size: formData.crewSize ? Number(formData.crewSize) : null,
        estimated_price: formData.estimatedPrice ? Number(formData.estimatedPrice) : null,
        expiration_date: formData.expirationDate || null,
        planned_equipment: formData.plannedEquipment.trim() || null,
        planned_crew: formData.plannedCrew.trim() || null,
        hazard_selections: selectedHazards,
        hazard_notes: formData.hazardNotes.trim() || null,
        preliminary_mitigations: formData.mitigations.split('\n').map((item) => item.trim()).filter(Boolean),
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
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to="/jobs?tab=proposals">Back to Proposals</Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Proposal Management</p>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">Create Proposal</h1>
        <p className="mt-2 text-sm text-slate-600">Start safety planning before the work is awarded, then carry this information forward into the job file.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormSection title="Client Information">
          <TextField label="Client Name" value={formData.clientName} onChange={(value) => updateField('clientName', value)} disabled={isSaving} required />
          <TextField label="Company Name" value={formData.companyName} onChange={(value) => updateField('companyName', value)} disabled={isSaving} required />
          <TextField label="Contact Name" value={formData.contactName} onChange={(value) => updateField('contactName', value)} disabled={isSaving} />
          <TextField label="Email" type="email" value={formData.email} onChange={(value) => updateField('email', value)} disabled={isSaving} />
          <TextField label="Phone" type="tel" value={formData.phone} onChange={(value) => updateField('phone', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Site Information">
          <TextField label="Site Name" value={formData.siteName} onChange={(value) => updateField('siteName', value)} disabled={isSaving} required />
          <TextField label="Site Address" value={formData.siteAddress} onChange={(value) => updateField('siteAddress', value)} disabled={isSaving} required />
          <TextField label="City" value={formData.city} onChange={(value) => updateField('city', value)} disabled={isSaving} required />
          <TextField label="State" value={formData.state} onChange={(value) => updateField('state', value)} disabled={isSaving} required />
          <TextField label="ZIP" value={formData.zip} onChange={(value) => updateField('zip', value)} disabled={isSaving} required />
        </FormSection>

        <FormSection title="Proposal Details">
          <TextField label="Proposal Name" value={formData.proposalName} onChange={(value) => updateField('proposalName', value)} disabled={isSaving} required />
          <SelectField label="Service Type" value={formData.serviceType} options={proposalServiceTypes} onChange={(value) => updateField('serviceType', value)} disabled={isSaving} />
          <TextAreaField label="Scope of Work" value={formData.scopeOfWork} onChange={(value) => updateField('scopeOfWork', value)} disabled={isSaving} required />
          <TextField label="Estimated Duration" value={formData.estimatedDuration} onChange={(value) => updateField('estimatedDuration', value)} disabled={isSaving} placeholder="Example: 1 day / 6 hours" />
          <TextField label="Crew Size" type="number" value={formData.crewSize} onChange={(value) => updateField('crewSize', value)} disabled={isSaving} />
          <TextField label="Estimated Price" type="number" value={formData.estimatedPrice} onChange={(value) => updateField('estimatedPrice', value)} disabled={isSaving} />
          <TextField label="Proposal Expiration Date" type="date" value={formData.expirationDate} onChange={(value) => updateField('expirationDate', value)} disabled={isSaving} />
          <SelectField label="Status" value={formData.status} options={proposalStatuses} onChange={(value) => updateField('status', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Equipment and Crew Planned">
          <TextAreaField label="Equipment Planned" value={formData.plannedEquipment} onChange={(value) => updateField('plannedEquipment', value)} disabled={isSaving} placeholder="Drone platform, batteries, payload, cleaning system" />
          <TextAreaField label="Crew Planned" value={formData.plannedCrew} onChange={(value) => updateField('plannedCrew', value)} disabled={isSaving} placeholder="RPIC, visual observer, crew members" />
        </FormSection>

        <FormSection title="Preliminary Hazard Assessment">
          <div className="space-y-4 sm:col-span-2">
            {hazardLibrary.map((group) => (
              <fieldset key={group.category} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <legend className="px-1 text-sm font-semibold text-brand-900">{group.category}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.hazards.map((hazard) => (
                    <Checkbox key={hazard} label={hazard} checked={selectedHazards.includes(hazard)} onChange={() => toggleHazard(hazard)} disabled={isSaving} />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <TextAreaField label="Optional Notes for Unusual Hazards" value={formData.hazardNotes} onChange={(value) => updateField('hazardNotes', value)} disabled={isSaving} />
        </FormSection>

        <FormSection title="Preliminary Mitigations">
          <div className="sm:col-span-2 rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900">
            {standardMitigations.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {standardMitigations.map((mitigation) => <li key={mitigation}>{mitigation}</li>)}
              </ul>
            ) : (
              <p>Select hazards to automatically populate standard mitigations.</p>
            )}
          </div>
          <TextAreaField label="Editable Mitigations" value={formData.mitigations} onChange={(value) => updateField('mitigations', value)} disabled={isSaving} />
        </FormSection>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <button type="submit" className="min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Proposal'}
          </button>
        </div>
      </form>
    </section>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><legend className="px-1 text-base font-semibold text-brand-900">{title}</legend><div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div></fieldset>;
}

function TextField({ label, value, onChange, disabled, type = 'text', required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{required ? <span className="text-red-600"> *</span> : null}<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} step={type === 'number' ? '0.01' : undefined} placeholder={placeholder} /></label>;
}

function TextAreaField({ label, value, onChange, disabled, required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; required?: boolean; placeholder?: string }) {
  return <label className="block text-sm font-medium text-slate-700 sm:col-span-2">{label}{required ? <span className="text-red-600"> *</span> : null}<textarea className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} placeholder={placeholder} /></label>;
}

function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: () => void; disabled: boolean }) {
  return <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700"><input className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" type="checkbox" checked={checked} onChange={onChange} disabled={disabled} /><span>{label}</span></label>;
}
