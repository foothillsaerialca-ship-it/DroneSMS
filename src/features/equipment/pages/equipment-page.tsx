import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';

const equipmentTypes = ['Aircraft', 'Battery', 'Controller', 'Support Equipment'];
const statusOptions = ['Active', 'Maintenance', 'Out of Service', 'Retired'];

const initialFormState = {
  equipmentName: '',
  equipmentType: equipmentTypes[0],
  manufacturer: '',
  model: '',
  serialNumber: '',
  status: statusOptions[0],
  faaRegistration: '',
  remoteId: '',
  lastInspectionDate: '',
  batteryIdentifier: '',
  batteryCycleCount: '',
  controllerIdentifier: '',
  notes: ''
};

type Equipment = {
  id: string;
  equipment_type: string;
  equipment_name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  faa_registration: string | null;
  remote_id: string | null;
  battery_identifier: string | null;
  battery_cycle_count: number | null;
  controller_identifier: string | null;
  last_inspection_date: string | null;
  notes: string | null;
};

type EquipmentFormState = typeof initialFormState;

type ReadinessState = {
  label: string;
  detail: string;
  className: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load equipment. Please try again.';
}

function formatDate(date: string | null) {
  if (!date) return 'Not tracked';

  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;

  return `${month}/${day}/${year}`;
}

