import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

const weatherOptions = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain'];
const visibilityOptions = ['Excellent', 'Good', 'Fair', 'Poor'];
const airspaceOptions = ['B', 'C', 'D', 'E', 'G'];
const laancOptions = ['Yes', 'No', 'Not Applicable'];
const waterBodyTypeOptions = ['River', 'Stream', 'Lake', 'Pond', 'Irrigation Canal', 'Storm Drain', 'Wetland', 'Other'];
const reclamationMethodOptions = ['Collection Tank', 'Absorbent Material', 'Containment Berm', 'Third Party Vendor', 'Not Required'];
const statusOptions = ['Draft', 'Complete'];
const citationOptions = [
  'Clean Water Act 402',
  'Clean Water Act 404',
  'FIFRA',
  'CA DPR',
  'Other State Ag Dept',
  'OSHA HazCom',
  'Not Applicable'
];
const ppeOptions = [
  'Safety Glasses',
  'Chemical Resistant Gloves',
  'Non-Slip Footwear',
  'High-Vis Vest',
  'Hearing Protection'
];

const probabilityHelp = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Frequent'];
const severityHelp = ['Minimal', 'Minor', 'Moderate', 'Serious', 'Catastrophic'];

const today = new Date().toISOString().slice(0, 10);

const defaultIncidentProcedure =
  'Land immediately, secure area, assess injuries, notify RPIC, document, and report per FAA requirements if applicable.';

type Job = {
  id: string;
  organization_id: string;
  name: string;
  service_type: string;
  location: string;
  planned_date: string;
  status: string;
};

type HazardEntry = {
  id: string;
  description: string;
  likelihood: number;
  severity: number;
  mitigation: string;
  owner: string;
  residualRisk: string;
  notes: string;
};

type PpeRequirements = Record<string, boolean>;

type JhaFormState = {
  operatorCompany: string;
  jhaNumber: string;
  remotePilotInCommand: string;
  datePrepared: string;
  clientPropertyOwner: string;
  jobDate: string;
  siteAddress: string;
  dronePlatform: string;
  jobTypeScope: string;
  crewMembers: string;
  weatherConditions: string;
  faaAirspaceClass: string;
  surfaceType: string;
  buildingHeight: string;
  siteAccess: string;
  windSpeed: string;
  weather: string;
  visibility: string;
  publicPresence: boolean;
  exclusionZonePlanned: boolean;
  exclusionZoneDescription: string;
  runoffRisk: boolean;
  chemicalType: string;
  containmentPlan: string;
  regulatoryCitations: string[];
  waterBodyProximity: boolean;
  waterBodyDistance: string;
  waterBodyType: string;
  secondaryContainmentInPlace: boolean;
  reclamationMethod: string;
  reclamationVolumeEstimate: string;
  disposalVendorNameContact: string;
  laancRequired: string;
  hazardEntries: HazardEntry[];
  ppeRequirements: PpeRequirements;
  nearestHospital: string;
  emergencyContact: string;
  droneIncidentProcedure: string;
  crewBriefed: boolean;
  controlsInPlace: boolean;
  stopWorkAuthorityAcknowledged: boolean;
  assessorName: string;
  assessmentDate: string;
  rpicPrintedName: string;
  status: string;
};

