import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

const steps = [
  'Mission Basics',
  'Site Conditions',
  'Airspace',
  'Environmental',
  'Hazards',
  'Crew Briefing & Communications'
];

const surfaceTypeOptions = ['Asphalt', 'Concrete', 'Gravel', 'Dirt', 'Grass', 'Rooftop', 'Mixed Surface', 'Other'];
const siteAccessOptions = [
  'Open parking lot',
  'Gated property',
  'Roof access required',
  'Public sidewalk nearby',
  'Active vehicle traffic',
  'Limited staging area',
  'Uneven terrain',
  'Narrow access point',
  'Alley/rear access only',
  'Other'
];
const exclusionZoneOptions = [
  'Cones/signage used',
  'Visual observer assigned',
  'Ground crew monitoring perimeter',
  'Public walkway controlled',
  'Vehicle traffic separated',
  'Work paused if public enters area',
  'Restricted access established',
  'Spotter assigned'
];
const communicationMethodOptions = ['Headsets', 'Radios', 'Cell Phones', 'Hand Signals', 'Other'];
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
const citationGuidance: Record<string, string> = {
  'Clean Water Act 402': 'This may apply if wash water or pollutants could enter a storm drain, ditch, creek, or waterway.',
  'Clean Water Act 404': 'This may apply if work impacts wetlands or protected waters.',
  FIFRA: 'This may apply if pesticides, disinfectants, or regulated chemicals are used.',
  'CA DPR': 'This may apply for agricultural chemical applications in California.',
  'Other State Ag Dept': 'This may apply if state agricultural rules cover the chemical use or application site.',
  'OSHA HazCom': 'This may apply if workers handle hazardous chemicals requiring SDS/PPE communication.',
  'Not Applicable': 'This may apply when no listed regulatory citation is relevant to the operation.'
};
const ppeOptions = [
  'Safety Glasses',
  'Chemical Resistant Gloves',
  'Non-Slip Footwear',
  'High-Vis Vest',
  'Hearing Protection',
  'Hard Hat'
];

const probabilityHelp = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Frequent'];
const severityHelp = ['Minimal', 'Minor', 'Moderate', 'Serious', 'Catastrophic'];

const commonHazards = [
  {
    description: 'Drone fly-away or loss of control over public or personnel',
    likelihood: 2,
    severity: 5,
    owner: 'RPIC',
    controls:
      'Pre-flight checks, VLOS maintained, visual observer assigned, exclusion zone established, emergency procedure briefed.'
  },
  {
    description: 'Drone rotor strike to ground personnel or public',
    likelihood: 2,
    severity: 5,
    owner: 'VO',
    controls: 'Exclusion zone marked and enforced, VO monitors perimeter, public warning signage posted, site access controlled.'
  },
  {
    description: 'Pressure equipment failure or hose burst',
    likelihood: 3,
    severity: 4,
    owner: 'RPIC',
    controls: 'Pre-job equipment inspection, pressure relief valve verified, hose hazard briefed, PPE worn by all crew.'
  },
  {
    description: 'Hose trip hazard to crew or public',
    likelihood: 4,
    severity: 3,
    owner: 'Crew',
    controls: 'Hoses routed and secured, cones or barriers placed, ground crew maintains awareness, public exclusion enforced.'
  },
  {
    description: 'Chemical or soft wash exposure to personnel',
    likelihood: 3,
    severity: 4,
    owner: 'RPIC',
    controls: 'SDS reviewed, PPE issued, dilution ratios verified, containment plan in place, eyewash available.'
  },
  {
    description: 'Chemical runoff to storm drain or waterway',
    likelihood: 3,
    severity: 4,
    owner: 'RPIC',
    controls: 'Storm drain covered or blocked, containment berm deployed, runoff direction assessed, local requirements checked.'
  },
  {
    description: 'Water or slip hazard on ground surface',
    likelihood: 5,
    severity: 3,
    owner: 'Crew',
    controls: 'Non-slip footwear required, wet surface signage posted, work area monitored continuously, crew briefed.'
  },
  {
    description: 'Electrical hazard from overhead power lines',
    likelihood: 2,
    severity: 5,
    owner: 'RPIC',
    controls: 'Site survey identifies power lines, minimum clearance maintained, VO monitors proximity, suspend if clearance is unsafe.'
  },
  {
    description: 'Battery fire or thermal runaway',
    likelihood: 2,
    severity: 4,
    owner: 'RPIC',
    controls: 'Battery inspection before flight, LiPo-safe transport, fire extinguisher on site, no charging near combustibles.'
  },
  {
    description: 'Unauthorized airspace or LAANC violation',
    likelihood: 2,
    severity: 4,
    owner: 'RPIC',
    controls: 'Airspace checked before operation, LAANC authorization obtained where required, documentation stored in job file.'
  },
  {
    description: 'Heat stress or dehydration',
    likelihood: 4,
    severity: 3,
    owner: 'RPIC',
    controls: 'Water on site, rest breaks scheduled, heat index monitored, work suspended if conditions exceed safe limits.'
  }
];

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

