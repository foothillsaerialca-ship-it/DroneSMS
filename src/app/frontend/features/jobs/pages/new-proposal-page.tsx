import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { OrganizationIdentityCard } from '@frontend/features/settings/components/organization-identity-card';
import {
  createCustomPreliminaryHazard,
  fallbackHazardLibrary,
  getSelectedHazardName,
  getSuggestedHazards,
  searchHazards,
  selectLibraryHazard,
  serviceTypes,
  summarizeSelectedHazards,
  normalizeSelectedHazards,
  type HazardLibraryEntry,
  type SelectedPreliminaryHazard
} from '@frontend/features/safety/lib/preliminary-hazard-library';
import { loadOrganizationSettingsForUser, type OrganizationSettings } from '@frontend/features/settings/lib/organization-settings';

const proposalStatuses = ['Draft', 'Sent', 'Under Review', 'Accepted', 'Declined'];
const airspaceClasses = ['Not reviewed', 'Class B', 'Class C', 'Class D', 'Class E', 'Class G'];
const blockedEquipmentStatuses = new Set(['Archived', 'Retired', 'Out-of-Service', 'Out of Service', 'Maintenance']);

type ProposalFormState = {
  clientName: string;
  contactName: string;
  phone: string;
  email: string;
  proposalName: string;
  serviceType: string;
  siteAddress: string;
  description: string;
  proposedRpicId: string;
  airspaceClass: string;
  laancRequired: string;
  additionalAuthorizationRequired: string;
  proposalAmount: string;
  validUntil: string;
  status: string;
};

const initialFormState: ProposalFormState = {
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


type ProposalRecord = {
  id: string;
  organization_id: string;
  user_id: string;
  client_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  proposal_number: string | null;
  proposal_name: string;
  service_type: string;
  site_address: string | null;
  description: string | null;
  proposed_rpic_id: string | null;
  proposed_rpic_name: string | null;
  proposed_rpic_credentials: string | null;
  proposed_rpic_bio: string | null;
  airspace_class: string | null;
  laanc_required: boolean | null;
  additional_authorization_required: boolean | null;
  hazard_assessment: unknown;
  proposal_equipment: unknown;
  proposal_amount: number | string | null;
  valid_until: string | null;
  status: string | null;
};

type ProposalEquipmentAssignment = {
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  make: string | null;
  model: string | null;
  status: string;
  purpose: string;
};

type RepositoryEquipment = {
  id: string;
  name: string;
  equipment_type: string;
  make: string | null;
  model: string | null;
  status: string;
};

type RpicSnapshot = {
  full_name: string;
  credentials: string | null;
  professional_bio: string | null;
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

function fromBoolean(value: boolean | null | undefined) {
  return value ? 'Yes' : 'No';
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : '';
}


function getDefaultEquipmentPurpose(equipmentType: string, serviceType: string) {
  const normalizedType = equipmentType.trim().toLowerCase();
  if (normalizedType === 'drone') return `Primary aircraft for ${serviceType || '[service type]'} operations`;
  if (normalizedType === 'payload') return 'Payload delivery and application system';
  if (normalizedType === 'ground support') return 'Ground support and site control';
  if (normalizedType === 'filtration / water system' || normalizedType === 'filtration' || normalizedType === 'water system') return 'Purified water production on site';
  if (normalizedType === 'camera / sensor' || normalizedType === 'camera' || normalizedType === 'sensor') return 'Visual documentation and inspection';
  return '';
}

function normalizeProposalEquipment(value: unknown): ProposalEquipmentAssignment[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = item as Partial<ProposalEquipmentAssignment>;
      const equipmentId = typeof record.equipment_id === 'string' ? record.equipment_id : '';
      const equipmentName = typeof record.equipment_name === 'string' ? record.equipment_name : '';
      if (!equipmentId || !equipmentName) return null;

      return {
        equipment_id: equipmentId,
        equipment_name: equipmentName,
        equipment_type: typeof record.equipment_type === 'string' ? record.equipment_type : '',
        make: typeof record.make === 'string' ? record.make : null,
        model: typeof record.model === 'string' ? record.model : null,
        status: typeof record.status === 'string' ? record.status : '',
        purpose: typeof record.purpose === 'string' ? record.purpose : ''
      } satisfies ProposalEquipmentAssignment;
    })
    .filter((item): item is ProposalEquipmentAssignment => Boolean(item));
}

