import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../../../../../../supabase/migrations/20260903000000_neutralize_legacy_risk_fields.sql', import.meta.url), 'utf8');
const jhaPage = readFileSync(new URL('../pages/job-hazard-analysis-page.tsx', import.meta.url), 'utf8');
const proposalPage = readFileSync(new URL('../pages/new-proposal-page.tsx', import.meta.url), 'utf8');
const proposalPdf = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
const smsPage = readFileSync(new URL('../../sms/pages/sms-page.tsx', import.meta.url), 'utf8');

test('new JHAs have no default operational risk classification while historical values remain intact', () => {
  assert.match(migration, /alter column overall_risk_rating drop default/);
  assert.match(migration, /alter column overall_risk_rating drop not null/);
  assert.doesNotMatch(migration, /update\s+public\.jha_assessments/i);
  assert.doesNotMatch(jhaPage, /overall_risk_rating|risk_rating|risk_score|residual_risk/);
});

test('proposal creation, conversion, rendering, and exports omit legacy classified-risk fields', () => {
  for (const activePath of [proposalPage, proposalPdf]) {
    assert.doesNotMatch(activePath, /overall_risk_rating|risk_rating|risk_score|residual_risk/);
    assert.doesNotMatch(activePath, /(?:^|[, {])risk(?:\s*[:,}]|\b)/m);
  }
  assert.match(proposalPdf, /hazard_assessment/);
  assert.match(proposalPdf, /proposed_mitigation/);
});

test('active SMS UI retains the SMS pillar without advertising matrix configuration or classifications', () => {
  assert.match(smsPage, /Safety Risk Management/);
  assert.doesNotMatch(smsPage, /Risk Matrix|\b(?:Low|Medium|High) Risk\b/);
});
