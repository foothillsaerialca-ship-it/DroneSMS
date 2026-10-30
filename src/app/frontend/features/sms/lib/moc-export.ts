/**
 * File purpose: Builds human-readable Management of Change Excel workbooks and resolves stored user/personnel IDs to names.
 * Fallback/error behavior: Unresolvable identities use safe labels (organization owner, the exporting user's email, or "Unknown user") rather than internal IDs.
 * Known limitation: Hazard links are not exported because DroneSMS does not yet record them; the data loader lives in moc-export-data.ts.
 */
import { buildXlsx, xlsxDate, xlsxDateTime, type XlsxCell, type XlsxSheet } from '../../../lib/xlsx-writer.ts';
import { formatMocId, mocImpactQuestions } from './management-of-change.ts';

export type MocExportPersonnel = { id: string; user_id: string | null; full_name: string | null; role: string | null; email: string | null; status: string | null };
export type MocExportAction = { id: string; moc_id: string; description: string; owner_id: string | null; due_date: string | null; required_before_operational_use: boolean; status: string; completion_date: string | null; notes_or_evidence: string | null; created_at: string };
export type MocExportActivity = { id: string; moc_id: string; action: string; details: Record<string, unknown> | null; performed_by: string | null; created_at: string };
export type MocExportRecord = {
  id: string; moc_number: number; title: string; description: string | null; source: string; change_type: string; status: string;
  initiated_by: string; impact_review: Record<string, string> | null;
  external_documents_reviewed: boolean | null; external_document_notes: string | null; external_document_reference: string | null; people_informed: string | null;
  safety_review_decision: string | null; safety_reviewer_id: string | null; safety_reviewed_at: string | null; safety_review_comments: string | null;
  operational_accepted_by: string | null; operational_acceptance_role: string | null; operational_accepted_at: string | null;
  follow_up_required: boolean | null; follow_up_date: string | null; follow_up_responsible_id: string | null; follow_up_unnecessary_reason: string | null;
  change_worked_as_intended: string | null; controls_effective: string | null; unexpected_hazards_or_events: string | null; additional_corrective_actions: string | null; final_closure_decision: string | null;
  approved_at: string | null; completed_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string;
  operational_capabilities: { name: string; status: string } | null;
  equipment: { name: string; make: string | null; model: string | null } | null;
  job_safety_events: { category: string; description: string | null; outcome: string | null; immediate_actions_taken: string | null; created_at: string } | null;
};
export type MocExportData = {
  organizationName: string;
  organizationOwnerUserId: string | null;
  safetyManagerPersonnelId: string | null;
  currentUser: { id: string; email: string | null } | null;
  personnel: MocExportPersonnel[];
  mocs: MocExportRecord[];
  actions: MocExportAction[];
  activity: MocExportActivity[];
};
export type MocExportScope = { kind: 'single' } | { kind: 'all' } | { kind: 'filtered'; description: string };

export type PersonIdentity = { name: string; role: string | null; email: string | null };

/** Resolves auth user IDs and personnel IDs to people without ever returning the raw ID. */
export function buildMocIdentityDirectory(input: Pick<MocExportData, 'personnel' | 'organizationOwnerUserId' | 'safetyManagerPersonnelId' | 'currentUser'>) {
  const byPersonnelId = new Map<string, MocExportPersonnel>();
  const byUserId = new Map<string, MocExportPersonnel>();
  // Prefer active, then named, personnel records; ID order keeps the choice stable when duplicates exist.
  const ranked = [...input.personnel].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  for (const person of ranked) {
    byPersonnelId.set(person.id, person);
    if (person.user_id && !byUserId.has(person.user_id)) byUserId.set(person.user_id, person);
  }
  function fromPersonnel(person: MocExportPersonnel): PersonIdentity {
    const role = person.id === input.safetyManagerPersonnelId ? 'Safety Manager' : person.role?.trim() || null;
    const email = person.email?.trim() || null;
    return { name: person.full_name?.trim() || email || 'Unnamed personnel record', role, email };
  }
  function user(userId: string | null | undefined): PersonIdentity | null {
    if (!userId) return null;
    const person = byUserId.get(userId);
    if (person) return fromPersonnel(person);
    const ownEmail = input.currentUser?.id === userId ? input.currentUser.email?.trim() || null : null;
    if (userId === input.organizationOwnerUserId) return { name: ownEmail || 'Organization owner', role: 'Organization owner', email: ownEmail };
    return { name: ownEmail || 'Unknown user', role: null, email: ownEmail };
  }
  function personnel(personnelId: string | null | undefined): PersonIdentity | null {
    if (!personnelId) return null;
    const person = byPersonnelId.get(personnelId);
    return person ? fromPersonnel(person) : { name: 'Unknown personnel record', role: null, email: null };
  }
  return { user, personnel };
}
export type MocIdentityDirectory = ReturnType<typeof buildMocIdentityDirectory>;