function getReadinessState(status: string): ReadinessState {
  if (status === 'Active') {
    return {
      label: 'Active',
      detail: 'Available for future operations.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    };
  }

  if (status === 'Maintenance') {
    return {
      label: 'Maintenance',
      detail: 'Track as unavailable until maintenance is cleared.',
      className: 'border-amber-200 bg-amber-50 text-amber-700'
    };
  }

  if (status === 'Out of Service') {
    return {
      label: 'Out of Service',
      detail: 'Do not use for operations.',
      className: 'border-red-200 bg-red-50 text-red-700'
    };
  }

  return {
    label: 'Retired',
    detail: 'Retained for reference only.',
    className: 'border-slate-200 bg-slate-100 text-slate-700'
  };
}

function toFormState(equipment: Equipment): EquipmentFormState {
  return {
    equipmentName: equipment.equipment_name,
    equipmentType: equipment.equipment_type,
    manufacturer: equipment.manufacturer ?? '',
    model: equipment.model ?? '',
    serialNumber: equipment.serial_number ?? '',
    status: equipment.status,
    faaRegistration: equipment.faa_registration ?? '',
    remoteId: equipment.remote_id ?? '',
    lastInspectionDate: equipment.last_inspection_date ?? '',
    batteryIdentifier: equipment.battery_identifier ?? '',
    batteryCycleCount: equipment.battery_cycle_count?.toString() ?? '',
    controllerIdentifier: equipment.controller_identifier ?? '',
    notes: equipment.notes ?? ''
  };
}

async function getCurrentOrganizationId(userId: string) {
  const { data, error } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle();

  if (error) throw error;

  return data?.organization_id ?? null;
}

function buildEquipmentPayload(formData: EquipmentFormState) {
  const batteryCycleCount = formData.batteryCycleCount.trim();

  return {
    equipment_type: formData.equipmentType,
    equipment_name: formData.equipmentName.trim(),
    manufacturer: formData.manufacturer.trim() || null,
    model: formData.model.trim() || null,
    serial_number: formData.serialNumber.trim() || null,
    status: formData.status,
    faa_registration: formData.equipmentType === 'Aircraft' ? formData.faaRegistration.trim() || null : null,
    remote_id: formData.equipmentType === 'Aircraft' ? formData.remoteId.trim() || null : null,
    last_inspection_date: formData.equipmentType === 'Aircraft' ? formData.lastInspectionDate || null : null,
    battery_identifier: formData.equipmentType === 'Battery' ? formData.batteryIdentifier.trim() || null : null,
    battery_cycle_count: formData.equipmentType === 'Battery' && batteryCycleCount ? Number(batteryCycleCount) : null,
    controller_identifier: formData.equipmentType === 'Controller' ? formData.controllerIdentifier.trim() || null : null,
    notes: formData.notes.trim() || null,
    updated_at: new Date().toISOString()
  };
}

export function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [formData, setFormData] = useState<EquipmentFormState>(initialFormState);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingEquipmentId, setDeletingEquipmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadEquipment() {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, equipment_type, equipment_name, manufacturer, model, serial_number, status, faa_registration, remote_id, battery_identifier, battery_cycle_count, controller_identifier, last_inspection_date, notes')
        .order('equipment_name', { ascending: true });

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

  const filteredEquipment = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return equipment.filter((item) => {
      const searchableValues = [
        item.equipment_name,
        item.manufacturer,
        item.model,
        item.serial_number,
        item.faa_registration,
        item.remote_id,
        item.battery_identifier,
        item.controller_identifier,
        item.notes
      ];
      const matchesSearch = !normalizedSearch || searchableValues.some((value) => value?.toLowerCase().includes(normalizedSearch));
      const matchesType = typeFilter === 'All' || item.equipment_type === typeFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [equipment, searchTerm, typeFilter, statusFilter]);

  const statusCounts = useMemo(() => {
    return equipment.reduce(
      (counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }),
      {} as Record<string, number>
    );
  }, [equipment]);

  function updateField(field: keyof EquipmentFormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  function resetForm() {
    setFormData(initialFormState);
    setEditingEquipmentId(null);
    setMessage(null);
  }

  function validateForm() {
    if (!formData.equipmentName.trim()) return 'Equipment name is required.';
    if (!formData.equipmentType) return 'Equipment type is required.';
    if (!formData.status) return 'Status is required.';

    if (formData.batteryCycleCount.trim()) {
      const batteryCycleCount = Number(formData.batteryCycleCount);
      if (!Number.isInteger(batteryCycleCount) || batteryCycleCount < 0) {
        return 'Battery cycle count must be a whole number of 0 or greater.';
      }
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
    setMessage(null);
    setIsSaving(true);

    try {
      const payload = buildEquipmentPayload(formData);
      const successMessage = editingEquipmentId ? 'Equipment record updated.' : 'Equipment record created.';

      if (editingEquipmentId) {
        const { error: updateError } = await supabase.from('equipment').update(payload).eq('id', editingEquipmentId);
        if (updateError) throw updateError;
      } else {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!userData.user) throw new Error('You must be signed in to create equipment.');

        const organizationId = await getCurrentOrganizationId(userData.user.id);

        if (!organizationId) {
          throw new Error('Finish company onboarding before creating equipment records.');
        }

        const { error: insertError } = await supabase.from('equipment').insert({
          ...payload,
          organization_id: organizationId,
          created_by: userData.user.id
        });

        if (insertError) throw insertError;
      }

      resetForm();
      setMessage(successMessage);
      await loadEquipment();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(item: Equipment) {
    setEditingEquipmentId(item.id);
    setFormData(toFormState(item));
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(item: Equipment) {
    const shouldDelete = window.confirm(`Delete ${item.equipment_name}? This removes the equipment record from the repository.`);
    if (!shouldDelete) return;

    setError(null);
    setMessage(null);
    setDeletingEquipmentId(item.id);

    try {
      const { error: deleteError } = await supabase.from('equipment').delete().eq('id', item.id);

      if (deleteError) throw deleteError;

      if (editingEquipmentId === item.id) resetForm();
      setMessage('Equipment record deleted.');
      await loadEquipment();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeletingEquipmentId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Repository</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">Equipment Repository</h1>
            <p className="mt-2 text-sm text-slate-600">
              Track aircraft, batteries, remote controllers, and support equipment for future Job File, Preflight, Maintenance, Inspection, and Briefing workflows.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:min-w-72">
            {statusOptions.map((status) => {
              const readiness = getReadinessState(status);

              return (
                <div key={status} className={`rounded-lg border px-3 py-2 ${readiness.className}`}>
                  <p className="text-lg font-semibold">{statusCounts[status] ?? 0}</p>
                  <p className="text-xs">{status}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-900">{editingEquipmentId ? 'Edit Equipment' : 'Create Equipment'}</h2>
            <p className="mt-1 text-sm text-slate-600">Capture core repository details, then add the fields that apply to the selected equipment type.</p>
          </div>
          {editingEquipmentId ? (
            <button type="button" className="text-sm font-medium text-brand-700 hover:text-brand-900" onClick={resetForm} disabled={isSaving}>
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Equipment Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.equipmentName}
              onChange={(event) => updateField('equipmentName', event.target.value)}
              placeholder="Mavic 3 Enterprise"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Equipment Type
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={formData.equipmentType}
              onChange={(event) => updateField('equipmentType', event.target.value)}
              disabled={isSaving}
            >
              {equipmentTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Manufacturer
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.manufacturer}
              onChange={(event) => updateField('manufacturer', event.target.value)}
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
            Serial Number
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
            Status
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={formData.status}
              onChange={(event) => updateField('status', event.target.value)}
              disabled={isSaving}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          {formData.equipmentType === 'Aircraft' ? (
            <>
              <label className="block text-sm font-medium text-slate-700">
                FAA Registration Number
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                  type="text"
                  value={formData.faaRegistration}
                  onChange={(event) => updateField('faaRegistration', event.target.value)}
                  placeholder="FA3A1BCD2E"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Remote ID
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                  type="text"
                  value={formData.remoteId}
                  onChange={(event) => updateField('remoteId', event.target.value)}
                  placeholder="Remote ID serial"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Last Inspection Date
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                  type="date"
                  value={formData.lastInspectionDate}
                  onChange={(event) => updateField('lastInspectionDate', event.target.value)}
                  disabled={isSaving}
                />
              </label>
            </>
          ) : null}

          {formData.equipmentType === 'Battery' ? (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Battery Identifier
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                  type="text"
                  value={formData.batteryIdentifier}
                  onChange={(event) => updateField('batteryIdentifier', event.target.value)}
                  placeholder="Battery A1"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Battery Cycle Count
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.batteryCycleCount}
                  onChange={(event) => updateField('batteryCycleCount', event.target.value)}
                  placeholder="42"
                  disabled={isSaving}
                />
              </label>
            </>
          ) : null}

          {formData.equipmentType === 'Controller' ? (
            <label className="block text-sm font-medium text-slate-700">
              Controller Identifier
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                type="text"
                value={formData.controllerIdentifier}
                onChange={(event) => updateField('controllerIdentifier', event.target.value)}
                placeholder="RC Pro 1"
                disabled={isSaving}
              />
            </label>
          ) : null}

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Notes
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              value={formData.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Support equipment details, maintenance reminders, storage location, or inspection notes."
              disabled={isSaving}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{message}</p>
        ) : null}

        <button
          type="submit"
          className="mt-5 min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : editingEquipmentId ? 'Update Equipment' : 'Create Equipment'}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Search
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, serial, registration..."
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Filter by type
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="All">All types</option>
              {equipmentTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Filter by status
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading equipment...</div>
        ) : null}

        {!isLoading && equipment.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
            <h2 className="text-base font-semibold text-brand-900">No equipment yet</h2>
            <p className="mt-2 text-sm text-slate-600">Create the first aircraft, battery, controller, or support equipment record.</p>
          </div>
        ) : null}

        {!isLoading && equipment.length > 0 && filteredEquipment.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
            <h2 className="text-base font-semibold text-brand-900">No matching equipment</h2>
            <p className="mt-2 text-sm text-slate-600">Adjust search or filters to see more repository records.</p>
          </div>
        ) : null}

        {!isLoading && filteredEquipment.map((item) => {
          const readiness = getReadinessState(item.status);
          const details = [item.manufacturer, item.model, item.serial_number ? `SN: ${item.serial_number}` : null].filter(Boolean).join(' • ');

          return (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-brand-900">{item.equipment_name}</h2>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">{item.equipment_type}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${readiness.className}`}>{readiness.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{details || 'No manufacturer, model, or serial number recorded.'}</p>
                  <p className="mt-2 text-sm text-slate-600">{readiness.detail}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-0"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
                    onClick={() => void handleDelete(item)}
                    disabled={deletingEquipmentId === item.id}
                  >
                    {deletingEquipmentId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Aircraft</dt>
                  <dd className="mt-1 text-slate-700">{item.equipment_type === 'Aircraft' ? [item.faa_registration, item.remote_id, formatDate(item.last_inspection_date)].filter(Boolean).join(' • ') || 'Not provided' : 'Not applicable'}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Battery</dt>
                  <dd className="mt-1 text-slate-700">{item.equipment_type === 'Battery' ? [item.battery_identifier, item.battery_cycle_count !== null ? `${item.battery_cycle_count} cycles` : null].filter(Boolean).join(' • ') || 'Not provided' : 'Not applicable'}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Controller</dt>
                  <dd className="mt-1 text-slate-700">{item.equipment_type === 'Controller' ? item.controller_identifier || 'Not provided' : 'Not applicable'}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Support / Notes</dt>
                  <dd className="mt-1 text-slate-700">{item.notes || 'No notes'}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
