/**
 * File purpose: Verifies the Management of Change Excel export: workbook packaging, identity resolution, and sheet contents.
 * Fallback/error behavior: Assertions cover unresolvable identities, duplicate personnel records, and unanswered impact questions.
 * Known limitation: These tests do not query Supabase or open the workbook in Excel.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildXlsx, columnLetters, crc32, xlsxDate } from '../../../lib/xlsx-writer.ts';
import { buildMocIdentityDirectory, buildMocWorkbookSheets, describeMocActivity, describeMocRegisterFilters, formatPersonCell, mocExportFileName, type MocExportData, type MocExportRecord } from './moc-export.ts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ETHAN_USER = '389c300b-04cc-479a-9711-c5d3d79e9bcb';
const STRANGER = '99999999-9999-4999-8999-999999999999';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function moc(overrides: Partial<MocExportRecord>): MocExportRecord {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000001', moc_number: 3, title: 'Introduce M30T', description: 'Thermal payload', source: 'Equipment', change_type: 'New operational capability', status: 'Approved for Operational Use',
    initiated_by: OWNER, impact_review: { 0: 'Yes', 4: 'Unsure' }, external_documents_reviewed: true, external_document_notes: null, external_document_reference: null, people_informed: 'Crew',
    safety_review_decision: 'Accepted', safety_reviewer_id: ETHAN_USER, safety_reviewed_at: '2026-10-01T15:00:00Z', safety_review_comments: 'OK', operational_accepted_by: ETHAN_USER, operational_acceptance_role: 'Safety Manager', operational_accepted_at: '2026-10-01T15:00:00Z',
    follow_up_required: true, follow_up_date: '2026-11-01', follow_up_responsible_id: 'p-ethan', follow_up_unnecessary_reason: null, change_worked_as_intended: null, controls_effective: null, unexpected_hazards_or_events: null, additional_corrective_actions: null, final_closure_decision: null,
    approved_at: '2026-10-01T15:00:00Z', completed_at: null, cancelled_at: null, created_at: '2026-09-20T12:00:00Z', updated_at: '2026-10-01T15:00:00Z',
    operational_capabilities: { name: 'Thermal inspection', status: 'Established' }, equipment: { name: 'Matrice', make: 'DJI', model: 'M30T' }, job_safety_events: null,
    ...overrides,
  };
}

const data: MocExportData = {
  organizationName: 'Foothills Aerial',
  organizationOwnerUserId: OWNER,
  safetyManagerPersonnelId: 'p-ethan',
  currentUser: { id: OWNER, email: 'owner@example.com' },
  personnel: [
    { id: 'p-ethan-old', user_id: ETHAN_USER, full_name: 'E. Cole (former)', role: 'Pilot', email: null, status: 'Inactive' },
    { id: 'p-ethan', user_id: ETHAN_USER, full_name: 'Ethan Cole', role: 'Crew Member', email: 'ethan.cole@example.com', status: 'Active' },
    { id: 'p-sam', user_id: '22222222-2222-4222-8222-222222222222', full_name: 'Sam Ortiz', role: 'Visual Observer', email: null, status: 'Active' },
  ],
  mocs: [moc({ id: 'aaaaaaaa-0000-4000-8000-000000000009', moc_number: 9, title: 'Later change', initiated_by: STRANGER, safety_reviewer_id: null }), moc({})],
  actions: [{ id: 'act-1', moc_id: 'aaaaaaaa-0000-4000-8000-000000000001', description: 'Thermal training', owner_id: 'p-sam', due_date: '2026-10-05', required_before_operational_use: true, status: 'Complete', completion_date: '2026-10-04', notes_or_evidence: 'Certificate on file', created_at: '2026-09-21T00:00:00Z' }],
  activity: [{ id: 'log-1', moc_id: 'aaaaaaaa-0000-4000-8000-000000000001', action: 'Status changed', details: { from: 'Draft', to: 'Approved for Operational Use' }, performed_by: ETHAN_USER, created_at: '2026-10-01T15:00:00Z' }, { id: 'log-2', moc_id: 'aaaaaaaa-0000-4000-8000-000000000001', action: 'MOC created', details: {}, performed_by: null, created_at: '2026-09-20T12:00:00Z' }],
};

test('column letters roll over after Z', () => { assert.equal(columnLetters(0), 'A'); assert.equal(columnLetters(25), 'Z'); assert.equal(columnLetters(26), 'AA'); assert.equal(columnLetters(701), 'ZZ'); assert.equal(columnLetters(702), 'AAA'); });
test('CRC-32 matches the standard check value', () => assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926));
test('calendar dates convert to Excel serials without a time-zone shift', () => { assert.equal(xlsxDate('1970-01-01')?.excelSerial, 25569); assert.equal(xlsxDate('2026-10-09')?.excelSerial, 46304); assert.equal(xlsxDate(null), null); });

test('workbook is a ZIP package with every required part', () => {
  const bytes = buildXlsx([{ name: 'A/B', columns: [{ header: 'Name' }], rows: [['<Ethan & "Co">'], [null], [5]] }]);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const text = new TextDecoder().decode(bytes);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(text.includes(part), part);
  assert.ok(text.includes('&lt;Ethan &amp; &quot;Co&quot;&gt;'));
  assert.ok(text.includes('name="A B"'), 'invalid sheet-name characters are replaced');
});

test('identities resolve to name, Safety Manager role, and email', () => {
  const people = buildMocIdentityDirectory(data);
  assert.equal(formatPersonCell(people.user(ETHAN_USER)), 'Ethan Cole (Safety Manager, ethan.cole@example.com)');
  assert.equal(formatPersonCell(people.personnel('p-sam')), 'Sam Ortiz (Visual Observer)');
});
test('owner without a personnel record falls back to their own email or a role label', () => {
  assert.equal(formatPersonCell(buildMocIdentityDirectory(data).user(OWNER)), 'owner@example.com (Organization owner)');
  assert.equal(formatPersonCell(buildMocIdentityDirectory({ ...data, currentUser: null }).user(OWNER)), 'Organization owner');
});
test('unresolvable identities never expose the internal ID', () => {
  const people = buildMocIdentityDirectory(data);
  assert.equal(people.user(STRANGER)?.name, 'Unknown user');
  assert.equal(people.personnel('missing')?.name, 'Unknown personnel record');
  assert.equal(people.user(null), null);
});

test('workbook sheets cover the full record in MOC order with no UUIDs outside Record ID columns', () => {
  const sheets = buildMocWorkbookSheets(data, { kind: 'all' }, new Date('2026-10-09T12:00:00Z'));
  assert.deepEqual(sheets.map((sheet) => sheet.name), ['Summary', 'Register', 'Change Details', 'Impact Review', 'Actions', 'Review & Follow-up', 'Activity']);
  for (const sheet of sheets) {
    const idColumns = new Set(sheet.columns.flatMap((column, index) => (column.header === 'Record ID' ? [index] : [])));
    for (const row of sheet.rows) row.forEach((cell, index) => { if (!idColumns.has(index) && typeof cell === 'string') assert.doesNotMatch(cell, UUID, `${sheet.name}: ${cell}`); });
  }
  const register = sheets[1];
  assert.deepEqual(register.rows.map((row) => row[0]), ['MOC-003', 'MOC-009']);
  assert.equal(register.rows[0][7], 'Matrice (DJI M30T)');
  assert.equal(register.rows[0][11], 'Ethan Cole (Safety Manager, ethan.cole@example.com)');
  assert.equal(register.rows[0][16], 0, 'no open actions');
  const impact = sheets[3];
  assert.equal(impact.rows.length, 20);
  assert.deepEqual(impact.rows.slice(0, 2).map((row) => row[4]), ['Yes', 'Not answered']);
  const actions = sheets[4];
  assert.deepEqual(actions.rows[0].slice(2, 4), ['Thermal training', 'Sam Ortiz (Visual Observer)']);
  assert.equal(actions.rows[0][5], 'Yes');
  const followUp = sheets[5].rows.find((row) => row[0] === 'MOC-003')!;
  assert.equal(followUp[12], 'Ethan Cole (Safety Manager, ethan.cole@example.com)');
  const activity = sheets[6];
  assert.deepEqual(activity.rows.map((row) => [row[3], row[4], row[5]]), [['MOC created', '', 'System'], ['Status changed', 'Draft → Approved for Operational Use', 'Ethan Cole (Safety Manager, ethan.cole@example.com)']]);
});

test('activity details are described in plain language', () => {
  assert.equal(describeMocActivity({ action: 'Action completed', details: { description: 'Train crew', status: 'Complete', owner_id: 'p-sam' } }), 'Train crew · Status: Complete');
  assert.equal(describeMocActivity({ action: 'Administrative correction', details: { reason: 'Typo' } }), 'Reason: Typo');
  assert.equal(describeMocActivity({ action: 'MOC updated', details: {} }), '');
});

test('register filter description and file names are readable', () => {
  assert.equal(describeMocRegisterFilters({ from: '', to: '', source: 'All', type: 'All', status: 'All', capability: '', equipment: '', person: '' }), 'No filters applied');
  assert.equal(describeMocRegisterFilters({ from: '2026-01-01', to: '', source: 'Equipment', type: 'All', status: 'Monitoring', capability: '', equipment: '', person: '' }), 'Opened on or after 2026-01-01; Source: Equipment; Status: Monitoring');
  const day = new Date(2026, 9, 9);
  assert.equal(mocExportFileName({ kind: 'single' }, 3, day), 'MOC-003.xlsx');
  assert.equal(mocExportFileName({ kind: 'all' }, undefined, day), 'All-MOC-Records-2026-10-09.xlsx');
  assert.equal(mocExportFileName({ kind: 'filtered', description: '' }, undefined, day), 'MOC-Register-2026-10-09.xlsx');
});
