import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationsDirectory = new URL('../../../../../../supabase/migrations/', import.meta.url);
const orderedMigrations = readdirSync(migrationsDirectory)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => ({
    fileName,
    sql: readFileSync(new URL(fileName, migrationsDirectory), 'utf8'),
  }));
const migration = orderedMigrations.find(
  ({ fileName }) => fileName === '20260903000000_neutralize_legacy_risk_fields.sql',
)!.sql;
const jhaPage = readFileSync(new URL('../pages/job-hazard-analysis-page.tsx', import.meta.url), 'utf8');
const proposalPage = readFileSync(new URL('../pages/new-proposal-page.tsx', import.meta.url), 'utf8');
const proposalPdf = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
const smsPage = readFileSync(new URL('../../sms/pages/sms-page.tsx', import.meta.url), 'utf8');

const retainedCompatibilityFields = {
  jha_assessments: ['overall_risk_rating', 'assessor_name', 'assessment_date', 'rpic_printed_name'],
  proposals: ['risk'],
} as const;

test('retained compatibility fields survive the complete ordered migration history', () => {
  const migrationHistory = orderedMigrations.map(({ sql }) => sql).join('\n');

  for (const [table, columns] of Object.entries(retainedCompatibilityFields)) {
    const createTable = migrationHistory.match(
      new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\s*\\(([\\s\\S]*?)\\);`, 'i'),
    );
    assert.ok(createTable, `expected migration history to create public.${table}`);

    for (const column of columns) {
      assert.match(createTable[1], new RegExp(`(?:^|,)\\s*${column}\\s+`, 'im'));
    }

    for (const { fileName, sql } of orderedMigrations) {
      const tableAlterations = sql
        .split(';')
        .filter((statement) => new RegExp(`alter\\s+table\\s+public\\.${table}\\b`, 'i').test(statement));

      for (const statement of tableAlterations) {
        for (const column of columns) {
          assert.doesNotMatch(
            statement,
            new RegExp(`(?:drop\\s+column(?:\\s+if\\s+exists)?|rename\\s+column)\\s+${column}\\b`, 'i'),
            `${fileName} must retain public.${table}.${column}`,
          );
        }
      }
    }
  }
});

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
