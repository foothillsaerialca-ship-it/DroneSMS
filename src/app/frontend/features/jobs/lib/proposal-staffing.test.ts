import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeProposalPersonnel } from './workflow-types.ts';
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

test('proposal flow stores snapshots, seeds independent job assignments, and keeps qualifications read-only', () => {
  const form = readFileSync(new URL('../pages/new-proposal-page.tsx', import.meta.url), 'utf8');
  const conversion = readFileSync(new URL('../pages/jobs-page.tsx', import.meta.url), 'utf8');
  const pdf = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
  assert.match(form, /proposal_personnel: selectedPersonnel/);
  assert.match(form, /Qualifications \/ certifications \(read-only\)/);
  assert.doesNotMatch(form, /\.from\('personnel'\)\s*\.update/);
  assert.match(conversion, /\.from\("job_personnel"\)\s*\.insert\(personnelAssignments\)/s);
  assert.match(pdf, /normalizeProposalPersonnel\(proposal\.proposal_personnel\)/);
  assert.doesNotMatch(pdf, /\.from\('job_personnel'\)[\s\S]{0,200}converted_job_id/);
});

test('migration defaults historical proposal staffing without rewriting old records', () => {
  const migration = readFileSync('supabase/migrations/20260910000000_add_proposal_staffing.sql', 'utf8');
  assert.match(migration, /proposal_personnel jsonb not null default '\[\]'::jsonb/);
  assert.doesNotMatch(migration, /update public\.proposals/i);
});
