/**
 * File purpose: Implements the personnel page application page, including its presentation, state, validation, and service interactions.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';
import { getCurrentOrganizationId } from '@frontend/lib/organization';
import { daysUntilDate, formatIsoDate } from '@frontend/lib/date-utils';
import { type ReadinessState } from '@frontend/lib/readiness';

/**
 * Purpose: Defines the ordered role options used for UI choices and workflow decisions in personnel page.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const roleOptions = ['Remote Pilot in Command', 'Visual Observer', 'Crew Member', 'Payload Operator', 'Safety Manager'];
/**
 * Purpose: Defines the ordered status options used for UI choices and workflow decisions in personnel page.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const statusOptions = ['Active', 'Training', 'Inactive'];

/**
 * Purpose: Provides the stable default shape for initial form state in the personnel page workflow.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const initialFormState = {
  fullName: '',
  role: roleOptions[0],
  email: '',
  phone: '',
  part107CertificateNumber: '',
  part107ExpirationDate: '',
  trainingExpirationDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  status: statusOptions[0],
  professionalBio: '',
  certificationsSummary: '',
  profilePhotoUrl: '',
  notes: ''
};

/**
 * Purpose: Represents personnel data read, written, or rendered by the personnel page workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type Personnel = {
  id: string;
  full_name: string;
  role: string;
  email: string | null;
  phone: string | null;
  part_107_certificate_number: string | null;
  part_107_expiration_date: string | null;
  training_expiration_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: string;
  professional_bio: string | null;
  certifications_summary: string | null;
  profile_photo_url: string | null;
  notes: string | null;
  updated_at: string;
  archived_at: string | null;
};

/**
 * Purpose: Represents the complete personnel form state used by the personnel page workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type PersonnelFormState = typeof initialFormState;

/**
 * Purpose: Defines the training status data contract used by the personnel page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type TrainingStatus = {
  label: string;
  detail: string;
  className: string;
};

/**
 * Computes get error message for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load personnel. Please try again.';
}

/**
 * Computes get training status for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getTrainingStatus(person: Personnel): TrainingStatus | null {
  if (!person.training_expiration_date) {
    return null;
  }

  const remainingDays = daysUntilDate(person.training_expiration_date);

  if (remainingDays < 0) {
    return {
      label: 'Training Expired',
      detail: `Training expired ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} ago.`,
      className: 'border-red-200 bg-red-50 text-red-700'
    };
  }

  if (remainingDays <= 30) {
    return {
      label: 'Training Due Soon',
      detail: `Training expires in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.`,
      className: 'border-amber-200 bg-amber-50 text-amber-700'
    };
  }

  return null;
}

/**
 * Computes get readiness state for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getReadinessState(person: Personnel): ReadinessState {
  if (person.status !== 'Active') {
    return {
      label: person.status,
      detail: 'Not counted as an active flight-ready crew member.',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
      sortOrder: 5
    };
  }

  // Check training expiration for all roles
  const trainingStatus = getTrainingStatus(person);
  if (trainingStatus && trainingStatus.label === 'Training Expired') {
    return {
      label: 'Training Expired',
      detail: trainingStatus.detail,
      className: 'border-red-200 bg-red-50 text-red-700',
      sortOrder: 0
    };
  }

  if (person.role !== 'Remote Pilot in Command') {
    const crewReadinessDetail = trainingStatus
      ? trainingStatus.detail
      : 'Active crew record with emergency contact tracking.';
    
    return {
      label: trainingStatus ? 'Training Due Soon' : 'Crew Ready',
      detail: crewReadinessDetail,
      className: trainingStatus?.className || 'border-emerald-200 bg-emerald-50 text-emerald-700',
      sortOrder: trainingStatus ? 2 : 4
    };
  }

  if (!person.part_107_expiration_date) {
    return {
      label: 'Cert Missing',
      detail: 'Add a Part 107 expiration date before assigning as RPIC.',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      sortOrder: 1
    };
  }

  const remainingDays = daysUntilDate(person.part_107_expiration_date);

  if (remainingDays < 0) {
    return {
      label: 'Cert Expired',
      detail: `Part 107 expired ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} ago.`,
      className: 'border-red-200 bg-red-50 text-red-700',
      sortOrder: 0
    };
  }

  if (remainingDays <= 60) {
    const part107Detail = `Part 107 expires in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.`;
    const finalDetail = trainingStatus ? `${part107Detail} ${trainingStatus.detail}` : part107Detail;
    
    return {
      label: trainingStatus ? 'Renew Soon' : 'Renew Soon',
      detail: finalDetail,
      className: trainingStatus?.className || 'border-amber-200 bg-amber-50 text-amber-700',
      sortOrder: trainingStatus ? 2 : 3
    };
  }

  if (trainingStatus) {
    return {
      label: 'Training Due Soon',
      detail: trainingStatus.detail,
      className: trainingStatus.className,
      sortOrder: 2
    };
  }

  return {
    label: 'Pilot Ready',
    detail: `Part 107 current through ${formatIsoDate(person.part_107_expiration_date, 'Not tracked')}.`,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sortOrder: 4
  };
}

/**
 * Computes to form state for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function toFormState(person: Personnel): PersonnelFormState {
  return {
    fullName: person.full_name,
    role: person.role,
    email: person.email ?? '',
    phone: person.phone ?? '',
    part107CertificateNumber: person.part_107_certificate_number ?? '',
    part107ExpirationDate: person.part_107_expiration_date ?? '',
    trainingExpirationDate: person.training_expiration_date ?? '',
    emergencyContactName: person.emergency_contact_name ?? '',
    emergencyContactPhone: person.emergency_contact_phone ?? '',
    status: person.status,
    professionalBio: person.professional_bio ?? '',
    certificationsSummary: person.certifications_summary ?? '',
    profilePhotoUrl: person.profile_photo_url ?? '',
    notes: person.notes ?? ''
  };
}

/**
 * Computes build personnel payload for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function buildPersonnelPayload(formData: PersonnelFormState) {
  return {
    full_name: formData.fullName.trim(),
    role: formData.role,
    email: formData.email.trim() || null,
    phone: formData.phone.trim() || null,
    part_107_certificate_number: formData.part107CertificateNumber.trim() || null,
    part_107_expiration_date: formData.part107ExpirationDate || null,
    training_expiration_date: formData.trainingExpirationDate || null,
    emergency_contact_name: formData.emergencyContactName.trim() || null,
    emergency_contact_phone: formData.emergencyContactPhone.trim() || null,
    status: formData.status,
    professional_bio: formData.professionalBio.trim() || null,
    certifications_summary: formData.certificationsSummary.trim() || null,
    profile_photo_url: formData.profilePhotoUrl.trim() || null,
    notes: formData.notes.trim() || null,
    updated_at: new Date().toISOString()
  };
}

/**
 * Renders the personnel interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [formData, setFormData] = useState<PersonnelFormState>(initialFormState);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingPersonId, setArchivingPersonId] = useState<string | null>(null);
  // Card that shows the last update confirmation, so inline saves report back where the user is looking.
  const [updatedPersonId, setUpdatedPersonId] = useState<string | null>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  /**
   * Performs load personnel for the surrounding workflow.
   * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
   */
  async function loadPersonnel() {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: personnelError } = await supabase
        .from('personnel')
        .select('id, full_name, role, email, phone, part_107_certificate_number, part_107_expiration_date, training_expiration_date, emergency_contact_name, emergency_contact_phone, status, professional_bio, certifications_summary, profile_photo_url, notes, updated_at, archived_at')
        .order('status', { ascending: true })
        .order('full_name', { ascending: true });

      if (personnelError) throw personnelError;

      setPersonnel((data ?? []) as Personnel[]);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPersonnel();
  }, []);

  // The edit form replaces its record card in place; nudge it into view only if it overflows the viewport.
  useEffect(() => {
    if (!editingPersonId) return;
    const form = editFormRef.current;
    form?.scrollIntoView?.({ block: 'nearest' });
    form?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, [editingPersonId]);

  const rosterPersonnel = useMemo(() => personnel.filter((person) => !person.archived_at), [personnel]);
  const archivedPersonnel = useMemo(() => personnel.filter((person) => Boolean(person.archived_at)), [personnel]);

  const readinessCounts = useMemo(() => {
    return rosterPersonnel.reduce(
      (counts, person) => {
        const readiness = getReadinessState(person);
        const trainingStatus = getTrainingStatus(person);
        if (person.status === 'Active') counts.active += 1;
        if (person.role === 'Remote Pilot in Command') counts.pilots += 1;
        if (readiness.label === 'Cert Expired' || readiness.label === 'Cert Missing') counts.certBlocked += 1;
        if (trainingStatus?.label === 'Training Expired') counts.trainingExpired += 1;
        if (readiness.label === 'Renew Soon' && !readiness.label.includes('Training')) counts.renewSoon += 1;
        if (trainingStatus?.label === 'Training Due Soon') counts.trainingSoon += 1;
        return counts;
      },
      { active: 0, pilots: 0, certBlocked: 0, trainingSoon: 0, trainingExpired: 0, renewSoon: 0 }
    );
  }, [rosterPersonnel]);

  const sortedPersonnel = useMemo(() => {
    const listed = showArchived ? archivedPersonnel : rosterPersonnel;
    // The record being edited stays listed so its inline form (and Save/Cancel) never vanishes on a view change.
    const editing = personnel.find((person) => person.id === editingPersonId);
    return [...listed, ...(editing && !listed.includes(editing) ? [editing] : [])].sort((left, right) => {
      const readinessDifference = getReadinessState(left).sortOrder - getReadinessState(right).sortOrder;
      if (readinessDifference !== 0) return readinessDifference;
      return left.full_name.localeCompare(right.full_name);
    });
  }, [showArchived, archivedPersonnel, rosterPersonnel, personnel, editingPersonId]);

  /**
   * Renders the update field interface and coordinates its user interactions.
   * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
   */
  function updateField(field: keyof PersonnelFormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
    setSaveMessage(null);
  }

  /**
   * Handles reset form while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function resetForm() {
    setFormData(initialFormState);
    setEditingPersonId(null);
    setIsFormOpen(false);
    setError(null);
    setSaveMessage(null);
    setUpdatedPersonId(null);
  }

  /**
   * Handles add while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function handleAdd() {
    setFormData(initialFormState);
    setEditingPersonId(null);
    setIsFormOpen(true);
    setError(null);
    setSaveMessage(null);
    setUpdatedPersonId(null);
  }

  /**
   * Implements validate form for this module.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function validateForm() {
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (!formData.role) return 'Role is required.';
    if (!formData.status) return 'Status is required.';
    return null;
  }

  /**
   * Handles submit while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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
      if (!userData.user) throw new Error('You must be signed in to save personnel.');

      const payload = buildPersonnelPayload(formData);

      const successMessage = editingPersonId ? 'Personnel record updated.' : 'Personnel record added.';

      if (editingPersonId) {
        const { error: updateError } = await supabase.from('personnel').update(payload).eq('id', editingPersonId);
        if (updateError) throw updateError;
      } else {
        const organizationId = await getCurrentOrganizationId(userData.user.id);

        if (!organizationId) {
          throw new Error('Finish company onboarding before adding personnel.');
        }

        const { error: insertError } = await supabase.from('personnel').insert({
          ...payload,
          organization_id: organizationId,
          user_id: userData.user.id
        });

        if (insertError) throw insertError;
      }

      resetForm();
      setUpdatedPersonId(editingPersonId);
      setSaveMessage(successMessage);
      await loadPersonnel();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Handles edit while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function handleEdit(person: Personnel) {
    setEditingPersonId(person.id);
    setIsFormOpen(true);
    setFormData(toFormState(person));
    setError(null);
    setSaveMessage(null);
    setUpdatedPersonId(null);
  }

  /**
   * Archives or restores a personnel record. Personnel are never deleted because signed JHAs,
   * designations, and crew acknowledgments must keep pointing at the person who signed.
   * Archiving also sets the status to Inactive so every Active-only picker drops the person;
   * restoring leaves them Inactive until someone deliberately reactivates them.
   * Fallback/error behavior: Service errors are shown in the page error state; the list is reloaded on success.
   */
  async function setPersonArchived(person: Personnel, archive: boolean) {
    if (
      archive &&
      !window.confirm(
        `Archive ${person.full_name}? They will be removed from the roster and crew pickers. Past jobs, JHAs, and acknowledgments keep their name.`
      )
    ) {
      return;
    }

    setArchivingPersonId(person.id);
    setError(null);
    setSaveMessage(null);

    try {
      const now = new Date().toISOString();
      const update = archive
        ? { archived_at: now, status: 'Inactive', updated_at: now }
        : { archived_at: null, updated_at: now };
      const { error: archiveError } = await supabase.from('personnel').update(update).eq('id', person.id);
      if (archiveError) throw archiveError;

      if (editingPersonId === person.id) resetForm();
      setUpdatedPersonId(null);
      setSaveMessage(
        archive
          ? `${person.full_name} archived.`
          : `${person.full_name} restored as Inactive. Edit the record to set them Active when ready.`
      );
      await loadPersonnel();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
    } finally {
      setArchivingPersonId(null);
    }
  }

  // One form instance serves both modes: Add renders it above the list, Edit renders it in place of the record card.
  const personnelForm = isFormOpen ? (
      <form
        ref={editingPersonId ? editFormRef : undefined}
        className={editingPersonId ? 'rounded-xl border-2 border-brand-700 bg-white p-4 shadow-md ring-4 ring-brand-100 sm:p-6' : 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'}
        onSubmit={handleSubmit}
        aria-label={editingPersonId ? `Edit ${formData.fullName || 'personnel'}` : 'Add personnel'}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {editingPersonId ? <span className="inline-flex rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Editing</span> : null}
            <h2 className="mt-1 text-lg font-semibold text-brand-900">{editingPersonId ? 'Edit Personnel' : 'Add Personnel'}</h2>
            <p className="mt-1 text-sm text-slate-600">Start with required identity fields, then add optional certification and emergency details.</p>
          </div>
          <button type="button" className="text-sm font-medium text-brand-700 hover:text-brand-900" onClick={resetForm} disabled={isSaving}>
            Cancel
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Full name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.fullName}
              onChange={(event) => updateField('fullName', event.target.value)}
              placeholder="Alex Morgan"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Role
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={formData.role}
              onChange={(event) => updateField('role', event.target.value)}
              disabled={isSaving}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="email"
              value={formData.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="pilot@company.com"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="tel"
              value={formData.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              placeholder="(555) 555-0123"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Part 107 certificate number
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.part107CertificateNumber}
              onChange={(event) => updateField('part107CertificateNumber', event.target.value)}
              placeholder="Optional for non-RPIC crew"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Part 107 expiration date
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="date"
              value={formData.part107ExpirationDate}
              onChange={(event) => updateField('part107ExpirationDate', event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Training expiration date
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="date"
              value={formData.trainingExpirationDate}
              onChange={(event) => updateField('trainingExpirationDate', event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Emergency contact name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="text"
              value={formData.emergencyContactName}
              onChange={(event) => updateField('emergencyContactName', event.target.value)}
              placeholder="Taylor Morgan"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Emergency contact phone
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(event) => updateField('emergencyContactPhone', event.target.value)}
              placeholder="(555) 555-0456"
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

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Certifications Summary
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              value={formData.certificationsSummary}
              onChange={(event) => updateField('certificationsSummary', event.target.value)}
              placeholder="Part 107, night operations, waivers, sensor qualifications, or client-facing credentials."
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Professional Bio
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              value={formData.professionalBio}
              onChange={(event) => updateField('professionalBio', event.target.value)}
              placeholder="Client-facing pilot experience, specialties, and relevant project background."
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Profile Photo URL
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              type="url"
              value={formData.profilePhotoUrl}
              onChange={(event) => updateField('profilePhotoUrl', event.target.value)}
              placeholder="Future image upload placeholder or hosted profile photo URL"
              disabled={isSaving}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Notes
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              value={formData.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Training limitations, preferred assignments, PPE notes, or availability."
              disabled={isSaving}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
        ) : null}

        {saveMessage ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{saveMessage}</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : editingPersonId ? 'Save Changes' : 'Add Personnel'}
          </button>
          {editingPersonId ? (
            <button
              type="button"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 sm:w-auto sm:py-2"
              onClick={resetForm}
              disabled={isSaving}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
  ) : null;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Repository</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">Personnel</h1>
            <p className="mt-2 text-sm text-slate-600">
              Maintain pilots, observers, crew contact details, emergency contacts, and certification readiness.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:min-w-80">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-lg font-semibold text-brand-900">{readinessCounts.active}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-lg font-semibold text-brand-900">{readinessCounts.pilots}</p>
              <p className="text-xs text-slate-500">RPICs</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-lg font-semibold text-amber-700">{readinessCounts.renewSoon}</p>
              <p className="text-xs text-amber-700">Cert Renew Soon</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-lg font-semibold text-red-700">{readinessCounts.certBlocked}</p>
              <p className="text-xs text-red-700">Cert Blocked</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-lg font-semibold text-amber-700">{readinessCounts.trainingSoon}</p>
              <p className="text-xs text-amber-700">Training Soon</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-lg font-semibold text-red-700">{readinessCounts.trainingExpired}</p>
              <p className="text-xs text-red-700">Training Expired</p>
            </div>
          </div>
        </div>
      </div>

      {isFormOpen && !editingPersonId ? personnelForm : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">Personnel Records</h2>
              <p className="mt-1 text-sm text-slate-600">Review current crew readiness, then add or edit a record when needed.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-0 sm:py-2"
                onClick={() => setShowArchived((current) => !current)}
                aria-pressed={showArchived}
              >
                {showArchived ? 'Show current roster' : `Show archived (${archivedPersonnel.length})`}
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
                onClick={handleAdd}
              >
                + Add Personnel
              </button>
            </div>
          </div>
          {error && !editingPersonId ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
          {saveMessage && !updatedPersonId ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{saveMessage}</p> : null}
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading personnel...</div>
        ) : null}

        {!isLoading && showArchived && archivedPersonnel.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
            <h2 className="text-base font-semibold text-brand-900">No archived personnel</h2>
            <p className="mt-2 text-sm text-slate-600">People you archive appear here and can be restored at any time.</p>
          </div>
        ) : null}

        {!isLoading && !showArchived && rosterPersonnel.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
            <h2 className="text-base font-semibold text-brand-900">No personnel yet</h2>
            <p className="mt-2 text-sm text-slate-600">Add your first RPIC, visual observer, or crew member to begin readiness tracking.</p>
          </div>
        ) : null}

        {!isLoading && sortedPersonnel.map((person, index) => {
          const readiness = getReadinessState(person);
          const trainingStatus = getTrainingStatus(person);

          if (editingPersonId === person.id) return <div key={person.id}>{personnelForm}</div>;

          return (
            <article key={person.id} className={`rounded-xl border border-slate-200 p-4 shadow-sm ${index % 2 === 1 ? 'bg-[#F3F8FF]' : 'bg-white'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-brand-900">{person.full_name}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${readiness.className}`}>{readiness.label}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-600">{person.role}</p>
                  <p className="mt-2 text-sm text-slate-600">{readiness.detail}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {person.archived_at ? null : (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-0"
                      onClick={() => handleEdit(person)}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 sm:min-h-0"
                    onClick={() => void setPersonArchived(person, !person.archived_at)}
                    disabled={archivingPersonId === person.id}
                  >
                    {archivingPersonId === person.id ? 'Saving...' : person.archived_at ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </div>

              {saveMessage && updatedPersonId === person.id ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{saveMessage}</p> : null}

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact</dt>
                  <dd className="mt-1 text-slate-700">{person.email || person.phone ? [person.email, person.phone].filter(Boolean).join(' • ') : 'Not provided'}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Part 107</dt>
                  <dd className="mt-1 text-slate-700">{person.part_107_certificate_number || 'No certificate'} • {formatIsoDate(person.part_107_expiration_date, 'Not tracked')}</dd>
                </div>
                <div className={`rounded-lg p-3 ${trainingStatus ? trainingStatus.className.replace('border', 'bg').split(' ').slice(1).join(' ') : 'bg-slate-50'}`}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Training</dt>
                  <dd className="mt-1 text-slate-700">
                    {formatIsoDate(person.training_expiration_date, 'Not tracked')}
                    {trainingStatus ? <p className="mt-1 text-xs font-semibold">{trainingStatus.label}</p> : null}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Emergency / Status</dt>
                  <dd className="mt-1 text-slate-700">{person.emergency_contact_name || person.emergency_contact_phone ? [person.emergency_contact_name, person.emergency_contact_phone].filter(Boolean).join(' • ') : 'No emergency contact'} • {person.status}</dd>
                </div>
              </dl>

              {person.certifications_summary || person.professional_bio ? (
                <div className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
                  {person.certifications_summary ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <h3 className="font-semibold text-brand-900">Certifications Summary</h3>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{person.certifications_summary}</p>
                    </div>
                  ) : null}
                  {person.professional_bio ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <h3 className="font-semibold text-brand-900">Professional Bio</h3>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{person.professional_bio}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {person.profile_photo_url ? (
                <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Profile photo: {person.profile_photo_url}</p>
              ) : null}

              {person.notes ? <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{person.notes}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
