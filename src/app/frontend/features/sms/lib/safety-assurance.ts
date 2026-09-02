export const controlEffectivenessResults = ['Yes', 'Partially', 'No', 'Not Applicable'] as const;
export const followUpAreas = ['Hazard or control', 'Procedure', 'Training or briefing', 'Equipment', 'Other'] as const;

export type SafetyAssuranceInput = {
  controlEffectiveness: string;
  effectivenessNarrative: string;
  operationalAction: string;
  followUpRequired: boolean | null;
  followUpAreas: string[];
  unexpectedIssue: string;
  unexpectedIssueNarrative: string;
};

export function validateSafetyAssurance(input: SafetyAssuranceInput): string | null {
  if (!controlEffectivenessResults.includes(input.controlEffectiveness as typeof controlEffectivenessResults[number])) return 'Select whether the safety controls were effective.';
  if (input.controlEffectiveness === 'Partially' && !input.effectivenessNarrative.trim()) return 'Describe what didn’t work as expected.';
  if (input.controlEffectiveness === 'Partially' && input.followUpRequired === null) return 'Select whether anything needs to change before a future operation.';
  if (input.controlEffectiveness === 'Partially' && input.followUpRequired && input.followUpAreas.length === 0) return 'Select at least one follow-up area.';
  if (input.controlEffectiveness === 'No' && !input.effectivenessNarrative.trim()) return 'Describe what didn’t work.';
  if (input.controlEffectiveness === 'No' && !input.operationalAction.trim()) return 'Describe the action taken during the operation.';
  if (!['Yes', 'No'].includes(input.unexpectedIssue)) return 'Select whether anything was inadequately covered.';
  if (input.unexpectedIssue === 'Yes' && !input.unexpectedIssueNarrative.trim()) return 'Briefly describe what was not adequately covered.';
  return null;
}

export function requiresOpenReview(input: Pick<SafetyAssuranceInput, 'controlEffectiveness' | 'followUpRequired' | 'unexpectedIssue'>) {
  return input.controlEffectiveness === 'No' || (input.controlEffectiveness === 'Partially' && input.followUpRequired) || input.unexpectedIssue === 'Yes';
}
