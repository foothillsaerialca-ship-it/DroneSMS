import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildProposalPersonnelLanguage, resolveProposalRpic } from './proposal-language.ts';

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

test('converted job uses its reassigned RPIC without changing the proposal snapshot', () => {
  const proposalSnapshot = { personnelId: 'rpic-a', name: 'RPIC A' };
  const liveAssignments = [
    { personnelId: 'rpic-b', name: 'RPIC B', role: 'RPIC' },
    { personnelId: 'vo-1', name: 'Observer', role: 'Visual Observer' },
  ];

  const displayedRpic = resolveProposalRpic(liveAssignments, proposalSnapshot);
  const language = buildProposalPersonnelLanguage(liveAssignments);

  assert.deepEqual(displayedRpic, { name: 'RPIC B', usesProposalSnapshot: false });
  assert.equal(language.isCrewed, true);
  assert.match(language.executiveSummaryQualification(displayedRpic.name, 'Example Aviation'), /^RPIC B,/);
  assert.match(language.siteSetup, /crew briefing/);
  assert.deepEqual(proposalSnapshot, { personnelId: 'rpic-a', name: 'RPIC A' });
});

test('unconverted proposal uses its original RPIC assignment', () => {
  const proposalSnapshot = { personnelId: 'rpic-a', name: 'RPIC A' };
  const proposalAssignments = [{ ...proposalSnapshot, role: 'RPIC' }];
  const displayedRpic = resolveProposalRpic(proposalAssignments, proposalSnapshot);

  assert.deepEqual(displayedRpic, { name: 'RPIC A', usesProposalSnapshot: true });
  assert.equal(buildProposalPersonnelLanguage(proposalAssignments).isCrewed, false);
});

test('live personnel without an RPIC does not mix in the historical RPIC', () => {
  const displayedRpic = resolveProposalRpic(
    [{ personnelId: 'vo-1', name: 'Observer', role: 'Visual Observer' }],
    { personnelId: 'rpic-a', name: 'RPIC A' },
  );
  assert.deepEqual(displayedRpic, { name: '', usesProposalSnapshot: false });
});

test('proposal sections remain intact and completed-record terminology is unchanged', () => {
  const source = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
  for (const section of ['EXECUTIVE SUMMARY', 'SCOPE OF WORK', 'PERSONNEL', 'EQUIPMENT', 'PRELIMINARY HAZARD ASSESSMENT', 'AIRSPACE REVIEW', 'PRICING', 'PROJECT ASSUMPTIONS & SAFETY CONDITIONS', 'ACCEPTANCE']) assert.ok(source.includes(section));
  assert.match(source, /renderer\.section\('CREW ASSIGNMENT'\)/);
  assert.match(source, /renderer\.section\('EMERGENCY PLANNING \/ CREW BRIEFING'\)/);
  assert.match(source, /Operations may be delayed, modified, or stopped when safety or quality conditions require it/);
});
