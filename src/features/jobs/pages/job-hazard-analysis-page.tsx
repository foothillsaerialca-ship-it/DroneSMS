import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';

const steps = ['Mission Basics', 'Site Conditions', 'Airspace', 'Environmental', 'Hazards', 'Crew Briefing & Communications'];
const surfaceOptions = ['Asphalt', 'Concrete', 'Gravel', 'Dirt', 'Grass', 'Rooftop', 'Mixed Surface', 'Other'];
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
const exclusionOptions = [
  'Cones/signage used',
  'Visual observer assigned',
  'Ground crew monitoring perimeter',
  'Public walkway controlled',
  'Vehicle traffic separated',
  'Work paused if public enters area',
  'Restricted access established',
  'Spotter assigned'
];
const communicationOptions = ['Headsets', 'Radios', 'Cell Phones', 'Hand Signals', 'Other'];
const weatherOptions = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain'];
const visibilityOptions = ['Excellent', 'Good', 'Fair', 'Poor'];
const airspaceOptions = ['B', 'C', 'D', 'E', 'G'];
const laancOptions = ['Yes', 'No', 'Not Applicable'];
const waterBodyOptions = ['River', 'Stream', 'Lake', 'Pond', 'Irrigation Canal', 'Storm Drain', 'Wetland', 'Other'];
const reclamationOptions = ['Collection Tank', 'Absorbent Material', 'Containment Berm', 'Third Party Vendor', 'Not Required'];
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
const ppeOptions = ['Safety Glasses', 'Chemical Resistant Gloves', 'Non-Slip Footwear', 'High-Vis Vest', 'Hearing Protection', 'Hard Hat'];
const likelihoodHelp = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Frequent'];
const severityHelp = ['Minimal', 'Minor', 'Moderate', 'Serious', 'Catastrophic'];
const today = new Date().toISOString().slice(0, 10);
const defaultIncidentProcedure = 'Land immediately, secure area, assess injuries, notify RPIC, document, and report per FAA requirements if applicable.';

const commonHazards = [
  ['Drone fly-away or loss of control over public or personnel', 2, 5, 'RPIC', 'Pre-flight checks, VLOS maintained, visual observer assigned, exclusion zone established, emergency procedure briefed.'],
  ['Drone rotor strike to ground personnel or public', 2, 5, 'VO', 'Exclusion zone marked and enforced, VO monitors perimeter, public warning signage posted, site access controlled.'],
  ['Pressure equipment failure or hose burst', 3, 4, 'RPIC', 'Pre-job equipment inspection, pressure relief valve verified, hose hazard briefed, PPE worn by all crew.'],
  ['Hose trip hazard to crew or public', 4, 3, 'Crew', 'Hoses routed and secured, cones or barriers placed, ground crew maintains awareness, public exclusion enforced.'],
  ['Chemical or soft wash exposure to personnel', 3, 4, 'RPIC', 'SDS reviewed, PPE issued, dilution ratios verified, containment plan in place, eyewash available.'],
  ['Chemical runoff to storm drain or waterway', 3, 4, 'RPIC', 'Storm drain covered or blocked, containment berm deployed, runoff direction assessed, local requirements checked.'],
  ['Water or slip hazard on ground surface', 5, 3, 'Crew', 'Non-slip footwear required, wet surface signage posted, work area monitored continuously, crew briefed.'],
  ['Electrical hazard from overhead power lines', 2, 5, 'RPIC', 'Site survey identifies power lines, minimum clearance maintained, VO monitors proximity, suspend if clearance is unsafe.'],
  ['Battery fire or thermal runaway', 2, 4, 'RPIC', 'Battery inspection before flight, LiPo-safe transport, fire extinguisher on site, no charging near combustibles.'],
  ['Unauthorized airspace or LAANC violation', 2, 4, 'RPIC', 'Airspace checked before operation, LAANC authorization obtained where required, documentation stored in job file.'],
  ['Heat stress or dehydration', 4, 3, 'RPIC', 'Water on site, rest breaks scheduled, heat index monitored, work suspended if conditions exceed safe limits.']
] as const;

type Job = { id: string; organization_id: string; name: string; service_type: string; location: string; planned_date: string; status: string };
type HazardEntry = { id: string; description: string; likelihood: number; severity: number; mitigation: string; owner: string; residualRisk: string; notes: string };
type PpeValue = boolean | string | string[];
type PpeRequirements = Record<string, PpeValue>;
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
type JhaAssessment = Record<string, any>;

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

