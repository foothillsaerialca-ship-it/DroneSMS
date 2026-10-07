import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { buildJobPersonnelAssignments, normalizeProposalPersonnel, resolveProposalRpicBioSnapshot } from './workflow-types.ts';
import { buildProposalPersonnelLanguage } from './proposal-language.ts';

test('historical proposals and proposals with no crew normalize safely', () => {
  assert.deepEqual(normalizeProposalPersonnel(undefined), []);
  assert.deepEqual(normalizeProposalPersonnel([]), []);
  assert.equal(buildProposalPersonnelLanguage([]).isCrewed, false);
});

test('multiple Personnel snapshots retain proposal roles and read-only qualifications', () => {
  const source = [
    { personnel_id: 'person-1', personnel_name: 'Alex Pilot', proposed_role: 'RPIC', qualifications_summary: 'Part 107 expires 2027-01-01' },
    { personnel_id: 'person-2', personnel_name: 'Taylor Observer', proposed_role: 'Visual Observer', qualifications_summary: 'VO training current' },
  ];
  const normalized = normalizeProposalPersonnel(source);
  assert.deepEqual(normalized, source);
  assert.equal(buildProposalPersonnelLanguage(normalized.map((item) => ({ personnelId: item.personnel_id, name: item.personnel_name, role: item.proposed_role }))).isCrewed, true);
  assert.deepEqual(source, normalized);
});

test('one proposal RPIC becomes one canonical job assignment', () => {
  const proposalPersonnel = [
    { personnel_id: 'person-1', personnel_name: 'Ethan Cole', proposed_role: 'RPIC', qualifications_summary: null },
  ];

  assert.deepEqual(buildJobPersonnelAssignments(proposalPersonnel, 'job-1', 'org-1'), [
    { job_id: 'job-1', organization_id: 'org-1', personnel_id: 'person-1', assigned_role: 'RPIC' },
  ]);
  assert.equal(proposalPersonnel[0].proposed_role, 'RPIC');
});

test('every supported proposal role maps to its intended canonical job role', () => {
  const expectedRoles = [
    ['RPIC', 'RPIC'],
    ['Pilot', 'Pilot'],
    ['Visual Observer', 'Visual Observer'],
    ['Payload Operator', 'Payload Operator'],
    ['Ground Crew', 'Ground Crew'],
    ['Crew Member', 'Ground Crew'],
    ['Safety Support', 'Ground Crew'],
    ['Other', 'Ground Crew'],
  ];
  const proposalPersonnel = expectedRoles.map(([proposed_role], index) => ({
    personnel_id: `person-${index}`,
    personnel_name: `Person ${index}`,
    proposed_role,
    qualifications_summary: null,
  }));

  assert.deepEqual(
    buildJobPersonnelAssignments(proposalPersonnel, 'job-1', 'org-1').map(({ assigned_role }) => assigned_role),
    expectedRoles.map(([, assignedRole]) => assignedRole),
  );
});

test('ordinary unsupported proposal roles do not produce job assignments', () => {
  const unsupportedRole = [{ personnel_id: 'person-1', personnel_name: 'Office Support', proposed_role: 'Administrator', qualifications_summary: null }];

  assert.deepEqual(buildJobPersonnelAssignments(unsupportedRole, 'job-1', 'org-1'), []);
});

test('all proposal personnel transfer with proposal-only crew terminology mapped to canonical job roles', () => {
  const proposalPersonnel = [
    { personnel_id: 'person-1', personnel_name: 'Ethan Cole', proposed_role: 'RPIC', qualifications_summary: null },
    { personnel_id: 'person-2', personnel_name: 'Maya Rodriguez', proposed_role: 'Visual Observer', qualifications_summary: null },
    { personnel_id: 'person-3', personnel_name: 'Daniel Brooks', proposed_role: 'Crew Member', qualifications_summary: null },
  ];

  assert.deepEqual(buildJobPersonnelAssignments(proposalPersonnel, 'job-1', 'org-1'), [
    { job_id: 'job-1', organization_id: 'org-1', personnel_id: 'person-1', assigned_role: 'RPIC' },
    { job_id: 'job-1', organization_id: 'org-1', personnel_id: 'person-2', assigned_role: 'Visual Observer' },
    { job_id: 'job-1', organization_id: 'org-1', personnel_id: 'person-3', assigned_role: 'Ground Crew' },
  ]);
  assert.deepEqual(proposalPersonnel.map(({ proposed_role }) => proposed_role), ['RPIC', 'Visual Observer', 'Crew Member']);
});

