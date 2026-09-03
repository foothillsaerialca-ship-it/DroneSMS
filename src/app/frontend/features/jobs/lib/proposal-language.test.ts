import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildProposalPersonnelLanguage } from './proposal-language.ts';

test('solo proposal language is operator-specific and preserves safety commitments', () => {
  const language = buildProposalPersonnelLanguage([{ personnelId: 'rpic-1', name: 'Alex Pilot', role: 'RPIC' }]);
  const summary = language.executiveSummaryQualification('Alex Pilot', 'Example Aviation');
  assert.equal(language.isCrewed, false);
  assert.match(summary, /Alex Pilot/);
  assert.match(summary, /Example Aviation's documented Safety Management System/);
  assert.doesNotMatch(summary, /supported by a trained crew|assigned crew/);
  assert.doesNotMatch(language.siteSetup, /crew briefing/);
  assert.match(language.siteSetup, /equipment readiness/);
  assert.match(language.siteSetup, /site controls/);
  assert.equal(language.conditionsVerification, 'The operator verifies current conditions before flight and coordinates with the client when conditions change.');
  assert.equal(language.personnelHelper, 'Personnel assignments are confirmed before scheduling and matched to the site requirements.');
});

test('crewed proposal language uses assigned operational roles', () => {
  const language = buildProposalPersonnelLanguage([
    { personnelId: 'rpic-1', name: 'Morgan Remote', role: 'RPIC' },
    { personnelId: 'vo-1', name: 'Taylor Observer', role: 'Visual Observer' },
    { personnelId: 'admin-1', name: 'Casey Admin', role: 'Safety Manager' },
  ]);
  assert.equal(language.isCrewed, true);
  assert.match(language.executiveSummaryQualification('Morgan Remote', 'Dynamic UAS'), /with the assigned crew/);
  assert.match(language.siteSetup, /conduct crew briefing/);
  assert.match(language.conditionsVerification, /^The crew verifies/);
});

test('administrative roles and duplicate assignments do not create a crew', () => {
  const language = buildProposalPersonnelLanguage([
    { personnelId: 'rpic-1', role: 'RPIC' },
    { personnelId: 'rpic-1', role: 'Pilot' },
    { personnelId: 'manager-1', role: 'Safety Manager' },
  ]);
  assert.equal(language.isCrewed, false);
});

test('proposal sections remain intact and completed-record terminology is unchanged', () => {
  const source = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
  for (const section of ['EXECUTIVE SUMMARY', 'SCOPE OF WORK', 'PERSONNEL', 'EQUIPMENT', 'PRELIMINARY HAZARD ASSESSMENT', 'AIRSPACE REVIEW', 'PRICING', 'PROJECT ASSUMPTIONS & SAFETY CONDITIONS', 'ACCEPTANCE']) assert.ok(source.includes(section));
  assert.match(source, /renderer\.section\('CREW ASSIGNMENT'\)/);
  assert.match(source, /renderer\.section\('EMERGENCY PLANNING \/ CREW BRIEFING'\)/);
  assert.match(source, /Operations may be delayed, modified, or stopped when safety or quality conditions require it/);
});