function formatEquipmentName(equipment: Pick<ProposalEquipmentAssignment, 'equipment_name' | 'make' | 'model'>) {
  const makeModel = [equipment.make, equipment.model].filter(Boolean).join(' ').trim();
  return makeModel ? `${equipment.equipment_name} — ${makeModel}` : equipment.equipment_name;
}

function isEquipmentSelectable(equipment: RepositoryEquipment) {
  return !blockedEquipmentStatuses.has(equipment.status);
}

function mapProposalToFormState(proposal: ProposalRecord) {
  return {
    clientName: proposal.client_name ?? '',
    contactName: proposal.contact_name ?? '',
    phone: proposal.phone ?? '',
    email: proposal.email ?? '',
    proposalName: proposal.proposal_name ?? '',
    serviceType: proposal.service_type || serviceTypes[0],
    siteAddress: proposal.site_address ?? '',
    description: proposal.description ?? '',
    proposedRpicId: proposal.proposed_rpic_id ?? '',
    airspaceClass: proposal.airspace_class ?? airspaceClasses[0],
    laancRequired: fromBoolean(proposal.laanc_required),
    additionalAuthorizationRequired: fromBoolean(proposal.additional_authorization_required),
    proposalAmount: proposal.proposal_amount === null || proposal.proposal_amount === undefined ? '' : String(proposal.proposal_amount),
    validUntil: toDateInputValue(proposal.valid_until),
    status: proposal.status || proposalStatuses[0]
  };
}

