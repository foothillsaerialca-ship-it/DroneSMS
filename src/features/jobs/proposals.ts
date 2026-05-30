export type ProposalStatus = 'Draft' | 'Sent' | 'Under Review' | 'Awarded' | 'Declined' | 'Expired';

export const proposalStatuses: ProposalStatus[] = ['Draft', 'Sent', 'Under Review', 'Awarded', 'Declined', 'Expired'];

export const proposalServiceTypes = [
  'Exterior Building Cleaning',
  'Window Cleaning',
  'Solar Panel Cleaning',
  'Thermal Inspection',
  'Roof Inspection',
  'Facade Inspection',
  'Mapping',
  'Construction Progress Monitoring',
  'Other'
];

export const hazardLibrary = [
  {
    category: 'Airspace',
    hazards: ['Controlled Airspace', 'LAANC Authorization Required', 'Airport Nearby', 'Helipad Nearby']
  },
  {
    category: 'Environmental',
    hazards: ['High Winds', 'Extreme Heat', 'Rain Potential', 'Wildlife Activity']
  },
  {
    category: 'Site Hazards',
    hazards: ['Power Lines', 'Public Pedestrian Traffic', 'Vehicle Traffic', 'Roof Access Required', 'Slips / Trips / Falls', 'Uneven Terrain', 'Water Hazard']
  },
  {
    category: 'Cleaning Hazards',
    hazards: ['Runoff Management Required', 'Chemical Use', 'Sensitive Landscaping', 'Storm Drain Nearby']
  },
  {
    category: 'Building Hazards',
    hazards: ['Glass Breakage Risk', 'Falling Object Hazard', 'Overhead Work Area']
  }
];

export const standardMitigations: Record<string, string[]> = {
  'Controlled Airspace': ['Review airspace before proposal acceptance', 'Confirm authorization pathway', 'Brief RPIC before scheduling'],
  'LAANC Authorization Required': ['Submit LAANC request before flight', 'Verify approval window', 'Keep authorization with job documentation'],
  'Airport Nearby': ['Review sectional and facility maps', 'Establish conservative operating area', 'Brief crew on traffic awareness'],
  'Helipad Nearby': ['Identify helipad activity patterns', 'Maintain visual scan for low-altitude traffic', 'Pause work for medical or emergency activity'],
  'High Winds': ['Monitor forecast and onsite wind', 'Set go/no-go limits', 'Reschedule if limits are exceeded'],
  'Extreme Heat': ['Schedule breaks and hydration', 'Monitor heat index', 'Stop work for heat illness symptoms'],
  'Rain Potential': ['Monitor forecast and radar', 'Protect electrical equipment', 'Delay operations during precipitation'],
  'Wildlife Activity': ['Inspect site for nesting or aggressive wildlife', 'Maintain distance from wildlife', 'Pause work if wildlife is disturbed'],
  'Power Lines': ['Establish exclusion zone', 'Maintain FAA separation requirements', 'Brief crew'],
  'Public Pedestrian Traffic': ['Establish work perimeter', 'Use cones/signage', 'Assign visual observer'],
  'Vehicle Traffic': ['Set traffic-side work boundary', 'Use cones/signage', 'Assign spotter or visual observer'],
  'Roof Access Required': ['Confirm safe roof access method', 'Use fall protection where required', 'Limit roof access to authorized crew'],
  'Slips / Trips / Falls': ['Keep hoses and equipment organized', 'Mark trip hazards', 'Use appropriate footwear'],
  'Uneven Terrain': ['Walk the site before setup', 'Mark uneven areas', 'Use stable launch and recovery zones'],
  'Water Hazard': ['Establish water setback', 'Prepare recovery plan', 'Keep electrical equipment away from water'],
  'Runoff Management Required': ['Plan containment before work', 'Use recovery or diversion controls', 'Document runoff controls'],
  'Chemical Use': ['Review SDS before work', 'Use required PPE', 'Prevent overspray and incompatible mixing'],
  'Sensitive Landscaping': ['Protect landscaping', 'Control overspray/runoff', 'Coordinate sensitive areas with client'],
  'Storm Drain Nearby': ['Protect drains', 'Prevent runoff discharge', 'Follow local requirements'],
  'Glass Breakage Risk': ['Use appropriate pressure and standoff distance', 'Inspect existing glass damage', 'Keep people clear below work area'],
  'Falling Object Hazard': ['Establish drop zone', 'Secure tools and payloads', 'Keep public and crew clear below'],
  'Overhead Work Area': ['Barricade work area below', 'Brief crew on overhead activity', 'Use visual observer for perimeter control']
};

export function getMitigationsForHazards(hazards: string[]) {
  return Array.from(new Set(hazards.flatMap((hazard) => standardMitigations[hazard] ?? [])));
}

export function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return 'Not provided';
  const [datePart] = dateValue.split('T');
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return dateValue;
  return `${month}/${day}/${year}`;
}