function rank(person: MocExportPersonnel) { return (person.status === 'Active' ? 0 : 2) + (person.full_name?.trim() ? 0 : 1); }

/** Formats a person for a single spreadsheet cell, e.g. "Ethan Cole (Safety Manager, ethan.cole@example.com)". */
export function formatPersonCell(identity: PersonIdentity | null) {
  if (!identity) return '';
  const details = [identity.role !== identity.name ? identity.role : null, identity.email !== identity.name ? identity.email : null].filter(Boolean);
  return details.length ? `${identity.name} (${details.join(', ')})` : identity.name;
}

function yesNo(value: boolean | null | undefined) { return value === null || value === undefined ? '' : value ? 'Yes' : 'No'; }

function equipmentLabel(equipment: MocExportRecord['equipment']) {
  if (!equipment) return '';
  const model = [equipment.make, equipment.model].filter((part) => part?.trim()).join(' ');
  return model && !equipment.name.includes(model) ? `${equipment.name} (${model})` : equipment.name;
}

const INTERNAL_DETAIL_KEYS = new Set(['id', 'moc_id', 'organization_id', 'created_by', 'created_at', 'updated_at']);

function detailLabel(key: string) { return key.replace(/_id$/, '').replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase()); }

function detailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/**
 * Describes an activity entry's recorded details in plain language, keeping every human-meaningful field the audit trigger stored.
 * Personnel IDs resolve to names; other internal IDs and bookkeeping timestamps are left out because the row already records when and on which MOC.
 */
export function describeMocActivity(entry: Pick<MocExportActivity, 'action' | 'details'>, people?: MocIdentityDirectory) {
  const details = entry.details ?? {};
  const text = (key: string) => detailValue(details[key]);
  const join = (parts: string[]) => parts.filter(Boolean).join(' · ');
  if ('from' in details || 'to' in details) return `${text('from') || '(blank)'} → ${text('to') || '(blank)'}`;
  if (entry.action.startsWith('Action')) {
    const owner = typeof details.owner_id === 'string' ? formatPersonCell(people?.personnel(details.owner_id) ?? null) : 'owner_id' in details ? 'Unassigned' : '';
    return join([
      text('description'),
      owner ? `Owner: ${owner}` : '',
      text('due_date') ? `Due: ${text('due_date')}` : '',
      details.required_before_operational_use === true ? 'Required before operational use' : details.required_before_operational_use === false ? 'Not required before operational use' : '',
      text('status') ? `Status: ${text('status')}` : '',
      text('completion_date') ? `Completed: ${text('completion_date')}` : '',
      text('notes_or_evidence') ? `Notes: ${text('notes_or_evidence')}` : '',
    ]);
  }
  if (entry.action === 'Administrative correction') {
    const fields = details.fields && typeof details.fields === 'object' ? Object.entries(details.fields as Record<string, unknown>) : [];
    return join([text('reason') ? `Reason: ${text('reason')}` : '', ...fields.map(([key, value]) => `${detailLabel(key)} set to: ${detailValue(value) || '(blank)'}`)]);
  }
  // Hazard-link changes and any future activity types: list every non-internal field rather than dropping them.
  return join(Object.entries(details).filter(([key, value]) => !INTERNAL_DETAIL_KEYS.has(key) && !(key.endsWith('_id') && typeof value === 'string' && value.length === 36) && detailValue(value)).map(([key, value]) => `${detailLabel(key)}: ${detailValue(value)}`));
}

