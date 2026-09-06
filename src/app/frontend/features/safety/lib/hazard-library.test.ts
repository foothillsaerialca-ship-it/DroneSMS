/**
 * File purpose: Verifies hazard-library search and record normalization helpers.
 * Fallback/error behavior: Assertions ensure empty, partial, and matching inputs produce predictable results.
 * Known limitation: The tests do not query Supabase or verify rendered selector behavior.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { type HazardLibraryRecord, searchHazardLibrary } from './hazard-library.ts';

const hazards: HazardLibraryRecord[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    hazard_name: 'GNSS Degradation / Interference',
    category: 'Aircraft / Systems',
    default_mitigation: 'Confirm a stable navigation solution before launch',
    mitigations: [],
    service_types: ['Mapping'],
    is_universal: true,
    is_system_hazard: true
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    hazard_name: 'Chemical exposure',
    category: 'Personnel',
    default_mitigation: 'Wear appropriate PPE',
    mitigations: [],
    service_types: ['Agricultural Application'],
    is_universal: false,
    is_system_hazard: true
  }
];

test('searches the complete library by hazard name and category', () => {
  assert.deepEqual(searchHazardLibrary(hazards, 'GNSS').map(({ id }) => id), [hazards[0].id]);
  assert.deepEqual(searchHazardLibrary(hazards, 'personnel').map(({ id }) => id), [hazards[1].id]);
});

test('also searches mitigation and service type text using all query terms', () => {
  assert.deepEqual(searchHazardLibrary(hazards, 'stable launch').map(({ id }) => id), [hazards[0].id]);
  assert.deepEqual(searchHazardLibrary(hazards, 'agricultural application').map(({ id }) => id), [hazards[1].id]);
});

test('returns the full library when the search is blank', () => {
  assert.deepEqual(searchHazardLibrary(hazards, '  '), hazards);
});
