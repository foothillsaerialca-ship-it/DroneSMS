/**
 * File purpose: Verifies shared workflow option values and proposal-equipment normalization.
 * Fallback/error behavior: deterministic assertions fail the test process when shared structures or compatibility defaults regress.
 * Known issues: this unit test does not validate matching database constraints.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeProposalEquipment,
  proposalStatuses,
  serviceTypes
} from './workflow-types.ts';

test('shared workflow options retain stable defaults', () => {
  assert.equal(serviceTypes[0], 'Cleaning Operations');
  assert.equal(proposalStatuses[0], 'Draft');
  assert.ok(serviceTypes.includes('Custom Operation'));
  assert.deepEqual(proposalStatuses, ['Draft', 'Sent', 'Under Review', 'Accepted', 'Declined']);
});

test('proposal equipment normalization rejects invalid collections and incomplete rows', () => {
  assert.deepEqual(normalizeProposalEquipment(null), []);
  assert.deepEqual(normalizeProposalEquipment([{ equipment_id: 'id-only' }]), []);
});

test('proposal equipment normalization supplies compatibility defaults', () => {
  assert.deepEqual(
    normalizeProposalEquipment([{ equipment_id: 'eq-1', equipment_name: 'Aircraft' }]),
    [{
      equipment_id: 'eq-1',
      equipment_name: 'Aircraft',
      equipment_type: '',
      make: null,
      model: null,
      status: '',
      purpose: ''
    }]
  );
});
