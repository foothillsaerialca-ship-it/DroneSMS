import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';

const typeOptions = ['Drone', 'Controller', 'Battery', 'Payload', 'Ground Support', 'Filtration / Water System', 'Camera / Sensor', 'Charger', 'Safety Kit', 'Chemical / Material', 'Other'];
const statusOptions = ['Available', 'In Use', 'Maintenance', 'Inactive', 'Retired'];
const maintenanceFilterOptions = ['All', 'Not Scheduled', 'Due Soon', 'Overdue'];
const chemicalMaterialType = 'Chemical / Material';
const chemicalDocumentTypes = ['Safety Data Sheet (SDS)', 'Product Label', 'Technical Data Sheet (TDS)'] as const;
type ChemicalDocumentType = (typeof chemicalDocumentTypes)[number];

const initialFormState = {
  name: '',
  equipmentType: typeOptions[0],
  make: '',
  model: '',
  serialNumber: '',
  faaRegistrationNumber: '',
  assignedLocation: '',
  status: statusOptions[0],
  maintenanceDueDate: '',
  notes: '',
  productCategory: '',
  typicalMixRatio: '',
  applicationNotes: '',
  purpose: '',
  epaRegistrationNumber: '',
  signalWord: '',
  restrictedUseProduct: 'No'
};

type Equipment = {
  id: string;
  name: string;
  equipment_type: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  faa_registration_number: string | null;
  assigned_location: string | null;
  status: string;
  maintenance_due_date: string | null;
  notes: string | null;
  product_category: string | null;
  typical_mix_ratio: string | null;
  application_notes: string | null;
  purpose: string | null;
  epa_registration_number: string | null;
  signal_word: string | null;
  restricted_use_product: boolean | null;
  equipment_reference_documents?: EquipmentReferenceDocument[];
  updated_at: string;
};

type EquipmentFormState = typeof initialFormState;

type EquipmentReferenceDocument = {
  id: string;
  equipment_id: string;
  document_type: ChemicalDocumentType;
  file_name: string;
  display_file_name: string | null;
  storage_path: string;
  created_at: string;
};

type PendingReferenceDocument = { documentType: ChemicalDocumentType; file: File };

const equipmentReferenceDocumentsBucket = 'equipment-reference-documents';

type ReadinessState = {
  label: string;
  detail: string;
  className: string;
  sortOrder: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load equipment. Please try again.';
}

function formatDate(date: string | null) {
  if (!date) return 'Not scheduled';

  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;

  return `${month}/${day}/${year}`;
}

function daysUntil(date: string) {
  const targetDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000);
}

function getMaintenanceStatus(equipment: Equipment): 'not-scheduled' | 'due-soon' | 'overdue' {
  if (!equipment.maintenance_due_date) return 'not-scheduled';

  const remainingDays = daysUntil(equipment.maintenance_due_date);

  if (remainingDays < 0) return 'overdue';
  if (remainingDays <= 30) return 'due-soon';

  return 'not-scheduled';
}

function getReadinessState(equipment: Equipment): ReadinessState {
  if (equipment.status === 'Retired') {
    return {
      label: 'Retired',
      detail: 'Removed from operational equipment assignments.',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
      sortOrder: 5
    };
  }

  if (equipment.status === 'Maintenance') {
    return {
      label: 'Maintenance',
      detail: 'Do not assign until maintenance is complete.',
      className: 'border-red-200 bg-red-50 text-red-700',
      sortOrder: 0
    };
  }

  if (equipment.maintenance_due_date) {
    const remainingDays = daysUntil(equipment.maintenance_due_date);

    if (remainingDays < 0) {
      return {
        label: 'Overdue',
        detail: `Maintenance overdue by ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'}.`,
        className: 'border-red-200 bg-red-50 text-red-700',
        sortOrder: 1
      };
    }

    if (remainingDays <= 30) {
      return {
        label: 'Due Soon',
        detail: `Maintenance due in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.`,
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        sortOrder: 2
      };
    }
  }

  if (equipment.status === 'In Use') {
    return {
      label: 'Assigned',
      detail: 'Currently assigned or checked out for operations.',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      sortOrder: 3
    };
  }

  return {
    label: 'Ready',
    detail: equipment.maintenance_due_date
      ? `Maintenance current through ${formatDate(equipment.maintenance_due_date)}.`
      : 'Available with no scheduled maintenance blocker.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sortOrder: 4
  };
}

