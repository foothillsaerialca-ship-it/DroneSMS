/**
 * File purpose: Defines management-of-change options, types, formatting, and workflow decision helpers.
 * Fallback/error behavior: Optional identities and action data receive stable display and approval defaults.
 * Known limitation: Server-side MOC state transitions and authorization are enforced by Supabase functions and policies.
 */
export const mocSources = ['Equipment', 'Safety Event', 'Manual'] as const;
export const mocChangeTypes = ['New operational capability', 'Equipment or configuration change', 'Change resulting from a safety event', 'Organizational change', 'Other safety-relevant change'] as const;
export const mocStatuses = ['Draft', 'Under Review', 'Actions Required', 'Approved for Operational Use', 'Monitoring', 'Complete', 'Cancelled'] as const;
export const pendingMocStatuses = new Set(['Draft', 'Under Review', 'Actions Required']);

export type MocSource = (typeof mocSources)[number];
export type MocStatus = (typeof mocStatuses)[number];

export type MocAction = { required_before_operational_use: boolean; status: string };
export type EventReviewAnswers = { existingControl: string; controlResult: string; newHazardOrControl: string; changeNeeded: string };
export type UserIdentity = { full_name?: string | null; email?: string | null } | null | undefined;

export function formatMocId(number: number) { return `MOC-${String(number).padStart(3, '0')}`; }
export function formatMocName(number: number, title: string) { return `${formatMocId(number)} — ${title}`; }

export function conciseEquipmentTitle(name: string, make?: string | null, model?: string | null) {
  const modelName = [make, model].filter(Boolean).join(' ').trim();
  return `Introduce ${modelName || name}`.slice(0, 120);
}

export function canApproveMoc(actions: MocAction[]) {
  return !actions.some((action) => action.required_before_operational_use && !['Complete', 'Cancelled'].includes(action.status));
}

export function eventReviewRoute(answers: EventReviewAnswers) {
  if (answers.changeNeeded === 'Further investigation required' || answers.existingControl === 'Unsure') return 'investigate';
  if (answers.newHazardOrControl === 'Yes') return 'candidate-hazard';
  if (['Equipment or configuration change', 'Organizational or capability change'].includes(answers.changeNeeded)) return 'offer-moc';
  if (['It was used but did not work as intended', 'It worked, but was not sufficient', 'Conditions had changed beyond what it addressed'].includes(answers.controlResult)) return 'offer-moc';
  if (answers.controlResult === 'It was not used or followed' || answers.changeNeeded === 'Training or familiarization') return 'corrective-action';
  return 'no-organizational-change';
}

export function csvCell(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

export function displayUserIdentity(identity: UserIdentity, fallbackEmail?: string | null) {
  const fullName = identity?.full_name?.trim();
  if (fullName) return fullName;
  const email = identity?.email?.trim() || fallbackEmail?.trim();
  return email || 'Unknown user';
}
