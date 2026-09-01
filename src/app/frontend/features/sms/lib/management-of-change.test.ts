import assert from 'node:assert/strict';
import test from 'node:test';
import { canApproveMoc, eventReviewRoute, formatMocName } from './management-of-change.ts';

test('MOC display identity is stable and padded', () => assert.equal(formatMocName(4, 'Add Thermal Inspection Capability'), 'MOC-004 — Add Thermal Inspection Capability'));
test('incomplete pre-use action prevents approval', () => assert.equal(canApproveMoc([{ required_before_operational_use: true, status: 'In Progress' }]), false));
test('completed pre-use and non-pre-use actions allow approval', () => assert.equal(canApproveMoc([{ required_before_operational_use: true, status: 'Complete' }, { required_before_operational_use: false, status: 'Open' }]), true));
test('material event change offers MOC', () => assert.equal(eventReviewRoute({ existingControl: 'Yes', controlResult: 'It worked, but was not sufficient', newHazardOrControl: 'No', changeNeeded: 'No change required' }), 'offer-moc'));
test('control not followed routes to corrective action', () => assert.equal(eventReviewRoute({ existingControl: 'Yes', controlResult: 'It was not used or followed', newHazardOrControl: 'No', changeNeeded: 'No change required' }), 'corrective-action'));
test('unclear cause continues investigation', () => assert.equal(eventReviewRoute({ existingControl: 'Unsure', controlResult: '', newHazardOrControl: 'Further review needed', changeNeeded: 'Further investigation required' }), 'investigate'));