/** Builds the sheets for a Management of Change workbook covering the given records. */
export function buildMocWorkbookSheets(data: MocExportData, scope: MocExportScope, generatedAt = new Date()): XlsxSheet[] {
  const people = buildMocIdentityDirectory(data);
  const mocs = [...data.mocs].sort((a, b) => a.moc_number - b.moc_number);
  const mocById = new Map(mocs.map((moc) => [moc.id, moc]));
  const actions = data.actions.filter((action) => mocById.has(action.moc_id)).sort((a, b) => mocById.get(a.moc_id)!.moc_number - mocById.get(b.moc_id)!.moc_number || a.created_at.localeCompare(b.created_at));
  const activity = data.activity.filter((entry) => mocById.has(entry.moc_id)).sort((a, b) => mocById.get(a.moc_id)!.moc_number - mocById.get(b.moc_id)!.moc_number || a.created_at.localeCompare(b.created_at));
  const openActionCount = (mocId: string) => actions.filter((action) => action.moc_id === mocId && !['Complete', 'Cancelled'].includes(action.status)).length;
  const scopeLabel = scope.kind === 'single' ? 'Single MOC record' : scope.kind === 'all' ? 'All Management of Change records' : `MOC register, filtered: ${scope.description}`;
  const ref = (moc: MocExportRecord): XlsxCell[] => [formatMocId(moc.moc_number), moc.title];

  return [
    {
      name: 'Summary', filter: false,
      columns: [{ header: 'Item', width: 24 }, { header: 'Details', width: 80 }],
      rows: [
        ['Organization', data.organizationName],
        ['Export', scopeLabel],
        ['Records', mocs.length],
        ['Generated', xlsxDateTime(generatedAt)],
        ['Generated by', formatPersonCell(people.user(data.currentUser?.id))],
        ['Note', 'Dates and times are shown in the local time of the person who generated this export. Record ID columns hold internal DroneSMS identifiers for traceability.'],
      ],
    },
    {
      name: 'Register',
      columns: [{ header: 'MOC ID', width: 10 }, { header: 'Title', width: 40 }, { header: 'Status', width: 22 }, { header: 'Source', width: 14 }, { header: 'Change type', width: 30 }, { header: 'Affected capability', width: 28 }, { header: 'Capability status', width: 16 }, { header: 'Equipment / aircraft', width: 28 }, { header: 'Linked safety event', width: 20 }, { header: 'Date opened', width: 17 }, { header: 'Initiated by', width: 36 }, { header: 'Safety reviewer', width: 36 }, { header: 'Review decision', width: 20 }, { header: 'Date approved', width: 17 }, { header: 'Date completed', width: 17 }, { header: 'Date cancelled', width: 17 }, { header: 'Open actions', width: 12 }, { header: 'Record ID', width: 38 }],
      rows: mocs.map((moc) => [...ref(moc), moc.status, moc.source, moc.change_type, moc.operational_capabilities?.name, moc.operational_capabilities?.status, equipmentLabel(moc.equipment), moc.job_safety_events?.category, xlsxDateTime(moc.created_at), formatPersonCell(people.user(moc.initiated_by)), formatPersonCell(people.user(moc.safety_reviewer_id)), moc.safety_review_decision, xlsxDateTime(moc.approved_at), xlsxDateTime(moc.completed_at), xlsxDateTime(moc.cancelled_at), openActionCount(moc.id), moc.id]),
    },
    {
      name: 'Change Details',
      columns: [{ header: 'MOC ID', width: 10 }, { header: 'Title', width: 32 }, { header: 'Description', width: 60 }, { header: 'Safety event description', width: 45 }, { header: 'Safety event outcome', width: 20 }, { header: 'Safety event immediate actions', width: 40 }, { header: 'Safety event date', width: 17 }, { header: 'External instructions reviewed or updated', width: 20 }, { header: 'External document notes', width: 40 }, { header: 'Reference or attachment URL', width: 36 }, { header: 'Who was informed', width: 36 }, { header: 'Record ID', width: 38 }],
      rows: mocs.map((moc) => [...ref(moc), moc.description, moc.job_safety_events?.description, moc.job_safety_events?.outcome, moc.job_safety_events?.immediate_actions_taken, xlsxDateTime(moc.job_safety_events?.created_at), yesNo(moc.external_documents_reviewed), moc.external_document_notes, moc.external_document_reference, moc.people_informed, moc.id]),
    },
    {
      name: 'Impact Review',
      columns: [{ header: 'MOC ID', width: 10 }, { header: 'Title', width: 32 }, { header: '#', width: 5 }, { header: 'Question', width: 70 }, { header: 'Answer', width: 14 }, { header: 'Record ID', width: 38 }],
      rows: mocs.flatMap((moc) => mocImpactQuestions.map((question, index) => [...ref(moc), index + 1, question, moc.impact_review?.[String(index)] || 'Not answered', moc.id])),
    },
    {
      name: 'Actions',
      columns: [{ header: 'MOC ID', width: 10 }, { header: 'MOC title', width: 32 }, { header: 'Action', width: 50 }, { header: 'Owner', width: 36 }, { header: 'Due date', width: 12 }, { header: 'Required before operational use', width: 16 }, { header: 'Status', width: 14 }, { header: 'Completion date', width: 14 }, { header: 'Notes or evidence', width: 45 }, { header: 'Created', width: 17 }, { header: 'Record ID', width: 38 }],
      rows: actions.map((action) => { const moc = mocById.get(action.moc_id)!; return [...ref(moc), action.description, formatPersonCell(people.personnel(action.owner_id)) || 'Unassigned', xlsxDate(action.due_date), yesNo(action.required_before_operational_use), action.status, xlsxDate(action.completion_date), action.notes_or_evidence, xlsxDateTime(action.created_at), action.id]; }),
    },
    {
      name: 'Review & Follow-up',
      columns: [{ header: 'MOC ID', width: 10 }, { header: 'Title', width: 32 }, { header: 'Status', width: 22 }, { header: 'Review decision', width: 20 }, { header: 'Safety reviewer', width: 36 }, { header: 'Reviewed', width: 17 }, { header: 'Reviewer comments', width: 45 }, { header: 'Operational acceptance by', width: 36 }, { header: 'Acting role', width: 20 }, { header: 'Operational acceptance', width: 17 }, { header: 'Follow-up required', width: 12 }, { header: 'Follow-up date', width: 14 }, { header: 'Follow-up responsible', width: 36 }, { header: 'Why follow-up is unnecessary', width: 36 }, { header: 'Did the change work as intended?', width: 36 }, { header: 'Were controls effective?', width: 36 }, { header: 'Unexpected hazards or events', width: 36 }, { header: 'Additional corrective actions', width: 36 }, { header: 'Final closure decision', width: 36 }, { header: 'Date completed', width: 17 }, { header: 'Date cancelled', width: 17 }, { header: 'Record ID', width: 38 }],
      rows: mocs.map((moc) => [...ref(moc), moc.status, moc.safety_review_decision, formatPersonCell(people.user(moc.safety_reviewer_id)), xlsxDateTime(moc.safety_reviewed_at), moc.safety_review_comments, formatPersonCell(people.user(moc.operational_accepted_by)), moc.operational_acceptance_role, xlsxDateTime(moc.operational_accepted_at), yesNo(moc.follow_up_required), xlsxDate(moc.follow_up_date), formatPersonCell(people.personnel(moc.follow_up_responsible_id)), moc.follow_up_unnecessary_reason, moc.change_worked_as_intended, moc.controls_effective, moc.unexpected_hazards_or_events, moc.additional_corrective_actions, moc.final_closure_decision, xlsxDateTime(moc.completed_at), xlsxDateTime(moc.cancelled_at), moc.id]),
    },
    {
      name: 'Activity',
      columns: [{ header: 'MOC ID', width: 10 }, { header: 'MOC title', width: 32 }, { header: 'When', width: 17 }, { header: 'Activity', width: 28 }, { header: 'Details', width: 50 }, { header: 'Performed by', width: 36 }, { header: 'Record ID', width: 38 }],
      rows: activity.map((entry) => { const moc = mocById.get(entry.moc_id)!; return [...ref(moc), xlsxDateTime(entry.created_at), entry.action, describeMocActivity(entry, people), entry.performed_by ? formatPersonCell(people.user(entry.performed_by)) : 'System', entry.id]; }),
    },
  ];
}

