import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';

const roleOptions = ['RPIC', 'Operator', 'Visual Observer', 'Ground Crew', 'Other'];
const activeStatuses = ['Active', 'Inactive'] as const;

type PersonnelStatus = (typeof activeStatuses)[number];
type PersonnelForm = {
  fullName: string;
  role: string;
  part107CertificateNumber: string;
  part107ExpirationDate: string;
  trainingExpirationDate: string;
  status: PersonnelStatus;
  notes: string;
};

const emptyForm: PersonnelForm = {
  fullName: '',
  role: roleOptions[0],
  part107CertificateNumber: '',
  part107ExpirationDate: '',
  trainingExpirationDate: '',
  status: activeStatuses[0],
  notes: ''
};
type Personnel = {
  id: string;
  organization_id: string;
  user_id: string;
  full_name: string;
  role: string;
  part107_certificate_number: string | null;
  part107_expiration_date: string | null;
  training_expiration_date: string | null;
  is_active: boolean;
  notes: string | null;
};

type ExpirationState = 'valid' | 'warning' | 'expired' | 'missing';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load personnel. Please try again.';
}

async function getCurrentOrganizationId(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.organization_id) return profile.organization_id as string;

  const { data: ownedOrganizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', userId)
    .limit(1);

  if (organizationError) throw organizationError;

  const organization = ownedOrganizations?.[0];
  if (!organization) return null;

  const { error: profileUpsertError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      organization_id: organization.id,
      company_name: organization.name,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (profileUpsertError) throw profileUpsertError;
  return organization.id as string;
}

function toForm(person: Personnel): PersonnelForm {
  return {
    fullName: person.full_name,
    role: roleOptions.includes(person.role) ? person.role : 'Other',
    part107CertificateNumber: person.part107_certificate_number ?? '',
    part107ExpirationDate: person.part107_expiration_date ?? '',
    trainingExpirationDate: person.training_expiration_date ?? '',
    status: person.is_active ? 'Active' : 'Inactive',
    notes: person.notes ?? ''
  };
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return 'Not recorded';
  const [year, month, day] = dateValue.split('-');
  return year && month && day ? `${month}/${day}/${year}` : dateValue;
}

function getExpirationState(dateValue: string | null): ExpirationState {
  if (!dateValue) return 'missing';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(`${dateValue}T00:00:00`);
  const daysUntilExpiration = Math.ceil((expiration.getTime() - today.getTime()) / 86_400_000);

  if (daysUntilExpiration < 0) return 'expired';
  if (daysUntilExpiration <= 90) return 'warning';
  return 'valid';
}

function ExpirationBadge({ label, dateValue }: { label: string; dateValue: string | null }) {
  const state = getExpirationState(dateValue);
  const styles: Record<ExpirationState, string> = {
    valid: 'border-green-200 bg-green-50 text-green-700',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    expired: 'border-red-200 bg-red-50 text-red-700',
    missing: 'border-slate-200 bg-slate-50 text-slate-600'
  };
  const statusText: Record<ExpirationState, string> = {
    valid: 'Valid',
    warning: 'Expires soon',
    expired: 'Expired',
    missing: 'Missing'
  };

  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2 text-slate-700">
        <span>{formatDate(dateValue)}</span>
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[state]}`}>
          {statusText[state]}
        </span>
      </dd>
    </div>
  );
}

export function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<PersonnelForm>(emptyForm);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const filteredPersonnel = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return personnel;

    return personnel.filter((person) =>
      [person.full_name, person.role, person.part107_certificate_number ?? '', person.notes ?? ''].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    );
  }, [personnel, searchTerm]);

  async function loadPersonnel() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from('personnel')
        .select('id, organization_id, user_id, full_name, role, part107_certificate_number, part107_expiration_date, training_expiration_date, is_active, notes')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setPersonnel((data ?? []) as Personnel[]);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPersonnel();
  }, []);

  function updateField(field: keyof PersonnelForm, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
    setSaveError(null);
    setSaveMessage(null);
  }

  function startEdit(person: Personnel) {
    setEditingPerson(person);
    setFormData(toForm(person));
    setSaveError(null);
    setSaveMessage(null);
  }

  function resetForm() {
    setEditingPerson(null);
    setFormData(emptyForm);
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formData.fullName.trim()) {
      setSaveError('Full name is required.');
      setSaveMessage(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to save personnel.');

      const organizationId = editingPerson?.organization_id ?? (await getCurrentOrganizationId(userData.user.id));
      if (!organizationId) throw new Error('Finish company onboarding before adding personnel.');

      const payload = {
        organization_id: organizationId,
        user_id: editingPerson?.user_id ?? userData.user.id,
        full_name: formData.fullName.trim(),
        role: formData.role,
        part107_certificate_number: formData.part107CertificateNumber.trim() || null,
        part107_expiration_date: formData.part107ExpirationDate || null,
        training_expiration_date: formData.trainingExpirationDate || null,
        is_active: formData.status === 'Active',
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = editingPerson
        ? await supabase.from('personnel').update(payload).eq('id', editingPerson.id)
        : await supabase.from('personnel').insert(payload);

      if (error) throw error;

      setSaveMessage(editingPerson ? 'Personnel record updated.' : 'Personnel record created.');
      resetForm();
      await loadPersonnel();
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4 pb-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-slate-500">Operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">Personnel Repository</h1>
        <p className="mt-2 text-sm text-slate-600">
          Store pilots and crew members for future RPIC, operator, visual observer, briefing, and packet workflows.
        </p>
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-900">{editingPerson ? 'Edit personnel' : 'Add personnel'}</h2>
            <p className="mt-1 text-sm text-slate-600">Create reusable crew records for operational planning.</p>
          </div>
          {editingPerson ? (
            <button className="min-h-11 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 sm:py-2" type="button" onClick={resetForm} disabled={isSaving}>
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Full Name <span className="text-red-600">*</span>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={formData.fullName} onChange={(event) => updateField('fullName', event.target.value)} disabled={isSaving} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Role
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={formData.role} onChange={(event) => updateField('role', event.target.value)} disabled={isSaving}>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Part 107 Certificate Number
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={formData.part107CertificateNumber} onChange={(event) => updateField('part107CertificateNumber', event.target.value)} disabled={isSaving} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Part 107 Expiration Date
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" type="date" value={formData.part107ExpirationDate} onChange={(event) => updateField('part107ExpirationDate', event.target.value)} disabled={isSaving} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Training Expiration Date
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" type="date" value={formData.trainingExpirationDate} onChange={(event) => updateField('trainingExpirationDate', event.target.value)} disabled={isSaving} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Status
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={formData.status} onChange={(event) => updateField('status', event.target.value as PersonnelStatus)} disabled={isSaving}>
              {activeStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Notes
          <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm" value={formData.notes} onChange={(event) => updateField('notes', event.target.value)} disabled={isSaving} />
        </label>

        {saveError ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{saveError}</p> : null}
        {saveMessage ? <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status">{saveMessage}</p> : null}

        <button className="mt-5 min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : editingPerson ? 'Update Personnel' : 'Create Personnel'}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <label className="block text-sm font-medium text-slate-700">
          Search personnel
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name, role, certificate, or notes" />
        </label>
      </div>

      {isLoading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading personnel...</div> : null}

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h2 className="text-base font-semibold text-red-800">Unable to load personnel</h2>
          <p className="mt-2 text-sm text-red-700">{loadError}</p>
        </div>
      ) : null}

      {!isLoading && !loadError && filteredPersonnel.length > 0 ? (
        <div className="space-y-3">
          {filteredPersonnel.map((person) => (
            <article key={person.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-brand-900">{person.full_name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{person.role}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${person.is_active ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                    {person.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="button" onClick={() => startEdit(person)}>
                    Edit
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <ExpirationBadge label="Part 107 Expiration" dateValue={person.part107_expiration_date} />
                <ExpirationBadge label="Training Expiration" dateValue={person.training_expiration_date} />
              </dl>
            </article>
          ))}
        </div>
      ) : null}

      {!isLoading && !loadError && personnel.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">No personnel yet</h2>
          <p className="mt-2 text-sm text-slate-600">Add pilots and crew members to prepare for future job assignments and operations packets.</p>
        </div>
      ) : null}

      {!isLoading && !loadError && personnel.length > 0 && filteredPersonnel.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">No matching personnel</h2>
          <p className="mt-2 text-sm text-slate-600">Try a different name, role, certificate number, or note keyword.</p>
        </div>
      ) : null}
    </section>
  );
}
