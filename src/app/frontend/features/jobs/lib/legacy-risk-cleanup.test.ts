import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../../../../../../supabase/migrations/20260903000000_neutralize_legacy_risk_fields.sql', import.meta.url), 'utf8');
const jhaPage = readFileSync(new URL('../pages/job-hazard-analysis-page.tsx', import.meta.url), 'utf8');
const proposalPage = readFileSync(new URL('../pages/new-proposal-page.tsx', import.meta.url), 'utf8');
const proposalPdf = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
const smsPage = readFileSync(new URL('../../sms/pages/sms-page.tsx', import.meta.url), 'utf8');
const mergedSchema = readFileSync(new URL('../../../../../../supabase/migrations/20260524000000_merged.sql', import.meta.url), 'utf8');
const readinessMigration = readFileSync(new URL('../../../../../../supabase/migrations/20260903010000_crew_briefing_acknowledgments.sql', import.meta.url), 'utf8');

test('new JHAs have no default operational risk classification while historical values remain intact', () => {
  assert.match(migration, /alter column overall_risk_rating drop default/);
  assert.match(migration, /alter column overall_risk_rating drop not null/);
  assert.doesNotMatch(migration, /update\s+public\.jha_assessments/i);
  assert.doesNotMatch(jhaPage, /overall_risk_rating|risk_rating|risk_score|residual_risk/);
  assert.match(mergedSchema, /overall_risk_rating text not null default 'Low'/);
  assert.match(mergedSchema, /assessor_name text,\s+assessment_date date,\s+rpic_printed_name text,/);
});

test('proposal creation, conversion, rendering, and exports omit legacy classified-risk fields', () => {
  for (const activePath of [proposalPage, proposalPdf]) {
    assert.doesNotMatch(activePath, /overall_risk_rating|risk_rating|risk_score|residual_risk/);
    assert.doesNotMatch(activePath, /(?:^|[, {])risk(?:\s*[:,}]|\b)/m);
  }
  assert.match(proposalPdf, /hazard_assessment/);
  assert.match(proposalPdf, /proposed_mitigation/);
});

test('legacy JHA identity fields remain readable while current attestations provide identity evidence', () => {
  assert.match(jhaPage, /stop_work_authority_acknowledged/);
  assert.match(jhaPage, /safety_manager_name/);
  assert.match(jhaPage, /rpic_name/);
  assert.doesNotMatch(jhaPage, /assessor_name|assessment_date|rpic_printed_name/);
});

test('completion and readiness do not depend on scored-risk or legacy identity fields', () => {
  for (const activePath of [jhaPage, readinessMigration]) {
    assert.doesNotMatch(activePath, /overall_risk_rating|risk_score|residual_risk|assessor_name|assessment_date|rpic_printed_name/);
  }
  assert.match(readinessMigration, /jha\.status<>'Complete'/);
  assert.match(readinessMigration, /jha\.safety_manager_reviewed_at is null/);
  assert.match(readinessMigration, /jha\.rpic_accepted_at is null/);
  assert.match(readinessMigration, /not jha\.controls_in_place/);
  assert.match(readinessMigration, /Manual Field Briefing/);
});

test('active SMS UI retains the SMS pillar without advertising matrix configuration or classifications', () => {
  assert.match(smsPage, /Safety Risk Management/);
  assert.doesNotMatch(smsPage, /Risk Matrix|\b(?:Low|Medium|High) Risk\b/);
});
