/**
 * File purpose: Verifies JHA hazard list search matching and expand/collapse state helpers with deterministic Node unit tests.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getMissingRequiredHazardFields, hazardMatchesSearch, isHazardExpanded, setHazardsExpanded, withoutHazardExpansion } from './hazard-card-view.ts';

const battery = { description: 'Battery fire or thermal runaway', category: 'Aircraft / Systems', mitigation: 'Fire extinguisher on site, LiPo-safe transport.' };

test('search matches name, category, and mitigation case-insensitively', () => {
  assert.equal(hazardMatchesSearch(battery, 'THERMAL'), true);
  assert.equal(hazardMatchesSearch(battery, 'aircraft /'), true);
  assert.equal(hazardMatchesSearch(battery, 'extinguisher'), true);
  assert.equal(hazardMatchesSearch(battery, 'runoff'), false);
});

test('a blank or whitespace query matches every hazard, including empty custom hazards', () => {
  assert.equal(hazardMatchesSearch(battery, ''), true);
  assert.equal(hazardMatchesSearch(battery, '   '), true);
  assert.equal(hazardMatchesSearch({ description: '', category: '', mitigation: '' }, ''), true);
  assert.equal(hazardMatchesSearch(battery, '  fire  '), true);
});

test('hazards present on open start collapsed and later hazards start expanded', () => {
  const initial = new Set(['existing']);
  assert.equal(isHazardExpanded('existing', {}, initial), false);
  assert.equal(isHazardExpanded('added', {}, initial), true);
  assert.equal(isHazardExpanded('existing', { existing: true }, initial), true);
  assert.equal(isHazardExpanded('added', { added: false }, initial), false);
});

test('expand/collapse all only changes the listed ids and does not mutate the input', () => {
  const overrides = { hidden: true, shown: false };
  const next = setHazardsExpanded(overrides, ['shown', 'other'], true);
  assert.deepEqual(next, { hidden: true, shown: true, other: true });
  assert.deepEqual(overrides, { hidden: true, shown: false });
  assert.deepEqual(setHazardsExpanded(next, ['shown', 'other'], false), { hidden: true, shown: false, other: false });
});

test('removing a hazard drops only its expansion choice', () => {
  const overrides = { a: true, b: false };
  assert.deepEqual(withoutHazardExpansion(overrides, 'a'), { b: false });
  assert.equal(withoutHazardExpansion(overrides, 'missing'), overrides);
  assert.deepEqual(overrides, { a: true, b: false });
});

test('missing required fields follow the JHA completion check', () => {
  assert.deepEqual(getMissingRequiredHazardFields(battery), []);
  assert.deepEqual(getMissingRequiredHazardFields({ description: '', category: '', mitigation: '' }), [], 'blank hazards are skipped by the check');
  assert.deepEqual(getMissingRequiredHazardFields({ description: '  ', category: 'Ground', mitigation: ' ' }), [], 'whitespace-only counts as blank');
  assert.deepEqual(getMissingRequiredHazardFields({ description: 'Glare', category: '', mitigation: '' }), ['category', 'mitigation']);
  assert.deepEqual(getMissingRequiredHazardFields({ description: '', category: 'Ground', mitigation: 'Cones placed' }), ['description']);
  assert.deepEqual(getMissingRequiredHazardFields({ description: 'Glare', category: ' ', mitigation: 'Sunglasses' }), ['category']);
});