type JhaAssessment = {
  operator_company: string | null;
  jha_number: string | null;
  remote_pilot_in_command: string | null;
  date_prepared: string | null;
  client_property_owner: string | null;
  job_date: string | null;
  site_address: string | null;
  drone_platform: string | null;
  job_type_scope: string | null;
  crew_members: string | null;
  weather_conditions: string | null;
  faa_airspace_class: string | null;
  surface_type: string | null;
  building_height: number | null;
  site_access: string | null;
  wind_speed: number | null;
  weather: string | null;
  visibility: string | null;
  public_presence: boolean | null;
  exclusion_zone_planned: boolean | null;
  exclusion_zone_description: string | null;
  runoff_risk: boolean | null;
  chemical_type: string | null;
  containment_plan: string | null;
  regulatory_citations: string[] | null;
  water_body_proximity: boolean | null;
  water_body_distance: number | null;
  water_body_type: string | null;
  secondary_containment_in_place: boolean | null;
  reclamation_method: string | null;
  reclamation_volume_estimate: number | null;
  disposal_vendor_name_contact: string | null;
  laanc_required: string | null;
  hazard_entries: unknown;
  ppe_requirements: unknown;
  nearest_hospital: string | null;
  emergency_contact: string | null;
  drone_incident_procedure: string | null;
  crew_briefed: boolean | null;
  controls_in_place: boolean | null;
  stop_work_authority_acknowledged: boolean | null;
  assessor_name: string | null;
  assessment_date: string | null;
  rpic_printed_name: string | null;
  status: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function createHazardEntry(): HazardEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: '',
    likelihood: 1,
    severity: 1,
    mitigation: '',
    owner: '',
    residualRisk: 'Low',
    notes: ''
  };
}

function getInitialPpeRequirements(): PpeRequirements {
  return ppeOptions.reduce<PpeRequirements>((requirements, option) => {
    requirements[option] = false;
    return requirements;
  }, {});
}

function getInitialFormState(job: Job | null): JhaFormState {
  return {
    operatorCompany: '',
    jhaNumber: job ? `JHA-${job.id.slice(0, 8).toUpperCase()}` : '',
    remotePilotInCommand: '',
    datePrepared: today,
    clientPropertyOwner: '',
    jobDate: job?.planned_date ?? today,
    siteAddress: job?.location ?? '',
    dronePlatform: '',
    jobTypeScope: job ? `${job.service_type} - ${job.name}` : '',
    crewMembers: '',
    weatherConditions: '',
    faaAirspaceClass: '',
    surfaceType: '',
    buildingHeight: '',
    siteAccess: '',
    windSpeed: '',
    weather: weatherOptions[0],
    visibility: visibilityOptions[0],
    publicPresence: false,
    exclusionZonePlanned: false,
    exclusionZoneDescription: '',
    runoffRisk: false,
    chemicalType: '',
    containmentPlan: '',
    regulatoryCitations: [],
    waterBodyProximity: false,
    waterBodyDistance: '',
    waterBodyType: waterBodyTypeOptions[0],
    secondaryContainmentInPlace: false,
    reclamationMethod: reclamationMethodOptions[0],
    reclamationVolumeEstimate: '',
    disposalVendorNameContact: '',
    laancRequired: laancOptions[2],
    hazardEntries: [createHazardEntry()],
    ppeRequirements: getInitialPpeRequirements(),
    nearestHospital: '',
    emergencyContact: '',
    droneIncidentProcedure: defaultIncidentProcedure,
    crewBriefed: false,
    controlsInPlace: false,
    stopWorkAuthorityAcknowledged: false,
    assessorName: '',
    assessmentDate: today,
    rpicPrintedName: '',
    status: statusOptions[0]
  };
}

function normalizeHazards(value: unknown) {
  if (!Array.isArray(value)) return [createHazardEntry()];

  const hazards = value.map((entry) => {
    const item = entry as Partial<HazardEntry>;
    return {
      id: item.id || createHazardEntry().id,
      description: item.description ?? '',
      likelihood: Number(item.likelihood) || 1,
      severity: Number(item.severity) || 1,
      mitigation: item.mitigation ?? '',
      owner: item.owner ?? '',
      residualRisk: item.residualRisk ?? 'Low',
      notes: item.notes ?? ''
    };
  });

  return hazards.length > 0 ? hazards : [createHazardEntry()];
}

function normalizePpe(value: unknown) {
  const defaults = getInitialPpeRequirements();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;

  return { ...defaults, ...(value as PpeRequirements) };
}

