import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

const templateChecklist = [
  { name: 'Job Hazard Analysis', path: 'templates/jha' },
  { name: 'Pre-Flight Checklist', path: 'templates/preflight' },
  { name: 'Crew Briefing' },
  { name: 'LAANC / Airspace Log' },
  { name: 'Incident / No-Incident Closeout' },
  { name: 'Training Summary' }
];

const crewRoleOptions = ['RPIC', 'Pilot', 'Visual Observer', 'Payload Operator', 'Ground Crew'];

type Job = {
  id: string;
  organization_id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
};

type PersonnelOption = {
  id: string;
  full_name: string;
  role: string;
  part_107_expiration_date: string | null;
  training_expiration_date: string | null;
  status: string;
};

type JobPersonnelAssignment = {
  id: string;
  assigned_role: string;
  personnel: PersonnelOption | null;
};

type EquipmentOption = {
  id: string;
  name: string;
  equipment_type: string;
  status: string;
};

type JobEquipmentAssignment = {
  id: string;
  equipment: EquipmentOption | null;
};

type ReadinessIndicator = {
  label: 'Current' | 'Expiring Soon' | 'Expired' | 'Missing';
  className: string;
};

const currentClassName = 'border-emerald-200 bg-emerald-50 text-emerald-700';
const expiringClassName = 'border-amber-200 bg-amber-50 text-amber-700';
const expiredClassName = 'border-red-200 bg-red-50 text-red-700';
const missingClassName = 'border-slate-200 bg-slate-100 text-slate-600';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load job file. Please try again.';
}

function formatPlannedDate(plannedDate: string) {
  if (!plannedDate) return 'Not scheduled';

  const [year, month, day] = plannedDate.split('-');
  if (!year || !month || !day) return plannedDate;

  return `${month}/${day}/${year}`;
}

function formatExpirationDate(date: string | null) {
  if (!date) return 'Not tracked';

  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;

  return `${month}/${day}/${year}`;
}

function getDaysUntil(date: string) {
  const expirationDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((expirationDate.getTime() - today.getTime()) / 86_400_000);
}

function getReadinessIndicator(date: string | null): ReadinessIndicator {
  if (!date) {
    return { label: 'Missing', className: missingClassName };
  }

  const daysRemaining = getDaysUntil(date);

  if (daysRemaining < 0) {
    return { label: 'Expired', className: expiredClassName };
  }

  if (daysRemaining <= 90) {
    return { label: 'Expiring Soon', className: expiringClassName };
  }

  return { label: 'Current', className: currentClassName };
}

function getStatusClassName(status: string | undefined) {
  return status === 'Active' || status === 'Available' ? currentClassName : missingClassName;
}

function normalizeAssignment(row: unknown): JobPersonnelAssignment {
  const assignment = row as JobPersonnelAssignment & { personnel: PersonnelOption | PersonnelOption[] | null };
  const personnel = Array.isArray(assignment.personnel) ? assignment.personnel[0] ?? null : assignment.personnel;

  return {
    id: assignment.id,
    assigned_role: assignment.assigned_role,
    personnel
  };
}

function normalizeEquipmentAssignment(row: unknown): JobEquipmentAssignment {
  const assignment = row as JobEquipmentAssignment & { equipment: EquipmentOption | EquipmentOption[] | null };
  const equipment = Array.isArray(assignment.equipment) ? assignment.equipment[0] ?? null : assignment.equipment;

  return {
    id: assignment.id,
    equipment
  };
}

