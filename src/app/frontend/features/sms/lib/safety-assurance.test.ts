import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresOpenReview, validateSafetyAssurance, type SafetyAssuranceInput } from './safety-assurance.ts';

const valid = (changes: Partial<SafetyAssuranceInput> = {}): SafetyAssuranceInput => ({ controlEffectiveness: 'Yes', effectivenessNarrative: '', operationalAction: '', followUpRequired: false, followUpAreas: [], unexpectedIssue: 'No', unexpectedIssueNarrative: '', ...changes });

test('Yes and Not Applicable complete without follow-up', () => {
  assert.equal(validateSafetyAssurance(valid()), null);
  assert.equal(requiresOpenReview(valid()), false);
  assert.equal(validateSafetyAssurance(valid({ controlEffectiveness: 'Not Applicable' })), null);
  assert.equal(requiresOpenReview(valid({ controlEffectiveness: 'Not Applicable' })), false);
});
test('Partially requires explanation and opens only when follow-up is required', () => {
  assert.match(validateSafetyAssurance(valid({ controlEffectiveness: 'Partially', followUpRequired: null }))!, /expected/);
  assert.equal(requiresOpenReview(valid({ controlEffectiveness: 'Partially', effectivenessNarrative: 'Briefing was late' })), false);
  assert.match(validateSafetyAssurance(valid({ controlEffectiveness: 'Partially', effectivenessNarrative: 'Briefing was late', followUpRequired: true }))!, /follow-up area/);
  assert.equal(requiresOpenReview(valid({ controlEffectiveness: 'Partially', effectivenessNarrative: 'Briefing was late', followUpRequired: true, followUpAreas: ['Procedure'] })), true);
});
test('No requires explanation and in-operation action and opens review', () => {
  assert.match(validateSafetyAssurance(valid({ controlEffectiveness: 'No' }))!, /didn.t work/);
  assert.match(validateSafetyAssurance(valid({ controlEffectiveness: 'No', effectivenessNarrative: 'Barrier failed' }))!, /action taken/);
  assert.equal(requiresOpenReview(valid({ controlEffectiveness: 'No', effectivenessNarrative: 'Barrier failed', operationalAction: 'Stopped work' })), true);
});
test('unexpected issue requires description and opens review', () => {
  assert.match(validateSafetyAssurance(valid({ unexpectedIssue: 'Yes' }))!, /adequately covered/);
  assert.equal(requiresOpenReview(valid({ unexpectedIssue: 'Yes', unexpectedIssueNarrative: 'New obstruction' })), true);
});
