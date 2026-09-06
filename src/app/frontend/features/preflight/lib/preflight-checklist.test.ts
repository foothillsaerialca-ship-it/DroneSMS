/**
 * File purpose: Verifies preflight checklist state, validation, formatting, and packet helpers.
 * Fallback/error behavior: Assertions ensure incomplete checklists produce actionable completion errors.
 * Known limitation: Pure helper tests do not exercise Supabase persistence or browser interactions.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPreflightPacketRows, checklistItems, emptyChecklistStates, formatChecklistState, getCompletionError, getPostChecklistDestination, readChecklistStates, type ChecklistStates } from './preflight-checklist.ts';

const resolved = (state: 'confirmed' | 'not_applicable' = 'confirmed') =>
  Object.fromEntries(checklistItems.map(({ key }) => [key, state])) as ChecklistStates;

test('completion is blocked while any item is unresolved', () => {
  assert.match(getCompletionError({ ...resolved(), battery_condition_checked: null }) ?? '', /Battery condition checked/);
});

test('completion is blocked while any item is Not Confirmed', () => {
  assert.match(getCompletionError({ ...resolved(), crew_communications_confirmed: 'not_confirmed' }) ?? '', /Not Confirmed/);
});

test('completion allows Confirmed and Not Applicable states', () => {
  assert.equal(getCompletionError({ ...resolved(), visual_observer_assigned_if_needed: 'not_applicable' }), null);
});

test('Final RPIC Approval does not override another unresolved item and must itself be confirmed', () => {
  assert.ok(getCompletionError({ ...emptyChecklistStates, final_rpic_approval: 'confirmed' }));
  assert.match(getCompletionError({ ...resolved(), final_rpic_approval: 'not_applicable' }) ?? '', /must be Confirmed/);
});

test('legacy booleans remain readable without treating unchecked values as Not Applicable', () => {
  const states = readChecklistStates(null, { aircraft_selected: true, weather_verified: false });
  assert.equal(states.aircraft_selected, 'confirmed');
  assert.equal(states.weather_verified, null);
});

test('packet labels distinguish every state and unresolved legacy data', () => {
  assert.deepEqual([
    formatChecklistState('confirmed'), formatChecklistState('not_confirmed'), formatChecklistState('not_applicable'), formatChecklistState(undefined, false),
  ], ['Confirmed', 'Not Confirmed', 'Not Applicable', 'Unresolved']);
  const rows = buildPreflightPacketRows({
    checklist_states: { aircraft_selected: 'confirmed', battery_condition_checked: 'not_confirmed', propellers_inspected: 'not_applicable' },
  });
  assert.deepEqual(rows.slice(0, 4).map((row) => row[1]), ['Confirmed', 'Not Confirmed', 'Not Applicable', 'Unresolved']);
});

test('draft state may remain incomplete', () => {
  assert.equal(Object.values(emptyChecklistStates).every((value) => value === null), true);
});

test('incomplete or failed checklist completion does not offer the readiness next step', () => {
  assert.equal(getPostChecklistDestination('job-123', 'Draft'), null);
});

test('successful and previously completed checklists link to the existing readiness section', () => {
  assert.equal(getPostChecklistDestination('job-123', 'Complete'), '/jobs/job-123/hub#ready-to-operate');
});
