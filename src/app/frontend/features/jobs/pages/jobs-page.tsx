/**
 * File purpose: Implements the jobs page application page, including its presentation, state, validation, and service interactions.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { todayIsoDate } from "@frontend/lib/date-utils";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@frontend/lib/supabase";
import { OrganizationIdentityCard } from "@frontend/features/settings/components/organization-identity-card";
import { generateProposalPdf } from "@frontend/features/jobs/lib/proposal-pdf";
import {
  archiveGeneratedDocument,
  downloadGeneratedDocument,
  formatFileSize,
  loadGeneratedDocuments,
  openGeneratedDocument,
  getGeneratedDocumentFileName,
  getGeneratedDocumentTypeLabel,
  type GeneratedDocumentRecord,
} from "@frontend/features/jobs/lib/generated-documents";
import {
  loadOrganizationSettingsForUser,
  type OrganizationSettings,
} from "@frontend/features/settings/lib/organization-settings";
import {
  getSelectedHazardName,
  normalizeSelectedHazards,
  type SelectedPreliminaryHazard,
} from "@frontend/features/safety/lib/preliminary-hazard-library";
import {
  proposalStatuses,
  type ProposalEquipmentAssignment,
  type ProposalStatus,
} from "@frontend/features/jobs/lib/workflow-types";

/**
 * Purpose: Represents job data read, written, or rendered by the jobs page workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type Job = {
  id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
};

/**
 * Purpose: Represents proposal data read, written, or rendered by the jobs page workflow.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type Proposal = {
  id: string;
  organization_id: string;
  proposal_number: string | null;
  proposal_name: string;
  client_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  service_type: string;
  site_address: string | null;
  status: ProposalStatus;
  created_at: string;
  hazard_assessment: SelectedPreliminaryHazard[] | null;
  proposal_equipment: Array<Pick<ProposalEquipmentAssignment, "equipment_id">> | null;
  proposed_rpic_id: string | null;
  proposed_rpic_name: string | null;
  proposed_rpic_credentials: string | null;
  proposed_rpic_bio: string | null;
  converted_to_job: boolean;
  converted_job_id: string | null;
  converted_at: string | null;
};

/**
 * Purpose: Defines the jobs tab data contract used by the jobs page module.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type JobsTab = "proposals" | "active" | "completed";
/**
 * Purpose: Defines the input contract accepted by the jobs page component.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type JobsPageProps = { mode?: "jobs" | "proposals" };

/**
 * Purpose: Stores the shared jobs tabs structure used by the jobs page module.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const jobsTabs: { id: Exclude<JobsTab, "proposals">; label: string }[] = [
  { id: "active", label: "Active Jobs" },
  { id: "completed", label: "Completed Jobs" },
];

/**
 * Computes get error message for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getErrorMessage(
  error: unknown,
  fallback = "Unable to load jobs. Please try again.",
) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

/**
 * Computes format date for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function formatDate(dateValue: string) {
  if (!dateValue) return "Not scheduled";

  const [datePart] = dateValue.split("T");
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return dateValue;

  return `${month}/${day}/${year}`;
}

/**
 * Determines is completed job for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function isCompletedJob(job: Job) {
  return (
    job.status.toLowerCase() === "complete" ||
    job.status.toLowerCase() === "completed"
  );
}

/**
 * Computes get initial tab for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getInitialTab(tab: string | null): JobsTab {
  if (tab === "completed") return "completed";
  return "active";
}

/**
 * Renders the jobs interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function JobsPage({ mode = "jobs" }: JobsPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<JobsTab>(() => {
    if (mode === "proposals") return "proposals";
    return getInitialTab(searchParams.get("tab"));
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingProposals, setIsLoadingProposals] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [updatingProposalId, setUpdatingProposalId] = useState<string | null>(
    null,
  );
  const [creatingJobProposalId, setCreatingJobProposalId] = useState<
    string | null
  >(null);
  const [deletingProposalId, setDeletingProposalId] = useState<string | null>(
    null,
  );
  const [generatingProposalPdfId, setGeneratingProposalPdfId] = useState<
    string | null
  >(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [workspaceWarning, setWorkspaceWarning] = useState<string | null>(null);
  const [proposalDocuments, setProposalDocuments] = useState<
    GeneratedDocumentRecord[]
  >([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [organizationSettings, setOrganizationSettings] =
    useState<OrganizationSettings | null>(null);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);

  const loadJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    setJobsError(null);

    try {
      const { data, error: jobsLoadError } = await supabase
        .from("jobs")
        .select("id, name, service_type, location, planned_date, status")
        .is("deleted_at", null)
        .order("planned_date", { ascending: true })
        .order("created_at", { ascending: false });

      if (jobsLoadError) throw jobsLoadError;

      setJobs((data ?? []) as Job[]);
    } catch (loadError) {
      setJobsError(getErrorMessage(loadError));
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  const loadProposals = useCallback(async () => {
    setIsLoadingProposals(true);
    setProposalsError(null);

    try {
      const { data, error: proposalsLoadError } = await supabase
        .from("proposals")
        .select(
          "id, organization_id, proposal_number, proposal_name, client_name, contact_name, phone, email, service_type, site_address, status, created_at, hazard_assessment, proposal_equipment, proposed_rpic_id, proposed_rpic_name, proposed_rpic_credentials, proposed_rpic_bio, converted_to_job, converted_job_id, converted_at",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (proposalsLoadError) throw proposalsLoadError;

      setProposals(
        ((data ?? []) as Proposal[]).map((proposal) => ({
          ...proposal,
          hazard_assessment: normalizeSelectedHazards(
            proposal.hazard_assessment,
          ),
        })),
      );
    } catch (loadError) {
      setProposalsError(getErrorMessage(loadError));
    } finally {
      setIsLoadingProposals(false);
    }
  }, []);

  const loadDocumentsForProposals = useCallback(
    async (proposalIds: string[]) => {
      setDocumentsError(null);
      try {
        setProposalDocuments(
          await loadGeneratedDocuments({
            recordType: 'proposal',
            recordIds: proposalIds,
            documentType: 'proposal_pdf',
          }),
        );
      } catch (documentsLoadError) {
        setDocumentsError(
          getErrorMessage(
            documentsLoadError,
            "Unable to load documents. Please try again.",
          ),
        );
      }
    },
    [],
  );

  useEffect(() => {
    void loadDocumentsForProposals(proposals.map((proposal) => proposal.id));
  }, [loadDocumentsForProposals, proposals]);

  useEffect(() => {
    if (mode !== "proposals") {
      const tabParam = searchParams.get("tab");
      if (tabParam === "proposals") {
        setActiveTab("active");
        setSearchParams({}, { replace: true });
      }
    }
  }, [mode, searchParams, setSearchParams]);

  useEffect(() => {
    let isMounted = true;

    /**
     * Performs load company identity for the surrounding workflow.
     * Fallback/error behavior: Service, storage, browser, or authentication failures are returned or thrown to the caller for user-visible handling.
     */
    async function loadCompanyIdentity() {
      setIsLoadingOrganization(true);

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError) throw userError;

        const userId = userData.user?.id;
        const settings = userId
          ? await loadOrganizationSettingsForUser(userId)
          : null;
        if (isMounted) setOrganizationSettings(settings);
      } catch {
        if (isMounted) setOrganizationSettings(null);
      } finally {
        if (isMounted) setIsLoadingOrganization(false);
      }
    }

    void loadCompanyIdentity();
    void loadJobs();
    void loadProposals();

    return () => {
      isMounted = false;
    };
  }, [loadJobs, loadProposals]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => !isCompletedJob(job)),
    [jobs],
  );
  const completedJobs = useMemo(() => jobs.filter(isCompletedJob), [jobs]);
  const visibleJobs = activeTab === "completed" ? completedJobs : activeJobs;
  const activeProposals = useMemo(
    () => proposals.filter((proposal) => !proposal.converted_to_job),
    [proposals],
  );
  const convertedProposals = useMemo(
    () => proposals.filter((proposal) => proposal.converted_to_job),
    [proposals],
  );
  const showProposalsView = mode === "proposals" || activeTab === "proposals";
  const showJobsView = mode !== "proposals" && activeTab !== "proposals";
  const isLoadingCurrentTab = showProposalsView ? isLoadingProposals : isLoadingJobs;
  const currentError = showProposalsView ? proposalsError : jobsError;
  const tabs = mode === "proposals" ? [{ id: "proposals" as JobsTab, label: "Proposals" }] : jobsTabs;

  /**
   * Computes select tab for the surrounding workflow.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function selectTab(tab: JobsTab) {
    if (mode === "proposals") return;
    setActiveTab(tab);
    setSearchParams(tab === "active" ? {} : { tab });
  }

  /**
   * Computes create job from proposal for the surrounding workflow.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function createJobFromProposal(proposal: Proposal) {
    if (proposal.converted_to_job && proposal.converted_job_id) {
      navigate(`/jobs/${proposal.converted_job_id}`);
      return;
    }

    setCreatingJobProposalId(proposal.id);
    setProposalsError(null);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user)
        throw new Error("You must be signed in to create a job.");

      const { data: currentProposal, error: currentProposalError } = await supabase
        .from("proposals")
        .select("converted_to_job, converted_job_id")
        .eq("id", proposal.id)
        .maybeSingle();

      if (currentProposalError) throw currentProposalError;
      if (currentProposal?.converted_to_job && currentProposal.converted_job_id) {
        navigate(`/jobs/${currentProposal.converted_job_id}`);
        return;
      }

      const proposalNumber =
        proposal.proposal_number ?? proposal.id.slice(0, 8).toUpperCase();
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          organization_id: proposal.organization_id,
          user_id: userData.user.id,
          name: proposal.proposal_name,
          service_type: proposal.service_type,
          location: proposal.site_address || proposal.client_name,
          planned_date: todayIsoDate(),
          notes: `Created from proposal ${proposalNumber}. Confirm planned date during Mission Planning / JHA.`,
          status: "Planned",
          source_proposal_id: proposal.id,
          source_proposal_number: proposalNumber,
          client_name: proposal.client_name,
          contact_name: proposal.contact_name,
          client_phone: proposal.phone,
          client_email: proposal.email,
          site_address: proposal.site_address,
          preliminary_hazards: proposal.hazard_assessment ?? [],
          proposed_rpic_id: proposal.proposed_rpic_id,
          proposed_rpic_name: proposal.proposed_rpic_name,
          proposed_rpic_credentials: proposal.proposed_rpic_credentials,
          proposed_rpic_bio: proposal.proposed_rpic_bio,
        })
        .select("id, name, service_type, location, planned_date, status")
        .single();

      if (error) throw error;

      const createdJob = data as Job;

      // Proposal selections are copied into the operational assignment tables.
      // These are independent rows, so subsequent job edits never rewrite the
      // historical proposal snapshot.
      const personnelAssignments = proposal.proposed_rpic_id
        ? [{
            job_id: createdJob.id,
            organization_id: proposal.organization_id,
            personnel_id: proposal.proposed_rpic_id,
            assigned_role: "RPIC",
          }]
        : [];
      const equipmentAssignments = (proposal.proposal_equipment ?? [])
        .filter((assignment) => Boolean(assignment?.equipment_id))
        .map((assignment) => ({
          job_id: createdJob.id,
          organization_id: proposal.organization_id,
          equipment_id: assignment.equipment_id,
        }));

      if (personnelAssignments.length) {
        const { error: personnelAssignmentError } = await supabase
          .from("job_personnel")
          .insert(personnelAssignments);
        if (personnelAssignmentError) {
          throw new Error(`Job created, but proposal personnel could not be carried forward: ${personnelAssignmentError.message}`);
        }
      }

      if (equipmentAssignments.length) {
        const { error: equipmentAssignmentError } = await supabase
          .from("job_equipment")
          .insert(equipmentAssignments);
        if (equipmentAssignmentError) {
          throw new Error(`Job created, but proposal equipment could not be carried forward: ${equipmentAssignmentError.message}`);
        }
      }

      const convertedAt = new Date().toISOString();
      const { error: proposalUpdateError } = await supabase
        .from("proposals")
        .update({
          converted_to_job: true,
          converted_job_id: createdJob.id,
          converted_at: convertedAt,
          status: "Accepted",
          updated_at: convertedAt,
        })
        .eq("id", proposal.id)
        .eq("converted_to_job", false)
        .select("id")
        .single();

      if (proposalUpdateError) {
        throw new Error(
          "Job was created, but the source proposal could not be marked converted. Please refresh and contact support before creating another job from this proposal.",
        );
      }

      setJobs((current) => [createdJob, ...current]);
      setProposals((current) =>
        current.map((currentProposal) =>
          currentProposal.id === proposal.id
            ? {
                ...currentProposal,
                status: "Accepted",
                converted_to_job: true,
                converted_job_id: createdJob.id,
                converted_at: convertedAt,
              }
            : currentProposal,
        ),
      );
      navigate(`/jobs/${createdJob.id}`);
    } catch (createError) {
      setProposalsError(getErrorMessage(createError));
    } finally {
      setCreatingJobProposalId(null);
    }
  }

  /**
   * Handles update proposal status while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function updateProposalStatus(
    proposalId: string,
    status: ProposalStatus,
  ) {
    const previousProposals = proposals;
    setUpdatingProposalId(proposalId);
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, status } : proposal,
      ),
    );
    setProposalsError(null);

    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", proposalId);

      if (error) throw error;
    } catch (statusError) {
      setProposals(previousProposals);
      setProposalsError(getErrorMessage(statusError));
    } finally {
      setUpdatingProposalId(null);
    }
  }


  /**
   * Handles generate proposal pdf while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function handleGenerateProposalPdf(proposalId: string) {
    setGeneratingProposalPdfId(proposalId);
    setProposalsError(null);
    setWorkspaceMessage(null);
    setWorkspaceWarning(null);

    try {
      const result = await generateProposalPdf(proposalId);
      if (result.saved) {
        setWorkspaceMessage(
          "Proposal PDF downloaded and saved to DroneSMS records.",
        );
        await loadDocumentsForProposals(
          proposals.map((proposal) => proposal.id),
        );
      } else {
        setWorkspaceWarning(
          "Proposal PDF downloaded successfully. Unable to save a copy to DroneSMS records.",
        );
      }
    } catch (pdfError) {
      setProposalsError(getErrorMessage(pdfError));
    } finally {
      setGeneratingProposalPdfId(null);
    }
  }

  /**
   * Implements delete proposal for this module.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function deleteProposal(proposalId: string) {
    if (
      !window.confirm(
        "Are you sure? This will remove the proposal from your active workspace.",
      )
    )
      return;

    setDeletingProposalId(proposalId);
    setProposalsError(null);
    setWorkspaceMessage(null);

    try {
      // Soft-delete only. Future Archive and Locked Record workflows can branch from deleted_at.
      const { error } = await supabase
        .from("proposals")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      if (error) throw error;

      setWorkspaceMessage("Proposal removed from your active workspace.");
      await loadProposals();
    } catch (deleteError) {
      setProposalsError(getErrorMessage(deleteError));
    } finally {
      setDeletingProposalId(null);
    }
  }

  /**
   * Implements delete job for this module.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function deleteJob(jobId: string) {
    if (
      !window.confirm(
        "Are you sure? This will remove the job from your active workspace.",
      )
    )
      return;

    setDeletingJobId(jobId);
    setJobsError(null);
    setWorkspaceMessage(null);

    try {
      // Soft-delete only. Future Archive and Locked Record workflows can branch from deleted_at.
      const { error } = await supabase
        .from("jobs")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;

      setWorkspaceMessage("Job removed from your active workspace.");
      await loadJobs();
    } catch (deleteError) {
      setJobsError(getErrorMessage(deleteError));
    } finally {
      setDeletingJobId(null);
    }
  }


  /**
   * Handles remove generated document while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function removeGeneratedDocument(documentId: string) {
    if (!window.confirm("Remove this document from the proposal documents list?")) {
      return;
    }

    setDocumentsError(null);
    setWorkspaceWarning(null);
    setWorkspaceMessage(null);

    try {
      await archiveGeneratedDocument(documentId);
      setProposalDocuments((current) =>
        current.filter((document) => document.id !== documentId),
      );
      setWorkspaceMessage("Document removed from proposal documents.");
    } catch (archiveError) {
      setDocumentsError(
        getErrorMessage(
          archiveError,
          "Unable to remove document. Please try again.",
        ),
      );
    }
  }

  /**
   * Renders the render proposal card interface and coordinates its user interactions.
   * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
   */
  function renderProposalCard(proposal: Proposal, isConverted: boolean) {
    const proposalNumber =
      proposal.proposal_number ?? proposal.id.slice(0, 8).toUpperCase();
    const isBusy = creatingJobProposalId === proposal.id;
    const isGeneratingPdf = generatingProposalPdfId === proposal.id;
    const documents = proposalDocuments.filter(
      (document) => document.record_id === proposal.id,
    );

    return (
      <article
        key={proposal.id}
        className={`rounded-xl border p-4 shadow-sm ${
          isConverted
            ? "border-emerald-200 bg-emerald-50/50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <h2 className="text-base font-semibold text-brand-900">
                {proposal.proposal_name}
              </h2>
              {isConverted ? (
                <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Converted to Job
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {proposal.client_name}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-44">
            {isConverted ? (
              <>
                {proposal.converted_job_id ? (
                  <Link
                    to={`/jobs/${proposal.converted_job_id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
                  >
                    View Job
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="min-h-11 rounded-lg bg-slate-300 px-3 py-3 text-sm font-medium text-slate-600 sm:min-h-0 sm:py-2"
                    disabled
                  >
                    Job Link Unavailable
                  </button>
                )}
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="sr-only">Proposal status</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 sm:py-2 sm:text-sm"
                    value={proposal.status}
                    onChange={(event) =>
                      void updateProposalStatus(
                        proposal.id,
                        event.target.value as ProposalStatus,
                      )
                    }
                    disabled={updatingProposalId === proposal.id || isBusy}
                  >
                    {proposalStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-h-0 sm:py-2"
                  onClick={() => void createJobFromProposal(proposal)}
                  disabled={
                    isBusy ||
                    Boolean(
                      proposal.converted_to_job && proposal.converted_job_id,
                    )
                  }
                >
                  {isBusy ? "Creating Job..." : "Create Job"}
                </button>
              </>
            )}

            <button
              type="button"
              className="min-h-11 rounded-lg border border-brand-700 bg-white px-3 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0 sm:py-2"
              onClick={() => void handleGenerateProposalPdf(proposal.id)}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? "Generating PDF..." : "Generate Proposal PDF"}
            </button>
            <Link
              to={`/proposals/${proposal.id}/edit`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-700 bg-white px-3 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 sm:min-h-0 sm:py-2"
            >
              Edit Proposal
            </Link>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0 sm:py-2"
              onClick={() => void deleteProposal(proposal.id)}
              disabled={deletingProposalId === proposal.id || isBusy}
            >
              {deletingProposalId === proposal.id
                ? "Removing..."
                : "Delete Proposal"}
            </button>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-500">Proposal number</dt>
            <dd className="mt-1 text-slate-700">{proposalNumber}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Service type</dt>
            <dd className="mt-1 text-slate-700">{proposal.service_type}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Status</dt>
            <dd className="mt-1 text-slate-700">{proposal.status}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Date created</dt>
            <dd className="mt-1 text-slate-700">
              {formatDate(proposal.created_at)}
            </dd>
          </div>
          {isConverted ? (
            <div>
              <dt className="font-medium text-slate-500">Converted date</dt>
              <dd className="mt-1 text-slate-700">
                {proposal.converted_at
                  ? formatDate(proposal.converted_at)
                  : "Not recorded"}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-slate-500">Proposed RPIC</dt>
            <dd className="mt-1 text-slate-700">
              {proposal.proposed_rpic_name ?? "Not selected"}
            </dd>
          </div>
        </dl>

        {proposal.proposed_rpic_credentials || proposal.proposed_rpic_bio ? (
          <div className="mt-4 grid gap-3 text-sm lg:grid-cols-2">
            {proposal.proposed_rpic_credentials ? (
              <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
                <h3 className="font-semibold text-brand-900">
                  RPIC Credentials Snapshot
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {proposal.proposed_rpic_credentials}
                </p>
              </div>
            ) : null}
            {proposal.proposed_rpic_bio ? (
              <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
                <h3 className="font-semibold text-brand-900">
                  RPIC Bio Snapshot
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {proposal.proposed_rpic_bio}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}


        <section
          className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"
          aria-label="Proposal documents"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-brand-900">
                Documents
              </h3>
              <p className="text-xs text-slate-500">
                Retained proposal files are listed newest first.
              </p>
            </div>
          </div>
          {documents.length > 0 ? (
            <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-col gap-3 p-3 text-sm lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {getGeneratedDocumentFileName(document)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getGeneratedDocumentTypeLabel(document.document_type)} ·{" "}
                      Generated {formatDate(document.generated_at)} ·{" "}
                      {formatFileSize(document.file_size)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="rounded-lg border border-brand-700 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                      onClick={() => void openGeneratedDocument(document)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-brand-700 bg-brand-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900"
                      onClick={() => void downloadGeneratedDocument(document)}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => void removeGeneratedDocument(document.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
              No proposal documents have been saved yet. Generate a Proposal PDF
              to retain a copy in DroneSMS records.
            </p>
          )}
        </section>

        {proposal.hazard_assessment?.length ? (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-brand-900">
              Preliminary Hazard Assessment
            </h3>
            <div className="grid gap-2 lg:grid-cols-2">
              {proposal.hazard_assessment.map((hazard) => (
                <div
                  key={hazard.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="font-semibold text-brand-900">
                      {getSelectedHazardName(hazard)}
                    </p>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {hazard.category}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">
                    {hazard.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand-900">
              {mode === "proposals" ? "Proposals" : "Jobs"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {mode === "proposals"
                ? "Review proposal records separately from operations and keep sales activity organized."
                : "Track active operations, completed work, and proposal records in separate views."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/proposals/new"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-700 bg-white px-3 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 sm:min-h-0 sm:py-2"
            >
              + New Proposal
            </Link>
            {mode === "jobs" ? (
              <Link
                to="/jobs/new"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-3 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
              >
                New Job
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {mode === "jobs" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            role="tablist"
            aria-label="Jobs sections"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-brand-700 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-50 hover:text-brand-900"
                }`}
                onClick={() => selectTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isLoadingCurrentTab ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading {activeTab === "proposals" ? "proposals" : "jobs"}...
        </div>
      ) : null}

      {currentError ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-red-800">
            Unable to load or update{" "}
            {activeTab === "proposals" ? "proposals" : "jobs"}
          </h2>
          <p className="mt-2 text-sm text-red-700">{currentError}</p>
        </div>
      ) : null}

      {workspaceMessage ? (
        <div
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 shadow-sm"
          role="status"
        >
          {workspaceMessage}
        </div>
      ) : null}

      {workspaceWarning ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 shadow-sm"
          role="status"
        >
          {workspaceWarning}
        </div>
      ) : null}

      {documentsError ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm"
          role="status"
        >
          Documents could not be loaded: {documentsError}
        </div>
      ) : null}

      {showProposalsView ? (
        <OrganizationIdentityCard
          organization={organizationSettings}
          title="Proposal Company Information"
          description="Company identity is auto-populated from Settings for proposal display and future exports."
          isLoading={isLoadingOrganization}
        />
      ) : null}

      {showProposalsView &&
      !isLoadingProposals &&
      !proposalsError &&
      proposals.length > 0 ? (
        <div className="space-y-6">
          <section
            className="space-y-3"
            aria-labelledby="active-proposals-heading"
          >
            <div>
              <h2
                id="active-proposals-heading"
                className="text-lg font-semibold text-brand-900"
              >
                Active Proposals
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Sales records that have not yet been converted into operational
                jobs.
              </p>
            </div>
            {activeProposals.length > 0 ? (
              <div className="space-y-3">
                {activeProposals.map((proposal) =>
                  renderProposalCard(proposal, false),
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 shadow-sm">
                No active proposals.
              </div>
            )}
          </section>

          <section
            className="space-y-3"
            aria-labelledby="converted-proposals-heading"
          >
            <div>
              <h2
                id="converted-proposals-heading"
                className="text-lg font-semibold text-brand-900"
              >
                Converted Proposals
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Historical sales records that are linked to an operational job.
              </p>
            </div>
            {convertedProposals.length > 0 ? (
              <div className="space-y-3">
                {convertedProposals.map((proposal) =>
                  renderProposalCard(proposal, true),
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 shadow-sm">
                No converted proposals.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {showJobsView &&
      !isLoadingJobs &&
      !jobsError &&
      visibleJobs.length > 0 ? (
        <div className="space-y-3">
          {visibleJobs.map((job) => (
            <article
              key={job.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <Link
                  to={`/jobs/${job.id}`}
                  className="block flex-1 rounded-lg transition hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <h2 className="text-base font-semibold text-brand-900">
                    {job.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {job.service_type}
                  </p>
                </Link>
                <div className="flex flex-col gap-2 sm:items-end">
                  <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    {job.status}
                  </span>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-0 sm:py-2"
                    onClick={() => void deleteJob(job.id)}
                    disabled={deletingJobId === job.id}
                  >
                    {deletingJobId === job.id ? "Removing..." : "Delete Job"}
                  </button>
                </div>
              </div>

              <Link
                to={`/jobs/${job.id}`}
                className="mt-4 block rounded-lg transition hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">Location</dt>
                    <dd className="mt-1 text-slate-700">{job.location}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Planned date</dt>
                    <dd className="mt-1 text-slate-700">
                      {formatDate(job.planned_date)}
                    </dd>
                  </div>
                </dl>
              </Link>
            </article>
          ))}
        </div>
      ) : null}

      {showProposalsView &&
      !isLoadingProposals &&
      !proposalsError &&
      proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">
            No proposals yet
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Create the first proposal before work becomes a job.
          </p>
          <Link
            to="/proposals/new"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            + New Proposal
          </Link>
        </div>
      ) : null}

      {showJobsView &&
      !isLoadingJobs &&
      !jobsError &&
      visibleJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-brand-900">
            No {activeTab === "completed" ? "completed jobs" : "active jobs"}{" "}
            yet
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {activeTab === "completed"
              ? "Completed operations will appear here when a job status is complete."
              : "Create your first job to start building an operations list."}
          </p>
          {activeTab === "active" ? (
            <Link
              to="/jobs/new"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
            >
              New Job
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
