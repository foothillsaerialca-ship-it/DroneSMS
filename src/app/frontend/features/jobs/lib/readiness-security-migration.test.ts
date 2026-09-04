import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationDirectory = 'supabase/migrations';
const migrationName = '20260904000000_harden_readiness_invalidation.sql';
const migration = readFileSync(`${migrationDirectory}/${migrationName}`, 'utf8');
const allMigrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(`${migrationDirectory}/${name}`, 'utf8') }));

const wrappers = [
  'invalidate_readiness_from_jha',
  'invalidate_readiness_from_preflight',
  'invalidate_readiness_from_assignment',
  'invalidate_readiness_from_equipment',
  'advance_crew_briefing_version_from_job',
  'advance_crew_briefing_version_from_assignment',
] as const;

test('readiness stale helper is denied to every broad client role', () => {
  assert.match(migration, /revoke all on function public\.mark_job_operation_readiness_stale\(uuid, text\) from public;/i);
  assert.match(migration, /revoke all on function public\.mark_job_operation_readiness_stale\(uuid, text\) from anon, authenticated;/i);
});

test('no migration after the hardening migration restores client helper execution', () => {
  const hardeningIndex = allMigrations.findIndex(({ name }) => name === migrationName);
  assert.notEqual(hardeningIndex, -1);
  const subsequentSql = allMigrations.slice(hardeningIndex).map(({ sql }) => sql).join('\n');
  assert.doesNotMatch(
    subsequentSql,
    /grant\s+execute\s+on\s+function\s+public\.mark_job_operation_readiness_stale\s*\(uuid\s*,\s*text\)[^;]*\bto\s+(public|anon|authenticated)\b/i,
  );
});

test('every readiness helper caller is a locked-down security-definer trigger wrapper', () => {
  const callers = allMigrations
    .flatMap(({ sql }) => [...sql.matchAll(/perform\s+public\.mark_job_operation_readiness_stale\s*\(/gi)])
    .length;
  assert.equal(callers, 7, 'review the execution context of every new helper call site');

  const historicalSql = allMigrations.map(({ sql }) => sql).join('\n');

  for (const wrapper of wrappers) {
    assert.match(
      historicalSql,
      new RegExp(`function public\\.${wrapper}\\(\\)[\\s\\S]*?mark_job_operation_readiness_stale\\([\\s\\S]*?end \\$\\$;`, 'i'),
      `${wrapper} must remain a helper caller`,
    );
    assert.match(migration, new RegExp(`alter function public\\.${wrapper}\\(\\) security definer;`, 'i'));
    assert.match(migration, new RegExp(`alter function public\\.${wrapper}\\(\\) set search_path = pg_catalog, public;`, 'i'));
    assert.match(migration, new RegExp(`revoke all on function public\\.${wrapper}\\(\\) from public, anon, authenticated;`, 'i'));
  }
});

test('JHA, preflight, job, RPIC/crew, equipment, and briefing invalidation stay wired', () => {
  const sql = allMigrations.map(({ sql }) => sql).join('\n');
  const expectedWiring = [
    /after update on public\.jha_assessments[\s\S]*execute function public\.invalidate_readiness_from_jha\(\)/i,
    /after update on public\.preflight_checklists[\s\S]*execute function public\.invalidate_readiness_from_preflight\(\)/i,
    /after insert or update or delete on public\.job_personnel[\s\S]*execute function public\.invalidate_readiness_from_assignment\(\)/i,
    /after insert or update or delete on public\.job_equipment[\s\S]*execute function public\.invalidate_readiness_from_equipment\(\)/i,
    /before update on public\.jobs[\s\S]*execute function public\.advance_crew_briefing_version_from_job\(\)/i,
    /after insert or update or delete on public\.job_personnel[\s\S]*execute function public\.advance_crew_briefing_version_from_assignment\(\)/i,
  ];
  for (const trigger of expectedWiring) assert.match(sql, trigger);

  for (const reason of [
    'JHA or its required attestations changed',
    'Pre-flight checklist changed or returned to Draft',
    'Assigned RPIC changed',
    'Aircraft or capability assignment changed',
    'Operation briefing content changed',
    'Operational crew assignment changed',
  ]) assert.match(sql, new RegExp(`mark_job_operation_readiness_stale\\([^;]+${reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});