function toFormState(equipment: Equipment): EquipmentFormState {
  return {
    name: equipment.name,
    equipmentType: equipment.equipment_type,
    make: equipment.make ?? '',
    model: equipment.model ?? '',
    serialNumber: equipment.serial_number ?? '',
    faaRegistrationNumber: equipment.faa_registration_number ?? '',
    assignedLocation: equipment.assigned_location ?? '',
    status: equipment.status,
    maintenanceDueDate: equipment.maintenance_due_date ?? '',
    notes: equipment.notes ?? '',
    productCategory: equipment.product_category ?? '',
    typicalMixRatio: equipment.typical_mix_ratio ?? '',
    applicationNotes: equipment.application_notes ?? '',
    purpose: equipment.purpose ?? '',
    epaRegistrationNumber: equipment.epa_registration_number ?? '',
    signalWord: equipment.signal_word ?? '',
    restrictedUseProduct: equipment.restricted_use_product ? 'Yes' : 'No'
  };
}

async function getCurrentOrganizationId(userId: string) {
  const { data, error } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle();

  if (error) throw error;

  return data?.organization_id ?? null;
}

function isChemicalMaterial(formData: EquipmentFormState | Equipment) {
  return ('equipmentType' in formData ? formData.equipmentType : formData.equipment_type) === chemicalMaterialType;
}

function sanitizeStorageName(value: string) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'document';
}

function buildEquipmentPayload(formData: EquipmentFormState) {
  const chemical = formData.equipmentType === chemicalMaterialType;
  return {
    name: formData.name.trim(),
    equipment_type: formData.equipmentType,
    make: formData.make.trim() || null,
    model: formData.model.trim() || null,
    serial_number: formData.serialNumber.trim() || null,
    faa_registration_number: formData.faaRegistrationNumber.trim() || null,
    assigned_location: formData.assignedLocation.trim() || null,
    status: formData.status,
    maintenance_due_date: formData.maintenanceDueDate || null,
    notes: formData.notes.trim() || null,
    product_category: chemical ? formData.productCategory.trim() || null : null,
    typical_mix_ratio: chemical ? formData.typicalMixRatio.trim() || null : null,
    application_notes: chemical ? formData.applicationNotes.trim() || null : null,
    purpose: chemical ? formData.purpose.trim() || null : null,
    epa_registration_number: chemical ? formData.epaRegistrationNumber.trim() || null : null,
    signal_word: chemical ? formData.signalWord.trim() || null : null,
    restricted_use_product: chemical ? formData.restrictedUseProduct === 'Yes' : null,
    updated_at: new Date().toISOString()
  };
}