export function JobFileHubPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [personnel, setPersonnel] = useState<PersonnelOption[]>([]);
  const [equipmentKits, setEquipmentKits] = useState<EquipmentOption[]>([]);
  const [assignments, setAssignments] = useState<JobPersonnelAssignment[]>([]);
  const [equipmentAssignments, setEquipmentAssignments] = useState<JobEquipmentAssignment[]>([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
  const [selectedRole, setSelectedRole] = useState(crewRoleOptions[0]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [isCrewFormOpen, setIsCrewFormOpen] = useState(false);
  const [isEquipmentFormOpen, setIsEquipmentFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isSavingEquipmentAssignment, setIsSavingEquipmentAssignment] = useState(false);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [removingEquipmentAssignmentId, setRemovingEquipmentAssignmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crewError, setCrewError] = useState<string | null>(null);
  const [crewMessage, setCrewMessage] = useState<string | null>(null);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [equipmentMessage, setEquipmentMessage] = useState<string | null>(null);

  async function loadAssignments(currentJobId: string) {
    const { data, error: assignmentsError } = await supabase
      .from('job_personnel')
      .select('id, assigned_role, personnel:personnel_id(id, full_name, role, part_107_expiration_date, training_expiration_date, status)')
      .eq('job_id', currentJobId)
      .order('created_at', { ascending: true });

    if (assignmentsError) throw assignmentsError;

    setAssignments((data ?? []).map(normalizeAssignment));
  }

  async function loadEquipmentAssignments(currentJobId: string) {
    const { data, error: assignmentsError } = await supabase
      .from('job_equipment')
      .select('id, equipment:equipment_id(id, name, equipment_type, status)')
      .eq('job_id', currentJobId)
      .order('created_at', { ascending: true });

    if (assignmentsError) throw assignmentsError;

    setEquipmentAssignments((data ?? []).map(normalizeEquipmentAssignment));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadJobFile() {
      if (!jobId) {
        setError('Missing job id.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setCrewError(null);
      setEquipmentError(null);

      try {
        const jobQuery = supabase
          .from('jobs')
          .select('id, organization_id, name, service_type, location, planned_date, status')
          .eq('id', jobId)
          .maybeSingle();
        const personnelQuery = supabase
          .from('personnel')
          .select('id, full_name, role, part_107_expiration_date, training_expiration_date, status')
          .order('full_name', { ascending: true });
        const assignmentsQuery = supabase
          .from('job_personnel')
          .select('id, assigned_role, personnel:personnel_id(id, full_name, role, part_107_expiration_date, training_expiration_date, status)')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });
        const equipmentQuery = supabase
          .from('equipment')
          .select('id, name, equipment_type, status')
          .neq('status', 'Retired')
          .order('name', { ascending: true });
        const equipmentAssignmentsQuery = supabase
          .from('job_equipment')
          .select('id, equipment:equipment_id(id, name, equipment_type, status)')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });

        const [jobResult, personnelResult, assignmentsResult, equipmentResult, equipmentAssignmentsResult] = await Promise.all([
          jobQuery,
          personnelQuery,
          assignmentsQuery,
          equipmentQuery,
          equipmentAssignmentsQuery
        ]);

        if (jobResult.error) throw jobResult.error;
        if (personnelResult.error) throw personnelResult.error;
        if (assignmentsResult.error) throw assignmentsResult.error;
        if (equipmentResult.error) throw equipmentResult.error;
        if (equipmentAssignmentsResult.error) throw equipmentAssignmentsResult.error;
        if (!isMounted) return;

        if (!jobResult.data) {
          setError('Job not found.');
          setJob(null);
          setPersonnel([]);
          setEquipmentKits([]);
          setAssignments([]);
          setEquipmentAssignments([]);
          return;
        }

        const loadedPersonnel = (personnelResult.data ?? []) as PersonnelOption[];
        const loadedEquipment = (equipmentResult.data ?? []) as EquipmentOption[];
        const loadedEquipmentAssignments = (equipmentAssignmentsResult.data ?? []).map(normalizeEquipmentAssignment);
        const loadedAssignedEquipmentIds = new Set(loadedEquipmentAssignments.map((assignment) => assignment.equipment?.id).filter(Boolean));
        setJob(jobResult.data as Job);
        setPersonnel(loadedPersonnel);
        setEquipmentKits(loadedEquipment);
        setAssignments((assignmentsResult.data ?? []).map(normalizeAssignment));
        setEquipmentAssignments(loadedEquipmentAssignments);
        setSelectedPersonnelId(loadedPersonnel[0]?.id ?? '');
        setSelectedEquipmentId(loadedEquipment.find((equipment) => !loadedAssignedEquipmentIds.has(equipment.id))?.id ?? loadedEquipment[0]?.id ?? '');
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadJobFile();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  const assignedPersonnelIds = useMemo(() => new Set(assignments.map((assignment) => assignment.personnel?.id).filter(Boolean)), [assignments]);
  const assignedEquipmentIds = useMemo(() => new Set(equipmentAssignments.map((assignment) => assignment.equipment?.id).filter(Boolean)), [equipmentAssignments]);
  const activePersonnelCount = personnel.filter((person) => person.status === 'Active').length;

  async function handleAddAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job || !selectedPersonnelId) {
      setCrewError('Select a personnel record before assigning crew.');
      return;
    }

    setCrewError(null);
    setCrewMessage(null);
    setIsSavingAssignment(true);

    try {
      const { error: insertError } = await supabase.from('job_personnel').insert({
        job_id: job.id,
        personnel_id: selectedPersonnelId,
        organization_id: job.organization_id,
        assigned_role: selectedRole
      });

      if (insertError) throw insertError;

      await loadAssignments(job.id);
      setIsCrewFormOpen(false);
      setCrewMessage('Crew assignment added to this Job File.');
    } catch (assignmentError) {
      setCrewError(getErrorMessage(assignmentError));
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    if (!job) return;

    setCrewError(null);
    setCrewMessage(null);
    setRemovingAssignmentId(assignmentId);

    try {
      const { error: deleteError } = await supabase.from('job_personnel').delete().eq('id', assignmentId);

      if (deleteError) throw deleteError;

      await loadAssignments(job.id);
      setCrewMessage('Crew assignment removed from this Job File.');
    } catch (removeError) {
      setCrewError(getErrorMessage(removeError));
    } finally {
      setRemovingAssignmentId(null);
    }
  }

  async function handleAddEquipmentAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job || !selectedEquipmentId) {
      setEquipmentError('Select an equipment kit before assigning equipment.');
      return;
    }

    if (assignedEquipmentIds.has(selectedEquipmentId)) {
      setEquipmentError('This equipment kit is already assigned to this Job File.');
      return;
    }

    setEquipmentError(null);
    setEquipmentMessage(null);
    setIsSavingEquipmentAssignment(true);

    try {
      const { error: insertError } = await supabase.from('job_equipment').insert({
        job_id: job.id,
        equipment_id: selectedEquipmentId,
        organization_id: job.organization_id
      });

      if (insertError) throw insertError;

      await loadEquipmentAssignments(job.id);
      setSelectedEquipmentId(equipmentKits.find((equipment) => equipment.id !== selectedEquipmentId && !assignedEquipmentIds.has(equipment.id))?.id ?? selectedEquipmentId);
      setIsEquipmentFormOpen(false);
      setEquipmentMessage('Equipment assignment added to this Job File.');
    } catch (assignmentError) {
      setEquipmentError(getErrorMessage(assignmentError));
    } finally {
      setIsSavingEquipmentAssignment(false);
    }
  }

  async function handleRemoveEquipmentAssignment(assignmentId: string) {
    if (!job) return;

    setEquipmentError(null);
    setEquipmentMessage(null);
    setRemovingEquipmentAssignmentId(assignmentId);

    try {
      const { error: deleteError } = await supabase.from('job_equipment').delete().eq('id', assignmentId);

      if (deleteError) throw deleteError;

      await loadEquipmentAssignments(job.id);
      setEquipmentMessage('Equipment assignment removed from this Job File.');
    } catch (removeError) {
      setEquipmentError(getErrorMessage(removeError));
    } finally {
      setRemovingEquipmentAssignmentId(null);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Loading job file...
      </section>
    );
  }

  if (error || !job) {
    return (
      <section className="space-y-4">
        <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={jobId ? `/jobs/${jobId}` : '/jobs'}>
          Back to Job
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h1 className="text-base font-semibold text-red-800">Unable to load job file</h1>
          <p className="mt-2 text-sm text-red-700">{error ?? 'Please try again.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={`/jobs/${job.id}`}>
        Back to Job
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Job File</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{job.name}</h1>
            <p className="mt-2 text-sm text-slate-600">Template packet workspace for this operation.</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-300 px-4 py-3 text-sm font-medium text-slate-600 sm:min-h-0 sm:py-2"
            disabled
          >
            Export Packet
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-brand-900">Job summary</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Service type</dt>
            <dd className="mt-1 text-slate-800">{job.service_type}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Location</dt>
            <dd className="mt-1 text-slate-800">{job.location}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Planned date</dt>
            <dd className="mt-1 text-slate-800">{formatPlannedDate(job.planned_date)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Status</dt>
            <dd className="mt-1">
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {job.status}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-900">Crew Assignment</h2>
            <p className="mt-1 text-sm text-slate-600">
              Assign personnel to this operation for future JHA, Preflight, briefing, sign-off, and packet export workflows.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {assignments.length} assigned / {activePersonnelCount} active
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {assignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No crew assigned yet.
            </div>
          ) : null}

          {assignments.map((assignment) => {
            const person = assignment.personnel;
            const part107Readiness = getReadinessIndicator(person?.part_107_expiration_date ?? null);
            const trainingReadiness = getReadinessIndicator(person?.training_expiration_date ?? null);

            return (
              <article key={assignment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-brand-900">{person?.full_name ?? 'Personnel record unavailable'}</h3>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        {assignment.assigned_role}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(person?.status)}`}>
                        {person?.status ?? 'Missing'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Repository role: {person?.role ?? 'Not available'}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
                    onClick={() => void handleRemoveAssignment(assignment.id)}
                    disabled={removingAssignmentId === assignment.id}
                  >
                    {removingAssignmentId === assignment.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>

                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <dt className="font-medium text-slate-500">Part 107 expiration date</dt>
                    <dd className="mt-2 flex flex-wrap items-center gap-2 text-slate-800">
                      <span>{formatExpirationDate(person?.part_107_expiration_date ?? null)}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${part107Readiness.className}`}>{part107Readiness.label}</span>
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <dt className="font-medium text-slate-500">Training expiration date</dt>
                    <dd className="mt-2 flex flex-wrap items-center gap-2 text-slate-800">
                      <span>{formatExpirationDate(person?.training_expiration_date ?? null)}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${trainingReadiness.className}`}>{trainingReadiness.label}</span>
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>

        {crewError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{crewError}</p>
        ) : null}

        {crewMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{crewMessage}</p>
        ) : null}

        {isCrewFormOpen ? (
          <form
            id="crew-assignment-form"
            className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto_auto] sm:items-end"
            onSubmit={handleAddAssignment}
          >
            <label className="block text-sm font-medium text-slate-700">
              Personnel
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                value={selectedPersonnelId}
                onChange={(event) => setSelectedPersonnelId(event.target.value)}
                disabled={isSavingAssignment || personnel.length === 0}
              >
                {personnel.length === 0 ? <option value="">No personnel records available</option> : null}
                {personnel.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name} — {person.role}{assignedPersonnelIds.has(person.id) ? ' (already assigned)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Assigned role
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                disabled={isSavingAssignment || personnel.length === 0}
              >
                {crewRoleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
              disabled={isSavingAssignment || personnel.length === 0}
            >
              {isSavingAssignment ? 'Assigning...' : 'Add Crew'}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:py-2"
              onClick={() => setIsCrewFormOpen(false)}
              disabled={isSavingAssignment}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
            aria-controls="crew-assignment-form"
            aria-expanded={isCrewFormOpen}
            onClick={() => setIsCrewFormOpen(true)}
          >
            + Add Personnel
          </button>
        )}

        {isCrewFormOpen && personnel.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Add personnel records before assigning crew to this job.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-900">Equipment Assignment</h2>
            <p className="mt-1 text-sm text-slate-600">
              Assign aircraft or equipment kits to this operation. Accessories, batteries, controllers, and payloads are not assigned individually.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {equipmentAssignments.length} assigned
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {equipmentAssignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No equipment assigned yet.
            </div>
          ) : null}

          {equipmentAssignments.map((assignment) => {
            const equipment = assignment.equipment;

            return (
              <article key={assignment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-brand-900">{equipment?.name ?? 'Equipment record unavailable'}</h3>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(equipment?.status)}`}>
                        {equipment?.status ?? 'Missing'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Equipment type: {equipment?.equipment_type ?? 'Not available'}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
                    onClick={() => void handleRemoveEquipmentAssignment(assignment.id)}
                    disabled={removingEquipmentAssignmentId === assignment.id}
                  >
                    {removingEquipmentAssignmentId === assignment.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {equipmentError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{equipmentError}</p>
        ) : null}

        {equipmentMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{equipmentMessage}</p>
        ) : null}

        {isEquipmentFormOpen ? (
          <form
            id="equipment-assignment-form"
            className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
            onSubmit={handleAddEquipmentAssignment}
          >
            <label className="block text-sm font-medium text-slate-700">
              Equipment Kit
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                value={selectedEquipmentId}
                onChange={(event) => setSelectedEquipmentId(event.target.value)}
                disabled={isSavingEquipmentAssignment || equipmentKits.length === 0}
              >
                {equipmentKits.length === 0 ? <option value="">No active equipment kits available</option> : null}
                {equipmentKits.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.name} — {equipment.equipment_type}{assignedEquipmentIds.has(equipment.id) ? ' (already assigned)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
              disabled={isSavingEquipmentAssignment || equipmentKits.length === 0 || assignedEquipmentIds.has(selectedEquipmentId)}
            >
              {isSavingEquipmentAssignment ? 'Assigning...' : 'Assign Equipment'}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:py-2"
              onClick={() => setIsEquipmentFormOpen(false)}
              disabled={isSavingEquipmentAssignment}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
            aria-controls="equipment-assignment-form"
            aria-expanded={isEquipmentFormOpen}
            onClick={() => setIsEquipmentFormOpen(true)}
          >
            + Add Equipment
          </button>
        )}

        {isEquipmentFormOpen && equipmentKits.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Add active equipment kit records before assigning equipment to this job.
          </p>
        ) : null}
      </div>


      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-900">Equipment Assignment</h2>
            <p className="mt-1 text-sm text-slate-600">
              Assign aircraft or equipment kits to this operation. Accessories, batteries, controllers, and payloads are not assigned individually.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {equipmentAssignments.length} assigned
          </span>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={handleAddEquipmentAssignment}>
          <label className="block text-sm font-medium text-slate-700">
            Equipment Kit
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={selectedEquipmentId}
              onChange={(event) => setSelectedEquipmentId(event.target.value)}
              disabled={isSavingEquipmentAssignment || equipmentKits.length === 0}
            >
              {equipmentKits.length === 0 ? <option value="">No active equipment kits available</option> : null}
              {equipmentKits.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name} — {equipment.equipment_type}{assignedEquipmentIds.has(equipment.id) ? ' (already assigned)' : ''}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
            disabled={isSavingEquipmentAssignment || equipmentKits.length === 0 || assignedEquipmentIds.has(selectedEquipmentId)}
          >
            {isSavingEquipmentAssignment ? 'Assigning...' : 'Assign Equipment'}
          </button>
        </form>

        {equipmentKits.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Add active equipment kit records before assigning equipment to this job.
          </p>
        ) : null}

        {equipmentError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{equipmentError}</p>
        ) : null}

        {equipmentMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{equipmentMessage}</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {equipmentAssignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No equipment assigned yet. Select an Equipment Repository kit to add the first aircraft or equipment kit.
            </div>
          ) : null}

          {equipmentAssignments.map((assignment) => {
            const equipment = assignment.equipment;

            return (
              <article key={assignment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-brand-900">{equipment?.name ?? 'Equipment record unavailable'}</h3>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(equipment?.status)}`}>
                        {equipment?.status ?? 'Missing'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Equipment type: {equipment?.equipment_type ?? 'Not available'}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
                    onClick={() => void handleRemoveEquipmentAssignment(assignment.id)}
                    disabled={removingEquipmentAssignmentId === assignment.id}
                  >
                    {removingEquipmentAssignmentId === assignment.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {templateChecklist.map((template) => {
          const content = (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-brand-900">{template.name}</h2>
              <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Not started
              </span>
            </div>
          );

          if (template.path) {
            return (
              <Link
                key={template.name}
                to={`/jobs/${job.id}/${template.path}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
              >
                {content}
              </Link>
            );
          }

          return (
            <article key={template.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
}
