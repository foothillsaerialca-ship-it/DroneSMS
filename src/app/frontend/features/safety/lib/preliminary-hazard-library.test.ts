/**
 * File purpose: Verifies the preliminary hazard library domain helpers with deterministic Node unit tests.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fallbackHazardLibrary,
  getSuggestedHazards,
  getVisibleHazards,
  normalizeSelectedHazards,
  normalizeServiceType,
  restoreSystemHazardMappings,
  selectLibraryHazard,
  type HazardLibraryEntry
} from './preliminary-hazard-library.ts';

/**
 * Implements names for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
const names = (serviceType: string) => new Set(getSuggestedHazards(fallbackHazardLibrary, serviceType).map((hazard) => hazard.hazard_name));

test('canonicalizes legacy service type aliases', () => {
  assert.equal(normalizeServiceType('Thermal Imaging'), 'Thermal Inspection');
  assert.equal(normalizeServiceType('Mapping/Surveying'), 'Mapping / Surveying');
});

test('Thermal relevant hazards contain universal and Thermal mappings, not Cleaning-only hazards', () => {
  const thermal = getSuggestedHazards(fallbackHazardLibrary, 'Thermal Inspection');
  assert.ok(thermal.every((hazard) => hazard.is_universal || hazard.service_types.includes('Thermal Inspection')));
  assert.equal(names('Thermal Inspection').has('Water Runoff'), false);
  assert.equal(names('Thermal Imaging').has('Roof Access'), true);
});

test('standard service types include only universal or their mapped hazards', () => {
  for (const serviceType of ['Cleaning Operations', 'Agricultural', 'Mapping / Surveying', 'Roof Inspection', 'Construction Progress', 'Real Estate / Property Media']) {
    const relevant = getSuggestedHazards(fallbackHazardLibrary, serviceType);
    assert.ok(relevant.length > 0);
    assert.ok(relevant.every((hazard) => hazard.is_universal || hazard.service_types.includes(serviceType)), serviceType);
  }
  assert.equal(names('Cleaning Operations').has('Water Runoff'), true);
  assert.equal(names('Agricultural').has('Chemical Exposure'), true);
  assert.equal(names('Mapping/Surveying').has('Extended Flight Operations'), true);
});

test('Custom Operation receives universal hazards rather than the entire library', () => {
  const relevant = getSuggestedHazards(fallbackHazardLibrary, 'Custom Operation');
  assert.ok(relevant.length > 0);
  assert.ok(relevant.every((hazard) => hazard.is_universal));
  assert.ok(relevant.length < fallbackHazardLibrary.length);
});

test('All Hazards changes availability without changing selected hazards', () => {
  const selected = [selectLibraryHazard(fallbackHazardLibrary.find((hazard) => hazard.hazard_name === 'Water Runoff')!)];
  const relevant = getVisibleHazards(fallbackHazardLibrary, 'Thermal Inspection', 'relevant');
  const all = getVisibleHazards(fallbackHazardLibrary, 'Thermal Inspection', 'all');
  assert.equal(relevant.some((hazard) => hazard.hazard_name === 'Water Runoff'), false);
  assert.equal(all.length, fallbackHazardLibrary.length);
  assert.equal(all.some((hazard) => hazard.hazard_name === 'Water Runoff'), true);
  assert.deepEqual(selected.map((hazard) => hazard.hazard_name), ['Water Runoff']);
});

test('system mappings are restored by canonical name while custom mappings are preserved', () => {
  const staleSystem: HazardLibraryEntry = { ...fallbackHazardLibrary.find((hazard) => hazard.hazard_name === 'Water Runoff')!, id: 'database-uuid', service_types: ['Thermal Inspection'], is_universal: true };
  const custom: HazardLibraryEntry = { id: 'org-hazard', hazard_name: 'Organization Hazard', category: 'Custom', default_mitigation: 'Control it', service_types: ['Thermal Inspection'], is_universal: false, is_system_hazard: false };
  const restored = restoreSystemHazardMappings([staleSystem, custom]);
  assert.deepEqual(restored[0].service_types, ['Cleaning Operations']);
  assert.equal(restored[0].is_universal, false);
  assert.deepEqual(restored[1], custom);
  assert.equal(getSuggestedHazards(restored, 'Thermal Inspection').some((hazard) => hazard.id === custom.id), true);
});

test('proposal hazard normalization preserves custom data for independent JHA copying', () => {
  const proposalSnapshot = [{ id: 'custom-site', hazard_name: 'Site-specific hazard', category: 'Site', mitigation: 'Use a spotter', source: 'custom', notes: 'North entrance' }];
  const copied = normalizeSelectedHazards(structuredClone(proposalSnapshot));
  copied[0].mitigation = 'Close the north entrance';
  assert.equal(proposalSnapshot[0].mitigation, 'Use a spotter');
  assert.equal(copied[0].category, 'Site');
  assert.equal(copied[0].notes, 'North entrance');
});
