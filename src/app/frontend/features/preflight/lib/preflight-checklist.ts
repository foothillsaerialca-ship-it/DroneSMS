export const checklistSections = [
  { title: 'Aircraft & Equipment', items: [
    { key: 'aircraft_selected', label: 'Aircraft selected' },
    { key: 'battery_condition_checked', label: 'Battery condition checked' },
    { key: 'propellers_inspected', label: 'Propellers inspected' },
    { key: 'firmware_app_status_checked', label: 'Firmware/app status checked' },
    { key: 'gps_signal_confirmed', label: 'GPS/signal confirmed' },
    { key: 'home_point_verified', label: 'Home point verified' },
    { key: 'storage_media_checked', label: 'Storage/media checked' },
  ]},
  { title: 'Environment & Airspace', items: [
    { key: 'weather_verified', label: 'Weather verified' },
    { key: 'wind_conditions_acceptable', label: 'Wind conditions acceptable' },
    { key: 'airspace_reviewed', label: 'Airspace reviewed' },
    { key: 'laanc_confirmed_if_required', label: 'LAANC confirmed if required' },
    { key: 'notam_tfr_checked', label: 'NOTAM/TFR checked' },
  ]},
  { title: 'Crew & Safety', items: [
    { key: 'visual_observer_assigned_if_needed', label: 'Visual observer assigned if needed' },
    { key: 'emergency_procedures_reviewed', label: 'Emergency procedures reviewed' },
    { key: 'crew_communications_confirmed', label: 'Crew communications confirmed' },
    { key: 'final_rpic_approval', label: 'Final RPIC approval' },
  ]},
] as const;

export type ChecklistKey = (typeof checklistSections)[number]['items'][number]['key'];
export type ChecklistItem = { key: ChecklistKey; label: string };
export const checklistItems: ChecklistItem[] = checklistSections.reduce<ChecklistItem[]>(
  (items, section) => items.concat(section.items as readonly ChecklistItem[]),
  [],
);
export type ChecklistItemState = 'confirmed' | 'not_confirmed' | 'not_applicable';
export type ChecklistStates = Record<ChecklistKey, ChecklistItemState | null>;

export const emptyChecklistStates = Object.fromEntries(checklistItems.map(({ key }) => [key, null])) as ChecklistStates;

export function readChecklistStates(
  stored: unknown,
  legacy: Partial<Record<ChecklistKey, boolean | null | undefined>>,
): ChecklistStates {
  const values = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
  return Object.fromEntries(checklistItems.map(({ key }) => {
    const value = values[key];
    if (value === 'confirmed' || value === 'not_confirmed' || value === 'not_applicable') return [key, value];
    // Legacy true is positive evidence. Legacy false only meant "unchecked", so it stays unresolved.
    return [key, legacy[key] === true ? 'confirmed' : null];
  })) as ChecklistStates;
}

export function getCompletionProblems(states: ChecklistStates) {
  const unresolved = checklistItems.filter(({ key }) => states[key] === null).map(({ label }) => label);
  const notConfirmed = checklistItems.filter(({ key }) => states[key] === 'not_confirmed').map(({ label }) => label);
  const finalApprovalMissing = states.final_rpic_approval !== 'confirmed';
  return { unresolved, notConfirmed, finalApprovalMissing };
}

export function getCompletionError(states: ChecklistStates) {
  const { unresolved, notConfirmed, finalApprovalMissing } = getCompletionProblems(states);
  const messages: string[] = [];
  if (unresolved.length) messages.push(`Select a state for: ${unresolved.join(', ')}`);
  if (notConfirmed.length) messages.push(`Resolve checks marked Not Confirmed: ${notConfirmed.join(', ')}`);
  if (finalApprovalMissing && !unresolved.includes('Final RPIC approval') && !notConfirmed.includes('Final RPIC approval')) messages.push('Final RPIC approval must be Confirmed');
  return messages.length ? `${messages.join('. ')}.` : null;
}

export function formatChecklistState(value: unknown, legacyValue?: boolean | null) {
  if (value === 'confirmed') return 'Confirmed';
  if (value === 'not_confirmed') return 'Not Confirmed';
  if (value === 'not_applicable') return 'Not Applicable';
  return legacyValue === true ? 'Confirmed' : 'Unresolved';
}

export function buildPreflightPacketRows(preflight: Record<string, unknown>) {
  const stored = preflight.checklist_states;
  const states = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
  return checklistItems.map(({ key, label }) => [label, formatChecklistState(states[key], preflight[key] === true)]);
}