export function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [formData, setFormData] = useState<EquipmentFormState>(initialFormState);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [maintenanceFilter, setMaintenanceFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingEquipmentId, setDeletingEquipmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<PendingReferenceDocument[]>([]);

  async function loadEquipment() {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, name, equipment_type, make, model, serial_number, faa_registration_number, assigned_location, status, maintenance_due_date, notes, product_category, typical_mix_ratio, application_notes, epa_registration_number, signal_word, restricted_use_product, purpose, updated_at, equipment_reference_documents(id, equipment_id, document_type, file_name, display_file_name, storage_path, created_at)')
        .order('status', { ascending: true })
        .order('name', { ascending: true });

      if (equipmentError) throw equipmentError;

      setEquipment((data ?? []) as Equipment[]);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEquipment();
  }, []);

  const readinessCounts = useMemo(() => {
    return equipment.reduce(
      (counts, item) => {
        const readiness = getReadinessState(item);
        if (readiness.label === 'Ready') counts.ready += 1;
        if (readiness.label === 'Due Soon') counts.dueSoon += 1;
        if (readiness.label === 'Overdue' || readiness.label === 'Maintenance') counts.blocked += 1;
        if (item.status !== 'Retired') counts.active += 1;
        return counts;
      },
      { ready: 0, dueSoon: 0, blocked: 0, active: 0 }
    );
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    let filtered = equipment
      .filter((item) => statusFilter === 'All' || item.status === statusFilter)
      .filter((item) => typeFilter === 'All' || item.equipment_type === typeFilter)
      .filter((item) => {
        if (maintenanceFilter === 'All') return true;
        const maintenanceStatus = getMaintenanceStatus(item);
        return maintenanceStatus === maintenanceFilter.toLowerCase().replace(' ', '-');
      })
      .filter((item) => {
        if (!normalizedSearch) return true;

        return [item.name, item.equipment_type, item.make, item.model, item.serial_number, item.faa_registration_number, item.assigned_location]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedSearch));
      });

    // Custom sorting when maintenance filter is active
    if (maintenanceFilter !== 'All') {
      filtered.sort((left, right) => {
        if (!left.maintenance_due_date && !right.maintenance_due_date) return left.name.localeCompare(right.name);
        if (!left.maintenance_due_date) return 1;
        if (!right.maintenance_due_date) return -1;

        const leftDays = daysUntil(left.maintenance_due_date);
        const rightDays = daysUntil(right.maintenance_due_date);

        // For "Due Soon", sort by soonest first (ascending days)
        if (maintenanceFilter === 'Due Soon') {
          return leftDays - rightDays;
        }

        // For "Overdue", sort by furthest past first (most negative first)
        if (maintenanceFilter === 'Overdue') {
          return leftDays - rightDays;
        }

        return left.name.localeCompare(right.name);
      });
    } else {
      // Default sorting when no maintenance filter
      filtered.sort((left, right) => {
        const readinessDifference = getReadinessState(left).sortOrder - getReadinessState(right).sortOrder;
        if (readinessDifference !== 0) return readinessDifference;
        return left.name.localeCompare(right.name);
      });
    }

    return filtered;
  }, [equipment, searchQuery, statusFilter, typeFilter, maintenanceFilter]);

  function updateField(field: keyof EquipmentFormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
    setSaveMessage(null);
  }

  function resetForm() {
    setFormData(initialFormState);
    setEditingEquipmentId(null);
    setIsFormOpen(false);
    setPendingDocuments([]);
    setError(null);
    setSaveMessage(null);
  }

  function handleAdd() {
    setFormData(initialFormState);
    setEditingEquipmentId(null);
    setIsFormOpen(true);
    setPendingDocuments([]);
    setError(null);
    setSaveMessage(null);
  }

  function validateForm() {
    if (!formData.name.trim()) return 'Equipment name is required.';
    if (!formData.equipmentType) return 'Equipment type is required.';
    if (!formData.status) return 'Status is required.';
    if (formData.equipmentType === chemicalMaterialType && !formData.productCategory.trim()) return 'Product category is required for Chemical / Material records.';
    return null;
  }

  function addPendingDocument(documentType: ChemicalDocumentType, files: FileList | null) {
    if (!files?.length) return;
    setPendingDocuments((current) => [...current, ...Array.from(files).map((file) => ({ documentType, file }))]);
  }

  function removePendingDocument(index: number) {
    setPendingDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function uploadPendingDocuments(equipmentId: string, organizationId: string) {
    await Promise.all(pendingDocuments.map(async ({ documentType, file }) => {
      const storagePath = `${organizationId}/${equipmentId}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(equipmentReferenceDocumentsBucket).upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('equipment_reference_documents').insert({ equipment_id: equipmentId, organization_id: organizationId, document_type: documentType, file_name: storagePath.split('/').pop() ?? file.name, display_file_name: file.name, storage_path: storagePath, file_size: file.size, mime_type: file.type || 'application/pdf' });
      if (insertError) throw insertError;
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaveMessage(null);
    setIsSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to save equipment.');

      const payload = buildEquipmentPayload(formData);
      const successMessage = editingEquipmentId ? 'Equipment record updated.' : 'Equipment record added.';

      if (editingEquipmentId) {
        const { data: updated, error: updateError } = await supabase.from('equipment').update(payload).eq('id', editingEquipmentId).select('id, organization_id').single();
        if (updateError) throw updateError;
        if (pendingDocuments.length) await uploadPendingDocuments(updated.id, updated.organization_id);
      } else {
        const organizationId = await getCurrentOrganizationId(userData.user.id);

        if (!organizationId) {
          throw new Error('Finish company onboarding before adding equipment.');
        }

        const { data: inserted, error: insertError } = await supabase.from('equipment').insert({
          ...payload,
          organization_id: organizationId,
          user_id: userData.user.id
        }).select('id, organization_id').single();

        if (insertError) throw insertError;
        if (pendingDocuments.length) await uploadPendingDocuments(inserted.id, inserted.organization_id);
      }

      resetForm();
      setSaveMessage(successMessage);
      await loadEquipment();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item: Equipment) {
    const confirmed = window.confirm(`Delete ${item.name}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingEquipmentId(item.id);
    setError(null);
    setSaveMessage(null);

    try {
      const { error: deleteError } = await supabase.from('equipment').delete().eq('id', item.id);
      if (deleteError) throw deleteError;

      if (editingEquipmentId === item.id) resetForm();
      setSaveMessage('Equipment record deleted.');
      await loadEquipment();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeletingEquipmentId(null);
    }
  }

  function handleEdit(item: Equipment) {
    setEditingEquipmentId(item.id);
    setIsFormOpen(true);
    setFormData(toFormState(item));
    setPendingDocuments([]);
    setError(null);
    setSaveMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const showChemicalFields = formData.equipmentType === chemicalMaterialType;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Repository</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">Equipment</h1>
            <p className="mt-2 text-sm text-slate-600">
              Track aircraft, payloads, support gear, chemicals/materials, maintenance windows, and operational readiness.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:min-w-64">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-lg font-semibold text-brand-900">{readinessCounts.active}</p>
              <p className="text-xs text-slate-500">Active Items</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-lg font-semibold text-emerald-700">{readinessCounts.ready}</p>
              <p className="text-xs text-emerald-700">Ready</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-lg font-semibold text-amber-700">{readinessCounts.dueSoon}</p>
              <p className="text-xs text-amber-700">Due Soon</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-lg font-semibold text-red-700">{readinessCounts.blocked}</p>
              <p className="text-xs text-red-700">Blocked</p>
            </div>
          </div>
        </div>
      </div>

      {isFormOpen ? (
      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-900">{editingEquipmentId ? 'Edit Equipment' : 'Add Equipment'}</h2>
            <p className="mt-1 text-sm text-slate-600">Capture required equipment details first, then add maintenance, tracking, and chemical/material reference fields when applicable.</p>
          </div>
          <button type="button" className="text-sm font-medium text-brand-700 hover:text-brand-900" onClick={resetForm} disabled={isSaving}>
            Cancel
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Equipment name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Mavic 3 Enterprise"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Type
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={formData.equipmentType}
              onChange={(event) => updateField('equipmentType', event.target.value)}
              disabled={isSaving}
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Make
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.make}
              onChange={(event) => updateField('make', event.target.value)}
              placeholder="DJI"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Model
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.model}
              onChange={(event) => updateField('model', event.target.value)}
              placeholder="M3E"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Serial number
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.serialNumber}
              onChange={(event) => updateField('serialNumber', event.target.value)}
              placeholder="SN-001"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            FAA registration
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.faaRegistrationNumber}
              onChange={(event) => updateField('faaRegistrationNumber', event.target.value)}
              placeholder="FA3ABC1234"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={formData.status}
              onChange={(event) => updateField('status', event.target.value)}
              disabled={isSaving}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Maintenance due
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="date"
              value={formData.maintenanceDueDate}
              onChange={(event) => updateField('maintenanceDueDate', event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Assigned location
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.assignedLocation}
              onChange={(event) => updateField('assignedLocation', event.target.value)}
              placeholder="Main kit, truck 2, or current job site"
              disabled={isSaving}
            />
          </label>

          {showChemicalFields ? (
            <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 sm:col-span-2">
              <h3 className="text-sm font-semibold text-brand-900">Chemical / Material Details</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Product Name<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.name} onChange={(event) => updateField('name', event.target.value)} disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700">Manufacturer<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.make} onChange={(event) => updateField('make', event.target.value)} disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700">Product Category<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.productCategory} onChange={(event) => updateField('productCategory', event.target.value)} placeholder="Cleaner, carrier water, pesticide, surfactant" disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700">Typical Mix Ratio<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.typicalMixRatio} onChange={(event) => updateField('typicalMixRatio', event.target.value)} placeholder="Optional" disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Purpose<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.purpose} onChange={(event) => updateField('purpose', event.target.value)} placeholder="Exterior window cleaning detergent, rinse water, herbicide" disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Application Notes<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.applicationNotes} onChange={(event) => updateField('applicationNotes', event.target.value)} placeholder="Optional" disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700">EPA Registration Number<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.epaRegistrationNumber} onChange={(event) => updateField('epaRegistrationNumber', event.target.value)} disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700">Signal Word<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.signalWord} onChange={(event) => updateField('signalWord', event.target.value)} placeholder="Caution, Warning, Danger" disabled={isSaving} /></label>
                <label className="block text-sm font-medium text-slate-700">Restricted Use Product<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={formData.restrictedUseProduct} onChange={(event) => updateField('restrictedUseProduct', event.target.value)} disabled={isSaving}><option>No</option><option>Yes</option></select></label>
              </div>
              <div className="mt-4 space-y-3"><p className="text-sm font-semibold text-brand-900">Reference Documents</p>{chemicalDocumentTypes.map((documentType) => <label key={documentType} className="block text-sm font-medium text-slate-700">{documentType}<input className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(event) => addPendingDocument(documentType, event.target.files)} disabled={isSaving} /></label>)}{pendingDocuments.length ? <ul className="rounded-lg bg-white p-3 text-sm text-slate-700">{pendingDocuments.map((doc, index) => <li key={`${doc.documentType}-${doc.file.name}-${index}`} className="flex justify-between gap-3 py-1"><span>{doc.documentType}: {doc.file.name}</span><button type="button" className="text-red-700" onClick={() => removePendingDocument(index)}>Remove</button></li>)}</ul> : null}</div>
            </div>
          ) : null}

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Notes
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={formData.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Maintenance notes, kit contents, firmware details, or assignment constraints."
              disabled={isSaving}
            />
          </label>
        </div>

        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {saveMessage ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{saveMessage}</p> : null}

        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : editingEquipmentId ? 'Update Equipment' : 'Add Equipment'}
        </button>
      </form>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">Equipment Records</h2>
              <p className="mt-1 text-sm text-slate-600">Review current equipment readiness, then add or edit a record when needed.</p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
              onClick={handleAdd}
            >
              + Add Equipment
            </button>
          </div>
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {saveMessage ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{saveMessage}</p> : null}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-900">Equipment Records</h2>
            <p className="mt-1 text-sm text-slate-600">Search by name, serial, registration, make, model, type, or location.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[52rem]">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">
              Search
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search equipment"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Type
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="All">All types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Maintenance
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
                value={maintenanceFilter}
                onChange={(event) => setMaintenanceFilter(event.target.value)}
              >
                {maintenanceFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading equipment...</p> : null}
          {!isLoading && filteredEquipment.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No equipment records match the current filters.</p>
          ) : null}
          {filteredEquipment.map((item) => {
            const readiness = getReadinessState(item);
            const isDeleting = deletingEquipmentId === item.id;

            return (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-brand-900">{item.name}</h3>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${readiness.className}`}>{readiness.label}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      {item.equipment_type} {item.make || item.model ? `• ${[item.make, item.model].filter(Boolean).join(' ')}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{readiness.detail}</p>
                    {isChemicalMaterial(item) ? <p className="mt-1 text-sm text-slate-600">{[item.product_category, item.typical_mix_ratio ? `Mix: ${item.typical_mix_ratio}` : null].filter(Boolean).join(' • ')}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-700 shadow-sm hover:text-brand-900" onClick={() => handleEdit(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:text-red-900 disabled:cursor-not-allowed disabled:text-slate-400"
                      onClick={() => void handleDelete(item)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-medium text-slate-500">Status</dt>
                    <dd className="text-slate-800">{item.status}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Maintenance Due</dt>
                    <dd className="text-slate-800">{formatDate(item.maintenance_due_date)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Serial</dt>
                    <dd className="text-slate-800">{item.serial_number || 'Not tracked'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">FAA Registration</dt>
                    <dd className="text-slate-800">{item.faa_registration_number || 'Not tracked'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-slate-500">Location</dt>
                    <dd className="text-slate-800">{item.assigned_location || 'Not assigned'}</dd>
                  </div>
                  {isChemicalMaterial(item) ? (<>
                    <div><dt className="font-medium text-slate-500">Purpose</dt><dd className="text-slate-800">{item.purpose || 'Not provided'}</dd></div>
                    <div><dt className="font-medium text-slate-500">EPA Reg. No.</dt><dd className="text-slate-800">{item.epa_registration_number || 'Not tracked'}</dd></div>
                    <div><dt className="font-medium text-slate-500">Signal Word</dt><dd className="text-slate-800">{item.signal_word || 'Not tracked'}</dd></div>
                    <div><dt className="font-medium text-slate-500">Restricted Use</dt><dd className="text-slate-800">{item.restricted_use_product ? 'Yes' : 'No'}</dd></div>
                    <div><dt className="font-medium text-slate-500">Documents</dt><dd className="text-slate-800">{item.equipment_reference_documents?.length ?? 0} uploaded</dd></div>
                  </>) : null}
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-slate-500">Notes</dt>
                    <dd className="text-slate-800">{item.notes || 'No notes'}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
