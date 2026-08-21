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
