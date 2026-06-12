import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { OrganizationIdentityCard } from '@frontend/features/settings/components/organization-identity-card';
import {
  createCustomPreliminaryHazard,
  preliminaryHazardCategories,
  preliminaryHazardLibrary,
  summarizeSelectedHazards,
  type SelectedPreliminaryHazard
} from '@frontend/features/safety/lib/preliminary-hazard-library';
import { loadOrganizationSettingsForUser, type OrganizationSettings } from '@frontend/features/settings/lib/organization-settings';

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
  proposedRpicId: '',
  airspaceClass: airspaceClasses[0],
  laancRequired: 'No',
  additionalAuthorizationRequired: 'No',
  proposalAmount: '',
  validUntil: '',
  status: proposalStatuses[0]
};


type ProposedRpic = {
  id: string;
  full_name: string;
  role: string;
  status: string;
  part_107_certificate_number: string | null;
  part_107_expiration_date: string | null;
  certifications_summary: string | null;
  professional_bio: string | null;
};

function createProposalNumber() {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStamp = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `PRO-${dateStamp}-${timeStamp}`;
}

function buildFallbackCredentials(person: ProposedRpic | null) {
  if (!person) return null;
  const credentials = person.certifications_summary?.trim();
  if (credentials) return credentials;

  const part107 = person.part_107_certificate_number?.trim();
  const expires = person.part_107_expiration_date ? `expires ${person.part_107_expiration_date}` : null;
  const fallback = [part107 ? `Part 107 ${part107}` : null, expires].filter(Boolean).join(' • ');
  return fallback || null;
}

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
  const [selectedHazards, setSelectedHazards] = useState<SelectedPreliminaryHazard[]>([]);
  const [customHazard, setCustomHazard] = useState('');
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings | null>(null);
  const [personnel, setPersonnel] = useState<ProposedRpic[]>([]);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);
  const [isLoadingPersonnel, setIsLoadingPersonnel] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCompanyIdentity() {
      setIsLoadingOrganization(true);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const userId = userData.user?.id;
        if (!userId) {
          if (isMounted) setOrganizationSettings(null);
          return;
        }

        const settings = await loadOrganizationSettingsForUser(userId);
        if (isMounted) setOrganizationSettings(settings);
      } catch {
        if (isMounted) setOrganizationSettings(null);
      } finally {
        if (isMounted) setIsLoadingOrganization(false);
      }
    }

    async function loadPersonnel() {
      setIsLoadingPersonnel(true);

      try {
        const { data, error: personnelError } = await supabase
          .from('personnel')
          .select('id, full_name, role, status, part_107_certificate_number, part_107_expiration_date, certifications_summary, professional_bio')
          .eq('status', 'Active')
          .order('full_name', { ascending: true });

        if (personnelError) throw personnelError;
        if (isMounted) setPersonnel((data ?? []) as ProposedRpic[]);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoadingPersonnel(false);
      }
    }

    void loadCompanyIdentity();
    void loadPersonnel();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedRpic = useMemo(() => personnel.find((person) => person.id === formData.proposedRpicId) ?? null, [personnel, formData.proposedRpicId]);

  const rpicCredentials = useMemo(() => buildFallbackCredentials(selectedRpic), [selectedRpic]);

  function updateField(field: keyof typeof initialFormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function toggleHazard(hazardId: string) {
    const libraryHazard = preliminaryHazardLibrary.find((hazard) => hazard.id === hazardId);
    if (!libraryHazard) return;

    setSelectedHazards((current) =>
      current.some((hazard) => hazard.id === hazardId)
        ? current.filter((hazard) => hazard.id !== hazardId)
        : [...current, { ...libraryHazard, notes: '' }]
    );
  }

  function removeHazard(hazardId: string) {
    setSelectedHazards((current) => current.filter((hazard) => hazard.id !== hazardId));
  }

  function updateSelectedHazard(hazardId: string, field: 'mitigation' | 'notes', value: string) {
    setSelectedHazards((current) =>
      current.map((hazard) => (hazard.id === hazardId ? { ...hazard, [field]: value } : hazard))
    );
  }

  function addCustomHazard() {
    const trimmedHazard = customHazard.trim();
    if (!trimmedHazard) return;

    setSelectedHazards((current) => [...current, createCustomPreliminaryHazard(trimmedHazard)]);
    setCustomHazard('');
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

      const summarizedHazards = summarizeSelectedHazards(selectedHazards);
      const selectedRpicSnapshot = selectedRpic;
      const selectedRpicCredentials = buildFallbackCredentials(selectedRpicSnapshot);

      const { error: proposalError } = await supabase.from('proposals').insert({
        organization_id: organizationId,
        user_id: userData.user.id,
        client_name: formData.clientName.trim(),
        contact_name: formData.contactName.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        proposal_number: createProposalNumber(),
        proposal_name: formData.proposalName.trim(),
        service_type: formData.serviceType,
        site_address: formData.siteAddress.trim(),
        description: formData.description.trim() || null,
        proposed_rpic_id: selectedRpicSnapshot?.id ?? null,
        proposed_rpic_name: selectedRpicSnapshot?.full_name ?? null,
        proposed_rpic_credentials: selectedRpicCredentials,
        proposed_rpic_bio: selectedRpicSnapshot?.professional_bio?.trim() || null,
        proposed_rpic: selectedRpicSnapshot?.full_name ?? null,
        airspace_class: formData.airspaceClass === 'Not reviewed' ? null : formData.airspaceClass,
        laanc_required: toBoolean(formData.laancRequired),
        additional_authorization_required: toBoolean(formData.additionalAuthorizationRequired),
        hazard: summarizedHazards.hazard,
        risk: summarizedHazards.risk,
        proposed_mitigation: summarizedHazards.proposedMitigation,
        hazard_assessment: selectedHazards,
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

      <OrganizationIdentityCard
        organization={organizationSettings}
        title="Proposal Company Information"
        description="Company identity is auto-populated from Settings and used for proposal documents."
        isLoading={isLoadingOrganization}
      />

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

        <FormSection title="Proposed RPIC">
          <PersonnelSelectField
            label="Proposed RPIC"
            value={formData.proposedRpicId}
            personnel={personnel}
            onChange={(value) => updateField('proposedRpicId', value)}
            disabled={isSaving || isLoadingPersonnel}
          />
          <RpicSnapshotCard selectedRpic={selectedRpic} credentials={rpicCredentials} isLoading={isLoadingPersonnel} />
        </FormSection>

        <FormSection title="Airspace Review">
          <SelectField label="Airspace Class" value={formData.airspaceClass} options={airspaceClasses} onChange={(value) => updateField('airspaceClass', value)} disabled={isSaving} />
          <SelectField label="LAANC Required" value={formData.laancRequired} options={['No', 'Yes']} onChange={(value) => updateField('laancRequired', value)} disabled={isSaving} />
          <SelectField label="Additional Authorization Required" value={formData.additionalAuthorizationRequired} options={['No', 'Yes']} onChange={(value) => updateField('additionalAuthorizationRequired', value)} disabled={isSaving} />
        </FormSection>

        <HazardSelection
          selectedHazards={selectedHazards}
          customHazard={customHazard}
          disabled={isSaving}
          onToggleHazard={toggleHazard}
          onRemoveHazard={removeHazard}
          onUpdateHazard={updateSelectedHazard}
          onCustomHazardChange={setCustomHazard}
          onAddCustomHazard={addCustomHazard}
        />

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


function HazardSelection({
  selectedHazards,
  customHazard,
  disabled,
  onToggleHazard,
  onRemoveHazard,
  onUpdateHazard,
  onCustomHazardChange,
  onAddCustomHazard
}: {
  selectedHazards: SelectedPreliminaryHazard[];
  customHazard: string;
  disabled: boolean;
  onToggleHazard: (hazardId: string) => void;
  onRemoveHazard: (hazardId: string) => void;
  onUpdateHazard: (hazardId: string, field: 'mitigation' | 'notes', value: string) => void;
  onCustomHazardChange: (value: string) => void;
  onAddCustomHazard: () => void;
}) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <legend className="px-1 text-base font-semibold text-brand-900">Preliminary Hazard Assessment</legend>
      <p className="mt-2 text-sm text-slate-600">
        Select common hazards to auto-populate preliminary mitigations. Mitigation text and notes can be adjusted for this proposal.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {preliminaryHazardCategories.map((category) => (
            <div key={category} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-brand-900">{category}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {preliminaryHazardLibrary
                  .filter((hazard) => hazard.category === category)
                  .map((hazard) => (
                    <label key={hazard.id} className="flex items-start gap-2 rounded-lg bg-white p-2 text-sm text-slate-700">
                      <input
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-100"
                        type="checkbox"
                        checked={selectedHazards.some((selectedHazard) => selectedHazard.id === hazard.id)}
                        onChange={() => onToggleHazard(hazard.id)}
                        disabled={disabled}
                      />
                      {hazard.hazard}
                    </label>
                  ))}
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-brand-900">Optional Custom Hazard</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:py-2 sm:text-sm"
                type="text"
                value={customHazard}
                onChange={(event) => onCustomHazardChange(event.target.value)}
                placeholder="Add site-specific hazard"
                disabled={disabled}
              />
              <button
                type="button"
                className="min-h-11 rounded-lg border border-brand-700 bg-white px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 sm:py-2"
                onClick={onAddCustomHazard}
                disabled={disabled || !customHazard.trim()}
              >
                Add Hazard
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-brand-900">Selected Hazards</h3>
          {selectedHazards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No hazards selected yet. Choose one or more hazards from the library.
            </div>
          ) : null}

          {selectedHazards.map((hazard) => (
            <article key={hazard.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-brand-900">{hazard.hazard}</h4>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{hazard.category}</p>
                </div>
                <button
                  type="button"
                  className="text-left text-sm font-medium text-red-700 disabled:text-slate-400 sm:text-right"
                  onClick={() => onRemoveHazard(hazard.id)}
                  disabled={disabled}
                >
                  Remove
                </button>
              </div>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Preliminary Mitigation
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm"
                  value={hazard.mitigation}
                  onChange={(event) => onUpdateHazard(hazard.id, 'mitigation', event.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Optional Notes
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm"
                  value={hazard.notes}
                  onChange={(event) => onUpdateHazard(hazard.id, 'notes', event.target.value)}
                  disabled={disabled}
                />
              </label>
            </article>
          ))}
        </div>
      </div>
    </fieldset>
  );
}


function PersonnelSelectField({
  label,
  value,
  personnel,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  personnel: ProposedRpic[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:py-2 sm:text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Select a proposed RPIC</option>
        {personnel.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RpicSnapshotCard({ selectedRpic, credentials, isLoading }: { selectedRpic: ProposedRpic | null; credentials: string | null; isLoading: boolean }) {
  if (isLoading) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">Loading personnel...</div>;
  }

  if (!selectedRpic) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">
        Select a personnel record to snapshot the proposed RPIC name, certifications, and professional bio into this proposal.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50 p-3 sm:col-span-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Selected RPIC</p>
        <h3 className="mt-1 text-base font-semibold text-brand-900">{selectedRpic.full_name}</h3>
      </div>
      <div className="grid gap-3 text-sm lg:grid-cols-2">
        <div className="rounded-lg bg-white p-3">
          <h4 className="font-semibold text-brand-900">Certifications Summary</h4>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{credentials || 'No certifications summary on file yet.'}</p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <h4 className="font-semibold text-brand-900">Professional Bio</h4>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{selectedRpic.professional_bio?.trim() || 'No professional bio on file yet.'}</p>
        </div>
      </div>
    </div>
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
