export type HazardCategory = 'Airspace' | 'Environmental' | 'Ground / Site' | 'Infrastructure' | 'Cleaning Operations';

export type PreliminaryHazard = {
  id: string;
  category: HazardCategory;
  hazard: string;
  mitigation: string;
};

export type SelectedPreliminaryHazard = PreliminaryHazard & {
  notes: string;
};

export const preliminaryHazardLibrary: PreliminaryHazard[] = [
  {
    id: 'controlled-airspace',
    category: 'Airspace',
    hazard: 'Controlled Airspace',
    mitigation:
      'Review airspace classification.\nDetermine whether LAANC or additional FAA authorization is required.\nConfirm authorization before flight.'
  },
  {
    id: 'laanc-authorization-required',
    category: 'Airspace',
    hazard: 'LAANC Authorization Required',
    mitigation: 'Submit LAANC request before operations.\nVerify approved altitude and operating area.\nBrief crew on authorization limits.'
  },
  {
    id: 'nearby-airport',
    category: 'Airspace',
    hazard: 'Nearby Airport',
    mitigation: 'Identify airport location and traffic patterns.\nMonitor for crewed aircraft.\nMaintain required standoff and communication procedures.'
  },
  {
    id: 'nearby-heliport',
    category: 'Airspace',
    hazard: 'Nearby Heliport',
    mitigation: 'Identify heliport location and approach paths.\nAssign visual observer when appropriate.\nPause operations for nearby helicopter activity.'
  },
  {
    id: 'temporary-flight-restriction',
    category: 'Airspace',
    hazard: 'Temporary Flight Restriction',
    mitigation: 'Check current TFRs before flight.\nConfirm operation is outside restricted areas.\nDo not launch until restrictions are resolved.'
  },
  {
    id: 'high-winds',
    category: 'Environmental',
    hazard: 'High Winds',
    mitigation: 'Check forecast and on-site wind conditions.\nOperate within aircraft limits.\nPause operations if gusts exceed safe limits.'
  },
  {
    id: 'extreme-heat',
    category: 'Environmental',
    hazard: 'Extreme Heat',
    mitigation: 'Monitor crew heat exposure.\nPlan hydration and rest breaks.\nWatch battery and equipment temperature limits.'
  },
  {
    id: 'rain-moisture',
    category: 'Environmental',
    hazard: 'Rain / Moisture',
    mitigation: 'Confirm aircraft and payload weather limitations.\nProtect electrical equipment.\nDelay operations during unsafe precipitation.'
  },
  {
    id: 'wildlife-activity',
    category: 'Environmental',
    hazard: 'Wildlife Activity',
    mitigation: 'Scan area for wildlife before launch.\nAvoid disturbing animals.\nPause operations if wildlife enters the work area.'
  },
  {
    id: 'dust-debris',
    category: 'Environmental',
    hazard: 'Dust / Debris',
    mitigation: 'Clear launch and landing zones.\nMaintain safe rotor wash area.\nUse eye protection where appropriate.'
  },
  {
    id: 'pedestrian-traffic',
    category: 'Ground / Site',
    hazard: 'Pedestrian Traffic',
    mitigation:
      'Establish controlled work area.\nUse cones, signage, or barriers where appropriate.\nAssign visual observer or ground safety monitor.'
  },
  {
    id: 'vehicle-traffic',
    category: 'Ground / Site',
    hazard: 'Vehicle Traffic',
    mitigation: 'Separate work area from vehicle paths.\nUse spotters or traffic controls where appropriate.\nPause flight when vehicles enter the operating area.'
  },
  {
    id: 'public-roadway-nearby',
    category: 'Ground / Site',
    hazard: 'Public Roadway Nearby',
    mitigation: 'Maintain safe standoff from roadway.\nPrevent equipment or runoff from entering traffic lanes.\nUse ground monitor near public access points.'
  },
  {
    id: 'uneven-terrain',
    category: 'Ground / Site',
    hazard: 'Uneven Terrain',
    mitigation: 'Identify safe walking paths and launch areas.\nBrief crew on footing hazards.\nUse appropriate footwear and lighting.'
  },
  {
    id: 'slip-trip-hazards',
    category: 'Ground / Site',
    hazard: 'Slip / Trip Hazards',
    mitigation: 'Keep hoses, cases, and tools organized.\nMark or remove trip hazards.\nMaintain clear crew access routes.'
  },
  {
    id: 'construction-activity',
    category: 'Ground / Site',
    hazard: 'Construction Activity',
    mitigation: 'Coordinate with site supervisor.\nAvoid active equipment zones.\nBrief crew on changing site conditions.'
  },
  {
    id: 'confined-work-area',
    category: 'Ground / Site',
    hazard: 'Confined Work Area',
    mitigation: 'Define operating boundaries.\nUse slow, deliberate maneuvers.\nAssign observer to monitor clearance and obstructions.'
  },
  {
    id: 'power-lines',
    category: 'Infrastructure',
    hazard: 'Power Lines',
    mitigation: 'Establish minimum standoff distance.\nBrief crew on power line location.\nMaintain visual awareness during flight.'
  },
  {
    id: 'trees-vegetation',
    category: 'Infrastructure',
    hazard: 'Trees / Vegetation',
    mitigation: 'Identify canopy and branch clearance.\nAvoid rotor contact with vegetation.\nAccount for wind movement near trees.'
  },
  {
    id: 'buildings-structures',
    category: 'Infrastructure',
    hazard: 'Buildings / Structures',
    mitigation: 'Map structure edges and obstacles.\nMaintain safe clearance.\nUse observer support around blind corners.'
  },
  {
    id: 'communication-towers',
    category: 'Infrastructure',
    hazard: 'Communication Towers',
    mitigation: 'Identify tower location, guy wires, and antennas.\nMaintain conservative standoff.\nMonitor for signal interference.'
  },
  {
    id: 'glass-facade-damage-exposure',
    category: 'Infrastructure',
    hazard: 'Glass / Facade Damage Exposure',
    mitigation: 'Inspect fragile or damaged areas before work.\nAvoid direct impact or excessive pressure.\nDocument pre-existing conditions.'
  },
  {
    id: 'water-runoff',
    category: 'Cleaning Operations',
    hazard: 'Water Runoff',
    mitigation: 'Identify runoff path.\nProtect storm drains where required.\nPrevent uncontrolled discharge.'
  },
  {
    id: 'overspray',
    category: 'Cleaning Operations',
    hazard: 'Overspray',
    mitigation: 'Identify overspray exposure areas.\nProtect people, vehicles, and sensitive surfaces.\nAdjust spray pattern or pause for wind.'
  },
  {
    id: 'chemical-use',
    category: 'Cleaning Operations',
    hazard: 'Chemical Use',
    mitigation: 'Review chemical label and SDS requirements.\nUse required PPE.\nPrevent incompatible mixing and uncontrolled release.'
  },
  {
    id: 'hose-tether-snag',
    category: 'Cleaning Operations',
    hazard: 'Hose / Tether Snag',
    mitigation: 'Assign ground crew for hose/tether management.\nKeep hose/tether clear of pedestrians, vehicles, and obstructions.'
  },
  {
    id: 'storm-drain-nearby',
    category: 'Cleaning Operations',
    hazard: 'Storm Drain Nearby',
    mitigation: 'Locate storm drains before work.\nUse drain protection where required.\nPrevent wash water or chemicals from entering drains.'
  },
  {
    id: 'sensitive-landscaping',
    category: 'Cleaning Operations',
    hazard: 'Sensitive Landscaping',
    mitigation: 'Identify sensitive plants and soil areas.\nLimit overspray and runoff exposure.\nUse barriers or alternate workflow as needed.'
  }
];

export const preliminaryHazardCategories = Array.from(
  new Set(preliminaryHazardLibrary.map((hazard) => hazard.category))
);

export function createCustomPreliminaryHazard(hazard: string): SelectedPreliminaryHazard {
  return {
    id: `custom-${Date.now()}`,
    category: 'Ground / Site',
    hazard,
    mitigation: 'Review site-specific hazard with crew.\nDefine controls before flight.\nDocument additional mitigation as needed.',
    notes: ''
  };
}

export function summarizeSelectedHazards(selectedHazards: SelectedPreliminaryHazard[]) {
  return {
    hazard: selectedHazards.map((entry) => `${entry.category}: ${entry.hazard}`).join('\n') || null,
    risk: selectedHazards.map((entry) => entry.notes.trim()).filter(Boolean).join('\n') || null,
    proposedMitigation:
      selectedHazards.map((entry) => `${entry.hazard}:\n${entry.mitigation.trim()}`).join('\n\n') || null
  };
}