test('job personnel conversion removes duplicate canonical assignments', () => {
  const duplicateCrew = [
    { personnel_id: 'person-1', personnel_name: 'Daniel Brooks', proposed_role: 'Crew Member', qualifications_summary: null },
    { personnel_id: 'person-1', personnel_name: 'Daniel Brooks', proposed_role: 'Ground Crew', qualifications_summary: null },
  ];

  assert.deepEqual(buildJobPersonnelAssignments(duplicateCrew, 'job-1', 'org-1'), [
    { job_id: 'job-1', organization_id: 'org-1', personnel_id: 'person-1', assigned_role: 'Ground Crew' },
  ]);
});

test('unsupported prototype property names cannot become job assignment roles', () => {
  for (const proposed_role of ['toString', 'constructor', '__proto__']) {
    const proposalPersonnel = [{ personnel_id: 'person-1', personnel_name: 'Person 1', proposed_role, qualifications_summary: null }];
    assert.deepEqual(buildJobPersonnelAssignments(proposalPersonnel, 'job-1', 'org-1'), [], proposed_role);
  }
});

test('proposal flow stores snapshots, seeds independent job assignments, and keeps qualifications read-only', () => {
  const form = readFileSync(new URL('../pages/new-proposal-page.tsx', import.meta.url), 'utf8');
  const conversion = readFileSync(new URL('../pages/jobs-page.tsx', import.meta.url), 'utf8');
  const pdf = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
  assert.match(form, /proposal_personnel: selectedPersonnel/);
  assert.match(form, /Qualifications \/ certifications \(read-only\)/);
  assert.doesNotMatch(form, /\.from\('personnel'\)\s*\.update/);
  assert.match(conversion, /buildJobPersonnelAssignments\(/);
  assert.match(conversion, /\.from\("job_personnel"\)\s*\.insert\(personnelAssignments\)/s);
  assert.match(pdf, /normalizeProposalPersonnel\(proposal\.proposal_personnel\)/);
  assert.doesNotMatch(pdf, /\.from\('job_personnel'\)[\s\S]{0,200}converted_job_id/);
});

test('migration defaults historical proposal staffing without rewriting old records', () => {
  const migration = readFileSync('supabase/migrations/20260910000000_add_proposal_staffing.sql', 'utf8');
  assert.match(migration, /proposal_personnel jsonb not null default '\[\]'::jsonb/);
  assert.doesNotMatch(migration, /update public\.proposals/i);
});

test('unchanged RPIC preserves its saved bio when active Personnel data is unavailable', () => {
  assert.equal(resolveProposalRpicBioSnapshot('rpic-1', 'Saved historical bio', 'rpic-1', undefined), 'Saved historical bio');
  assert.equal(resolveProposalRpicBioSnapshot('rpic-1', 'Saved historical bio', 'rpic-1', null), 'Saved historical bio');
});

test('changing RPIC uses only the newly selected Personnel bio', () => {
  assert.equal(resolveProposalRpicBioSnapshot('rpic-1', 'Old bio', 'rpic-2', 'New bio'), 'New bio');
  assert.equal(resolveProposalRpicBioSnapshot('rpic-1', 'Old bio', 'rpic-2', null), null);
  assert.equal(resolveProposalRpicBioSnapshot('rpic-1', 'Old bio', null, undefined), null);
});

test('tracked project files contain no unresolved merge conflict markers', () => {
  const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n')
    .filter((file) => /^(src|supabase)\//.test(file) || /^(package|tsconfig|vite|postcss|tailwind)[^/]*\.(json|js|ts)$/.test(file));
  const unresolved = trackedFiles.filter((file) => /^(<<<<<<<|=======|>>>>>>>)/m.test(readFileSync(file, 'utf8')));
  assert.deepEqual(unresolved, []);
});
