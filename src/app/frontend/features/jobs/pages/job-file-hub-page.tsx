/**
 * File purpose: Implements the job file hub page application page, including its presentation, state, validation, and service interactions.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';
import { daysUntilDate, formatIsoDate, formatIsoDate as formatPlannedDate } from '@frontend/lib/date-utils';
import { OrganizationIdentityCard } from '@frontend/features/settings/components/organization-identity-card';
import { generateJobPacketPdf } from '@frontend/features/jobs/lib/proposal-pdf';
import { loadOrganizationSettingsById, type OrganizationSettings } from '@frontend/features/settings/lib/organization-settings';
import { getOperationReadinessStatus, getReadinessBlockingReasons, type OperationReadinessRecord } from '@frontend/features/jobs/lib/operation-readiness';
import { crewAcknowledgmentSendErrorMessage, crewAcknowledgmentsCurrent, crewBriefingStatus, requiredCrewAssignments, validateManualFieldBriefing, type CrewBriefingEvidence } from '@frontend/features/jobs/lib/crew-briefing';
import { followUpAreas, validateSafetyAssurance, type SafetyAssuranceInput } from '@frontend/features/sms/lib/safety-assurance';

/**
 * Purpose: Defines the ordered operation result options used for UI choices and workflow decisions in job file hub page.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const operationResultOptions = ['Completed as Planned', 'Completed with Changes', 'Delayed', 'Aborted', 'Incident Occurred'];
/**
 * Purpose: Stores the shared results requiring narrative structure used by the job file hub page module.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const resultsRequiringNarrative = new Set(operationResultOptions.filter((result) => result !== 'Completed as Planned'));

/**
 * Purpose: Defines the ordered crew role options used for UI choices and workflow decisions in job file hub page.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const crewRoleOptions = ['RPIC', 'Pilot', 'Visual Observer', 'Payload Operator', 'Ground Crew'];
/**
 * Purpose: Defines the ordered safety event categories used for UI choices and workflow decisions in job file hub page.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const safetyEventCategories = ['Operational', 'Environmental', 'Equipment', 'Personnel', 'Public'];
/**
 * Purpose: Stores the shared safety event outcomes structure used by the job file hub page module.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const safetyEventOutcomes = ['Resolved', 'Operation Paused', 'Operation Terminated'];

/**
 * Purpose: Provides the stable default shape for initial safety event form state in the job file hub page workflow.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const initialSafetyEventFormState = {
  category: safetyEventCategories[0],
  description: '',
  immediateActionsTaken: '',
  outcome: safetyEventOutcomes[0],
  promoteToHazardLibrary: false
};

/**
 * Purpose: Represents job data read, written, or rendered by the job file hub page workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
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
  crew_acknowledgment_required_at: string | null;
};

/**
 * Purpose: Defines the personnel option data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type PersonnelOption = {
  id: string;
  full_name: string;
  role: string;
  part_107_expiration_date: string | null;
  training_expiration_date: string | null;
  status: string;
  user_id: string | null;
  email: string | null;
};

/**
 * Purpose: Defines the job personnel assignment data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type JobPersonnelAssignment = {
  id: string;
  assigned_role: string;
  personnel: PersonnelOption | null;
};

/**
 * Purpose: Defines the equipment option data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type EquipmentOption = {
  id: string;
  name: string;
  equipment_type: string;
  status: string;
};

/**
 * Purpose: Defines the job equipment assignment data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type JobEquipmentAssignment = {
  id: string;
  equipment: EquipmentOption | null;
};

/**
 * Purpose: Defines the job safety event data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type JobSafetyEvent = {
  id: string;
  category: string;
  description: string;
  immediate_actions_taken: string | null;
  outcome: string;
  promote_to_hazard_library: boolean;
  created_at: string;
};

/**
 * Purpose: Defines the jha summary data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
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
  hazard_entries: Array<{ id?: string; description?: string; mitigation?: string }>;
  public_right_of_way_restriction_required: boolean | null;
  permit_authorization_required: boolean | null;
  permit_authorization_status: 'Pending' | 'Approved' | null;
  briefing_version: number;
};

/**
 * Purpose: Defines the preflight summary data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type PreflightSummary = {
  status: string;
  final_rpic_approval: boolean;
};

/**
 * Purpose: Defines the operation closeout data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type OperationCloseout = {
  id: string;
  operation_result: string;
  deviation_narrative: string | null;
  updated_at: string;
};

/**
 * Purpose: Represents the complete closeout form state used by the job file hub page workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type CloseoutFormState = {
  operationResult: string;
  deviationNarrative: string;
  assurance: SafetyAssuranceInput;
  relatedHazardId: string;
  relatedControlId: string;
  relatedSafetyEventId: string;
};

<<<<<<< HEAD
/**
 * Purpose: Represents the complete safety event form state used by the job file hub page workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
=======
const blankAssurance: SafetyAssuranceInput = { controlEffectiveness: '', effectivenessNarrative: '', operationalAction: '', followUpRequired: null, followUpAreas: [], unexpectedIssue: '', unexpectedIssueNarrative: '' };

>>>>>>> ba31bcb3390a51c22a598b340d1a6e7bc45bc1e7
type SafetyEventFormState = typeof initialSafetyEventFormState;

/**
 * Purpose: Defines the readiness indicator data contract used by the job file hub page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type ReadinessIndicator = {
  label: 'Current' | 'Expiring Soon' | 'Expired' | 'Missing';
  className: string;
};

const currentClassName = 'border-emerald-200 bg-emerald-50 text-emerald-700';
const expiringClassName = 'border-amber-200 bg-amber-50 text-amber-700';
const expiredClassName = 'border-red-200 bg-red-50 text-red-700';
const missingClassName = 'border-slate-200 bg-slate-100 text-slate-600';

/**
 * Computes get error message for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load job file. Please try again.';
}

/**
 * Computes format expiration date for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function formatExpirationDate(date: string | null) {
  return formatIsoDate(date, 'Not tracked');
}

/**
 * Renders the get readiness indicator interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
function getReadinessIndicator(date: string | null): ReadinessIndicator {
  if (!date) {
    return { label: 'Missing', className: missingClassName };
  }

  const daysRemaining = daysUntilDate(date);

  if (daysRemaining < 0) {
    return { label: 'Expired', className: expiredClassName };
  }

  if (daysRemaining <= 90) {
    return { label: 'Expiring Soon', className: expiringClassName };
  }

  return { label: 'Current', className: currentClassName };
}

/**
 * Computes get status class name for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getStatusClassName(status: string | undefined) {
  return status === 'Active' || status === 'Available' ? currentClassName : missingClassName;
}

/**
 * Computes get workflow status class name for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getWorkflowStatusClassName(isComplete: boolean) {
  return isComplete ? currentClassName : missingClassName;
}

/**
 * Renders the get personnel readiness summary interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
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

/**
 * Computes normalize assignment for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function normalizeAssignment(row: unknown): JobPersonnelAssignment {
  const assignment = row as JobPersonnelAssignment & { personnel: PersonnelOption | PersonnelOption[] | null };
  const personnel = Array.isArray(assignment.personnel) ? assignment.personnel[0] ?? null : assignment.personnel;

  return {
    id: assignment.id,
    assigned_role: assignment.assigned_role,
    personnel
  };
}

/**
 * Computes normalize equipment assignment for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function normalizeEquipmentAssignment(row: unknown): JobEquipmentAssignment {
  const assignment = row as JobEquipmentAssignment & { equipment: EquipmentOption | EquipmentOption[] | null };
  const equipment = Array.isArray(assignment.equipment) ? assignment.equipment[0] ?? null : assignment.equipment;

  return {
    id: assignment.id,
    equipment
  };
}

/**
 * Renders the job file hub interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function JobFileHubPage() {
  const { jobId } = useParams();
  const location = useLocation();
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
  const [crewEvidence, setCrewEvidence] = useState<CrewBriefingEvidence[]>([]);
  const [briefingActionId, setBriefingActionId] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingMessage, setBriefingMessage] = useState<string | null>(null);
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
  const [closeoutFormData, setCloseoutFormData] = useState<CloseoutFormState>({ operationResult: operationResultOptions[0], deviationNarrative: '', assurance: blankAssurance, relatedHazardId: '', relatedControlId: '', relatedSafetyEventId: '' });
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

  /**
   * Performs load assignments for the surrounding workflow.
   * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
   */
  async function loadAssignments(currentJobId: string) {
    const { data, error: assignmentsError } = await supabase
      .from('job_personnel')
      .select('id, assigned_role, personnel:personnel_id(id, full_name, role, email, part_107_expiration_date, training_expiration_date, status, user_id)')
      .eq('job_id', currentJobId)
      .order('created_at', { ascending: true });

    if (assignmentsError) throw assignmentsError;

    setAssignments((data ?? []).map(normalizeAssignment));
  }

  /**
   * Performs load equipment assignments for the surrounding workflow.
   * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
   */
  async function loadEquipmentAssignments(currentJobId: string) {
    const { data, error: assignmentsError } = await supabase
      .from('job_equipment')
      .select('id, equipment:equipment_id(id, name, equipment_type, status)')
      .eq('job_id', currentJobId)
      .order('created_at', { ascending: true });

    if (assignmentsError) throw assignmentsError;

    setEquipmentAssignments((data ?? []).map(normalizeEquipmentAssignment));
  }

  /**
   * Performs load safety events for the surrounding workflow.
   * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
   */
  async function loadSafetyEvents(currentJobId: string) {
    const { data, error: safetyEventsError } = await supabase
      .from('job_safety_events')
      .select('id, category, description, immediate_actions_taken, outcome, promote_to_hazard_library, created_at')
      .eq('job_id', currentJobId)
      .order('created_at', { ascending: false });

    if (safetyEventsError) throw safetyEventsError;

    setSafetyEvents((data ?? []) as JobSafetyEvent[]);
  }

  /**
   * Handles reset safety event form while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function resetSafetyEventForm() {
    setSafetyEventFormData(initialSafetyEventFormState);
  }

  /**
   * Renders the update safety event field interface and coordinates its user interactions.
   * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
   */
  function updateSafetyEventField<Key extends keyof SafetyEventFormState>(field: Key, value: SafetyEventFormState[Key]) {
    setSafetyEventFormData((currentFormData) => ({ ...currentFormData, [field]: value }));
  }

  /**
   * Renders the update closeout field interface and coordinates its user interactions.
   * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
   */
  function updateCloseoutField<Key extends keyof CloseoutFormState>(field: Key, value: CloseoutFormState[Key]) {
    setCloseoutFormData((currentFormData) => ({ ...currentFormData, [field]: value }));
    setCloseoutError(null);
    setCloseoutMessage(null);
  }

  useEffect(() => {
    let isMounted = true;

    /**
     * Performs load job file for the surrounding workflow.
     * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
     */
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
          .select('id, organization_id, name, service_type, location, planned_date, status, source_proposal_id, source_proposal_number, crew_acknowledgment_required_at')
          .eq('id', jobId)
          .maybeSingle();
        const personnelQuery = supabase
          .from('personnel')
          .select('id, full_name, role, email, part_107_expiration_date, training_expiration_date, status, user_id')
          .order('full_name', { ascending: true });
        const assignmentsQuery = supabase
          .from('job_personnel')
          .select('id, assigned_role, personnel:personnel_id(id, full_name, role, email, part_107_expiration_date, training_expiration_date, status, user_id)')
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
          .select('status, faa_airspace_class, laanc_required, crew_briefed, controls_in_place, certified_at, safety_manager_reviewed_at, safety_manager_review_stale, rpic_accepted_at, rpic_acceptance_stale, rpic_personnel_id, hazard_entries, public_right_of_way_restriction_required, permit_authorization_required, permit_authorization_status, briefing_version')
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
        const crewEvidenceQuery = supabase.from('crew_briefing_acknowledgments').select('assignment_id, assigned_role, briefing_version, status, acknowledged_at, field_briefed_at').eq('job_id', jobId).order('created_at', { ascending: false });

        const [jobResult, personnelResult, assignmentsResult, equipmentResult, equipmentAssignmentsResult, safetyEventsResult, jhaSummaryResult, preflightSummaryResult, closeoutResult, readinessResult, userResult, crewEvidenceResult] = await Promise.all([
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
          userQuery, crewEvidenceQuery
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
        if (crewEvidenceResult.error) throw crewEvidenceResult.error;
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
        setCrewEvidence((crewEvidenceResult.data ?? []) as CrewBriefingEvidence[]);
        setFitnessConfirmed(Boolean(readinessResult.data?.fitness_for_duty_confirmed && !readinessResult.data?.approval_stale));
        setCurrentUserId(userResult.data.user?.id ?? null);
        const loadedCloseout = closeoutResult.data as OperationCloseout | null;
        setOperationCloseout(loadedCloseout);
        setCloseoutFormData({
          operationResult: loadedCloseout?.operation_result ?? operationResultOptions[0],
          deviationNarrative: loadedCloseout?.deviation_narrative ?? '', assurance: blankAssurance,
          relatedHazardId: '', relatedControlId: '', relatedSafetyEventId: ''
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

  useEffect(() => {
    if (isLoading || location.hash !== '#ready-to-operate') return;
    document.getElementById('ready-to-operate')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isLoading, location.hash]);

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
  const briefingVersion = jhaSummary?.briefing_version ?? 1;
  const crewEvidenceCurrent = crewAcknowledgmentsCurrent(assignments, crewEvidence, briefingVersion);
  const readinessPrerequisites = {
    jhaComplete,
    safetyManagerReviewCurrent: Boolean(jhaSummary?.safety_manager_reviewed_at && !jhaSummary.safety_manager_review_stale),
    rpicAcceptanceCurrent: Boolean(jhaSummary?.rpic_accepted_at && !jhaSummary.rpic_acceptance_stale && jhaSummary.rpic_personnel_id === assignedRpic?.id),
    controlsInPlace: Boolean(jhaSummary?.controls_in_place), preflightComplete,
    assignedRpicId: assignedRpic?.id ?? null, fitnessForDutyConfirmed: fitnessConfirmed,
    publicRightOfWayRestrictionRequired: jhaSummary?.public_right_of_way_restriction_required,
    permitAuthorizationRequired: jhaSummary?.permit_authorization_required,
    permitAuthorizationStatus: jhaSummary?.permit_authorization_status,
    crewAcknowledgmentsCurrent: job?.crew_acknowledgment_required_at ? crewEvidenceCurrent : undefined,
  };
  const readinessBlockingReasons = getReadinessBlockingReasons(readinessPrerequisites);
  const readinessStatus = getOperationReadinessStatus(operationReadiness);

  async function reloadCrewEvidence() {
    if (!job) return;
    const { data, error: evidenceError } = await supabase.from('crew_briefing_acknowledgments').select('assignment_id, assigned_role, briefing_version, status, acknowledged_at, field_briefed_at').eq('job_id', job.id).order('created_at', { ascending: false });
    if (evidenceError) throw evidenceError;
    setCrewEvidence((data ?? []) as CrewBriefingEvidence[]);
    setJob((current) => current ? { ...current, crew_acknowledgment_required_at: current.crew_acknowledgment_required_at ?? new Date().toISOString() } : current);
  }

  async function sendCrewAcknowledgment(assignmentId: string) {
    setBriefingActionId(assignmentId); setBriefingError(null); setBriefingMessage(null);
    try {
      const { error: sendError } = await supabase.functions.invoke('send-crew-acknowledgment', { body: { assignmentId } });
      if (sendError) throw sendError;
      await reloadCrewEvidence(); setBriefingMessage('Crew acknowledgment request sent.');
    } catch (sendError) {
      console.error('Crew acknowledgment delivery failed', sendError);
      setBriefingError(crewAcknowledgmentSendErrorMessage());
      await reloadCrewEvidence().catch(() => undefined);
    }
    finally { setBriefingActionId(null); }
  }

  async function recordManualBriefing(assignmentId: string) {
    const reason = window.prompt('Reason: No internet/cellular service; Crew member unable to access email; Device/access issue; or Other')?.trim() ?? '';
    const detail = reason === 'Other' ? window.prompt('Short explanation')?.trim() ?? '' : '';
    const validation = validateManualFieldBriefing(reason, detail, true);
    if (validation) { setBriefingError(validation); return; }
    if (!window.confirm('I confirm that this crew member participated in the full operation briefing in person and was provided the opportunity to ask questions before operations began.')) return;
    setBriefingActionId(assignmentId); setBriefingError(null); setBriefingMessage(null);
    try {
      const { error: manualError } = await supabase.rpc('record_manual_field_briefing', { p_assignment_id: assignmentId, p_reason: reason, p_reason_detail: detail, p_attested: true });
      if (manualError) throw manualError;
      await reloadCrewEvidence();
      setBriefingMessage('Manual Field Briefing recorded.');
    } catch (manualError) {
      setBriefingError(getErrorMessage(manualError));
    } finally {
      setBriefingActionId(null);
    }
  }

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

  /**
   * Handles add assignment while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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

  /**
   * Handles start editing assignment role while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function startEditingAssignmentRole(assignment: JobPersonnelAssignment) {
    setCrewError(null);
    setCrewMessage(null);
    setEditingAssignmentId(assignment.id);
    setEditedAssignmentRole(assignment.assigned_role);
  }

  /**
   * Handles cancel editing assignment role while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function cancelEditingAssignmentRole() {
    setEditingAssignmentId(null);
    setEditedAssignmentRole(crewRoleOptions[0]);
  }

  /**
   * Handles update assignment role while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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

  /**
   * Handles remove assignment while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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

  /**
   * Handles add equipment assignment while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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

  /**
   * Handles remove equipment assignment while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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

  /**
   * Handles save safety event while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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

<<<<<<< HEAD
  /**
   * Handles edit safety event while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function handleEditSafetyEvent(safetyEvent: JobSafetyEvent) {
    setEditingSafetyEventId(safetyEvent.id);
    setSafetyEventFormData({
      category: safetyEvent.category,
      description: safetyEvent.description,
      immediateActionsTaken: safetyEvent.immediate_actions_taken ?? '',
      outcome: safetyEvent.outcome,
      promoteToHazardLibrary: safetyEvent.promote_to_hazard_library
    });
    setSafetyEventError(null);
    setSafetyEventMessage(null);
    setIsSafetyEventFormOpen(true);
  }

  /**
   * Handles delete safety event while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function handleDeleteSafetyEvent(safetyEvent: JobSafetyEvent) {
    if (!job) return;

    const confirmed = window.confirm('Delete this safety event from the Job File? This cannot be undone.');
    if (!confirmed) return;

    setSafetyEventError(null);
    setSafetyEventMessage(null);
    setRemovingSafetyEventId(safetyEvent.id);

    try {
      const { error: deleteError } = await supabase.from('job_safety_events').delete().eq('id', safetyEvent.id);
      if (deleteError) throw deleteError;

      if (editingSafetyEventId === safetyEvent.id) {
        resetSafetyEventForm();
        setIsSafetyEventFormOpen(false);
      }

      await loadSafetyEvents(job.id);
      setSafetyEventMessage('Safety event deleted from this Job File.');
    } catch (deleteError) {
      setSafetyEventError(getErrorMessage(deleteError));
    } finally {
      setRemovingSafetyEventId(null);
    }
  }

  /**
   * Handles save closeout while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
=======
>>>>>>> ba31bcb3390a51c22a598b340d1a6e7bc45bc1e7
  async function handleSaveCloseout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!job) return;

    if (resultsRequiringNarrative.has(closeoutFormData.operationResult) && !closeoutFormData.deviationNarrative.trim()) {
      setCloseoutError('Describe changes, delays, deviations, operational issues, or reasons for aborting the mission.');
      return;
    }
    const assuranceError = validateSafetyAssurance(closeoutFormData.assurance);
    if (assuranceError) { setCloseoutError(assuranceError); return; }

    setCloseoutError(null);
    setCloseoutMessage(null);
    setIsSavingCloseout(true);

    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userResult.user?.id;
      if (!userId) throw new Error('Sign in again before saving operation closeout.');

      const assurance = closeoutFormData.assurance;
      const { data, error: saveError } = await supabase.rpc('save_operation_closeout_with_assurance', {
        target_job_id: job.id, operation_result_value: closeoutFormData.operationResult,
        deviation_narrative_value: closeoutFormData.deviationNarrative.trim(), control_effectiveness_value: assurance.controlEffectiveness,
        effectiveness_narrative_value: assurance.effectivenessNarrative.trim(), operational_action_value: assurance.operationalAction.trim(),
        unexpected_issue_value: assurance.unexpectedIssue === 'Yes', unexpected_issue_narrative_value: assurance.unexpectedIssueNarrative.trim(),
        follow_up_required_value: Boolean(assurance.followUpRequired), follow_up_areas_value: assurance.followUpAreas,
        related_jha_hazard_ids_value: closeoutFormData.relatedHazardId ? [closeoutFormData.relatedHazardId] : [],
        related_control_ids_value: closeoutFormData.relatedControlId ? [closeoutFormData.relatedControlId] : [],
        related_safety_event_ids_value: closeoutFormData.relatedSafetyEventId ? [closeoutFormData.relatedSafetyEventId] : []
      });
      if (saveError) throw saveError;

      setOperationCloseout(data as OperationCloseout);
      setCloseoutMessage('Operation closeout saved.');
    } catch (saveError) {
      setCloseoutError(getErrorMessage(saveError));
    } finally {
      setIsSavingCloseout(false);
    }
  }

  /**
   * Handles export packet while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
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

      <section className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="crew-briefing-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="crew-briefing-heading" className="text-lg font-semibold text-brand-900">Crew Briefing / Crew Acknowledgment</h2><p className="mt-1 text-sm text-slate-600">After the RPIC conducts the full in-person operation briefing, send each assigned non-RPIC crew member a request to review and acknowledge it.</p></div><button type="button" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400" disabled={!jhaSummary || briefingActionId !== null || requiredCrewAssignments(assignments).length === 0 || currentUserId !== assignedRpic?.user_id} onClick={() => void (async () => { for (const assignment of requiredCrewAssignments(assignments)) await sendCrewAcknowledgment(assignment.id); })()}>Send Crew Acknowledgments</button></div>
        <div className="mt-4 space-y-3">{assignments.filter((assignment) => assignment.assigned_role === 'RPIC' || requiredCrewAssignments([assignment]).length).map((assignment) => { const status = crewBriefingStatus(assignment, crewEvidence, briefingVersion); const busy = briefingActionId === assignment.id; return <article key={assignment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-brand-900">{assignment.personnel?.full_name ?? 'Personnel unavailable'} — {assignment.assigned_role}</p><p className="mt-1 text-sm text-slate-600">Status: <strong>{status}</strong></p>{assignment.assigned_role !== 'RPIC' && !assignment.personnel?.email ? <p className="mt-1 text-xs text-amber-700">Add an email on the Personnel record to use electronic acknowledgment.</p> : null}</div>{assignment.assigned_role !== 'RPIC' ? <div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 disabled:text-slate-400" disabled={busy || !jhaSummary || !assignment.personnel?.email || currentUserId !== assignedRpic?.user_id} onClick={() => void sendCrewAcknowledgment(assignment.id)}>{busy ? 'Working…' : status === 'Not Sent' ? 'Send' : 'Resend'}</button><button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:text-slate-400" disabled={busy || !jhaSummary || currentUserId !== assignedRpic?.user_id} onClick={() => void recordManualBriefing(assignment.id)}>Record Manual Field Briefing</button></div> : null}</div></article>; })}{requiredCrewAssignments(assignments).length === 0 ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Solo operation — no separate crew acknowledgment is required. The RPIC continues through the existing acceptance and readiness workflow.</p> : null}</div>
        {briefingError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{briefingError}</p> : null}{briefingMessage ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{briefingMessage}</p> : null}
      </section>

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

      <section id="ready-to-operate" className="scroll-mt-4 rounded-xl border border-brand-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="ready-to-operate-heading">
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

          <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-brand-900">Post-operation Safety Assurance</legend>
            <label className="block text-sm font-medium text-slate-700">Were the safety controls used for this operation effective?<select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={closeoutFormData.assurance.controlEffectiveness} onChange={e=>updateCloseoutField('assurance',{...closeoutFormData.assurance,controlEffectiveness:e.target.value,followUpRequired:false,followUpAreas:[]})}><option value="">Select…</option>{['Yes','Partially','No','Not Applicable'].map(value=><option key={value}>{value}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Think about the controls identified during planning and the JHA. Did they work as intended during the operation?</span></label>
            {closeoutFormData.assurance.controlEffectiveness==='Partially'||closeoutFormData.assurance.controlEffectiveness==='No'?<label className="block text-sm font-medium text-slate-700">{closeoutFormData.assurance.controlEffectiveness==='No'?"What didn’t work?":"What didn’t work as expected?"}<textarea className="mt-1 min-h-20 w-full rounded-lg border p-2" value={closeoutFormData.assurance.effectivenessNarrative} onChange={e=>updateCloseoutField('assurance',{...closeoutFormData.assurance,effectivenessNarrative:e.target.value})} required/></label>:null}
            {closeoutFormData.assurance.controlEffectiveness==='No'?<label className="block text-sm font-medium text-slate-700">What action was taken during the operation?<textarea className="mt-1 min-h-20 w-full rounded-lg border p-2" value={closeoutFormData.assurance.operationalAction} onChange={e=>updateCloseoutField('assurance',{...closeoutFormData.assurance,operationalAction:e.target.value})} required/></label>:null}
            {closeoutFormData.assurance.controlEffectiveness==='Partially'?<fieldset><legend className="text-sm font-medium text-slate-700">Does anything need to change before a future operation?</legend><div className="mt-2 flex gap-4">{['Yes','No'].map(value=><label key={value} className="flex items-center gap-2 text-sm"><input type="radio" checked={closeoutFormData.assurance.followUpRequired===(value==='Yes')} onChange={()=>updateCloseoutField('assurance',{...closeoutFormData.assurance,followUpRequired:value==='Yes'})}/>{value}</label>)}</div>{closeoutFormData.assurance.followUpRequired?<div className="mt-3 grid gap-2 sm:grid-cols-2">{followUpAreas.map(area=><label key={area} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={closeoutFormData.assurance.followUpAreas.includes(area)} onChange={()=>updateCloseoutField('assurance',{...closeoutFormData.assurance,followUpAreas:closeoutFormData.assurance.followUpAreas.includes(area)?closeoutFormData.assurance.followUpAreas.filter(item=>item!==area):[...closeoutFormData.assurance.followUpAreas,area]})}/>{area}</label>)}</div>:null}</fieldset>:null}
            <label className="block text-sm font-medium text-slate-700">Did anything occur that wasn’t adequately covered by the existing hazards or controls?<select className="mt-1 w-full rounded-lg border p-2" value={closeoutFormData.assurance.unexpectedIssue} onChange={e=>updateCloseoutField('assurance',{...closeoutFormData.assurance,unexpectedIssue:e.target.value})}><option value="">Select…</option><option>Yes</option><option>No</option></select></label>
            {closeoutFormData.assurance.unexpectedIssue==='Yes'?<label className="block text-sm font-medium text-slate-700">Briefly describe it.<textarea className="mt-1 min-h-20 w-full rounded-lg border p-2" value={closeoutFormData.assurance.unexpectedIssueNarrative} onChange={e=>updateCloseoutField('assurance',{...closeoutFormData.assurance,unexpectedIssueNarrative:e.target.value})} required/></label>:null}
            {['Partially','No'].includes(closeoutFormData.assurance.controlEffectiveness)||closeoutFormData.assurance.unexpectedIssue==='Yes'?<div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Related JHA hazard (optional)<select className="mt-1 w-full rounded-lg border p-2" value={closeoutFormData.relatedHazardId} onChange={e=>updateCloseoutField('relatedHazardId',e.target.value)}><option value="">Unlinked</option>{(jhaSummary?.hazard_entries||[]).filter(hazard=>hazard.id).map((hazard,index)=><option key={hazard.id} value={hazard.id}>{hazard.description||`Hazard ${index+1}`}</option>)}</select></label><label className="text-sm font-medium">Related control (optional)<select className="mt-1 w-full rounded-lg border p-2" value={closeoutFormData.relatedControlId} onChange={e=>updateCloseoutField('relatedControlId',e.target.value)}><option value="">Unlinked</option>{(jhaSummary?.hazard_entries||[]).filter(hazard=>hazard.id&&hazard.mitigation).map((hazard,index)=><option key={hazard.id} value={`${hazard.id}:control`}>{hazard.mitigation||`Control ${index+1}`}</option>)}</select></label><label className="text-sm font-medium">Related safety event (optional)<select className="mt-1 w-full rounded-lg border p-2" value={closeoutFormData.relatedSafetyEventId} onChange={e=>updateCloseoutField('relatedSafetyEventId',e.target.value)}><option value="">Unlinked</option>{safetyEvents.map(item=><option key={item.id} value={item.id}>{item.category}: {item.description}</option>)}</select></label></div>:null}
            {closeoutFormData.assurance.controlEffectiveness==='Not Applicable'?<label className="block text-sm font-medium text-slate-700">Optional note<textarea className="mt-1 min-h-16 w-full rounded-lg border p-2" value={closeoutFormData.assurance.effectivenessNarrative} onChange={e=>updateCloseoutField('assurance',{...closeoutFormData.assurance,effectivenessNarrative:e.target.value})}/></label>:null}
          </fieldset>

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
