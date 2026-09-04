import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationDirectory = 'supabase/migrations';
const migrationFiles = readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort();
const migrations = migrationFiles.map((file) => ({ file, sql: readFileSync(`${migrationDirectory}/${file}`, 'utf8') }));
const orderedSql = migrations.map(({ sql }) => sql).join('\n');
const hardeningMigration = migrations.find(({ file }) => file === '20260904000000_restrict_readiness_stale_helper.sql');

const helperSignature = String.raw`public\.mark_job_operation_readiness_stale\s*\(\s*uuid\s*,\s*text\s*\)`;

test('readiness staleness helper is denied to every client role by a forward migration', () => {
  assert.ok(hardeningMigration, 'the forward ACL migration must be present');
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(
      hardeningMigration.sql,
      new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+${helperSignature}\\s+from\\s+${role}\\s*;`, 'i'),
    );
  }
});

test('no later migration restores direct client execution', () => {
  const finalRevoke = orderedSql.toLowerCase().lastIndexOf('revoke execute on function public.mark_job_operation_readiness_stale');
  assert.notEqual(finalRevoke, -1);
  assert.doesNotMatch(
    orderedSql.slice(finalRevoke),
    new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${helperSignature}\\s+to\\s+(public|anon|authenticated)`, 'i'),
  );
});

test('existing trigger-driven invalidation callers remain wired to the internal helper', () => {
  const readinessMigration = readFileSync(`${migrationDirectory}/20260901010000_ready_to_operate.sql`, 'utf8');
  for (const triggerFunction of [
    'invalidate_readiness_from_jha',
    'invalidate_readiness_from_preflight',
    'invalidate_readiness_from_assignment',
    'invalidate_readiness_from_equipment',
  ]) {
    const functionStart = readinessMigration.indexOf(`function public.${triggerFunction}`);
    assert.notEqual(functionStart, -1, `${triggerFunction} must remain defined`);
    const functionBody = readinessMigration.slice(functionStart, readinessMigration.indexOf('end $$;', functionStart));
    assert.match(functionBody, /perform public\.mark_job_operation_readiness_stale\s*\(/i);
    assert.match(readinessMigration, new RegExp(`create\\s+trigger[^;]+execute\\s+function\\s+public\\.${triggerFunction}\\s*\\(\\s*\\)`, 'is'));
  }

  const crewMigration = readFileSync(`${migrationDirectory}/20260903010000_crew_briefing_acknowledgments.sql`, 'utf8');
  assert.match(crewMigration, /perform public\.mark_job_operation_readiness_stale\(new\.id,'Operation briefing content changed'\)/i);
  assert.match(crewMigration, /perform public\.mark_job_operation_readiness_stale\(target_job_id,'Operational crew assignment changed'\)/i);
});