/** Builds the complete .xlsx bytes for a Management of Change export. */
export function buildMocWorkbook(data: MocExportData, scope: MocExportScope, generatedAt = new Date()) {
  return buildXlsx(buildMocWorkbookSheets(data, scope, generatedAt));
}

/** Returns the download file name for an export, e.g. "MOC-003.xlsx" or "MOC-Register-2026-10-09.xlsx". */
export function mocExportFileName(scope: MocExportScope, mocNumber?: number, generatedAt = new Date()) {
  const day = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(generatedAt.getDate()).padStart(2, '0')}`;
  if (scope.kind === 'single' && mocNumber !== undefined) return `${formatMocId(mocNumber)}.xlsx`;
  return scope.kind === 'all' ? `All-MOC-Records-${day}.xlsx` : `MOC-Register-${day}.xlsx`;
}

export type MocRegisterFilters = { from: string; to: string; source: string; type: string; status: string; capability: string; equipment: string; person: string };

/** Describes the active register filters for the export summary; returns "No filters applied" when none are set. */
export function describeMocRegisterFilters(filters: MocRegisterFilters) {
  const parts = [
    filters.from ? `Opened on or after ${filters.from}` : '',
    filters.to ? `Opened on or before ${filters.to}` : '',
    filters.source !== 'All' ? `Source: ${filters.source}` : '',
    filters.type !== 'All' ? `Change type: ${filters.type}` : '',
    filters.status !== 'All' ? `Status: ${filters.status}` : '',
    filters.capability.trim() ? `Capability contains "${filters.capability.trim()}"` : '',
    filters.equipment.trim() ? `Equipment contains "${filters.equipment.trim()}"` : '',
    filters.person.trim() ? `Initiator or reviewer contains "${filters.person.trim()}"` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : 'No filters applied';
}
