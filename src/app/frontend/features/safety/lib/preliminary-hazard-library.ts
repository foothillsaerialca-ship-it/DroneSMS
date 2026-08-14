export const serviceTypes = [
  'Cleaning Operations',
  'Thermal Inspection',
  'Roof Inspection',
  'Agricultural',
  'Mapping / Surveying',
  'Construction Progress',
  'Real Estate / Property Media',
  'Custom Operation'
] as const;

export type ServiceType = (typeof serviceTypes)[number];
export type HazardSource = 'library' | 'custom';

export type HazardLibraryEntry = {
  id: string;
  hazard_name: string;
  category: string;
  default_mitigation: string;
  service_types: string[];
  is_universal: boolean;
  is_system_hazard: boolean;
};

export type SelectedPreliminaryHazard = {
  id: string;
  hazard_name: string;
  category: string;
  mitigation: string;
  source: HazardSource;
  notes?: string;
  hazard?: string;
};

type LegacySelectedHazard = {
  id?: string;
  hazard?: string;
  hazard_name?: string;
  category?: string;
  mitigation?: string;
  default_mitigation?: string;
  source?: HazardSource;
  notes?: string;
};

export const fallbackHazardLibrary: HazardLibraryEntry[] = [
  { id: 'airspace-restrictions', hazard_name: 'Airspace Restrictions', category: 'Airspace', default_mitigation: 'Review current airspace, TFRs, NOTAMs, and site restrictions before flight. Confirm the mission remains inside approved operating limits before launch.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'weather-conditions', hazard_name: 'Weather Conditions', category: 'Environmental', default_mitigation: 'Review forecast and on-site weather before operations. Delay or stop work when precipitation, visibility, temperature, or other weather conditions exceed aircraft or crew limits.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'wind-conditions', hazard_name: 'Wind Conditions', category: 'Environmental', default_mitigation: 'Check forecast and on-site wind at the operating area. Operate within aircraft limits and pause operations if gusts or direction changes reduce control margins.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'wildlife-activity', hazard_name: 'Wildlife Activity', category: 'Environmental', default_mitigation: 'Scan the area for wildlife before launch. Avoid disturbing animals and pause operations if wildlife enters the work area.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'pedestrian-traffic', hazard_name: 'Pedestrian Traffic', category: 'Ground / Site', default_mitigation: 'Establish a controlled work area with cones, signage, barriers, or a ground monitor where needed. Pause operations if pedestrians enter the operating area.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'vehicle-traffic', hazard_name: 'Vehicle Traffic', category: 'Ground / Site', default_mitigation: 'Separate the operation from vehicle paths. Use spotters or traffic controls where appropriate and pause flight when vehicles enter the operating area.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'power-lines', hazard_name: 'Power Lines', category: 'Infrastructure', default_mitigation: 'Identify and brief power line locations before launch. Maintain conservative standoff distance and use visual observer support when operating near utilities.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'loss-of-link', hazard_name: 'Loss of Link', category: 'Aircraft / Systems', default_mitigation: 'Confirm control link quality, return-to-home settings, lost-link behavior, and emergency landing areas before flight. Brief crew on lost-link response.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'battery-failure', hazard_name: 'Battery Failure', category: 'Aircraft / Systems', default_mitigation: 'Inspect batteries before use, verify charge state and health, and set conservative return and landing thresholds. Keep spare batteries managed and protected.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'crew-communication-failure', hazard_name: 'Crew Communication Failure', category: 'Crew Coordination', default_mitigation: 'Brief communication roles, hand signals, radio channels, and lost-communication procedures before work begins. Stop operations if crew coordination is lost.', service_types: [], is_universal: true, is_system_hazard: true },
  { id: 'water-runoff', hazard_name: 'Water Runoff', category: 'Cleaning Operations', default_mitigation: 'Identify runoff paths before work. Control or capture wash water where required and prevent uncontrolled discharge from the operating area.', service_types: ['Cleaning Operations'], is_universal: false, is_system_hazard: true },
  { id: 'storm-drain-nearby', hazard_name: 'Storm Drain Nearby', category: 'Cleaning Operations', default_mitigation: 'Locate storm drains before work. Use drain protection where required and prevent wash water or chemicals from entering drains.', service_types: ['Cleaning Operations'], is_universal: false, is_system_hazard: true },
  { id: 'overspray', hazard_name: 'Overspray', category: 'Cleaning Operations', default_mitigation: 'Identify overspray exposure areas. Protect people, vehicles, sensitive surfaces, and adjacent properties. Adjust spray pattern or pause for wind.', service_types: ['Cleaning Operations'], is_universal: false, is_system_hazard: true },
  { id: 'hose-tether-snag', hazard_name: 'Hose / Tether Snag', category: 'Cleaning Operations', default_mitigation: 'Assign ground crew for hose or tether management. Keep lines clear of pedestrians, vehicles, vegetation, structures, and aircraft flight paths.', service_types: ['Cleaning Operations'], is_universal: false, is_system_hazard: true },
  { id: 'sensitive-landscaping', hazard_name: 'Sensitive Landscaping', category: 'Cleaning Operations', default_mitigation: 'Identify sensitive plants, soil areas, and irrigation components. Limit overspray and runoff exposure with barriers or alternate workflow as needed.', service_types: ['Cleaning Operations'], is_universal: false, is_system_hazard: true },
  { id: 'building-occupants', hazard_name: 'Building Occupants', category: 'Cleaning Operations', default_mitigation: 'Coordinate with the client before work. Keep occupants clear of affected doors, windows, balconies, and work zones during cleaning operations.', service_types: ['Cleaning Operations'], is_universal: false, is_system_hazard: true },
  { id: 'public-roadway-exposure', hazard_name: 'Public Roadway Exposure', category: 'Ground / Site', default_mitigation: 'Maintain safe standoff from roadways. Prevent equipment, aircraft, debris, or runoff from entering traffic lanes and use a ground monitor near public access points.', service_types: ['Cleaning Operations', 'Roof Inspection', 'Agricultural', 'Mapping / Surveying', 'Real Estate / Property Media'], is_universal: false, is_system_hazard: true },
  { id: 'roof-access', hazard_name: 'Roof Access', category: 'Working at Height', default_mitigation: 'Coordinate safe roof access with the client or site representative. Keep drone crew away from unprotected edges unless qualified controls are in place.', service_types: ['Thermal Inspection', 'Roof Inspection'], is_universal: false, is_system_hazard: true },
  { id: 'early-morning-low-light-operations', hazard_name: 'Early Morning / Low Light Operations', category: 'Environmental', default_mitigation: 'Confirm lighting is sufficient for safe setup, visual line of sight, obstacle awareness, and crew movement. Use supplemental lighting where appropriate.', service_types: ['Thermal Inspection'], is_universal: false, is_system_hazard: true },
  { id: 'heat-loading-on-aircraft', hazard_name: 'Heat Loading on Aircraft', category: 'Aircraft / Systems', default_mitigation: 'Monitor aircraft, payload, and battery temperature limits. Plan rest periods and avoid extended operations when thermal loading reduces safe margins.', service_types: ['Thermal Inspection'], is_universal: false, is_system_hazard: true },
  { id: 'visual-line-of-sight-limitations', hazard_name: 'Visual Line of Sight Limitations', category: 'Flight Operations', default_mitigation: 'Plan flight paths that preserve unaided visual line of sight. Use visual observers, reposition launch points, or reduce mission scope when needed.', service_types: ['Thermal Inspection', 'Mapping / Surveying', 'Real Estate / Property Media'], is_universal: false, is_system_hazard: true },
  { id: 'controlled-airspace', hazard_name: 'Controlled Airspace', category: 'Airspace', default_mitigation: 'Review airspace classification and determine whether LAANC or additional authorization is required. Confirm authorization before flight and brief limits.', service_types: ['Thermal Inspection', 'Agricultural', 'Mapping / Surveying', 'Construction Progress'], is_universal: false, is_system_hazard: true },
  { id: 'ladder-use', hazard_name: 'Ladder Use', category: 'Working at Height', default_mitigation: 'Use ladders only when necessary and in accordance with site safety practices. Maintain three points of contact and keep drone tasks separate from ladder movement.', service_types: ['Roof Inspection'], is_universal: false, is_system_hazard: true },
  { id: 'fall-hazard', hazard_name: 'Fall Hazard', category: 'Working at Height', default_mitigation: 'Identify fall exposures before work. Maintain safe distance from roof edges and coordinate with qualified personnel for any work requiring fall protection.', service_types: ['Roof Inspection'], is_universal: false, is_system_hazard: true },
  { id: 'fragile-roofing-materials', hazard_name: 'Fragile Roofing Materials', category: 'Working at Height', default_mitigation: 'Identify fragile roof materials before access or close inspection. Avoid contact and document areas that require special handling or client controls.', service_types: ['Roof Inspection'], is_universal: false, is_system_hazard: true },
  { id: 'heat-stress', hazard_name: 'Heat Stress', category: 'Environmental', default_mitigation: 'Plan hydration, shade, and rest breaks. Monitor crew for heat stress symptoms and stop work when conditions become unsafe.', service_types: ['Roof Inspection'], is_universal: false, is_system_hazard: true },
  { id: 'chemical-exposure', hazard_name: 'Chemical Exposure', category: 'Agricultural', default_mitigation: 'Review chemical application history and SDS information when available. Use required PPE and avoid contact with treated areas until safe entry is confirmed.', service_types: ['Agricultural'], is_universal: false, is_system_hazard: true },
  { id: 'livestock-activity', hazard_name: 'Livestock Activity', category: 'Agricultural', default_mitigation: 'Coordinate with the landowner regarding livestock location and behavior. Maintain distance and pause operations if animals become stressed or enter the work area.', service_types: ['Agricultural'], is_universal: false, is_system_hazard: true },
  { id: 'wind-drift', hazard_name: 'Wind Drift', category: 'Agricultural', default_mitigation: 'Evaluate wind direction and drift potential before flight. Adjust operating area or delay work when drift could affect people, property, crops, or livestock.', service_types: ['Agricultural'], is_universal: false, is_system_hazard: true },
  { id: 'irrigation-equipment', hazard_name: 'Irrigation Equipment', category: 'Agricultural', default_mitigation: 'Identify pivots, pumps, risers, hoses, and lines before launch. Maintain clearance and coordinate with the landowner before operating near active equipment.', service_types: ['Agricultural'], is_universal: false, is_system_hazard: true },
  { id: 'remote-operating-area', hazard_name: 'Remote Operating Area', category: 'Agricultural', default_mitigation: 'Confirm communications, access, emergency response location, and battery logistics for remote sites. Brief crew on check-in and emergency procedures.', service_types: ['Agricultural'], is_universal: false, is_system_hazard: true },
  { id: 'extended-flight-operations', hazard_name: 'Extended Flight Operations', category: 'Flight Operations', default_mitigation: 'Plan battery rotations, crew breaks, data capture intervals, and emergency landing options. Monitor fatigue and aircraft status throughout the mission.', service_types: ['Mapping / Surveying'], is_universal: false, is_system_hazard: true },
  { id: 'multiple-takeoff-locations', hazard_name: 'Multiple Takeoff Locations', category: 'Flight Operations', default_mitigation: 'Assess each launch and recovery area before use. Re-brief hazards, airspace, emergency landing areas, and crew positions when relocating.', service_types: ['Mapping / Surveying'], is_universal: false, is_system_hazard: true },
  { id: 'battery-management', hazard_name: 'Battery Management', category: 'Aircraft / Systems', default_mitigation: 'Track battery assignment, charge state, temperature, and cycle condition. Use conservative reserves for mapping legs and recovery to the launch area.', service_types: ['Mapping / Surveying'], is_universal: false, is_system_hazard: true },
  { id: 'public-access-areas', hazard_name: 'Public Access Areas', category: 'Ground / Site', default_mitigation: 'Identify trails, parks, sidewalks, and other public access points. Use signs, cones, observers, or alternate timing to keep people clear of operations.', service_types: ['Mapping / Surveying'], is_universal: false, is_system_hazard: true },
  { id: 'terrain-obstacles', hazard_name: 'Terrain Obstacles', category: 'Ground / Site', default_mitigation: 'Review terrain, trees, slopes, towers, and other obstacles before flight. Set safe altitudes and update flight paths as terrain changes.', service_types: ['Mapping / Surveying'], is_universal: false, is_system_hazard: true },
  { id: 'cranes', hazard_name: 'Cranes', category: 'Construction Progress', default_mitigation: 'Coordinate with site supervision regarding crane location and movement. Maintain standoff distance and stop operations during conflicting crane activity.', service_types: ['Construction Progress'], is_universal: false, is_system_hazard: true },
  { id: 'suspended-loads', hazard_name: 'Suspended Loads', category: 'Construction Progress', default_mitigation: 'Avoid flight and crew activity near suspended loads. Coordinate timing with site supervision and pause operations when lifting activity is present.', service_types: ['Construction Progress'], is_universal: false, is_system_hazard: true },
  { id: 'active-equipment', hazard_name: 'Active Equipment', category: 'Construction Progress', default_mitigation: 'Identify active equipment routes and exclusion zones. Maintain separation from moving machinery and use a site escort or observer when needed.', service_types: ['Construction Progress'], is_universal: false, is_system_hazard: true },
  { id: 'multiple-contractors', hazard_name: 'Multiple Contractors', category: 'Construction Progress', default_mitigation: 'Coordinate with the site supervisor and communicate planned drone activity to affected contractors. Reassess hazards as work crews change.', service_types: ['Construction Progress'], is_universal: false, is_system_hazard: true },
  { id: 'dust', hazard_name: 'Dust', category: 'Construction Progress', default_mitigation: 'Monitor dust that could affect visibility, aircraft systems, or crew exposure. Delay or reposition operations when dust reduces safe margins.', service_types: ['Construction Progress'], is_universal: false, is_system_hazard: true },
  { id: 'dynamic-work-area', hazard_name: 'Dynamic Work Area', category: 'Construction Progress', default_mitigation: 'Treat the site as changing throughout the mission. Reassess traffic, equipment, personnel, and obstacles before each flight segment.', service_types: ['Construction Progress'], is_universal: false, is_system_hazard: true },
  { id: 'privacy-concerns', hazard_name: 'Privacy Concerns', category: 'Real Estate / Property Media', default_mitigation: 'Review camera angles, neighboring properties, and client expectations before flight. Avoid unnecessary capture of private areas and follow applicable privacy requirements.', service_types: ['Real Estate / Property Media'], is_universal: false, is_system_hazard: true }
];

export const preliminaryHazardLibrary = fallbackHazardLibrary;
export const preliminaryHazardCategories = Array.from(new Set(fallbackHazardLibrary.map((hazard) => hazard.category)));

/**
 * Keep the service mappings for built-in hazards authoritative in the client.
 *
 * Some existing databases contain system rows whose `service_types` or
 * `is_universal` values were broadened by an earlier seed/refactor.  Trusting
 * those values makes every system hazard appear for every service.  Descriptive
 * fields may still be maintained in the database, but the checked-in mapping is
 * the compatibility baseline for built-in hazards.  Organization-defined rows
 * continue to use their database mappings unchanged.
 */
export function restoreSystemHazardMappings(library: HazardLibraryEntry[]) {
  const canonicalByName = new Map(
    fallbackHazardLibrary.map((hazard) => [hazard.hazard_name.trim().toLowerCase(), hazard])
  );

  return library.map((hazard) => {
    const canonical = canonicalByName.get(hazard.hazard_name.trim().toLowerCase());
    if (!canonical || !hazard.is_system_hazard) return hazard;

    return {
      ...hazard,
      service_types: [...canonical.service_types],
      is_universal: canonical.is_universal
    };
  });
}

export function getSuggestedHazards(library: HazardLibraryEntry[], serviceType: string) {
  if (serviceType === 'Custom Operation') return [];

  return library.filter((hazard) => hazard.is_universal || hazard.service_types.includes(serviceType));
}

export function searchHazards(library: HazardLibraryEntry[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return library.filter((hazard) =>
    [hazard.hazard_name, hazard.category, hazard.default_mitigation].some((field) => field.toLowerCase().includes(normalizedQuery))
  );
}

export function selectLibraryHazard(hazard: HazardLibraryEntry): SelectedPreliminaryHazard {
  return {
    id: hazard.id,
    hazard_name: hazard.hazard_name,
    category: hazard.category,
    mitigation: hazard.default_mitigation,
    source: 'library'
  };
}

export function createCustomPreliminaryHazard(hazardName: string, category: string, mitigation: string): SelectedPreliminaryHazard {
  return {
    id: `custom-${Date.now()}`,
    hazard_name: hazardName,
    category,
    mitigation,
    source: 'custom'
  };
}

export function normalizeSelectedHazard(hazard: LegacySelectedHazard): SelectedPreliminaryHazard | null {
  const hazardName = (hazard.hazard_name ?? hazard.hazard ?? '').trim();
  if (!hazardName) return null;

  return {
    id: hazard.id ?? `custom-${hazardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    hazard_name: hazardName,
    category: hazard.category ?? 'Uncategorized',
    mitigation: hazard.mitigation ?? hazard.default_mitigation ?? '',
    source: hazard.source ?? (hazard.id?.startsWith('custom-') ? 'custom' : 'library'),
    notes: hazard.notes
  };
}

export function normalizeSelectedHazards(hazards: unknown): SelectedPreliminaryHazard[] {
  if (!Array.isArray(hazards)) return [];
  return hazards.map((hazard) => normalizeSelectedHazard(hazard as LegacySelectedHazard)).filter((hazard): hazard is SelectedPreliminaryHazard => Boolean(hazard));
}

export function getSelectedHazardName(hazard: SelectedPreliminaryHazard) {
  return hazard.hazard_name || hazard.hazard || 'Unnamed hazard';
}

export function summarizeSelectedHazards(selectedHazards: SelectedPreliminaryHazard[]) {
  return {
    hazard: selectedHazards.map((entry) => `${entry.category}: ${getSelectedHazardName(entry)}`).join('\n') || null,
    proposedMitigation:
      selectedHazards.map((entry) => `${getSelectedHazardName(entry)}:\n${entry.mitigation.trim()}`).join('\n\n') || null
  };
}