function defaultPpe(): PpeRequirements {
  return ppeOptions.reduce<PpeRequirements>((acc, option) => ({ ...acc, [option]: false }), {});
}

function getArray(value: PpeValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function getString(value: PpeValue | undefined) {
  return typeof value === 'string' ? value : '';
}

function splitOption(value: string | null | undefined, options: string[]) {
  if (!value) return { option: '', other: '' };
  return options.includes(value) ? { option: value, other: '' } : { option: 'Other', other: value };
}

function riskScore(entry: HazardEntry) {
  return entry.likelihood * entry.severity;
}

function riskRating(score: number) {
  if (score >= 15) return 'High';
  if (score >= 9) return 'Medium';
  return 'Low';
}

function parseNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function formatDate(value: string) {
  if (!value) return 'Not scheduled';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${month}/${day}/${year}` : value;
}

function effectiveSurface(formData: JhaFormState) {
  return formData.surfaceType === 'Other' ? formData.surfaceTypeOther.trim() : formData.surfaceType;
}

function effectiveSiteAccess(formData: JhaFormState) {
  return formData.siteAccess === 'Other' ? formData.siteAccessOther.trim() : formData.siteAccess;
}

function emptyForm(job: Job | null): JhaFormState {
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
    waterBodyType: waterBodyOptions[0],
    secondaryContainmentInPlace: false,
    reclamationMethod: reclamationOptions[0],
    reclamationVolumeEstimate: '',
    disposalVendorNameContact: '',
    laancRequired: laancOptions[2],
    hazardEntries: [],
    ppeRequirements: defaultPpe(),
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
    const item = entry as Partial<HazardEntry>;
    return createHazardEntry({
      id: item.id || createHazardEntry().id,
      description: item.description ?? '',
      likelihood: Number(item.likelihood) || 1,
      severity: Number(item.severity) || 1,
      mitigation: item.mitigation ?? '',
      owner: item.owner ?? '',
      residualRisk: item.residualRisk ?? 'Low',
      notes: item.notes ?? ''
    });
  });
}

function normalizePpe(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultPpe();
  return { ...defaultPpe(), ...(value as PpeRequirements) };
}

function toFormState(job: Job, assessment: JhaAssessment | null): JhaFormState {
  const base = emptyForm(job);
  if (!assessment) return base;
  const ppeRequirements = normalizePpe(assessment.ppe_requirements);
  const surface = splitOption(assessment.surface_type, surfaceOptions);
  const siteAccess = splitOption(assessment.site_access, siteAccessOptions);

  return {
    ...base,
    operatorCompany: assessment.operator_company ?? '',
    jhaNumber: assessment.jha_number ?? base.jhaNumber,
    remotePilotInCommand: assessment.remote_pilot_in_command ?? '',
    datePrepared: assessment.date_prepared ?? base.datePrepared,
    clientPropertyOwner: assessment.client_property_owner ?? '',
    jobDate: assessment.job_date ?? base.jobDate,
    siteAddress: assessment.site_address ?? base.siteAddress,
    dronePlatform: assessment.drone_platform ?? '',
    jobTypeScope: assessment.job_type_scope ?? base.jobTypeScope,
    crewMembers: assessment.crew_members ?? '',
    weatherConditions: assessment.weather_conditions ?? '',
    faaAirspaceClass: assessment.faa_airspace_class ?? '',
    surfaceType: surface.option,
    surfaceTypeOther: surface.other,
    buildingHeight: assessment.building_height?.toString() ?? '',
    siteAccess: siteAccess.option,
    siteAccessOther: siteAccess.other,
    windSpeed: assessment.wind_speed?.toString() ?? '',
    weather: assessment.weather ?? base.weather,
    visibility: assessment.visibility ?? base.visibility,
    publicPresence: Boolean(assessment.public_presence),
    exclusionZonePlanned: Boolean(assessment.exclusion_zone_planned),
    exclusionZoneControls: getArray(ppeRequirements.__exclusionZoneControls),
    exclusionZoneComments: (getString(ppeRequirements.__exclusionZoneComments) || assessment.exclusion_zone_description) ?? '',
    runoffRisk: Boolean(assessment.runoff_risk),
    chemicalType: assessment.chemical_type ?? '',
    containmentPlan: assessment.containment_plan ?? '',
    regulatoryCitations: assessment.regulatory_citations ?? [],
    waterBodyProximity: Boolean(assessment.water_body_proximity),
    waterBodyDistance: assessment.water_body_distance?.toString() ?? '',
    waterBodyType: assessment.water_body_type ?? base.waterBodyType,
    secondaryContainmentInPlace: Boolean(assessment.secondary_containment_in_place),
    reclamationMethod: assessment.reclamation_method ?? base.reclamationMethod,
    reclamationVolumeEstimate: assessment.reclamation_volume_estimate?.toString() ?? '',
    disposalVendorNameContact: assessment.disposal_vendor_name_contact ?? '',
    laancRequired: assessment.laanc_required ?? base.laancRequired,
    hazardEntries: normalizeHazards(assessment.hazard_entries),
    ppeRequirements,
    nearestHospital: assessment.nearest_hospital ?? '',
    emergencyContact: assessment.emergency_contact ?? '',
    droneIncidentProcedure: assessment.drone_incident_procedure ?? defaultIncidentProcedure,
    communicationMethods: getArray(ppeRequirements.__communicationMethods),
    communicationMethodOther: getString(ppeRequirements.__communicationMethodOther),
    radioChannel: getString(ppeRequirements.__radioChannel),
    communicationPlanReviewed: Boolean(ppeRequirements.__communicationPlanReviewed),
    lostCommunicationProcedureReviewed: Boolean(ppeRequirements.__lostCommunicationProcedureReviewed),
    crewBriefed: Boolean(assessment.crew_briefed),
    controlsInPlace: Boolean(assessment.controls_in_place),
    stopWorkAuthorityAcknowledged: Boolean(assessment.stop_work_authority_acknowledged),
    assessorName: assessment.assessor_name ?? '',
    assessmentDate: assessment.assessment_date ?? base.assessmentDate,
    rpicPrintedName: assessment.rpic_printed_name ?? '',
    status: assessment.status ?? base.status
  };
}

function stepCompletion(formData: JhaFormState) {
  return [
    Boolean(formData.jhaNumber && formData.jobDate && formData.siteAddress && formData.jobTypeScope),
    Boolean(effectiveSurface(formData) && formData.windSpeed && formData.weather && formData.visibility),
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
        if (isMounted) setLoadError(getErrorMessage(error));
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
    if (!formData?.hazardEntries.length) return 0;
    return Math.max(...formData.hazardEntries.map(riskScore), 0);
  }, [formData]);
  const overallRiskRating = riskRating(highestRiskScore);

  function setField<T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) {
    setFormData((current) => (current ? { ...current, [field]: value } : current));
    setSaveMessage(null);
  }

  function toggleList(field: 'exclusionZoneControls' | 'communicationMethods' | 'regulatoryCitations', value: string) {
    setFormData((current) => {
      if (!current) return current;
      const selected = current[field];
      const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
      return { ...current, [field]: next };
    });
    setSaveMessage(null);
  }

  function togglePpe(option: string) {
    setFormData((current) => {
      if (!current) return current;
      return { ...current, ppeRequirements: { ...current.ppeRequirements, [option]: !current.ppeRequirements[option] } };
    });
    setSaveMessage(null);
  }

  function updateHazard(index: number, field: keyof HazardEntry, value: string | number) {
    setFormData((current) => {
      if (!current) return current;
      return {
        ...current,
        hazardEntries: current.hazardEntries.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, [field]: value } : entry
        )
      };
    });
    setSaveMessage(null);
  }

  function addCommonHazard(hazard: (typeof commonHazards)[number]) {
    setFormData((current) => {
      if (!current || current.hazardEntries.some((entry) => entry.description === hazard[0])) return current;
      const score = hazard[1] * hazard[2];
      return {
        ...current,
        hazardEntries: [
          ...current.hazardEntries,
          createHazardEntry({ description: hazard[0], likelihood: hazard[1], severity: hazard[2], owner: hazard[3], mitigation: hazard[4], residualRisk: riskRating(score) === 'High' ? 'Medium' : 'Low' })
        ]
      };
    });
    setSaveMessage(null);
  }

  function validate(requireCompletion: boolean) {
    if (!formData) return 'Unable to save this JHA.';
    if (!requireCompletion) return null;
    if (!effectiveSurface(formData)) return 'Surface type is required.';
    if (!formData.windSpeed.trim()) return 'Wind speed is required.';
    if (!formData.weather) return 'Weather is required.';
    if (!formData.visibility) return 'Visibility is required.';
    if (!formData.faaAirspaceClass && !formData.laancRequired) return 'Airspace class or LAANC status is required.';
    if (formData.publicPresence && formData.exclusionZonePlanned && formData.exclusionZoneControls.length === 0) return 'Select at least one exclusion zone control.';
    if (formData.runoffRisk && !formData.containmentPlan.trim()) return 'Containment plan is required when runoff risk is present.';
    if (formData.communicationMethods.includes('Other') && !formData.communicationMethodOther.trim()) return 'Describe the other communication method.';
    if (!formData.hazardEntries.some((entry) => entry.description.trim() && entry.mitigation.trim())) return 'Select or add at least one hazard.';
    if (formData.hazardEntries.some((entry) => (entry.description.trim() || entry.mitigation.trim()) && (!entry.description.trim() || !entry.mitigation.trim()))) return 'Each hazard needs a description and mitigation.';
    if (!formData.assessorName.trim()) return 'Assessor name is required.';
    if (!formData.assessmentDate) return 'Assessment date is required.';
    if (formData.status === 'Complete') {
      if (!formData.crewBriefed || !formData.controlsInPlace || !formData.stopWorkAuthorityAcknowledged) return 'Complete the RPIC certification acknowledgments before marking the JHA complete.';
      if (!formData.communicationPlanReviewed || !formData.lostCommunicationProcedureReviewed) return 'Review the communication plan and lost communication procedure before marking the JHA complete.';
      if (!formData.rpicPrintedName.trim()) return 'RPIC printed name is required before marking the JHA complete.';
    }
    return null;
  }

  async function saveAssessment(options: { requireCompletion?: boolean; message?: string } = {}) {
    if (!job || !formData) return false;
    const validationError = validate(Boolean(options.requireCompletion));
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
          surface_type: effectiveSurface(formData) || null,
          building_height: parseNumber(formData.buildingHeight),
          site_access: effectiveSiteAccess(formData) || null,
          wind_speed: parseNumber(formData.windSpeed),
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
          water_body_distance: parseNumber(formData.waterBodyDistance),
          water_body_type: formData.waterBodyType || null,
          secondary_containment_in_place: formData.secondaryContainmentInPlace,
          reclamation_method: formData.reclamationMethod || null,
          reclamation_volume_estimate: parseNumber(formData.reclamationVolumeEstimate),
          disposal_vendor_name_contact: formData.disposalVendorNameContact.trim() || null,
          laanc_required: formData.laancRequired,
          hazard_entries: formData.hazardEntries.map((entry) => ({ ...entry, riskScore: riskScore(entry) })),
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAssessment({ requireCompletion: true, message: 'JHA saved.' });
  }

  if (isLoading) return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading job hazard analysis...</section>;
  if (loadError || !job || !formData) {
    return (
      <section className="space-y-4">
        <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={jobId ? `/jobs/${jobId}/hub` : '/jobs'}>Back to Job File</Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <h1 className="text-base font-semibold text-red-800">Unable to load JHA</h1>
          <p className="mt-2 text-sm text-red-700">{loadError ?? 'Please try again.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to={`/jobs/${job.id}/hub`}>Back to Job File</Link>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Pillar 2: Risk Management</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">Job Hazard Analysis</h1>
            <p className="mt-2 text-sm text-slate-600">{job.name} - {job.service_type} - {formatDate(job.planned_date)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Overall risk:</span> {overallRiskRating}
          </div>
        </div>
      </div>
      <ProgressIndicator activeStep={activeStep} completed={stepCompletion(formData)} onStepClick={goToStep} disabled={isSaving} />
      {highestRiskScore >= 15 ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm" role="alert">Risk score of 15 or higher detected. Reduce or document controls before this job proceeds.</div> : null}

      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm font-medium text-slate-500">Step {activeStep + 1} of {steps.length}</p>
          <h2 className="mt-1 text-xl font-semibold text-brand-900">{steps[activeStep]}</h2>
          <div className="mt-5">
            {activeStep === 0 ? <MissionBasics formData={formData} setField={setField} disabled={isSaving} /> : null}
            {activeStep === 1 ? <SiteConditions formData={formData} setField={setField} toggleList={toggleList} disabled={isSaving} /> : null}
            {activeStep === 2 ? <Airspace formData={formData} setField={setField} disabled={isSaving} /> : null}
            {activeStep === 3 ? <Environmental formData={formData} setField={setField} toggleList={toggleList} disabled={isSaving} /> : null}
            {activeStep === 4 ? <Hazards formData={formData} updateHazard={updateHazard} addCommonHazard={addCommonHazard} addCustomHazard={() => setField('hazardEntries', [...formData.hazardEntries, createHazardEntry()])} removeHazard={(index) => setField('hazardEntries', formData.hazardEntries.filter((_, entryIndex) => entryIndex !== index))} disabled={isSaving} /> : null}
            {activeStep === 5 ? <Certification formData={formData} setField={setField} togglePpe={togglePpe} toggleList={toggleList} disabled={isSaving} /> : null}
          </div>
        </div>

        {saveError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{saveError}</p> : null}
        {saveMessage ? <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status">{saveMessage}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:py-2" onClick={goBack} disabled={isSaving || activeStep === 0}>Back</button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 sm:py-2" onClick={() => saveAssessment({ message: 'Progress saved.' })} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Progress'}</button>
            {activeStep < steps.length - 1 ? (
              <button type="button" className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2" onClick={goNext} disabled={isSaving}>{isSaving ? 'Saving...' : 'Next'}</button>
            ) : (
              <button type="submit" className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save JHA'}</button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

function ProgressIndicator({ activeStep, completed, onStepClick, disabled }: { activeStep: number; completed: boolean[]; onStepClick: (step: number) => void; disabled: boolean }) {
  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="JHA progress">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((step, index) => (
          <li key={step}>
            <button type="button" className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${index === activeStep ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => onStepClick(index)} disabled={disabled}>
              <span className="block text-xs font-semibold uppercase text-slate-500">Step {index + 1}</span>
              <span className="mt-1 block font-semibold">{step}</span>
              <span className="mt-1 block text-xs">{completed[index] ? 'Started' : 'Not started'}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function MissionBasics({ formData, setField, disabled }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInput label="Operator / Company" value={formData.operatorCompany} onChange={(value) => setField('operatorCompany', value)} disabled={disabled} />
      <TextInput label="JHA Number" value={formData.jhaNumber} onChange={(value) => setField('jhaNumber', value)} disabled={disabled} />
      <TextInput label="Remote Pilot in Command" value={formData.remotePilotInCommand} onChange={(value) => setField('remotePilotInCommand', value)} disabled={disabled} />
      <TextInput label="Date Prepared" type="date" value={formData.datePrepared} onChange={(value) => setField('datePrepared', value)} disabled={disabled} />
      <TextInput label="Client / Property Owner" value={formData.clientPropertyOwner} onChange={(value) => setField('clientPropertyOwner', value)} disabled={disabled} />
      <TextInput label="Job Date" type="date" value={formData.jobDate} onChange={(value) => setField('jobDate', value)} disabled={disabled} />
      <TextInput label="Site Address" value={formData.siteAddress} onChange={(value) => setField('siteAddress', value)} disabled={disabled} />
      <TextInput label="Drone Platform" value={formData.dronePlatform} onChange={(value) => setField('dronePlatform', value)} disabled={disabled} />
      <TextInput label="Job Type / Scope" value={formData.jobTypeScope} onChange={(value) => setField('jobTypeScope', value)} disabled={disabled} />
      <TextInput label="Crew Members" value={formData.crewMembers} onChange={(value) => setField('crewMembers', value)} disabled={disabled} />
    </div>
  );
}

type StepProps = { formData: JhaFormState; setField: <T extends keyof JhaFormState>(field: T, value: JhaFormState[T]) => void; disabled: boolean };

function SiteConditions({ formData, setField, toggleList, disabled }: StepProps & { toggleList: (field: 'exclusionZoneControls' | 'communicationMethods' | 'regulatoryCitations', value: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Surface type" value={formData.surfaceType} options={['', ...surfaceOptions]} onChange={(value) => setField('surfaceType', value)} disabled={disabled} required />
        {formData.surfaceType === 'Other' ? <TextInput label="Custom surface type" value={formData.surfaceTypeOther} onChange={(value) => setField('surfaceTypeOther', value)} disabled={disabled} required /> : null}
        <TextInput label="Building height (feet)" type="number" value={formData.buildingHeight} onChange={(value) => setField('buildingHeight', value)} disabled={disabled} />
        <SelectInput label="Site access" value={formData.siteAccess} options={['', ...siteAccessOptions]} onChange={(value) => setField('siteAccess', value)} disabled={disabled} />
        {formData.siteAccess === 'Other' ? <TextInput label="Custom site access" value={formData.siteAccessOther} onChange={(value) => setField('siteAccessOther', value)} disabled={disabled} /> : null}
        <TextInput label="Wind speed (MPH)" type="number" value={formData.windSpeed} onChange={(value) => setField('windSpeed', value)} disabled={disabled} required />
        <SelectInput label="Weather" value={formData.weather} options={weatherOptions} onChange={(value) => setField('weather', value)} disabled={disabled} />
        <SelectInput label="Visibility" value={formData.visibility} options={visibilityOptions} onChange={(value) => setField('visibility', value)} disabled={disabled} />
        <TextInput label="Weather Conditions" value={formData.weatherConditions} onChange={(value) => setField('weatherConditions', value)} disabled={disabled} />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Checkbox label="Public presence" checked={formData.publicPresence} onChange={(checked) => setField('publicPresence', checked)} disabled={disabled} />
        {formData.publicPresence ? (
          <div className="mt-3 space-y-3">
            <Checkbox label="Exclusion zone planned" checked={formData.exclusionZonePlanned} onChange={(checked) => setField('exclusionZonePlanned', checked)} disabled={disabled} />
            {formData.exclusionZonePlanned ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">Exclusion zone controls</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {exclusionOptions.map((option) => <Checkbox key={option} label={option} checked={formData.exclusionZoneControls.includes(option)} onChange={() => toggleList('exclusionZoneControls', option)} disabled={disabled} />)}
                  </div>
                </fieldset>
                <TextArea label="Additional exclusion zone comments" value={formData.exclusionZoneComments} onChange={(value) => setField('exclusionZoneComments', value)} disabled={disabled} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Airspace({ formData, setField, disabled }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectInput label="FAA Airspace Class" value={formData.faaAirspaceClass} options={['', ...airspaceOptions]} onChange={(value) => setField('faaAirspaceClass', value)} disabled={disabled} />
      <SelectInput label="LAANC required" value={formData.laancRequired} options={laancOptions} onChange={(value) => setField('laancRequired', value)} disabled={disabled} />
      {formData.laancRequired === 'Yes' ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">Keep LAANC authorization documentation in the job file before operations begin.</div> : null}
    </div>
  );
}

function Environmental({ formData, setField, toggleList, disabled }: StepProps & { toggleList: (field: 'exclusionZoneControls' | 'communicationMethods' | 'regulatoryCitations', value: string) => void }) {
  const showAdvanced = formData.runoffRisk || formData.waterBodyProximity;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Checkbox label="Runoff risk" checked={formData.runoffRisk} onChange={(checked) => setField('runoffRisk', checked)} disabled={disabled} />
        {formData.runoffRisk ? <div className="mt-3 grid gap-4 sm:grid-cols-2"><TextInput label="Chemical type" value={formData.chemicalType} onChange={(value) => setField('chemicalType', value)} disabled={disabled} /><TextInput label="Containment plan" value={formData.containmentPlan} onChange={(value) => setField('containmentPlan', value)} disabled={disabled} /></div> : null}
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Checkbox label="Water body proximity" checked={formData.waterBodyProximity} onChange={(checked) => setField('waterBodyProximity', checked)} disabled={disabled} />
        {formData.waterBodyProximity ? <div className="mt-3 grid gap-4 sm:grid-cols-2"><TextInput label="Water body distance (feet)" type="number" value={formData.waterBodyDistance} onChange={(value) => setField('waterBodyDistance', value)} disabled={disabled} /><SelectInput label="Water body type" value={formData.waterBodyType} options={waterBodyOptions} onChange={(value) => setField('waterBodyType', value)} disabled={disabled} /></div> : null}
      </div>
      {showAdvanced ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3">
          <Checkbox label="Secondary containment in place" checked={formData.secondaryContainmentInPlace} onChange={(checked) => setField('secondaryContainmentInPlace', checked)} disabled={disabled} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput label="Reclamation method" value={formData.reclamationMethod} options={reclamationOptions} onChange={(value) => setField('reclamationMethod', value)} disabled={disabled} />
            <TextInput label="Reclamation volume estimate (gallons)" type="number" value={formData.reclamationVolumeEstimate} onChange={(value) => setField('reclamationVolumeEstimate', value)} disabled={disabled} />
            {formData.reclamationMethod === 'Third Party Vendor' ? <TextInput label="Disposal vendor name and contact" value={formData.disposalVendorNameContact} onChange={(value) => setField('disposalVendorNameContact', value)} disabled={disabled} /> : null}
          </div>
        </div>
      ) : null}
      {showAdvanced ? (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Regulatory citations</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {citationOptions.map((citation) => (
              <label key={citation} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <span className="flex items-start gap-3 font-medium"><input className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" type="checkbox" checked={formData.regulatoryCitations.includes(citation)} onChange={() => toggleList('regulatoryCitations', citation)} disabled={disabled} /><span>{citation}</span></span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">{citationGuidance[citation]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Advanced regulatory fields appear when runoff risk or water body proximity is selected.</div>}
    </div>
  );
}

function Hazards({ formData, updateHazard, addCommonHazard, addCustomHazard, removeHazard, disabled }: { formData: JhaFormState; updateHazard: (index: number, field: keyof HazardEntry, value: string | number) => void; addCommonHazard: (hazard: (typeof commonHazards)[number]) => void; addCustomHazard: () => void; removeHazard: (index: number) => void; disabled: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-brand-900">Common hazards</h3>
        <p className="mt-1 text-sm text-slate-600">Select common drone cleaning hazards to add them with editable suggested controls.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {commonHazards.map((hazard) => {
            const selected = formData.hazardEntries.some((entry) => entry.description === hazard[0]);
            return <button key={hazard[0]} type="button" className={`rounded-lg border p-3 text-left text-sm transition ${selected ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`} onClick={() => addCommonHazard(hazard)} disabled={disabled || selected}><span className="block font-semibold">{hazard[0]}</span><span className="mt-1 block text-xs text-slate-500">Suggested owner: {hazard[3]}</span></button>;
          })}
        </div>
      </div>
      <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:py-2" onClick={addCustomHazard} disabled={disabled}>Add Custom Hazard</button>
      {formData.hazardEntries.length === 0 ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Select a common hazard above or add a custom hazard to begin the risk assessment.</div> : null}
      {formData.hazardEntries.map((entry, index) => <HazardCard key={entry.id} entry={entry} index={index} updateHazard={updateHazard} removeHazard={removeHazard} disabled={disabled} />)}
    </div>
  );
}

function HazardCard({ entry, index, updateHazard, removeHazard, disabled }: { entry: HazardEntry; index: number; updateHazard: (index: number, field: keyof HazardEntry, value: string | number) => void; removeHazard: (index: number) => void; disabled: boolean }) {
  const score = riskScore(entry);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold text-brand-900">Hazard {index + 1}</h3><div className="flex items-center gap-2"><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{riskRating(score)} - {score}</span><button type="button" className="text-sm font-medium text-red-700 disabled:text-slate-400" onClick={() => removeHazard(index)} disabled={disabled}>Remove</button></div></div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <TextArea label="Hazard description" value={entry.description} onChange={(value) => updateHazard(index, 'description', value)} disabled={disabled} />
        <TextArea label="Controls / Mitigation Measures" value={entry.mitigation} onChange={(value) => updateHazard(index, 'mitigation', value)} disabled={disabled} />
        <RangeSelect label="Likelihood" value={entry.likelihood} helper={likelihoodHelp} onChange={(value) => updateHazard(index, 'likelihood', value)} disabled={disabled} />
        <RangeSelect label="Severity" value={entry.severity} helper={severityHelp} onChange={(value) => updateHazard(index, 'severity', value)} disabled={disabled} />
        <SelectInput label="Residual risk" value={entry.residualRisk} options={['Low', 'Medium', 'High']} onChange={(value) => updateHazard(index, 'residualRisk', value)} disabled={disabled} />
        <TextInput label="Notes / Owner" value={entry.owner} onChange={(value) => updateHazard(index, 'owner', value)} disabled={disabled} />
        <div className="sm:col-span-2"><TextArea label="Additional notes" value={entry.notes} onChange={(value) => updateHazard(index, 'notes', value)} disabled={disabled} /></div>
      </div>
    </div>
  );
}

function Certification({ formData, setField, togglePpe, toggleList, disabled }: StepProps & { togglePpe: (option: string) => void; toggleList: (field: 'exclusionZoneControls' | 'communicationMethods' | 'regulatoryCitations', value: string) => void }) {
  return (
    <div className="space-y-5">
      <fieldset><legend className="text-sm font-medium text-slate-700">PPE Requirements</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{ppeOptions.map((option) => <Checkbox key={option} label={option} checked={Boolean(formData.ppeRequirements[option])} onChange={() => togglePpe(option)} disabled={disabled} />)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Nearest Hospital" value={formData.nearestHospital} onChange={(value) => setField('nearestHospital', value)} disabled={disabled} /><TextInput label="Emergency Contact" value={formData.emergencyContact} onChange={(value) => setField('emergencyContact', value)} disabled={disabled} /><div className="sm:col-span-2"><TextArea label="Drone Incident Procedure" value={formData.droneIncidentProcedure} onChange={(value) => setField('droneIncidentProcedure', value)} disabled={disabled} /></div></div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-base font-semibold text-brand-900">Communications</h3>
        <fieldset className="mt-3"><legend className="text-sm font-medium text-slate-700">Communication Method</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{communicationOptions.map((option) => <Checkbox key={option} label={option} checked={formData.communicationMethods.includes(option)} onChange={() => toggleList('communicationMethods', option)} disabled={disabled} />)}</div></fieldset>
        {formData.communicationMethods.includes('Other') ? <div className="mt-3"><TextInput label="Other communication method" value={formData.communicationMethodOther} onChange={(value) => setField('communicationMethodOther', value)} disabled={disabled} /></div> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><TextInput label="Radio frequency/channel assigned or discussed" value={formData.radioChannel} onChange={(value) => setField('radioChannel', value)} disabled={disabled} /><div className="space-y-3 sm:pt-7"><Checkbox label="Communication plan reviewed" checked={formData.communicationPlanReviewed} onChange={(checked) => setField('communicationPlanReviewed', checked)} disabled={disabled} /><Checkbox label="Lost communication procedure reviewed" checked={formData.lostCommunicationProcedureReviewed} onChange={(checked) => setField('lostCommunicationProcedureReviewed', checked)} disabled={disabled} /></div></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-sm text-slate-600">RPIC certifies that hazards were assessed, controls are in place before work begins, crew members were briefed, and stop-work authority is retained.</p><div className="mt-4 space-y-3"><Checkbox label="Crew briefed on hazards, controls, PPE, emergency procedures, and communications" checked={formData.crewBriefed} onChange={(checked) => setField('crewBriefed', checked)} disabled={disabled} /><Checkbox label="Controls are in place before operations begin" checked={formData.controlsInPlace} onChange={(checked) => setField('controlsInPlace', checked)} disabled={disabled} /><Checkbox label="RPIC stop-work authority acknowledged" checked={formData.stopWorkAuthorityAcknowledged} onChange={(checked) => setField('stopWorkAuthorityAcknowledged', checked)} disabled={disabled} /></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Assessor name" value={formData.assessorName} onChange={(value) => setField('assessorName', value)} disabled={disabled} required /><TextInput label="Assessment date" type="date" value={formData.assessmentDate} onChange={(value) => setField('assessmentDate', value)} disabled={disabled} required /><TextInput label="RPIC Printed Name" value={formData.rpicPrintedName} onChange={(value) => setField('rpicPrintedName', value)} disabled={disabled} /><SelectInput label="Status" value={formData.status} options={statusOptions} onChange={(value) => setField('status', value)} disabled={disabled} /></div>
    </div>
  );
}

type FieldProps = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean };
function TextInput({ label, value, onChange, disabled, required, type = 'text' }: FieldProps & { type?: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{required ? <span className="text-red-600"> *</span> : null}<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /></label>;
}
function TextArea({ label, value, onChange, disabled }: FieldProps) {
  return <label className="block text-sm font-medium text-slate-700">{label}<textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:text-sm" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /></label>;
}
function SelectInput({ label, value, options, onChange, disabled, required }: FieldProps & { options: string[] }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{required ? <span className="text-red-600"> *</span> : null}<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{options.map((option) => <option key={option || 'blank'} value={option}>{option || 'Select one'}</option>)}</select></label>;
}
function RangeSelect({ label, value, helper, onChange, disabled }: { label: string; value: number; helper: string[]; onChange: (value: number) => void; disabled?: boolean }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:py-2 sm:text-sm" value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled}>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} - {helper[score - 1]}</option>)}</select></label>;
}
function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="flex items-start gap-3 text-sm font-medium text-slate-700"><input className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} /><span>{label}</span></label>;
}
