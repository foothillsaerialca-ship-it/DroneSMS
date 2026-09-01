import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { OrganizationIdentityCard } from '@frontend/features/settings/components/organization-identity-card';
import { generateJobPacketPdf } from '@frontend/features/jobs/lib/proposal-pdf';
import { loadOrganizationSettingsById, type OrganizationSettings } from '@frontend/features/settings/lib/organization-settings';
import { getOperationReadinessStatus, getReadinessBlockingReasons, type OperationReadinessRecord } from '@frontend/features/jobs/lib/operation-readiness';

const operationResultOptions = ['Completed as Planned', 'Completed with Changes', 'Delayed', 'Aborted', 'Incident Occurred'];
const resultsRequiringNarrative = new Set(operationResultOptions.filter((result) => result !== 'Completed as Planned'));

const crewRoleOptions = ['RPIC', 'Pilot', 'Visual Observer', 'Payload Operator', 'Ground Crew'];
const safetyEventCategories = ['Operational', 'Environmental', 'Equipment', 'Personnel', 'Public'];
const safetyEventOutcomes = ['Resolved', 'Operation Paused', 'Operation Terminated'];

const initialSafetyEventFormState = {
  category: safetyEventCategories[0],
  description: '',
  immediateActionsTaken: '',
  outcome: safetyEventOutcomes[0],
  promoteToHazardLibrary: false
};

type Job = {
  id: string;
  organization_id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
  source_proposal_id: string | null;
  source_proposal_number: string | null;
};

