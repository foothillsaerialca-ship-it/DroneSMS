/**
 * File purpose: Verifies the operational environment domain helpers with deterministic Node unit tests.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceUsesAppliedMaterials } from './operational-environment.ts';

test('liquid and application services receive applied-material environmental controls', () => {
  for (const service of ['Cleaning Operations', 'Drone Soft Wash', 'Agricultural', 'Pesticide Application']) {
    assert.equal(serviceUsesAppliedMaterials(service), true, service);
  }
});

test('inspection and imaging services use the lightweight environmental path', () => {
  for (const service of ['Thermal Inspection', 'Photography', 'Mapping / Surveying']) {
    assert.equal(serviceUsesAppliedMaterials(service), false, service);
  }
});