function toFormState(job: Job, assessment: JhaAssessment | null): JhaFormState {
  const defaults = getInitialFormState(job);
  if (!assessment) return defaults;

  return {
    ...defaults,
    operatorCompany: assessment.operator_company ?? '',
    jhaNumber: assessment.jha_number ?? defaults.jhaNumber,
    remotePilotInCommand: assessment.remote_pilot_in_command ?? '',
    datePrepared: assessment.date_prepared ?? defaults.datePrepared,
    clientPropertyOwner: assessment.client_property_owner ?? '',
    jobDate: assessment.job_date ?? defaults.jobDate,
    siteAddress: assessment.site_address ?? defaults.siteAddress,
    dronePlatform: assessment.drone_platform ?? '',
    jobTypeScope: assessment.job_type_scope ?? defaults.jobTypeScope,
    crewMembers: assessment.crew_members ?? '',
    weatherConditions: assessment.weather_conditions ?? '',
    faaAirspaceClass: assessment.faa_airspace_class ?? '',
    surfaceType: assessment.surface_type ?? '',
    buildingHeight: assessment.building_height?.toString() ?? '',
    siteAccess: assessment.site_access ?? '',
    windSpeed: assessment.wind_speed?.toString() ?? '',
    weather: assessment.weather ?? defaults.weather,
    visibility: assessment.visibility ?? defaults.visibility,
    publicPresence: Boolean(assessment.public_presence),
    exclusionZonePlanned: Boolean(assessment.exclusion_zone_planned),
    exclusionZoneDescription: assessment.exclusion_zone_description ?? '',
    runoffRisk: Boolean(assessment.runoff_risk),
    chemicalType: assessment.chemical_type ?? '',
    containmentPlan: assessment.containment_plan ?? '',
    regulatoryCitations: assessment.regulatory_citations ?? [],
    waterBodyProximity: Boolean(assessment.water_body_proximity),
    waterBodyDistance: assessment.water_body_distance?.toString() ?? '',
    waterBodyType: assessment.water_body_type ?? defaults.waterBodyType,
    secondaryContainmentInPlace: Boolean(assessment.secondary_containment_in_place),
    reclamationMethod: assessment.reclamation_method ?? defaults.reclamationMethod,
    reclamationVolumeEstimate: assessment.reclamation_volume_estimate?.toString() ?? '',
    disposalVendorNameContact: assessment.disposal_vendor_name_contact ?? '',
    laancRequired: assessment.laanc_required ?? defaults.laancRequired,
    hazardEntries: normalizeHazards(assessment.hazard_entries),
    ppeRequirements: normalizePpe(assessment.ppe_requirements),
    nearestHospital: assessment.nearest_hospital ?? '',
    emergencyContact: assessment.emergency_contact ?? '',
    droneIncidentProcedure: assessment.drone_incident_procedure ?? defaultIncidentProcedure,
    crewBriefed: Boolean(assessment.crew_briefed),
    controlsInPlace: Boolean(assessment.controls_in_place),
    stopWorkAuthorityAcknowledged: Boolean(assessment.stop_work_authority_acknowledged),
    assessorName: assessment.assessor_name ?? '',
    assessmentDate: assessment.assessment_date ?? defaults.assessmentDate,
    rpicPrintedName: assessment.rpic_printed_name ?? '',
    status: assessment.status ?? defaults.status
  };
}

function getRiskScore(entry: HazardEntry) {
  return entry.likelihood * entry.severity;
}

function getRiskRating(score: number) {
  if (score >= 15) return 'High';
  if (score >= 9) return 'Medium';
  return 'Low';
}

function parseNullableNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function formatDate(value: string) {
  if (!value) return 'Not scheduled';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${month}/${day}/${year}` : value;
}

export function JobHazardAnalysisPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<JhaFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadJha() {
      if (!jobId) {
        setLoadError('Missing job id.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('id, organization_id, name, service_type, location, planned_date, status')
          .eq('id', jobId)
          .maybeSingle();

        if (jobError) throw jobError;
        if (!jobData) throw new Error('Job not found.');

        const { data: assessmentData, error: assessmentError } = await supabase
          .from('jha_assessments')
          .select('*')
          .eq('job_id', jobId)
          .maybeSingle();

        if (assessmentError) throw assessmentError;
        if (!isMounted) return;

        const loadedJob = jobData as Job;
        setJob(loadedJob);
        setFormData(toFormState(loadedJob, assessmentData as JhaAssessment | null));
      } catch (error) {
        if (!isMounted) return;
        setLoadError(getErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadJha();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  const highestRiskScore = useMemo(() => {
    if (!formData) return 0;
    return Math.max(...formData.hazardEntries.map(getRiskScore), 0);
  }, [formData]);

  const overallRiskRating = getRiskRating(highestRiskScore);
  const hasHighRisk = highestRiskScore >= 15;

  function updateField<T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) {
    setFormData((current) => (current ? { ...current, [field]: value } : current));
    setSaveMessage(null);
  }

  function updateHazard(index: number, field: keyof HazardEntry, value: string | number) {
    setFormData((current) => {
      if (!current) return current;
      const hazardEntries = current.hazardEntries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      );
      return { ...current, hazardEntries };
    });
    setSaveMessage(null);
  }

  function addHazard() {
    setFormData((current) =>
      current ? { ...current, hazardEntries: [...current.hazardEntries, createHazardEntry()] } : current
    );
    setSaveMessage(null);
  }

  function removeHazard(index: number) {
    setFormData((current) => {
      if (!current || current.hazardEntries.length === 1) return current;
      return { ...current, hazardEntries: current.hazardEntries.filter((_, entryIndex) => entryIndex !== index) };
    });
    setSaveMessage(null);
  }

  function toggleCitation(citation: string) {
    setFormData((current) => {
      if (!current) return current;
      const regulatoryCitations = current.regulatoryCitations.includes(citation)
        ? current.regulatoryCitations.filter((item) => item !== citation)
        : [...current.regulatoryCitations, citation];
      return { ...current, regulatoryCitations };
    });
    setSaveMessage(null);
  }

  function togglePpe(option: string) {
    setFormData((current) => {
      if (!current) return current;
      return {
        ...current,
        ppeRequirements: {
          ...current.ppeRequirements,
          [option]: !current.ppeRequirements[option]
        }
      };
    });
    setSaveMessage(null);
  }

  function validateForm() {
    if (!formData) return 'Unable to save this JHA.';
    if (!formData.surfaceType.trim()) return 'Surface type is required.';
    if (!formData.windSpeed.trim()) return 'Wind speed is required.';
    if (!formData.weather) return 'Weather is required.';
    if (!formData.visibility) return 'Visibility is required.';
    if (!formData.faaAirspaceClass && !formData.laancRequired) return 'Airspace class or LAANC status is required.';
    if (!formData.assessorName.trim()) return 'Assessor name is required.';
    if (!formData.assessmentDate) return 'Assessment date is required.';

    const completeHazards = formData.hazardEntries.filter((entry) => entry.description.trim() || entry.mitigation.trim());
    if (completeHazards.length === 0) return 'Add at least one hazard row.';

    const incompleteHazard = completeHazards.find((entry) => !entry.description.trim() || !entry.mitigation.trim());
    if (incompleteHazard) return 'Each hazard row needs a description and mitigation.';

    if (formData.publicPresence && formData.exclusionZonePlanned && !formData.exclusionZoneDescription.trim()) {
      return 'Describe the planned exclusion zone.';
    }

    if (formData.runoffRisk && !formData.containmentPlan.trim()) return 'Containment plan is required when runoff risk is present.';

    if (formData.status === 'Complete') {
      if (!formData.crewBriefed || !formData.controlsInPlace || !formData.stopWorkAuthorityAcknowledged) {
        return 'Complete the RPIC certification acknowledgments before marking the JHA complete.';
      }
      if (!formData.rpicPrintedName.trim()) return 'RPIC printed name is required before marking the JHA complete.';
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!job || !formData) return;

    const validationError = validateForm();
    if (validationError) {
      setSaveError(validationError);
      setSaveMessage(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to save a JHA.');

      const { error } = await supabase.from('jha_assessments').upsert(
        {
          job_id: job.id,
          organization_id: job.organization_id,
          user_id: userData.user.id,
          operator_company: formData.operatorCompany.trim() || null,
          jha_number: formData.jhaNumber.trim() || null,
          remote_pilot_in_command: formData.remotePilotInCommand.trim() || null,
          date_prepared: formData.datePrepared || null,
          client_property_owner: formData.clientPropertyOwner.trim() || null,
          job_date: formData.jobDate || null,
          site_address: formData.siteAddress.trim() || null,
          drone_platform: formData.dronePlatform.trim() || null,
          job_type_scope: formData.jobTypeScope.trim() || null,
          crew_members: formData.crewMembers.trim() || null,
          weather_conditions: formData.weatherConditions.trim() || null,
          faa_airspace_class: formData.faaAirspaceClass || null,
          surface_type: formData.surfaceType.trim(),
          building_height: parseNullableNumber(formData.buildingHeight),
          site_access: formData.siteAccess.trim() || null,
          wind_speed: parseNullableNumber(formData.windSpeed),
          weather: formData.weather,
          visibility: formData.visibility,
          public_presence: formData.publicPresence,
          exclusion_zone_planned: formData.exclusionZonePlanned,
          exclusion_zone_description: formData.exclusionZoneDescription.trim() || null,
          runoff_risk: formData.runoffRisk,
          chemical_type: formData.chemicalType.trim() || null,
          containment_plan: formData.containmentPlan.trim() || null,
          regulatory_citations: formData.regulatoryCitations,
          water_body_proximity: formData.waterBodyProximity,
          water_body_distance: parseNullableNumber(formData.waterBodyDistance),
          water_body_type: formData.waterBodyType || null,
          secondary_containment_in_place: formData.secondaryContainmentInPlace,
          reclamation_method: formData.reclamationMethod || null,
          reclamation_volume_estimate: parseNullableNumber(formData.reclamationVolumeEstimate),
          disposal_vendor_name_contact: formData.disposalVendorNameContact.trim() || null,
          laanc_required: formData.laancRequired,
          hazard_entries: formData.hazardEntries.map((entry) => ({ ...entry, riskScore: getRiskScore(entry) })),
          overall_risk_rating: overallRiskRating,
          ppe_requirements: formData.ppeRequirements,
          nearest_hospital: formData.nearestHospital.trim() || null,
          emergency_contact: formData.emergencyContact.trim() || null,
          drone_incident_procedure: formData.droneIncidentProcedure.trim() || null,
          crew_briefed: formData.crewBriefed,
          controls_in_place: formData.controlsInPlace,
          stop_work_authority_acknowledged: formData.stopWorkAuthorityAcknowledged,
          assessor_name: formData.assessorName.trim(),
          assessment_date: formData.assessmentDate,
          rpic_printed_name: formData.rpicPrintedName.trim() || null,
          certified_at: formData.status === 'Complete' ? new Date().toISOString() : null,
          status: formData.status,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'job_id' }
      );

      if (error) throw error;
      setSaveMessage('JHA saved.');
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Loading job hazard analysis...
      </section>
    );
  }

  if (loadError || !job || !formData) {
    return (
      <section className="space-y-4">
        <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={jobId ? `/jobs/${jobId}/hub` : '/jobs'}>
          Back to Job File
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h1 className="text-base font-semibold text-red-800">Unable to load JHA</h1>
          <p className="mt-2 text-sm text-red-700">{loadError ?? 'Please try again.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={`/jobs/${job.id}/hub`}>
        Back to Job File
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Pillar 2: Risk Management</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">Job Hazard Analysis</h1>
            <p className="mt-2 text-sm text-slate-600">
              {job.name} • {job.service_type} • {formatDate(job.planned_date)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Overall risk:</span> {overallRiskRating || 'Low'}
          </div>
        </div>
      </div>

      {hasHighRisk ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm" role="alert">
          Risk score of 15 or higher detected. The scope document requires this high-risk warning before the job proceeds.
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-brand-900">Job Information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput label="Operator / Company" value={formData.operatorCompany} onChange={(value) => updateField('operatorCompany', value)} disabled={isSaving} />
            <TextInput label="JHA Number" value={formData.jhaNumber} onChange={(value) => updateField('jhaNumber', value)} disabled={isSaving} />
            <TextInput label="Remote Pilot in Command" value={formData.remotePilotInCommand} onChange={(value) => updateField('remotePilotInCommand', value)} disabled={isSaving} />
            <TextInput label="Date Prepared" type="date" value={formData.datePrepared} onChange={(value) => updateField('datePrepared', value)} disabled={isSaving} />
            <TextInput label="Client / Property Owner" value={formData.clientPropertyOwner} onChange={(value) => updateField('clientPropertyOwner', value)} disabled={isSaving} />
            <TextInput label="Job Date" type="date" value={formData.jobDate} onChange={(value) => updateField('jobDate', value)} disabled={isSaving} />
            <TextInput label="Site Address" value={formData.siteAddress} onChange={(value) => updateField('siteAddress', value)} disabled={isSaving} />
            <TextInput label="Drone Platform" value={formData.dronePlatform} onChange={(value) => updateField('dronePlatform', value)} disabled={isSaving} />
            <TextInput label="Job Type / Scope" value={formData.jobTypeScope} onChange={(value) => updateField('jobTypeScope', value)} disabled={isSaving} />
            <TextInput label="Crew Members" value={formData.crewMembers} onChange={(value) => updateField('crewMembers', value)} disabled={isSaving} />
            <TextInput label="Weather Conditions" value={formData.weatherConditions} onChange={(value) => updateField('weatherConditions', value)} disabled={isSaving} />
            <SelectInput label="FAA Airspace Class" value={formData.faaAirspaceClass} options={['', ...airspaceOptions]} onChange={(value) => updateField('faaAirspaceClass', value)} disabled={isSaving} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-brand-900">Site and Regulatory Assessment</h2>
          <p className="mt-2 text-sm text-slate-600">
            Adapted from the DroneSMS JHA template and MIL-STD-882E risk methodology.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput label="Surface type" value={formData.surfaceType} onChange={(value) => updateField('surfaceType', value)} disabled={isSaving} required />
            <TextInput label="Building height (feet)" type="number" value={formData.buildingHeight} onChange={(value) => updateField('buildingHeight', value)} disabled={isSaving} />
            <TextInput label="Site access" value={formData.siteAccess} onChange={(value) => updateField('siteAccess', value)} disabled={isSaving} />
            <TextInput label="Wind speed (MPH)" type="number" value={formData.windSpeed} onChange={(value) => updateField('windSpeed', value)} disabled={isSaving} required />
            <SelectInput label="Weather" value={formData.weather} options={weatherOptions} onChange={(value) => updateField('weather', value)} disabled={isSaving} />
            <SelectInput label="Visibility" value={formData.visibility} options={visibilityOptions} onChange={(value) => updateField('visibility', value)} disabled={isSaving} />
            <SelectInput label="LAANC required" value={formData.laancRequired} options={laancOptions} onChange={(value) => updateField('laancRequired', value)} disabled={isSaving} />
          </div>

          <div className="mt-5 space-y-3">
            <Checkbox label="Public presence" checked={formData.publicPresence} onChange={(checked) => updateField('publicPresence', checked)} disabled={isSaving} />
            {formData.publicPresence ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Checkbox label="Exclusion zone planned" checked={formData.exclusionZonePlanned} onChange={(checked) => updateField('exclusionZonePlanned', checked)} disabled={isSaving} />
                {formData.exclusionZonePlanned ? (
                  <TextArea label="Exclusion zone description" value={formData.exclusionZoneDescription} onChange={(value) => updateField('exclusionZoneDescription', value)} disabled={isSaving} />
                ) : null}
              </div>
            ) : null}

            <Checkbox label="Runoff risk" checked={formData.runoffRisk} onChange={(checked) => updateField('runoffRisk', checked)} disabled={isSaving} />
            {formData.runoffRisk ? (
              <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                <TextInput label="Chemical type" value={formData.chemicalType} onChange={(value) => updateField('chemicalType', value)} disabled={isSaving} />
                <TextInput label="Containment plan" value={formData.containmentPlan} onChange={(value) => updateField('containmentPlan', value)} disabled={isSaving} />
              </div>
            ) : null}

            <Checkbox label="Water body proximity" checked={formData.waterBodyProximity} onChange={(checked) => updateField('waterBodyProximity', checked)} disabled={isSaving} />
            {formData.waterBodyProximity ? (
              <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                <TextInput label="Water body distance (feet)" type="number" value={formData.waterBodyDistance} onChange={(value) => updateField('waterBodyDistance', value)} disabled={isSaving} />
                <SelectInput label="Water body type" value={formData.waterBodyType} options={waterBodyTypeOptions} onChange={(value) => updateField('waterBodyType', value)} disabled={isSaving} />
              </div>
            ) : null}

            <Checkbox label="Secondary containment in place" checked={formData.secondaryContainmentInPlace} onChange={(checked) => updateField('secondaryContainmentInPlace', checked)} disabled={isSaving} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Reclamation method" value={formData.reclamationMethod} options={reclamationMethodOptions} onChange={(value) => updateField('reclamationMethod', value)} disabled={isSaving} />
              <TextInput label="Reclamation volume estimate (gallons)" type="number" value={formData.reclamationVolumeEstimate} onChange={(value) => updateField('reclamationVolumeEstimate', value)} disabled={isSaving} />
              {formData.reclamationMethod === 'Third Party Vendor' ? (
                <TextInput label="Disposal vendor name and contact" value={formData.disposalVendorNameContact} onChange={(value) => updateField('disposalVendorNameContact', value)} disabled={isSaving} />
              ) : null}
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-slate-700">Regulatory citations</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {citationOptions.map((citation) => (
                <Checkbox key={citation} label={citation} checked={formData.regulatoryCitations.includes(citation)} onChange={() => toggleCitation(citation)} disabled={isSaving} />
              ))}
            </div>
          </fieldset>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-brand-900">Hazard Identification and Risk Assessment</h2>
              <p className="mt-2 text-sm text-slate-600">Risk score is calculated as likelihood x severity. High begins at 15.</p>
            </div>
            <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-0 sm:py-2" onClick={addHazard} disabled={isSaving}>
              Add Hazard
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {formData.hazardEntries.map((entry, index) => {
              const score = getRiskScore(entry);
              const rating = getRiskRating(score);
              return (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold text-brand-900">Hazard {index + 1}</h3>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {rating} • {score}
                      </span>
                      <button type="button" className="text-sm font-medium text-red-700 disabled:text-slate-400" onClick={() => removeHazard(index)} disabled={isSaving || formData.hazardEntries.length === 1}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <TextArea label="Hazard description" value={entry.description} onChange={(value) => updateHazard(index, 'description', value)} disabled={isSaving} />
                    <TextArea label="Controls / Mitigation Measures" value={entry.mitigation} onChange={(value) => updateHazard(index, 'mitigation', value)} disabled={isSaving} />
                    <RangeSelect label="Likelihood" value={entry.likelihood} helper={probabilityHelp} onChange={(value) => updateHazard(index, 'likelihood', value)} disabled={isSaving} />
                    <RangeSelect label="Severity" value={entry.severity} helper={severityHelp} onChange={(value) => updateHazard(index, 'severity', value)} disabled={isSaving} />
                    <SelectInput label="Residual risk" value={entry.residualRisk} options={['Low', 'Medium', 'High']} onChange={(value) => updateHazard(index, 'residualRisk', value)} disabled={isSaving} />
                    <TextInput label="Notes / Owner" value={entry.owner} onChange={(value) => updateHazard(index, 'owner', value)} disabled={isSaving} />
                    <div className="sm:col-span-2">
                      <TextArea label="Additional notes" value={entry.notes} onChange={(value) => updateHazard(index, 'notes', value)} disabled={isSaving} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-brand-900">PPE and Emergency Procedures</h2>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-700">PPE Requirements</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ppeOptions.map((option) => (
                <Checkbox key={option} label={option} checked={formData.ppeRequirements[option]} onChange={() => togglePpe(option)} disabled={isSaving} />
              ))}
            </div>
          </fieldset>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput label="Nearest Hospital" value={formData.nearestHospital} onChange={(value) => updateField('nearestHospital', value)} disabled={isSaving} />
            <TextInput label="Emergency Contact" value={formData.emergencyContact} onChange={(value) => updateField('emergencyContact', value)} disabled={isSaving} />
            <div className="sm:col-span-2">
              <TextArea label="Drone Incident Procedure" value={formData.droneIncidentProcedure} onChange={(value) => updateField('droneIncidentProcedure', value)} disabled={isSaving} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-brand-900">Crew Briefing and RPIC Certification</h2>
          <p className="mt-2 text-sm text-slate-600">
            RPIC certifies that hazards were assessed, controls are in place before work begins, crew members were briefed, and stop-work authority is retained.
          </p>
          <div className="mt-4 space-y-3">
            <Checkbox label="Crew briefed on hazards, controls, PPE, emergency procedures, and stop-work authority" checked={formData.crewBriefed} onChange={(checked) => updateField('crewBriefed', checked)} disabled={isSaving} />
            <Checkbox label="Controls are in place before operations begin" checked={formData.controlsInPlace} onChange={(checked) => updateField('controlsInPlace', checked)} disabled={isSaving} />
            <Checkbox label="RPIC stop-work authority acknowledged" checked={formData.stopWorkAuthorityAcknowledged} onChange={(checked) => updateField('stopWorkAuthorityAcknowledged', checked)} disabled={isSaving} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput label="Assessor name" value={formData.assessorName} onChange={(value) => updateField('assessorName', value)} disabled={isSaving} required />
            <TextInput label="Assessment date" type="date" value={formData.assessmentDate} onChange={(value) => updateField('assessmentDate', value)} disabled={isSaving} required />
            <TextInput label="RPIC Printed Name" value={formData.rpicPrintedName} onChange={(value) => updateField('rpicPrintedName', value)} disabled={isSaving} />
            <SelectInput label="Status" value={formData.status} options={statusOptions} onChange={(value) => updateField('status', value)} disabled={isSaving} />
          </div>
        </div>

        {saveError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {saveError}
          </p>
        ) : null}
        {saveMessage ? (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
            {saveMessage}
          </p>
        ) : null}

        <button type="submit" className="min-h-11 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save JHA'}
        </button>
      </form>
    </section>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

function TextInput({ label, value, onChange, disabled, required, type = 'text' }: FieldProps & { type?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <input
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, disabled }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea
        className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function SelectInput({ label, value, options, onChange, disabled }: FieldProps & { options: string[] }) {
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
          <option key={option || 'blank'} value={option}>
            {option || 'Select one'}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeSelect({ label, value, helper, onChange, disabled }: { label: string; value: number; helper: string[]; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {score} - {helper[score - 1]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
      <input
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