export function NewProposalPage() {
  const navigate = useNavigate();
  const { proposalId } = useParams();
  const isEditMode = Boolean(proposalId);
  const [formData, setFormData] = useState(initialFormState);
  const [hazardLibrary, setHazardLibrary] = useState<HazardLibraryEntry[]>(fallbackHazardLibrary);
  const [selectedHazards, setSelectedHazards] = useState<SelectedPreliminaryHazard[]>([]);
  const [customHazard, setCustomHazard] = useState({ hazardName: '', category: '', mitigation: '' });
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings | null>(null);
  const [personnel, setPersonnel] = useState<ProposedRpic[]>([]);
  const [equipment, setEquipment] = useState<RepositoryEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<ProposalEquipmentAssignment[]>([]);
  const [loadedProposal, setLoadedProposal] = useState<ProposalRecord | null>(null);
  const [isLoadingProposal, setIsLoadingProposal] = useState(Boolean(proposalId));
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);
  const [isLoadingPersonnel, setIsLoadingPersonnel] = useState(true);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(true);
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

    async function loadEquipment() {
      setIsLoadingEquipment(true);

      try {
        const { data, error: equipmentError } = await supabase
          .from('equipment')
          .select('id, name, equipment_type, make, model, status')
          .not('status', 'in', '(Archived,Retired,Out-of-Service,"Out of Service")')
          .order('name', { ascending: true });

        if (equipmentError) throw equipmentError;
        if (isMounted) setEquipment((data ?? []) as RepositoryEquipment[]);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoadingEquipment(false);
      }
    }

    async function loadProposalForEditing() {
      if (!proposalId) {
        if (isMounted) setIsLoadingProposal(false);
        return;
      }

      setIsLoadingProposal(true);

      try {
        const { data, error: proposalLoadError } = await supabase
          .from('proposals')
          .select('id, organization_id, user_id, client_name, contact_name, phone, email, proposal_number, proposal_name, service_type, site_address, description, proposed_rpic_id, proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio, airspace_class, laanc_required, additional_authorization_required, hazard_assessment, proposal_equipment, proposal_amount, valid_until, status')
          .eq('id', proposalId)
          .is('deleted_at', null)
          .single();

        if (proposalLoadError) throw proposalLoadError;

        if (isMounted) {
          const proposal = data as ProposalRecord;
          setLoadedProposal(proposal);
          setFormData(mapProposalToFormState(proposal));
          setSelectedHazards(normalizeSelectedHazards(proposal.hazard_assessment));
          setSelectedEquipment(normalizeProposalEquipment(proposal.proposal_equipment));
        }
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoadingProposal(false);
      }
    }

    async function loadHazardLibrary() {
      try {
        const { data, error: hazardLibraryError } = await supabase
          .from('hazard_library')
          .select('id, hazard_name, category, default_mitigation, service_types, is_universal, is_system_hazard')
          .order('category', { ascending: true })
          .order('hazard_name', { ascending: true });

        if (hazardLibraryError) throw hazardLibraryError;
        if (isMounted && data?.length) setHazardLibrary(data as HazardLibraryEntry[]);
      } catch {
        if (isMounted) setHazardLibrary(fallbackHazardLibrary);
      }
    }

    void loadCompanyIdentity();
    void loadPersonnel();
    void loadEquipment();
    void loadHazardLibrary();
    void loadProposalForEditing();

    return () => {
      isMounted = false;
    };
  }, [proposalId]);

  const selectedRpic = useMemo(() => personnel.find((person) => person.id === formData.proposedRpicId) ?? null, [personnel, formData.proposedRpicId]);

  const rpicCredentials = useMemo(() => buildFallbackCredentials(selectedRpic), [selectedRpic]);

  const displayedRpicSnapshot = useMemo<RpicSnapshot | null>(() => {
    if (selectedRpic) {
      return {
        full_name: selectedRpic.full_name,
        credentials: rpicCredentials,
        professional_bio: selectedRpic.professional_bio?.trim() || null
      };
    }

    if (isEditMode && loadedProposal?.proposed_rpic_name && formData.proposedRpicId === (loadedProposal.proposed_rpic_id ?? '')) {
      return {
        full_name: loadedProposal.proposed_rpic_name,
        credentials: loadedProposal.proposed_rpic_credentials,
        professional_bio: loadedProposal.proposed_rpic_bio
      };
    }

    return null;
  }, [formData.proposedRpicId, isEditMode, loadedProposal, rpicCredentials, selectedRpic]);

  const isFormDisabled = isSaving || isLoadingProposal;

  function updateField(field: keyof typeof initialFormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function addLibraryHazard(hazardId: string) {
    const libraryHazard = hazardLibrary.find((hazard) => hazard.id === hazardId);
    if (!libraryHazard) return;

    setSelectedHazards((current) =>
      current.some(
        (hazard) => hazard.id === hazardId || getSelectedHazardName(hazard).toLowerCase() === libraryHazard.hazard_name.toLowerCase()
      )
        ? current
        : [...current, selectLibraryHazard(libraryHazard)]
    );
  }

  function removeHazard(hazardId: string) {
    setSelectedHazards((current) => current.filter((hazard) => hazard.id !== hazardId));
  }

  function updateSelectedHazard(hazardId: string, value: string) {
    setSelectedHazards((current) =>
      current.map((hazard) => (hazard.id === hazardId ? { ...hazard, mitigation: value } : hazard))
    );
  }

  function updateCustomHazard(field: keyof typeof customHazard, value: string) {
    setCustomHazard((current) => ({ ...current, [field]: value }));
  }

  function addEquipment(equipmentId: string) {
    const selected = equipment.find((item) => item.id === equipmentId);
    if (!selected || !isEquipmentSelectable(selected)) return;

    setSelectedEquipment((current) =>
      current.some((item) => item.equipment_id === selected.id)
        ? current
        : [
            ...current,
            {
              equipment_id: selected.id,
              equipment_name: selected.name,
              equipment_type: selected.equipment_type,
              make: selected.make,
              model: selected.model,
              status: selected.status,
              purpose: getDefaultEquipmentPurpose(selected.equipment_type, formData.serviceType)
            }
          ]
    );
  }

  function removeEquipment(equipmentId: string) {
    setSelectedEquipment((current) => current.filter((item) => item.equipment_id !== equipmentId));
  }

  function updateEquipmentPurpose(equipmentId: string, purpose: string) {
    setSelectedEquipment((current) => current.map((item) => (item.equipment_id === equipmentId ? { ...item, purpose } : item)));
  }

  function addCustomHazard() {
    const hazardName = customHazard.hazardName.trim();
    const category = customHazard.category.trim();
    const mitigation = customHazard.mitigation.trim();
    if (!hazardName || !category || !mitigation) return;

    setSelectedHazards((current) =>
      current.some((hazard) => getSelectedHazardName(hazard).toLowerCase() === hazardName.toLowerCase())
        ? current
        : [...current, createCustomPreliminaryHazard(hazardName, category, mitigation)]
    );
    setCustomHazard({ hazardName: '', category: '', mitigation: '' });
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
        throw new Error('Finish company onboarding before saving proposals.');
      }

      const summarizedHazards = summarizeSelectedHazards(selectedHazards);
      const unchangedExistingRpic =
        isEditMode &&
        loadedProposal &&
        formData.proposedRpicId &&
        formData.proposedRpicId === (loadedProposal.proposed_rpic_id ?? '') &&
        !selectedRpic;
      const rpicSnapshot = unchangedExistingRpic
        ? {
            id: loadedProposal.proposed_rpic_id,
            full_name: loadedProposal.proposed_rpic_name,
            credentials: loadedProposal.proposed_rpic_credentials,
            professional_bio: loadedProposal.proposed_rpic_bio
          }
        : {
            id: selectedRpic?.id ?? null,
            full_name: selectedRpic?.full_name ?? null,
            credentials: buildFallbackCredentials(selectedRpic),
            professional_bio: selectedRpic?.professional_bio?.trim() || null
          };

      const proposalPayload = {
        client_name: formData.clientName.trim(),
        contact_name: formData.contactName.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        proposal_name: formData.proposalName.trim(),
        service_type: formData.serviceType,
        site_address: formData.siteAddress.trim(),
        description: formData.description.trim() || null,
        proposed_rpic_id: rpicSnapshot.id || null,
        proposed_rpic_name: rpicSnapshot.full_name || null,
        proposed_rpic_credentials: rpicSnapshot.credentials || null,
        proposed_rpic_bio: rpicSnapshot.professional_bio || null,
        proposed_rpic: rpicSnapshot.full_name || null,
        airspace_class: formData.airspaceClass === 'Not reviewed' ? null : formData.airspaceClass,
        laanc_required: toBoolean(formData.laancRequired),
        additional_authorization_required: toBoolean(formData.additionalAuthorizationRequired),
        hazard: summarizedHazards.hazard,
        proposed_mitigation: summarizedHazards.proposedMitigation,
        hazard_assessment: selectedHazards.map(({ id, hazard_name, category, mitigation, source }) => ({ id, hazard_name, category, mitigation, source })),
        proposal_equipment: selectedEquipment.map(({ equipment_id, equipment_name, equipment_type, make, model, status, purpose }) => ({
          equipment_id,
          equipment_name,
          equipment_type,
          make,
          model,
          status,
          purpose: purpose.trim()
        })),
        proposal_amount: formData.proposalAmount ? Number(formData.proposalAmount) : null,
        valid_until: formData.validUntil || null,
        status: formData.status,
        updated_at: new Date().toISOString()
      };

      if (isEditMode) {
        if (!proposalId) throw new Error('Proposal ID is missing.');

        const { error: proposalError } = await supabase
          .from('proposals')
          .update(proposalPayload)
          .eq('id', proposalId);

        if (proposalError) throw proposalError;
      } else {
        const { error: proposalError } = await supabase.from('proposals').insert({
          organization_id: organizationId,
          user_id: userData.user.id,
          proposal_number: createProposalNumber(),
          ...proposalPayload
        });

        if (proposalError) throw proposalError;
      }

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
          <h1 className="mt-1 text-2xl font-semibold text-brand-900">{isEditMode ? 'Edit Proposal' : 'Create Proposal'}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {isEditMode
              ? 'Update this living proposal while preserving its proposal ID and proposal number.'
              : 'Capture the first stage of the operational lifecycle before creating a job.'}
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
        {isLoadingProposal ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading proposal details...</div>
        ) : null}

        <FormSection title="Client Information">
          <TextField label="Client Name" value={formData.clientName} onChange={(value) => updateField('clientName', value)} disabled={isFormDisabled} required />
          <TextField label="Contact Name" value={formData.contactName} onChange={(value) => updateField('contactName', value)} disabled={isFormDisabled} />
          <TextField label="Phone" type="tel" value={formData.phone} onChange={(value) => updateField('phone', value)} disabled={isFormDisabled} />
          <TextField label="Email" type="email" value={formData.email} onChange={(value) => updateField('email', value)} disabled={isFormDisabled} />
        </FormSection>

        <FormSection title="Project Information">
          <TextField label="Proposal Name" value={formData.proposalName} onChange={(value) => updateField('proposalName', value)} disabled={isFormDisabled} required />
          <SelectField label="Service Type" value={formData.serviceType} options={serviceTypes} onChange={(value) => updateField('serviceType', value)} disabled={isFormDisabled} />
          <TextField label="Site Address" value={formData.siteAddress} onChange={(value) => updateField('siteAddress', value)} disabled={isFormDisabled} required />
          <TextAreaField label="Description" value={formData.description} onChange={(value) => updateField('description', value)} disabled={isFormDisabled} />
        </FormSection>

        <FormSection title="Proposed RPIC">
          <PersonnelSelectField
            label="Proposed RPIC"
            value={formData.proposedRpicId}
            personnel={personnel}
            onChange={(value) => updateField('proposedRpicId', value)}
            disabled={isFormDisabled || isLoadingPersonnel}
            currentSnapshot={displayedRpicSnapshot}
          />
          <RpicSnapshotCard snapshot={displayedRpicSnapshot} isLoading={isLoadingPersonnel} />
        </FormSection>

        <EquipmentSelection
          equipment={equipment}
          selectedEquipment={selectedEquipment}
          disabled={isFormDisabled}
          isLoading={isLoadingEquipment}
          onAddEquipment={addEquipment}
          onRemoveEquipment={removeEquipment}
          onUpdatePurpose={updateEquipmentPurpose}
        />

        <HazardSelection
          selectedHazards={selectedHazards}
          customHazard={customHazard}
          disabled={isFormDisabled}
          serviceType={formData.serviceType}
          hazardLibrary={hazardLibrary}
          onAddLibraryHazard={addLibraryHazard}
          onRemoveHazard={removeHazard}
          onUpdateHazard={updateSelectedHazard}
          onCustomHazardChange={updateCustomHazard}
          onAddCustomHazard={addCustomHazard}
        />

        <FormSection title="Airspace Review">
          <SelectField label="Airspace Class" value={formData.airspaceClass} options={airspaceClasses} onChange={(value) => updateField('airspaceClass', value)} disabled={isFormDisabled} />
          <SelectField label="LAANC Required" value={formData.laancRequired} options={['No', 'Yes']} onChange={(value) => updateField('laancRequired', value)} disabled={isFormDisabled} />
          <SelectField label="Additional Authorization Required" value={formData.additionalAuthorizationRequired} options={['No', 'Yes']} onChange={(value) => updateField('additionalAuthorizationRequired', value)} disabled={isFormDisabled} />
        </FormSection>

        <FormSection title="Pricing">
          <TextField label="Proposal Amount" type="number" value={formData.proposalAmount} onChange={(value) => updateField('proposalAmount', value)} disabled={isFormDisabled} />
          <TextField label="Proposal Valid Until Date" type="date" value={formData.validUntil} onChange={(value) => updateField('validUntil', value)} disabled={isFormDisabled} />
          <SelectField label="Status" value={formData.status} options={proposalStatuses} onChange={(value) => updateField('status', value)} disabled={isFormDisabled} />
        </FormSection>

        <ProposalEquipmentSummary selectedEquipment={selectedEquipment} />

        {selectedEquipment.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
            No equipment has been assigned to this proposal. The Equipment section of the generated proposal will contain placeholder content until equipment is selected.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2"
            disabled={isFormDisabled}
          >
            {isSaving ? 'Saving...' : isEditMode ? 'Update Proposal' : 'Save Proposal'}
          </button>
        </div>
      </form>
    </section>
  );
}