type StoredChecklistValue = boolean | string | string[];
type PpeRequirements = Record<string, StoredChecklistValue>;

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
  surfaceTypeOther: string;
  buildingHeight: string;
  siteAccess: string;
  siteAccessOther: string;
  windSpeed: string;
  weather: string;
  visibility: string;
  publicPresence: boolean;
  exclusionZonePlanned: boolean;
  exclusionZoneControls: string[];
  exclusionZoneComments: string;
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
  communicationMethods: string[];
  communicationMethodOther: string;
  radioChannel: string;
  communicationPlanReviewed: boolean;
  lostCommunicationProcedureReviewed: boolean;
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

function createHazardEntry(overrides: Partial<HazardEntry> = {}): HazardEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: '',
    likelihood: 1,
    severity: 1,
    mitigation: '',
    owner: '',
    residualRisk: 'Low',
    notes: '',
    ...overrides
  };
}

function getInitialPpeRequirements(): PpeRequirements {
  return ppeOptions.reduce<PpeRequirements>((requirements, option) => {
    requirements[option] = false;
    return requirements;
  }, {});
}

function getStoredString(value: StoredChecklistValue | undefined) {
  return typeof value === 'string' ? value : '';
}

function getStoredArray(value: StoredChecklistValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function splitStoredOption(value: string | null | undefined, options: string[]) {
  if (!value) return { option: '', other: '' };
  if (options.includes(value)) return { option: value, other: '' };
  return { option: 'Other', other: value };
}

function getEffectiveSurfaceType(formData: JhaFormState) {
  return formData.surfaceType === 'Other' ? formData.surfaceTypeOther.trim() : formData.surfaceType;
}

function getEffectiveSiteAccess(formData: JhaFormState) {
  return formData.siteAccess === 'Other' ? formData.siteAccessOther.trim() : formData.siteAccess;
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
    surfaceTypeOther: '',
    buildingHeight: '',
    siteAccess: '',
    siteAccessOther: '',
    windSpeed: '',
    weather: weatherOptions[0],
    visibility: visibilityOptions[0],
    publicPresence: false,
    exclusionZonePlanned: false,
    exclusionZoneControls: [],
    exclusionZoneComments: '',
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
    hazardEntries: [],
    ppeRequirements: getInitialPpeRequirements(),
    nearestHospital: '',
    emergencyContact: '',
    droneIncidentProcedure: defaultIncidentProcedure,
    communicationMethods: [],
    communicationMethodOther: '',
    radioChannel: '',
    communicationPlanReviewed: false,
    lostCommunicationProcedureReviewed: false,
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
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const item = entry as Partial<HazardEntry> & { riskScore?: number };
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
}

function normalizePpe(value: unknown) {
  const defaults = getInitialPpeRequirements();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;

  return { ...defaults, ...(value as PpeRequirements) };
}

function toFormState(job: Job, assessment: JhaAssessment | null): JhaFormState {
  const defaults = getInitialFormState(job);
  if (!assessment) return defaults;

  const ppeRequirements = normalizePpe(assessment.ppe_requirements);
  const surfaceType = splitStoredOption(assessment.surface_type, surfaceTypeOptions);
  const siteAccess = splitStoredOption(assessment.site_access, siteAccessOptions);

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
    surfaceType: surfaceType.option,
    surfaceTypeOther: surfaceType.other,
    buildingHeight: assessment.building_height?.toString() ?? '',
    siteAccess: siteAccess.option,
    siteAccessOther: siteAccess.other,
    windSpeed: assessment.wind_speed?.toString() ?? '',
    weather: assessment.weather ?? defaults.weather,
    visibility: assessment.visibility ?? defaults.visibility,
    publicPresence: Boolean(assessment.public_presence),
    exclusionZonePlanned: Boolean(assessment.exclusion_zone_planned),
    exclusionZoneControls: getStoredArray(ppeRequirements.__exclusionZoneControls),
    exclusionZoneComments: getStoredString(ppeRequirements.__exclusionZoneComments) || assessment.exclusion_zone_description ?? '',
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
    ppeRequirements,
    nearestHospital: assessment.nearest_hospital ?? '',
    emergencyContact: assessment.emergency_contact ?? '',
    droneIncidentProcedure: assessment.drone_incident_procedure ?? defaultIncidentProcedure,
    communicationMethods: getStoredArray(ppeRequirements.__communicationMethods),
    communicationMethodOther: getStoredString(ppeRequirements.__communicationMethodOther),
    radioChannel: getStoredString(ppeRequirements.__radioChannel),
    communicationPlanReviewed: Boolean(ppeRequirements.__communicationPlanReviewed),
    lostCommunicationProcedureReviewed: Boolean(ppeRequirements.__lostCommunicationProcedureReviewed),
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

function getStepCompletion(formData: JhaFormState) {
  return [
    Boolean(formData.jhaNumber && formData.jobDate && formData.siteAddress && formData.jobTypeScope),
    Boolean(getEffectiveSurfaceType(formData) && formData.windSpeed && formData.weather && formData.visibility),
    Boolean(formData.faaAirspaceClass || formData.laancRequired),
    !formData.runoffRisk || Boolean(formData.containmentPlan),
    formData.hazardEntries.some((entry) => entry.description.trim() && entry.mitigation.trim()),
    Boolean(formData.assessorName && formData.assessmentDate)
  ];
}

export function JobHazardAnalysisPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<JhaFormState | null>(null);
  const [activeStep, setActiveStep] = useState(0);
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
    if (!formData || formData.hazardEntries.length === 0) return 0;
    return Math.max(...formData.hazardEntries.map(getRiskScore), 0);
  }, [formData]);

  const overallRiskRating = getRiskRating(highestRiskScore);
  const hasHighRisk = highestRiskScore >= 15;
  const stepCompletion = formData ? getStepCompletion(formData) : [];
  const currentStepName = steps[activeStep];

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

  function addHazardFromSuggestion(hazard: (typeof commonHazards)[number]) {
    setFormData((current) => {
      if (!current) return current;

      const exists = current.hazardEntries.some((entry) => entry.description === hazard.description);
      if (exists) return current;

      return {
        ...current,
        hazardEntries: [
          ...current.hazardEntries,
          createHazardEntry({
            description: hazard.description,
            likelihood: hazard.likelihood,
            severity: hazard.severity,
            mitigation: hazard.controls,
            owner: hazard.owner,
            residualRisk: getRiskRating(hazard.likelihood * hazard.severity) === 'High' ? 'Medium' : 'Low'
          })
        ]
      };
    });
    setSaveMessage(null);
  }

  function addCustomHazard() {
    setFormData((current) =>
      current ? { ...current, hazardEntries: [...current.hazardEntries, createHazardEntry()] } : current
    );
    setSaveMessage(null);
  }

  function removeHazard(index: number) {
    setFormData((current) => {
      if (!current) return current;
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

  function toggleStringListField(field: 'exclusionZoneControls' | 'communicationMethods', value: string) {
    setFormData((current) => {
      if (!current) return current;
      const selected = current[field];
      const nextValue = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
      return { ...current, [field]: nextValue };
    });
    setSaveMessage(null);
  }

  function validateForm(requireCompletion: boolean) {
    if (!formData) return 'Unable to save this JHA.';
    if (!requireCompletion) return null;
    if (!getEffectiveSurfaceType(formData)) return 'Surface type is required.';
    if (!formData.windSpeed.trim()) return 'Wind speed is required.';
    if (!formData.weather) return 'Weather is required.';
    if (!formData.visibility) return 'Visibility is required.';
    if (!formData.faaAirspaceClass && !formData.laancRequired) return 'Airspace class or LAANC status is required.';
    if (!formData.assessorName.trim()) return 'Assessor name is required.';
    if (!formData.assessmentDate) return 'Assessment date is required.';

    const completeHazards = formData.hazardEntries.filter((entry) => entry.description.trim() || entry.mitigation.trim());
    if (completeHazards.length === 0) return 'Select or add at least one hazard.';

    const incompleteHazard = completeHazards.find((entry) => !entry.description.trim() || !entry.mitigation.trim());
    if (incompleteHazard) return 'Each hazard needs a description and mitigation.';

    if (formData.publicPresence && formData.exclusionZonePlanned && formData.exclusionZoneControls.length === 0) {
      return 'Select at least one exclusion zone control.';
    }

    if (formData.runoffRisk && !formData.containmentPlan.trim()) return 'Containment plan is required when runoff risk is present.';

    if (formData.communicationMethods.includes('Other') && !formData.communicationMethodOther.trim()) {
      return 'Describe the other communication method.';
    }

    if (formData.status === 'Complete') {
      if (!formData.crewBriefed || !formData.controlsInPlace || !formData.stopWorkAuthorityAcknowledged) {
        return 'Complete the RPIC certification acknowledgments before marking the JHA complete.';
      }
      if (!formData.communicationPlanReviewed || !formData.lostCommunicationProcedureReviewed) {
        return 'Review the communication plan and lost communication procedure before marking the JHA complete.';
      }
      if (!formData.rpicPrintedName.trim()) return 'RPIC printed name is required before marking the JHA complete.';
    }

    return null;
  }

  async function saveAssessment(options: { requireCompletion?: boolean; message?: string } = {}) {
    if (!job || !formData) return false;

    const validationError = validateForm(Boolean(options.requireCompletion));
    if (validationError) {
      setSaveError(validationError);
      setSaveMessage(null);
      return false;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('You must be signed in to save a JHA.');

      const ppeRequirements = {
        ...formData.ppeRequirements,
        __exclusionZoneControls: formData.exclusionZoneControls,
        __exclusionZoneComments: formData.exclusionZoneComments.trim(),
        __communicationMethods: formData.communicationMethods,
        __communicationMethodOther: formData.communicationMethodOther.trim(),
        __radioChannel: formData.radioChannel.trim(),
        __communicationPlanReviewed: formData.communicationPlanReviewed,
        __lostCommunicationProcedureReviewed: formData.lostCommunicationProcedureReviewed
      };

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
          surface_type: getEffectiveSurfaceType(formData) || null,
          building_height: parseNullableNumber(formData.buildingHeight),
          site_access: getEffectiveSiteAccess(formData) || null,
          wind_speed: parseNullableNumber(formData.windSpeed),
          weather: formData.weather,
          visibility: formData.visibility,
          public_presence: formData.publicPresence,
          exclusion_zone_planned: formData.exclusionZonePlanned,
          exclusion_zone_description: formData.exclusionZoneComments.trim() || null,
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
          ppe_requirements: ppeRequirements,
          nearest_hospital: formData.nearestHospital.trim() || null,
          emergency_contact: formData.emergencyContact.trim() || null,
          drone_incident_procedure: formData.droneIncidentProcedure.trim() || null,
          crew_briefed: formData.crewBriefed,
          controls_in_place: formData.controlsInPlace,
          stop_work_authority_acknowledged: formData.stopWorkAuthorityAcknowledged,
          assessor_name: formData.assessorName.trim() || null,
          assessment_date: formData.assessmentDate || null,
          rpic_printed_name: formData.rpicPrintedName.trim() || null,
          certified_at: formData.status === 'Complete' ? new Date().toISOString() : null,
          status: formData.status,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'job_id' }
      );

      if (error) throw error;
      setSaveMessage(options.message ?? 'Progress saved.');
      return true;
    } catch (error) {
      setSaveError(getErrorMessage(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function goToStep(stepIndex: number) {
    if (stepIndex === activeStep || isSaving) return;
    const saved = await saveAssessment({ message: 'Progress saved.' });
    if (saved) setActiveStep(stepIndex);
  }

  async function goNext() {
    if (activeStep >= steps.length - 1) return;
    const saved = await saveAssessment({ message: 'Progress saved.' });
    if (saved) setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function goBack() {
    if (activeStep <= 0) return;
    const saved = await saveAssessment({ message: 'Progress saved.' });
    if (saved) setActiveStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAssessment({ requireCompletion: true, message: 'JHA saved.' });
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
              {job.name} - {job.service_type} - {formatDate(job.planned_date)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Overall risk:</span> {overallRiskRating || 'Low'}
          </div>
        </div>
      </div>

      <ProgressIndicator activeStep={activeStep} completedSteps={stepCompletion} onStepClick={goToStep} disabled={isSaving} />

      {hasHighRisk ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm" role="alert">
          Risk score of 15 or higher detected. Reduce or document controls before this job proceeds.
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-1">
            <p className="text-sm font-medium text-slate-500">Step {activeStep + 1} of {steps.length}</p>
            <h2 className="text-xl font-semibold text-brand-900">{currentStepName}</h2>
          </div>

          {activeStep === 0 ? <MissionBasicsStep formData={formData} updateField={updateField} isSaving={isSaving} /> : null}
          {activeStep === 1 ? (
            <SiteConditionsStep
              formData={formData}
              updateField={updateField}
              toggleStringListField={toggleStringListField}
              isSaving={isSaving}
            />
          ) : null}
          {activeStep === 2 ? <AirspaceStep formData={formData} updateField={updateField} isSaving={isSaving} /> : null}
          {activeStep === 3 ? (
            <EnvironmentalStep
              formData={formData}
              updateField={updateField}
              toggleCitation={toggleCitation}
              isSaving={isSaving}
            />
          ) : null}
          {activeStep === 4 ? (
            <HazardsStep
              formData={formData}
              updateHazard={updateHazard}
              addHazardFromSuggestion={addHazardFromSuggestion}
              addCustomHazard={addCustomHazard}
              removeHazard={removeHazard}
              isSaving={isSaving}
            />
          ) : null}
          {activeStep === 5 ? (
            <CertificationStep
              formData={formData}
              updateField={updateField}
              togglePpe={togglePpe}
              toggleStringListField={toggleStringListField}
              isSaving={isSaving}
            />
          ) : null}
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:py-2"
            onClick={goBack}
            disabled={isSaving || activeStep === 0}
          >
            Back
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 sm:py-2"
              onClick={() => saveAssessment({ message: 'Progress saved.' })}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Progress'}
            </button>
            {activeStep < steps.length - 1 ? (
              <button
                type="button"
                className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
                onClick={goNext}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Next'}
              </button>
            ) : (
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save JHA'}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

function ProgressIndicator({
  activeStep,
  completedSteps,
  onStepClick,
  disabled
}: {
  activeStep: number;
  completedSteps: boolean[];
  onStepClick: (step: number) => void;
  disabled: boolean;
}) {
  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="JHA progress">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isComplete = completedSteps[index];
          return (
            <li key={step}>
              <button
                type="button"
                className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? 'border-brand-700 bg-brand-50 text-brand-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => onStepClick(index)}
                disabled={disabled}
              >
                <span className="block text-xs font-semibold uppercase text-slate-500">Step {index + 1}</span>
                <span className="mt-1 block font-semibold">{step}</span>
                <span className="mt-1 block text-xs">{isComplete ? 'Started' : 'Not started'}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MissionBasicsStep({
  formData,
  updateField,
  isSaving
}: {
  formData: JhaFormState;
  updateField: <T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) => void;
  isSaving: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
    </div>
  );
}

function SiteConditionsStep({
  formData,
  updateField,
  toggleStringListField,
  isSaving
}: {
  formData: JhaFormState;
  updateField: <T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) => void;
  toggleStringListField: (field: 'exclusionZoneControls' | 'communicationMethods', value: string) => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Surface type" value={formData.surfaceType} options={['', ...surfaceTypeOptions]} onChange={(value) => updateField('surfaceType', value)} disabled={isSaving} required />
        {formData.surfaceType === 'Other' ? (
          <TextInput label="Custom surface type" value={formData.surfaceTypeOther} onChange={(value) => updateField('surfaceTypeOther', value)} disabled={isSaving} required />
        ) : null}
        <TextInput label="Building height (feet)" type="number" value={formData.buildingHeight} onChange={(value) => updateField('buildingHeight', value)} disabled={isSaving} />
        <SelectInput label="Site access" value={formData.siteAccess} options={['', ...siteAccessOptions]} onChange={(value) => updateField('siteAccess', value)} disabled={isSaving} />
        {formData.siteAccess === 'Other' ? (
          <TextInput label="Custom site access" value={formData.siteAccessOther} onChange={(value) => updateField('siteAccessOther', value)} disabled={isSaving} />
        ) : null}
        <TextInput label="Wind speed (MPH)" type="number" value={formData.windSpeed} onChange={(value) => updateField('windSpeed', value)} disabled={isSaving} required />
        <SelectInput label="Weather" value={formData.weather} options={weatherOptions} onChange={(value) => updateField('weather', value)} disabled={isSaving} />
        <SelectInput label="Visibility" value={formData.visibility} options={visibilityOptions} onChange={(value) => updateField('visibility', value)} disabled={isSaving} />
        <TextInput label="Weather Conditions" value={formData.weatherConditions} onChange={(value) => updateField('weatherConditions', value)} disabled={isSaving} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Checkbox label="Public presence" checked={formData.publicPresence} onChange={(checked) => updateField('publicPresence', checked)} disabled={isSaving} />
        {formData.publicPresence ? (
          <div className="mt-3 space-y-3">
            <Checkbox label="Exclusion zone planned" checked={formData.exclusionZonePlanned} onChange={(checked) => updateField('exclusionZonePlanned', checked)} disabled={isSaving} />
            {formData.exclusionZonePlanned ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">Exclusion zone controls</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {exclusionZoneOptions.map((option) => (
                      <Checkbox
                        key={option}
                        label={option}
                        checked={formData.exclusionZoneControls.includes(option)}
                        onChange={() => toggleStringListField('exclusionZoneControls', option)}
                        disabled={isSaving}
                      />
                    ))}
                  </div>
                </fieldset>
                <TextArea label="Additional exclusion zone comments" value={formData.exclusionZoneComments} onChange={(value) => updateField('exclusionZoneComments', value)} disabled={isSaving} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AirspaceStep({
  formData,
  updateField,
  isSaving
}: {
  formData: JhaFormState;
  updateField: <T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) => void;
  isSaving: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectInput label="FAA Airspace Class" value={formData.faaAirspaceClass} options={['', ...airspaceOptions]} onChange={(value) => updateField('faaAirspaceClass', value)} disabled={isSaving} />
      <SelectInput label="LAANC required" value={formData.laancRequired} options={laancOptions} onChange={(value) => updateField('laancRequired', value)} disabled={isSaving} />
      {formData.laancRequired === 'Yes' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          Keep LAANC authorization documentation in the job file before operations begin.
        </div>
      ) : null}
    </div>
  );
}

function EnvironmentalStep({
  formData,
  updateField,
  toggleCitation,
  isSaving
}: {
  formData: JhaFormState;
  updateField: <T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) => void;
  toggleCitation: (citation: string) => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Checkbox label="Runoff risk" checked={formData.runoffRisk} onChange={(checked) => updateField('runoffRisk', checked)} disabled={isSaving} />
        {formData.runoffRisk ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <TextInput label="Chemical type" value={formData.chemicalType} onChange={(value) => updateField('chemicalType', value)} disabled={isSaving} />
            <TextInput label="Containment plan" value={formData.containmentPlan} onChange={(value) => updateField('containmentPlan', value)} disabled={isSaving} />
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Checkbox label="Water body proximity" checked={formData.waterBodyProximity} onChange={(checked) => updateField('waterBodyProximity', checked)} disabled={isSaving} />
        {formData.waterBodyProximity ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <TextInput label="Water body distance (feet)" type="number" value={formData.waterBodyDistance} onChange={(value) => updateField('waterBodyDistance', value)} disabled={isSaving} />
            <SelectInput label="Water body type" value={formData.waterBodyType} options={waterBodyTypeOptions} onChange={(value) => updateField('waterBodyType', value)} disabled={isSaving} />
          </div>
        ) : null}
      </div>

      {(formData.runoffRisk || formData.waterBodyProximity) ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3">
          <Checkbox label="Secondary containment in place" checked={formData.secondaryContainmentInPlace} onChange={(checked) => updateField('secondaryContainmentInPlace', checked)} disabled={isSaving} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput label="Reclamation method" value={formData.reclamationMethod} options={reclamationMethodOptions} onChange={(value) => updateField('reclamationMethod', value)} disabled={isSaving} />
            <TextInput label="Reclamation volume estimate (gallons)" type="number" value={formData.reclamationVolumeEstimate} onChange={(value) => updateField('reclamationVolumeEstimate', value)} disabled={isSaving} />
            {formData.reclamationMethod === 'Third Party Vendor' ? (
              <TextInput label="Disposal vendor name and contact" value={formData.disposalVendorNameContact} onChange={(value) => updateField('disposalVendorNameContact', value)} disabled={isSaving} />
            ) : null}
          </div>
        </div>
      ) : null}

      {(formData.runoffRisk || formData.waterBodyProximity) ? (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Regulatory citations</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {citationOptions.map((citation) => (
              <label key={citation} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <span className="flex items-start gap-3 font-medium">
                  <input
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
                    type="checkbox"
                    checked={formData.regulatoryCitations.includes(citation)}
                    onChange={() => toggleCitation(citation)}
                    disabled={isSaving}
                  />
                  <span>{citation}</span>
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">{citationGuidance[citation]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Advanced regulatory fields appear when runoff risk or water body proximity is selected.
        </div>
      )}
    </div>
  );
}

function HazardsStep({
  formData,
  updateHazard,
  addHazardFromSuggestion,
  addCustomHazard,
  removeHazard,
  isSaving
}: {
  formData: JhaFormState;
  updateHazard: (index: number, field: keyof HazardEntry, value: string | number) => void;
  addHazardFromSuggestion: (hazard: (typeof commonHazards)[number]) => void;
  addCustomHazard: () => void;
  removeHazard: (index: number) => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-brand-900">Common hazards</h3>
        <p className="mt-1 text-sm text-slate-600">Select common drone cleaning hazards to add them with editable suggested controls.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {commonHazards.map((hazard) => {
            const selected = formData.hazardEntries.some((entry) => entry.description === hazard.description);
            return (
              <button
                key={hazard.description}
                type="button"
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  selected ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => addHazardFromSuggestion(hazard)}
                disabled={isSaving || selected}
              >
                <span className="block font-semibold">{hazard.description}</span>
                <span className="mt-1 block text-xs text-slate-500">Suggested owner: {hazard.owner}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:py-2" onClick={addCustomHazard} disabled={isSaving}>
        Add Custom Hazard
      </button>

      <div className="space-y-4">
        {formData.hazardEntries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Select a common hazard above or add a custom hazard to begin the risk assessment.
          </div>
        ) : null}

        {formData.hazardEntries.map((entry, index) => {
          const score = getRiskScore(entry);
          const rating = getRiskRating(score);
          return (
            <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-brand-900">Hazard {index + 1}</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {rating} - {score}
                  </span>
                  <button type="button" className="text-sm font-medium text-red-700 disabled:text-slate-400" onClick={() => removeHazard(index)} disabled={isSaving}>
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
  );
}

function CertificationStep({
  formData,
  updateField,
  togglePpe,
  toggleStringListField,
  isSaving
}: {
  formData: JhaFormState;
  updateField: <T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) => void;
  togglePpe: (option: string) => void;
  toggleStringListField: (field: 'exclusionZoneControls' | 'communicationMethods', value: string) => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">PPE Requirements</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ppeOptions.map((option) => (
            <Checkbox key={option} label={option} checked={Boolean(formData.ppeRequirements[option])} onChange={() => togglePpe(option)} disabled={isSaving} />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Nearest Hospital" value={formData.nearestHospital} onChange={(value) => updateField('nearestHospital', value)} disabled={isSaving} />
        <TextInput label="Emergency Contact" value={formData.emergencyContact} onChange={(value) => updateField('emergencyContact', value)} disabled={isSaving} />
        <div className="sm:col-span-2">
          <TextArea label="Drone Incident Procedure" value={formData.droneIncidentProcedure} onChange={(value) => updateField('droneIncidentProcedure', value)} disabled={isSaving} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-base font-semibold text-brand-900">Communications</h3>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-slate-700">Communication Method</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {communicationMethodOptions.map((option) => (
              <Checkbox
                key={option}
                label={option}
                checked={formData.communicationMethods.includes(option)}
                onChange={() => toggleStringListField('communicationMethods', option)}
                disabled={isSaving}
              />
            ))}
          </div>
        </fieldset>
        {formData.communicationMethods.includes('Other') ? (
          <div className="mt-3">
            <TextInput label="Other communication method" value={formData.communicationMethodOther} onChange={(value) => updateField('communicationMethodOther', value)} disabled={isSaving} />
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextInput label="Radio frequency/channel assigned or discussed" value={formData.radioChannel} onChange={(value) => updateField('radioChannel', value)} disabled={isSaving} />
          <div className="space-y-3 sm:pt-7">
            <Checkbox label="Communication plan reviewed" checked={formData.communicationPlanReviewed} onChange={(checked) => updateField('communicationPlanReviewed', checked)} disabled={isSaving} />
            <Checkbox label="Lost communication procedure reviewed" checked={formData.lostCommunicationProcedureReviewed} onChange={(checked) => updateField('lostCommunicationProcedureReviewed', checked)} disabled={isSaving} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-600">
          RPIC certifies that hazards were assessed, controls are in place before work begins, crew members were briefed, and stop-work authority is retained.
        </p>
        <div className="mt-4 space-y-3">
          <Checkbox label="Crew briefed on hazards, controls, PPE, emergency procedures, and communications" checked={formData.crewBriefed} onChange={(checked) => updateField('crewBriefed', checked)} disabled={isSaving} />
          <Checkbox label="Controls are in place before operations begin" checked={formData.controlsInPlace} onChange={(checked) => updateField('controlsInPlace', checked)} disabled={isSaving} />
          <Checkbox label="RPIC stop-work authority acknowledged" checked={formData.stopWorkAuthorityAcknowledged} onChange={(checked) => updateField('stopWorkAuthorityAcknowledged', checked)} disabled={isSaving} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Assessor name" value={formData.assessorName} onChange={(value) => updateField('assessorName', value)} disabled={isSaving} required />
        <TextInput label="Assessment date" type="date" value={formData.assessmentDate} onChange={(value) => updateField('assessmentDate', value)} disabled={isSaving} required />
        <TextInput label="RPIC Printed Name" value={formData.rpicPrintedName} onChange={(value) => updateField('rpicPrintedName', value)} disabled={isSaving} />
        <SelectInput label="Status" value={formData.status} options={statusOptions} onChange={(value) => updateField('status', value)} disabled={isSaving} />
      </div>
    </div>
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

function SelectInput({ label, value, options, onChange, disabled, required }: FieldProps & { options: string[] }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
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
