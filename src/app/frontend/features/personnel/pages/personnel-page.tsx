import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@frontend/lib/supabase';

const roleOptions = ['Remote Pilot in Command', 'Visual Observer', 'Crew Member', 'Payload Operator', 'Safety Manager'];
const statusOptions = ['Active', 'Training', 'Inactive'];

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
};

type PersonnelFormState = typeof initialFormState;

type ReadinessState = {
  label: string;
  detail: string;
  className: string;
  sortOrder: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load personnel. Please try again.';
}

function formatDate(date: string | null) {
  if (!date) return 'Not tracked';

  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;

  return `${month}/${day}/${year}`;
}

function daysUntil(date: string) {
  const expirationDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((expirationDate.getTime() - today.getTime()) / 86_400_000);
}

function getReadinessState(person: Personnel): ReadinessState {
  if (person.status !== 'Active') {
    return {
      label: person.status,
      detail: 'Not counted as an active flight-ready crew member.',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
      sortOrder: 4
    };
  }

  if (person.role !== 'Remote Pilot in Command') {
    return {
      label: 'Crew Ready',
      detail: 'Active crew record with emergency contact tracking.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      sortOrder: 3
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

  const remainingDays = daysUntil(person.part_107_expiration_date);

  if (remainingDays < 0) {
    return {
      label: 'Cert Expired',
      detail: `Part 107 expired ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} ago.`,
      className: 'border-red-200 bg-red-50 text-red-700',
      sortOrder: 0
    };
  }

  if (remainingDays <= 60) {
    return {
      label: 'Renew Soon',
      detail: `Part 107 expires in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.`,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      sortOrder: 2
    };
  }

  return {
    label: 'Pilot Ready',
    detail: `Part 107 current through ${formatDate(person.part_107_expiration_date)}.`,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sortOrder: 3
  };
}

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

async function getCurrentOrganizationId(userId: string) {
  const { data, error } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle();

  if (error) throw error;

  return data?.organization_id ?? null;
}

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

export function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [formData, setFormData] = useState<PersonnelFormState>(initialFormState);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function loadPersonnel() {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: personnelError } = await supabase
        .from('personnel')
        .select('id, full_name, role, email, phone, part_107_certificate_number, part_107_expiration_date, training_expiration_date, emergency_contact_name, emergency_contact_phone, status, professional_bio, certifications_summary, profile_photo_url, notes, updated_at')
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

  const readinessCounts = useMemo(() => {
    return personnel.reduce(
      (counts, person) => {
        const readiness = getReadinessState(person);
        if (person.status === 'Active') counts.active += 1;
        if (person.role === 'Remote Pilot in Command') counts.pilots += 1;
        if (readiness.label === 'Cert Expired' || readiness.label === 'Cert Missing') counts.blocked += 1;
        if (readiness.label === 'Renew Soon') counts.renewSoon += 1;
        return counts;
      },
      { active: 0, pilots: 0, blocked: 0, renewSoon: 0 }
    );
  }, [personnel]);

  const sortedPersonnel = useMemo(() => {
    return [...personnel].sort((left, right) => {
      const readinessDifference = getReadinessState(left).sortOrder - getReadinessState(right).sortOrder;
      if (readinessDifference !== 0) return readinessDifference;
      return left.full_name.localeCompare(right.full_name);
    });
  }, [personnel]);

  function updateField(field: keyof PersonnelFormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
    setSaveMessage(null);
  }

  function resetForm() {
    setFormData(initialFormState);
    setEditingPersonId(null);
    setSaveMessage(null);
  }

  function validateForm() {
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (!formData.role) return 'Role is required.';
    if (!formData.status) return 'Status is required.';
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
      setSaveMessage(successMessage);
      await loadPersonnel();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(person: Personnel) {
    setEditingPersonId(person.id);
    setFormData(toFormState(person));
    setError(null);
    setSaveMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Repository</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">Personnel</h1>
            <p className="mt-2 text-sm text-slate-600">
              Maintain pilots, observers, crew contact details, emergency contacts, and Part 107 readiness.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:min-w-64">
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
              <p className="text-xs text-amber-700">Renew Soon</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-lg font-semibold text-red-700">{readinessCounts.blocked}</p>
              <p className="text-xs text-red-700">Blocked</p>
            </div>
          </div>
        </div>
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-900">{editingPersonId ? 'Edit Personnel' : 'Add Personnel'}</h2>
            <p className="mt-1 text-sm text-slate-600">Start with required identity fields, then add optional certification and emergency details.</p>
          </div>
          {editingPersonId ? (
            <button type="button" className="text-sm font-medium text-brand-700 hover:text-brand-900" onClick={resetForm} disabled={isSaving}>
              Cancel edit
            </button>
          ) : null}
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

        <button
          type="submit"
          className="mt-5 min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : editingPersonId ? 'Update Personnel' : 'Add Personnel'}
        </button>
      </form>

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading personnel...</div>
        ) : null}

        {!isLoading && personnel.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
            <h2 className="text-base font-semibold text-brand-900">No personnel yet</h2>
            <p className="mt-2 text-sm text-slate-600">Add your first RPIC, visual observer, or crew member to begin readiness tracking.</p>
          </div>
        ) : null}

        {!isLoading && sortedPersonnel.map((person) => {
          const readiness = getReadinessState(person);

          return (
            <article key={person.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-brand-900">{person.full_name}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${readiness.className}`}>{readiness.label}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-600">{person.role}</p>
                  <p className="mt-2 text-sm text-slate-600">{readiness.detail}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-0"
                  onClick={() => handleEdit(person)}
                >
                  Edit
                </button>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact</dt>
                  <dd className="mt-1 text-slate-700">{person.email || person.phone ? [person.email, person.phone].filter(Boolean).join(' • ') : 'Not provided'}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Part 107</dt>
                  <dd className="mt-1 text-slate-700">{person.part_107_certificate_number || 'No certificate'} • {formatDate(person.part_107_expiration_date)}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Training</dt>
                  <dd className="mt-1 text-slate-700">{formatDate(person.training_expiration_date)}</dd>
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