function EquipmentSelection({
  equipment,
  selectedEquipment,
  disabled,
  isLoading,
  onAddEquipment,
  onRemoveEquipment,
  onUpdatePurpose
}: {
  equipment: RepositoryEquipment[];
  selectedEquipment: ProposalEquipmentAssignment[];
  disabled: boolean;
  isLoading: boolean;
  onAddEquipment: (equipmentId: string) => void;
  onRemoveEquipment: (equipmentId: string) => void;
  onUpdatePurpose: (equipmentId: string, purpose: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const selectedIds = useMemo(() => new Set(selectedEquipment.map((item) => item.equipment_id)), [selectedEquipment]);
  const filteredEquipment = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return equipment.filter((item) => {
      if (blockedEquipmentStatuses.has(item.status)) return false;
      if (!query) return true;
      return [item.name, item.equipment_type, item.make, item.model, item.status].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  }, [equipment, searchQuery]);

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <legend className="px-1 text-base font-semibold text-brand-900">Proposal Equipment</legend>
      <p className="mt-2 text-sm text-slate-600">Select active equipment from the Equipment repository and document each item’s proposal-specific purpose.</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search equipment by name…" disabled={disabled} />
          {isLoading ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Loading equipment...</p> : null}
          {!isLoading && filteredEquipment.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">No selectable equipment records match your search.</p> : null}
          {filteredEquipment.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <article key={item.id} className={`rounded-lg border p-3 text-sm ${item.status === 'Available' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-brand-900">{item.name}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{item.equipment_type} {item.make || item.model ? `• ${[item.make, item.model].filter(Boolean).join(' ')}` : ''}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-700">Status: <span className={item.status === 'Available' ? 'text-emerald-700' : 'text-slate-700'}>{item.status}</span></p>
                  </div>
                  <button type="button" className="min-h-11 rounded-lg border border-brand-700 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400" onClick={() => onAddEquipment(item.id)} disabled={disabled || isSelected || !isEquipmentSelectable(item)}>{isSelected ? 'Added' : 'Add'}</button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-brand-900">Selected Equipment</h3>
          {selectedEquipment.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No equipment selected yet.</p> : null}
          {selectedEquipment.map((item) => (
            <article key={item.equipment_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-brand-900">{formatEquipmentName(item)}</h4>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{item.equipment_type} • {item.status}</p>
                </div>
                <button type="button" className="min-h-11 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:text-slate-400 sm:text-right" onClick={() => onRemoveEquipment(item.equipment_id)} disabled={disabled}>Remove</button>
              </div>
              <label className="mt-3 block text-sm font-medium text-slate-700">Purpose<textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm" value={item.purpose} onChange={(event) => onUpdatePurpose(item.equipment_id, event.target.value)} disabled={disabled} /></label>
            </article>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function ProposalEquipmentSummary({ selectedEquipment }: { selectedEquipment: ProposalEquipmentAssignment[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-brand-900">Proposal Equipment Summary</h2>
      <p className="mt-2 text-sm text-slate-600">Review selected equipment before saving and generating the proposal PDF.</p>
      {selectedEquipment.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">No equipment assigned.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="py-2 pr-4">Equipment Name</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Purpose</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{selectedEquipment.map((item) => <tr key={item.equipment_id}><td className="py-2 pr-4 font-medium text-brand-900">{item.equipment_name}</td><td className="py-2 pr-4 text-slate-700">{item.equipment_type}</td><td className="py-2 pr-4 text-slate-700">{item.purpose || 'No purpose entered.'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HazardSelection({
  serviceType,
  hazardLibrary,
  selectedHazards,
  customHazard,
  disabled,
  onAddLibraryHazard,
  onRemoveHazard,
  onUpdateHazard,
  onCustomHazardChange,
  onAddCustomHazard
}: {
  serviceType: string;
  hazardLibrary: HazardLibraryEntry[];
  selectedHazards: SelectedPreliminaryHazard[];
  customHazard: { hazardName: string; category: string; mitigation: string };
  disabled: boolean;
  onAddLibraryHazard: (hazardId: string) => void;
  onRemoveHazard: (hazardId: string) => void;
  onUpdateHazard: (hazardId: string, value: string) => void;
  onCustomHazardChange: (field: keyof typeof customHazard, value: string) => void;
  onAddCustomHazard: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const suggestedHazards = useMemo(() => getSuggestedHazards(hazardLibrary, serviceType), [hazardLibrary, serviceType]);
  const searchResults = useMemo(() => searchHazards(hazardLibrary, searchQuery), [hazardLibrary, searchQuery]);
  const selectedHazardIds = useMemo(() => new Set(selectedHazards.map((hazard) => hazard.id)), [selectedHazards]);
  const selectedHazardNames = useMemo(
    () => new Set(selectedHazards.map((hazard) => getSelectedHazardName(hazard).toLowerCase())),
    [selectedHazards]
  );
  const canAddCustomHazard = customHazard.hazardName.trim() && customHazard.category.trim() && customHazard.mitigation.trim();

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <legend className="px-1 text-base font-semibold text-brand-900">Proposal Hazard Identification</legend>
      <p className="mt-2 text-sm text-slate-600">
        Review suggested hazards for the selected service type, add any applicable library hazards, and document proposal-specific mitigations. Suggested hazards are not added unless selected.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-brand-900">Suggested Hazards</h3>
              <span className="text-xs font-medium text-slate-500">{serviceType}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {serviceType === 'Custom Operation'
                ? 'Custom Operation does not auto-suggest mission-type hazards. Search the library or add custom hazards below.'
                : 'Universal hazards and hazards matching this service type are shown here for optional selection.'}
            </p>

            {suggestedHazards.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {suggestedHazards.map((hazard) => {
                  const selectedHazard = selectedHazards.find(
                    (entry) => entry.id === hazard.id || getSelectedHazardName(entry).toLowerCase() === hazard.hazard_name.toLowerCase()
                  );

                  return (
                    <label key={hazard.id} className="flex min-h-12 items-start gap-2 rounded-lg bg-white p-3 text-sm text-slate-700">
                      <input
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-100"
                        type="checkbox"
                        checked={Boolean(selectedHazard)}
                        onChange={() => (selectedHazard ? onRemoveHazard(selectedHazard.id) : onAddLibraryHazard(hazard.id))}
                        disabled={disabled}
                      />
                      <span>
                        <span className="font-medium text-slate-800">{hazard.hazard_name}</span>
                        <span className="mt-1 block text-xs uppercase tracking-wide text-slate-500">{hazard.category}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                No service-type suggestions are shown for Custom Operation.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-brand-900">Search Hazard Library</h3>
            <input
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search hazards…"
              disabled={disabled}
            />
            {searchQuery.trim() ? (
              <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                {searchResults.length ? searchResults.map((hazard) => {
                  const isSelected = selectedHazardIds.has(hazard.id) || selectedHazardNames.has(hazard.hazard_name.toLowerCase());

                  return (
                    <div key={hazard.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-brand-900">{hazard.hazard_name}</p>
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{hazard.category}</p>
                          <p className="mt-2 line-clamp-3 text-slate-600">{hazard.default_mitigation}</p>
                        </div>
                        <button
                          type="button"
                          className="min-h-11 rounded-lg border border-brand-700 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                          onClick={() => onAddLibraryHazard(hazard.id)}
                          disabled={disabled || isSelected}
                        >
                          {isSelected ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">No hazards match your search.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-brand-900">Custom Hazard</h3>
            <p className="mt-1 text-xs text-slate-600">Custom hazards attach only to this proposal and are not added to the master library.</p>
            <div className="mt-3 grid gap-3">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm"
                type="text"
                value={customHazard.hazardName}
                onChange={(event) => onCustomHazardChange('hazardName', event.target.value)}
                placeholder="Hazard Name"
                disabled={disabled}
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm"
                type="text"
                value={customHazard.category}
                onChange={(event) => onCustomHazardChange('category', event.target.value)}
                placeholder="Category"
                disabled={disabled}
              />
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm"
                value={customHazard.mitigation}
                onChange={(event) => onCustomHazardChange('mitigation', event.target.value)}
                placeholder="Mitigation"
                disabled={disabled}
              />
              <button
                type="button"
                className="min-h-11 rounded-lg border border-brand-700 bg-white px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 sm:w-fit"
                onClick={onAddCustomHazard}
                disabled={disabled || !canAddCustomHazard}
              >
                Add Custom Hazard
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-brand-900">Selected Proposal Hazards</h3>
          {selectedHazards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No hazards selected yet. Select suggested hazards, search the library, or add a custom hazard.
            </div>
          ) : null}

          {selectedHazards.map((hazard) => {
            const defaultMitigation = hazardLibrary.find((libraryHazard) => libraryHazard.id === hazard.id)?.default_mitigation ?? hazard.mitigation;

            return (
              <article key={hazard.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-brand-900">{getSelectedHazardName(hazard)}</h4>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {hazard.category} • {hazard.source === 'custom' ? 'Custom' : 'Library'}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:text-slate-400 sm:text-right"
                  onClick={() => onRemoveHazard(hazard.id)}
                  disabled={disabled}
                >
                  Remove
                </button>
              </div>
              <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default mitigation</p>
                <p className="mt-1 whitespace-pre-wrap">{defaultMitigation}</p>
              </div>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Editable Mitigation
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 sm:text-sm"
                  value={hazard.mitigation}
                  onChange={(event) => onUpdateHazard(hazard.id, event.target.value)}
                  disabled={disabled}
                />
              </label>
              </article>
            );
          })}
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
  disabled,
  currentSnapshot
}: {
  label: string;
  value: string;
  personnel: ProposedRpic[];
  onChange: (value: string) => void;
  disabled: boolean;
  currentSnapshot: RpicSnapshot | null;
}) {
  const hasCurrentPersonnelOption = personnel.some((person) => person.id === value);

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
        {value && currentSnapshot && !hasCurrentPersonnelOption ? (
          <option value={value}>{currentSnapshot.full_name} (saved snapshot)</option>
        ) : null}
        {personnel.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RpicSnapshotCard({ snapshot, isLoading }: { snapshot: RpicSnapshot | null; isLoading: boolean }) {
  if (isLoading && !snapshot) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">Loading personnel...</div>;
  }

  if (!snapshot) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">
        Select a personnel record to snapshot the proposed RPIC name, certifications, and professional bio into this proposal.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50 p-3 sm:col-span-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Selected RPIC Snapshot</p>
        <h3 className="mt-1 text-base font-semibold text-brand-900">{snapshot.full_name}</h3>
      </div>
      <div className="grid gap-3 text-sm lg:grid-cols-2">
        <div className="rounded-lg bg-white p-3">
          <h4 className="font-semibold text-brand-900">Certifications Summary</h4>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{snapshot.credentials || 'No certifications summary on file yet.'}</p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <h4 className="font-semibold text-brand-900">Professional Bio</h4>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{snapshot.professional_bio?.trim() || 'No professional bio on file yet.'}</p>
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
  options: readonly string[];
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