type PersonnelOption = {
  id: string;
  full_name: string;
  role: string;
  part_107_expiration_date: string | null;
  training_expiration_date: string | null;
  status: string;
  user_id: string | null;
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

type JobSafetyEvent = {
  id: string;
  category: string;
  description: string;
  immediate_actions_taken: string | null;
  outcome: string;
  promote_to_hazard_library: boolean;
  created_at: string;
};

type JhaSummary = {
  status: string;
  faa_airspace_class: string | null;
  laanc_required: string | null;
  crew_briefed: boolean;
  controls_in_place: boolean;
  certified_at: string | null;
  safety_manager_reviewed_at: string | null;
  safety_manager_review_stale: boolean;
  rpic_accepted_at: string | null;
  rpic_acceptance_stale: boolean;
  rpic_personnel_id: string | null;
};

type PreflightSummary = {
  status: string;
  final_rpic_approval: boolean;
};

type OperationCloseout = {
  id: string;
  operation_result: string;
  deviation_narrative: string | null;
  updated_at: string;
};

type CloseoutFormState = {
  operationResult: string;
  deviationNarrative: string;
};

type SafetyEventFormState = typeof initialSafetyEventFormState;

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

function getWorkflowStatusClassName(isComplete: boolean) {
  return isComplete ? currentClassName : missingClassName;
}

function getPersonnelReadinessSummary(assignments: JobPersonnelAssignment[]) {
  if (assignments.length === 0) return 'No assigned crew members yet.';

  const currentAndQualified = assignments.filter((assignment) => {
    const person = assignment.personnel;
    if (!person || person.status !== 'Active') return false;

    return getReadinessIndicator(person.part_107_expiration_date).label === 'Current'
      && getReadinessIndicator(person.training_expiration_date).label === 'Current';
  }).length;

  const crewLabel = assignments.length === 1 ? 'crew member' : 'crew members';
  return `${currentAndQualified} assigned ${crewLabel} current and qualified`;
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
  const [safetyEvents, setSafetyEvents] = useState<JobSafetyEvent[]>([]);
  const [jhaSummary, setJhaSummary] = useState<JhaSummary | null>(null);
  const [preflightSummary, setPreflightSummary] = useState<PreflightSummary | null>(null);
  const [operationCloseout, setOperationCloseout] = useState<OperationCloseout | null>(null);
  const [operationReadiness, setOperationReadiness] = useState<OperationReadinessRecord | null>(null);
  const [fitnessConfirmed, setFitnessConfirmed] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [readinessMessage, setReadinessMessage] = useState<string | null>(null);
  const [isSavingReadiness, setIsSavingReadiness] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings | null>(null);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
  const [selectedRole, setSelectedRole] = useState(crewRoleOptions[0]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [safetyEventFormData, setSafetyEventFormData] = useState<SafetyEventFormState>(initialSafetyEventFormState);
  const [closeoutFormData, setCloseoutFormData] = useState<CloseoutFormState>({ operationResult: operationResultOptions[0], deviationNarrative: '' });
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editedAssignmentRole, setEditedAssignmentRole] = useState(crewRoleOptions[0]);
  const [isCrewFormOpen, setIsCrewFormOpen] = useState(false);
  const [isEquipmentFormOpen, setIsEquipmentFormOpen] = useState(false);
  const [isSafetyEventFormOpen, setIsSafetyEventFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isSavingEquipmentAssignment, setIsSavingEquipmentAssignment] = useState(false);
  const [isSavingSafetyEvent, setIsSavingSafetyEvent] = useState(false);
  const [isSavingCloseout, setIsSavingCloseout] = useState(false);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [savingRoleAssignmentId, setSavingRoleAssignmentId] = useState<string | null>(null);
  const [removingEquipmentAssignmentId, setRemovingEquipmentAssignmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crewError, setCrewError] = useState<string | null>(null);
  const [crewMessage, setCrewMessage] = useState<string | null>(null);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [equipmentMessage, setEquipmentMessage] = useState<string | null>(null);
  const [safetyEventError, setSafetyEventError] = useState<string | null>(null);
  const [safetyEventMessage, setSafetyEventMessage] = useState<string | null>(null);
  const [closeoutError, setCloseoutError] = useState<string | null>(null);
  const [closeoutMessage, setCloseoutMessage] = useState<string | null>(null);

  async function loadAssignments(currentJobId: string) {
    const { data, error: assignmentsError } = await supabase
      .from('job_personnel')
      .select('id, assigned_role, personnel:personnel_id(id, full_name, role, part_107_expiration_date, training_expiration_date, status, user_id)')
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

  async function loadSafetyEvents(currentJobId: string) {
    const { data, error: safetyEventsError } = await supabase
      .from('job_safety_events')
      .select('id, category, description, immediate_actions_taken, outcome, promote_to_hazard_library, created_at')
      .eq('job_id', currentJobId)
      .order('created_at', { ascending: false });

    if (safetyEventsError) throw safetyEventsError;

    setSafetyEvents((data ?? []) as JobSafetyEvent[]);
  }

  function resetSafetyEventForm() {
    setSafetyEventFormData(initialSafetyEventFormState);
  }

  function updateSafetyEventField<Key extends keyof SafetyEventFormState>(field: Key, value: SafetyEventFormState[Key]) {
    setSafetyEventFormData((currentFormData) => ({ ...currentFormData, [field]: value }));
  }

  function updateCloseoutField<Key extends keyof CloseoutFormState>(field: Key, value: CloseoutFormState[Key]) {
    setCloseoutFormData((currentFormData) => ({ ...currentFormData, [field]: value }));
    setCloseoutError(null);
    setCloseoutMessage(null);
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
      setSafetyEventError(null);

      try {
        const jobQuery = supabase
          .from('jobs')
          .select('id, organization_id, name, service_type, location, planned_date, status, source_proposal_id, source_proposal_number')
          .eq('id', jobId)
          .maybeSingle();
        const personnelQuery = supabase
          .from('personnel')
          .select('id, full_name, role, part_107_expiration_date, training_expiration_date, status, user_id')
          .order('full_name', { ascending: true });
        const assignmentsQuery = supabase
          .from('job_personnel')
          .select('id, assigned_role, personnel:personnel_id(id, full_name, role, part_107_expiration_date, training_expiration_date, status, user_id)')
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
        const safetyEventsQuery = supabase
          .from('job_safety_events')
          .select('id, category, description, immediate_actions_taken, outcome, promote_to_hazard_library, created_at')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false });
        const jhaSummaryQuery = supabase
          .from('jha_assessments')
          .select('status, faa_airspace_class, laanc_required, crew_briefed, controls_in_place, certified_at, safety_manager_reviewed_at, safety_manager_review_stale, rpic_accepted_at, rpic_acceptance_stale, rpic_personnel_id')
          .eq('job_id', jobId)
          .maybeSingle();
        const preflightSummaryQuery = supabase
          .from('preflight_checklists')
          .select('status, final_rpic_approval')
          .eq('job_id', jobId)
          .maybeSingle();
        const closeoutQuery = supabase
          .from('job_operation_closeouts')
          .select('id, operation_result, deviation_narrative, updated_at')
          .eq('job_id', jobId)
          .maybeSingle();
        const readinessQuery = supabase.from('job_operation_readiness').select('approved_at, approval_stale, fitness_for_duty_confirmed, rpic_personnel_id').eq('job_id', jobId).maybeSingle();
        const userQuery = supabase.auth.getUser();

        const [jobResult, personnelResult, assignmentsResult, equipmentResult, equipmentAssignmentsResult, safetyEventsResult, jhaSummaryResult, preflightSummaryResult, closeoutResult, readinessResult, userResult] = await Promise.all([
          jobQuery,
          personnelQuery,
          assignmentsQuery,
          equipmentQuery,
          equipmentAssignmentsQuery,
          safetyEventsQuery,
          jhaSummaryQuery,
          preflightSummaryQuery,
          closeoutQuery,
          readinessQuery,
          userQuery
        ]);

        if (jobResult.error) throw jobResult.error;
        if (personnelResult.error) throw personnelResult.error;
        if (assignmentsResult.error) throw assignmentsResult.error;
        if (equipmentResult.error) throw equipmentResult.error;
        if (equipmentAssignmentsResult.error) throw equipmentAssignmentsResult.error;
        if (safetyEventsResult.error) throw safetyEventsResult.error;
        if (jhaSummaryResult.error) throw jhaSummaryResult.error;
        if (preflightSummaryResult.error) throw preflightSummaryResult.error;
        if (closeoutResult.error) throw closeoutResult.error;
        if (readinessResult.error) throw readinessResult.error;
        if (!isMounted) return;

        if (!jobResult.data) {
          setError('Job not found.');
          setJob(null);
          setPersonnel([]);
          setEquipmentKits([]);
          setAssignments([]);
          setEquipmentAssignments([]);
          setSafetyEvents([]);
          setJhaSummary(null);
          setPreflightSummary(null);
          setOperationCloseout(null);
          setOrganizationSettings(null);
          return;
        }

        const loadedPersonnel = (personnelResult.data ?? []) as PersonnelOption[];
        const loadedEquipment = (equipmentResult.data ?? []) as EquipmentOption[];
        const loadedEquipmentAssignments = (equipmentAssignmentsResult.data ?? []).map(normalizeEquipmentAssignment);
        const loadedAssignedEquipmentIds = new Set(loadedEquipmentAssignments.map((assignment) => assignment.equipment?.id).filter(Boolean));
        setJob(jobResult.data as Job);
        setPersonnel(loadedPersonnel);
        setEquipmentKits(loadedEquipment);
        const loadedAssignments = (assignmentsResult.data ?? []).map(normalizeAssignment);
        setAssignments(loadedAssignments);
        setEquipmentAssignments(loadedEquipmentAssignments);
        setSafetyEvents((safetyEventsResult.data ?? []) as JobSafetyEvent[]);
        setJhaSummary(jhaSummaryResult.data as JhaSummary | null);
        setPreflightSummary(preflightSummaryResult.data as PreflightSummary | null);
        setOperationReadiness(readinessResult.data as OperationReadinessRecord | null);
        setFitnessConfirmed(Boolean(readinessResult.data?.fitness_for_duty_confirmed && !readinessResult.data?.approval_stale));
        setCurrentUserId(userResult.data.user?.id ?? null);
        const loadedCloseout = closeoutResult.data as OperationCloseout | null;
        setOperationCloseout(loadedCloseout);
        setCloseoutFormData({
          operationResult: loadedCloseout?.operation_result ?? operationResultOptions[0],
          deviationNarrative: loadedCloseout?.deviation_narrative ?? ''
        });
        const settings = await loadOrganizationSettingsById((jobResult.data as Job).organization_id);
        if (isMounted) setOrganizationSettings(settings);
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
  const jhaComplete = jhaSummary?.status === 'Complete';
  const crewBriefingComplete = Boolean(jhaSummary?.crew_briefed && jhaComplete);
  const airspaceReviewComplete = Boolean(jhaSummary && (jhaSummary.faa_airspace_class || jhaSummary.laanc_required));
  const preflightComplete = preflightSummary?.status === 'Complete';
  const closeoutComplete = Boolean(operationCloseout);
  const personnelReadinessSummary = getPersonnelReadinessSummary(assignments);
  const closeoutNarrativeRequired = resultsRequiringNarrative.has(closeoutFormData.operationResult);
  const assignedRpic = assignments.find((assignment) => assignment.assigned_role === 'RPIC' && assignment.personnel?.status === 'Active')?.personnel ?? null;
  const readinessPrerequisites = {
    jhaComplete,
    safetyManagerReviewCurrent: Boolean(jhaSummary?.safety_manager_reviewed_at && !jhaSummary.safety_manager_review_stale),
    rpicAcceptanceCurrent: Boolean(jhaSummary?.rpic_accepted_at && !jhaSummary.rpic_acceptance_stale && jhaSummary.rpic_personnel_id === assignedRpic?.id),
    controlsInPlace: Boolean(jhaSummary?.controls_in_place), preflightComplete,
    assignedRpicId: assignedRpic?.id ?? null, fitnessForDutyConfirmed: fitnessConfirmed,
  };
  const readinessBlockingReasons = getReadinessBlockingReasons(readinessPrerequisites);
  const readinessStatus = getOperationReadinessStatus(operationReadiness);

  async function recordOperationReadiness(fitness: boolean) {
    if (!job) return;
    setIsSavingReadiness(true); setReadinessError(null); setReadinessMessage(null);
    try {
      const { data, error: readinessSaveError } = await supabase.rpc('confirm_job_ready_to_operate', { target_job_id: job.id, fitness_confirmed: fitness });
      if (readinessSaveError) throw readinessSaveError;
      setOperationReadiness(data as OperationReadinessRecord); setFitnessConfirmed(fitness);
      setReadinessMessage(fitness ? 'Ready to Operate approval recorded.' : 'Not Ready saved; no operation approval was recorded.');
    } catch (saveError) { setReadinessError(getErrorMessage(saveError)); }
    finally { setIsSavingReadiness(false); }
  }

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

  function startEditingAssignmentRole(assignment: JobPersonnelAssignment) {
    setCrewError(null);
    setCrewMessage(null);
    setEditingAssignmentId(assignment.id);
    setEditedAssignmentRole(assignment.assigned_role);
  }

  function cancelEditingAssignmentRole() {
    setEditingAssignmentId(null);
    setEditedAssignmentRole(crewRoleOptions[0]);
  }

  async function handleUpdateAssignmentRole(assignment: JobPersonnelAssignment) {
    if (!job) return;

    if (editedAssignmentRole === assignment.assigned_role) {
      cancelEditingAssignmentRole();
      return;
    }

    setCrewError(null);
    setCrewMessage(null);
    setSavingRoleAssignmentId(assignment.id);

    try {
      const { error: updateError } = await supabase
        .from('job_personnel')
        .update({ assigned_role: editedAssignmentRole })
        .eq('id', assignment.id);

      if (updateError) throw updateError;

      await loadAssignments(job.id);
      cancelEditingAssignmentRole();
      setCrewMessage('Crew assignment role updated.');
    } catch (updateError) {
      setCrewError(getErrorMessage(updateError));
    } finally {
      setSavingRoleAssignmentId(null);
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

  async function handleSaveSafetyEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job) return;

    if (!safetyEventFormData.description.trim()) {
      setSafetyEventError('Describe the safety event before saving it.');
      return;
    }

    setSafetyEventError(null);
    setSafetyEventMessage(null);
    setIsSavingSafetyEvent(true);

    try {
      const payload = {
        category: safetyEventFormData.category,
        description: safetyEventFormData.description.trim(),
        immediate_actions_taken: safetyEventFormData.immediateActionsTaken.trim() || null,
        outcome: safetyEventFormData.outcome,
        promote_to_hazard_library: false
      };

      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userResult.user?.id;
      if (!userId) throw new Error('Sign in again before documenting a safety event.');

      const { error: insertError } = await supabase.from('job_safety_events').insert({
        ...payload,
        job_id: job.id,
        organization_id: job.organization_id,
        created_by: userId
      });

      if (insertError) throw insertError;

      await loadSafetyEvents(job.id);
      setSafetyEventMessage('Safety event added to this Job File and queued for Safety Manager Review.');
      resetSafetyEventForm();
      setIsSafetyEventFormOpen(false);
    } catch (saveError) {
      setSafetyEventError(getErrorMessage(saveError));
    } finally {
      setIsSavingSafetyEvent(false);
    }
  }

  async function handleSaveCloseout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job) return;

    if (resultsRequiringNarrative.has(closeoutFormData.operationResult) && !closeoutFormData.deviationNarrative.trim()) {
      setCloseoutError('Describe changes, delays, deviations, operational issues, or reasons for aborting the mission.');
      return;
    }

    setCloseoutError(null);
    setCloseoutMessage(null);
    setIsSavingCloseout(true);

    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userResult.user?.id;
      if (!userId) throw new Error('Sign in again before saving operation closeout.');

      const { data, error: upsertError } = await supabase
        .from('job_operation_closeouts')
        .upsert({
          job_id: job.id,
          organization_id: job.organization_id,
          user_id: userId,
          operation_result: closeoutFormData.operationResult,
          deviation_narrative: closeoutFormData.deviationNarrative.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'job_id' })
        .select('id, operation_result, deviation_narrative, updated_at')
        .single();

      if (upsertError) throw upsertError;

      setOperationCloseout(data as OperationCloseout);
      setCloseoutMessage('Operation closeout saved.');
    } catch (saveError) {
      setCloseoutError(getErrorMessage(saveError));
    } finally {
      setIsSavingCloseout(false);
    }
  }

  async function handleExportPacket() {
    if (!job) return;

    setCloseoutError(null);
    setCloseoutMessage(null);
    try {
      const result = await generateJobPacketPdf(job.id);
      setCloseoutMessage(
        result.saved
          ? 'Closeout packet PDF downloaded and saved to DroneSMS records.'
          : 'Closeout packet PDF downloaded successfully. Unable to save a copy to DroneSMS records.',
      );
    } catch (exportError) {
      setCloseoutError(getErrorMessage(exportError));
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
            <p className="mt-2 text-sm text-slate-600">Work this job packet from top to bottom: plan, verify, execute, close out, then export.</p>
          </div>
        </div>
      </div>

      <OrganizationIdentityCard
        organization={organizationSettings}
        title="Job File Company Information"
        description="Company identity is auto-populated from Settings for packet headers and job file documents."
      />

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
          {job.source_proposal_id ? (
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Source Proposal</dt>
              <dd className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="font-semibold text-slate-800">
                  {job.source_proposal_number ?? job.source_proposal_id.slice(0, 8).toUpperCase()}
                </span>
                <Link
                  to={`/proposals/${job.source_proposal_id}/edit`}
                  className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-brand-700 bg-white px-3 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 sm:min-h-0 sm:py-2"
                >
                  View Proposal
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div id="crew-assignment" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">1</span>
            <div>
              <h2 className="text-base font-semibold text-brand-900">Crew Assignment</h2>
              <p className="mt-1 text-sm text-slate-600">
                Assign personnel to this operation for JHA, pre-flight coordination, mission signoff, and packet export.
              </p>
              <span className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {assignments.length} assigned / {activePersonnelCount} active
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
            aria-controls="crew-assignment-form"
            aria-expanded={isCrewFormOpen}
            onClick={() => setIsCrewFormOpen(true)}
            disabled={isCrewFormOpen}
          >
            {isCrewFormOpen ? 'Adding Crew' : 'Add Crew'}
          </button>
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
            const isEditingRole = editingAssignmentId === assignment.id;
            const isSavingRole = savingRoleAssignmentId === assignment.id;
            const isRemovingAssignment = removingAssignmentId === assignment.id;

            return (
              <article key={assignment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-brand-900">{person?.full_name ?? 'Personnel record unavailable'}</h3>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        Current role: {assignment.assigned_role}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(person?.status)}`}>
                        {person?.status ?? 'Missing'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Repository role: {person?.role ?? 'Not available'}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!isEditingRole ? (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
                        onClick={() => startEditingAssignmentRole(assignment)}
                        disabled={isSavingRole || isRemovingAssignment}
                      >
                        Edit Role
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
                      onClick={() => void handleRemoveAssignment(assignment.id)}
                      disabled={isSavingRole || isRemovingAssignment}
                    >
                      {isRemovingAssignment ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>

                {isEditingRole ? (
                  <div className="mt-3 grid gap-2 rounded-lg border border-brand-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <label className="block text-sm font-medium text-slate-700">
                      Assigned role
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                        value={editedAssignmentRole}
                        onChange={(event) => setEditedAssignmentRole(event.target.value)}
                        disabled={isSavingRole}
                      >
                        {crewRoleOptions.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
                      onClick={() => void handleUpdateAssignmentRole(assignment)}
                      disabled={isSavingRole}
                    >
                      {isSavingRole ? 'Saving...' : 'Save Role'}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:py-2"
                      onClick={cancelEditingAssignmentRole}
                      disabled={isSavingRole}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}

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
        ) : null}

        {isCrewFormOpen && personnel.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Add personnel records before assigning crew to this job.
          </p>
        ) : null}
      </div>

      <div id="equipment-assignment" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">2</span>
            <div>
              <h2 className="text-base font-semibold text-brand-900">Equipment Assignment</h2>
              <p className="mt-1 text-sm text-slate-600">
                Assign aircraft or equipment kits to this operation. Accessories, batteries, controllers, and payloads are not assigned individually.
              </p>
              <span className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {equipmentAssignments.length} assigned
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
            aria-controls="equipment-assignment-form"
            aria-expanded={isEquipmentFormOpen}
            onClick={() => setIsEquipmentFormOpen(true)}
            disabled={isEquipmentFormOpen}
          >
            {isEquipmentFormOpen ? 'Adding Equipment' : 'Add Equipment'}
          </button>
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
        ) : null}

        {isEquipmentFormOpen && equipmentKits.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Add active equipment kit records before assigning equipment to this job.
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">3</span>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">Job Hazard Analysis (JHA)</h2>
              <p className="mt-1 text-sm text-slate-600">Core operational control for mission hazards, airspace review, communications, crew briefing, and RPIC certification.</p>
              <span className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowStatusClassName(jhaComplete)}`}>
                {jhaComplete ? 'Complete' : jhaSummary ? 'In progress' : 'Not started'}
              </span>
            </div>
          </div>
          <Link
            to={`/jobs/${job.id}/templates/jha`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            Open JHA
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">4</span>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">Pre-Flight Checklist</h2>
              <p className="mt-1 text-sm text-slate-600">Aircraft, equipment, weather, airspace, crew communications, and RPIC preflight review before the final Ready to Operate decision.</p>
              <span className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowStatusClassName(preflightComplete)}`}>
                {preflightComplete ? 'Complete' : preflightSummary ? 'In progress' : 'Not started'}
              </span>
            </div>
          </div>
          <Link
            to={`/jobs/${job.id}/templates/preflight`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            Open Pre-Flight
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="ready-to-operate-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">5</span>
            <div>
              <h2 id="ready-to-operate-heading" className="text-lg font-semibold text-brand-900">Ready to Operate</h2>
              <p className="mt-1 text-sm text-slate-600">Final operation approval by the assigned RPIC after the safety workflow is current.</p>
              <span className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${readinessStatus === 'Ready to Operate' ? currentClassName : readinessStatus === 'Approval Stale' ? expiringClassName : missingClassName}`}>{readinessStatus}</span>
              {operationReadiness?.approved_at ? <p className="mt-2 text-xs text-slate-500">{readinessStatus === 'Approval Stale' ? 'Previously approved' : 'Approved'} by {assignedRpic?.full_name ?? 'assigned RPIC'} on {new Date(operationReadiness.approved_at).toLocaleString()}.</p> : null}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>I have reviewed the hazards and controls for this operation. Required controls are in place, preflight requirements are complete, and current conditions are acceptable to proceed.</p>
          <label className="mt-4 flex items-start gap-3 font-medium text-slate-800"><input type="checkbox" className="mt-1 h-4 w-4" checked={fitnessConfirmed} onChange={(event) => { setFitnessConfirmed(event.target.checked); setReadinessMessage(null); }} disabled={isSavingReadiness || currentUserId !== assignedRpic?.user_id} /><span>I am fit to safely perform my assigned duties and am not impaired by fatigue, illness, medication, alcohol, drugs, or another condition that could affect safe operation.</span></label>
          <p className="mt-2 text-xs text-slate-500">Only the confirmation is recorded. Do not enter medical details.</p>
        </div>
        {readinessBlockingReasons.length ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Before approval:</p><ul className="mt-1 list-disc pl-5">{readinessBlockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div> : null}
        {assignedRpic && currentUserId !== assignedRpic.user_id ? <p className="mt-3 text-sm text-slate-600">Only assigned RPIC {assignedRpic.full_name} can complete this confirmation while signed in.</p> : null}
        {readinessError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{readinessError}</p> : null}
        {readinessMessage ? <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">{readinessMessage}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400" disabled={isSavingReadiness || readinessBlockingReasons.length > 0 || currentUserId !== assignedRpic?.user_id} onClick={() => void recordOperationReadiness(true)}>{isSavingReadiness ? 'Saving...' : 'Approve Ready to Operate'}</button><button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400" disabled={isSavingReadiness || !assignedRpic || currentUserId !== assignedRpic.user_id} onClick={() => void recordOperationReadiness(false)}>Save as Not Ready</button></div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">6</span>
            <div>
              <h2 className="text-base font-semibold text-brand-900">Operation Execution</h2>
              <p className="mt-1 text-sm text-slate-600">Conduct the operation under the approved JHA and pre-flight controls. This section is informational only and does not duplicate data entry.</p>
              <span className="mt-3 inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                Mission controls summary
              </span>
            </div>
          </div>
          <Link
            to={`/jobs/${job.id}/templates/jha`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 sm:min-h-0"
          >
            Review Controls
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-brand-900">Crew Briefing Status</p>
            <p className="mt-1 text-sm text-slate-600">{crewBriefingComplete ? 'Completed via JHA' : 'Pending JHA crew briefing completion'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-brand-900">Airspace Review Status</p>
            <p className="mt-1 text-sm text-slate-600">{airspaceReviewComplete ? 'Completed via JHA' : 'Pending JHA airspace review'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-brand-900">Personnel Readiness</p>
            <p className="mt-1 text-sm text-slate-600">{personnelReadinessSummary}</p>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">6</span>
            <div>
              <h2 className="text-base font-semibold text-brand-900">Safety Events</h2>
              <p className="mt-1 text-sm text-slate-600">
                Document unexpected hazards, near misses, lessons learned, and operational deviations encountered during this mission.
              </p>
              <span className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {safetyEvents.length} recorded
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0"
            aria-controls="safety-event-form"
            aria-expanded={isSafetyEventFormOpen}
            onClick={() => {
              resetSafetyEventForm();
              setSafetyEventError(null);
              setSafetyEventMessage(null);
              setIsSafetyEventFormOpen(true);
            }}
            disabled={isSafetyEventFormOpen}
          >
            {isSafetyEventFormOpen ? 'Adding Event' : 'Add Safety Event'}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {safetyEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No safety events recorded yet. Add one if unexpected hazards, near misses, or operational deviations occur.
            </div>
          ) : null}

          {safetyEvents.map((safetyEvent) => (
            <article key={safetyEvent.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                      {safetyEvent.category}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {safetyEvent.outcome}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Safety Manager Review</span>
                  </div>
                  <p className="text-sm text-slate-800">{safetyEvent.description}</p>
                  {safetyEvent.immediate_actions_taken ? (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium text-slate-700">Immediate actions:</span> {safetyEvent.immediate_actions_taken}
                    </p>
                  ) : null}
                </div>
                <p className="text-xs font-medium text-slate-500">Submitted records are preserved as historical evidence.</p>
              </div>
            </article>
          ))}
        </div>

        {safetyEventError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{safetyEventError}</p>
        ) : null}

        {safetyEventMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{safetyEventMessage}</p>
        ) : null}

        {isSafetyEventFormOpen ? (
          <form id="safety-event-form" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={handleSaveSafetyEvent}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-brand-900">Add Safety Event</h3>
                <p className="mt-1 text-sm text-slate-600">Capture the condition, response, outcome, and whether it should be promoted later.</p>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-brand-700 hover:text-brand-900 disabled:text-slate-400"
                onClick={() => {
                  resetSafetyEventForm();
                  setIsSafetyEventFormOpen(false);
                }}
                disabled={isSavingSafetyEvent}
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Category
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                  value={safetyEventFormData.category}
                  onChange={(event) => updateSafetyEventField('category', event.target.value)}
                  disabled={isSavingSafetyEvent}
                >
                  {safetyEventCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Outcome
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
                  value={safetyEventFormData.outcome}
                  onChange={(event) => updateSafetyEventField('outcome', event.target.value)}
                  disabled={isSavingSafetyEvent}
                >
                  {safetyEventOutcomes.map((outcome) => (
                    <option key={outcome} value={outcome}>{outcome}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Description
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
                  value={safetyEventFormData.description}
                  onChange={(event) => updateSafetyEventField('description', event.target.value)}
                  placeholder="Describe what happened, where it occurred, and what hazard or deviation was observed."
                  disabled={isSavingSafetyEvent}
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Immediate actions taken
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
                  value={safetyEventFormData.immediateActionsTaken}
                  onChange={(event) => updateSafetyEventField('immediateActionsTaken', event.target.value)}
                  placeholder="Document pauses, mitigations, crew briefings, equipment swaps, or decisions made during the mission."
                  disabled={isSavingSafetyEvent}
                />
              </label>
            </div>

            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Submitting creates a Safety Event Review in SMS. No hazard is created or proposed automatically.</p>

            <button
              type="submit"
              className="mt-4 min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
              disabled={isSavingSafetyEvent}
            >
              {isSavingSafetyEvent ? 'Saving...' : 'Add Safety Event'}
            </button>
          </form>
        ) : null}
      </div>


      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">7</span>
            <div>
              <h2 className="text-base font-semibold text-brand-900">Operation Closeout</h2>
              <p className="mt-1 text-sm text-slate-600">Final required operational step before packet export. Capture the mission result and document any changes, delays, deviations, abort reasons, or incidents.</p>
              <span className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowStatusClassName(closeoutComplete)}`}>
                {closeoutComplete ? 'Complete' : 'Not started'}
              </span>
            </div>
          </div>
          <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 sm:min-h-0">
            Save Closeout Below
          </span>
        </div>

        <form className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={handleSaveCloseout}>
          <label className="block text-sm font-medium text-slate-700">
            Operation Result
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
              value={closeoutFormData.operationResult}
              onChange={(event) => updateCloseoutField('operationResult', event.target.value)}
              disabled={isSavingCloseout}
            >
              {operationResultOptions.map((result) => (
                <option key={result} value={result}>{result}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Describe changes, delays, deviations, operational issues, or reasons for aborting the mission.
            {closeoutNarrativeRequired ? <span className="text-red-600"> *</span> : null}
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              value={closeoutFormData.deviationNarrative}
              onChange={(event) => updateCloseoutField('deviationNarrative', event.target.value)}
              placeholder={closeoutNarrativeRequired ? 'Required for this operation result.' : 'Optional when completed as planned.'}
              disabled={isSavingCloseout}
              required={closeoutNarrativeRequired}
            />
          </label>

          {closeoutError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{closeoutError}</p>
          ) : null}

          {closeoutMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{closeoutMessage}</p>
          ) : null}

          <button
            type="submit"
            className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
            disabled={isSavingCloseout}
          >
            {isSavingCloseout ? 'Saving...' : 'Save Operation Closeout'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">8</span>
            <div>
              <h2 className="text-base font-semibold text-brand-900">Export Packet</h2>
              <p className="mt-1 text-sm text-slate-600">Packet pulls from existing operational records only; no standalone Airspace, Crew Briefing, or Training Summary forms are created.</p>
              <span className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowStatusClassName(closeoutComplete)}`}>
                {closeoutComplete ? 'Ready to export' : 'Closeout required'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:min-h-0 sm:py-2"
            onClick={() => void handleExportPacket()}
            disabled={!closeoutComplete}
          >
            Export Packet
          </button>
        </div>
        <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li>• Proposal</li>
          <li>• Completed Job Record</li>
          <li>• Job Information</li>
          <li>• Crew Assignment</li>
          <li>• Equipment Assignment</li>
          <li>• JHA</li>
          <li>• Closeout & Supporting Documentation</li>
          <li>• Airspace Review (from JHA)</li>
          <li>• Preflight Checklist</li>
          <li>• Safety Events</li>
          <li>• Closeout Summary</li>
        </ul>
      </div>

    </section>
  );
}
