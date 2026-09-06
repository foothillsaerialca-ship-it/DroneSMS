/**
 * File purpose: Audits readiness-related migrations for required security and invalidation wiring.
 * Fallback/error behavior: Assertions identify missing policy, trigger, function, or schema protections.
 * Known limitation: Static migration inspection cannot prove behavior of a deployed database.
 */
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
const wrapperReasons = new Map<typeof wrappers[number], string>([
  ['invalidate_readiness_from_jha', 'JHA or its required attestations changed'],
  ['invalidate_readiness_from_preflight', 'Pre-flight checklist changed or returned to Draft'],
  ['invalidate_readiness_from_assignment', 'Assigned RPIC changed'],
  ['invalidate_readiness_from_equipment', 'Aircraft or capability assignment changed'],
  ['advance_crew_briefing_version_from_job', 'Operation briefing content changed'],
  ['advance_crew_briefing_version_from_assignment', 'Operational crew assignment changed'],
]);

type WrapperState = { body: string; securityDefiner: boolean; searchPath: string | null };
type TriggerState = { table: string; functionName: string; enabled: boolean };

function normalizedSearchPath(value: string) {
  return value.replace(/["'\s]/g, '').toLowerCase();
}

function deriveFinalMigrationState() {
  const functions = new Map<string, WrapperState>();
  const triggers = new Map<string, TriggerState>();

  for (const { sql } of allMigrations) {
    const events: Array<{ index: number; apply: () => void }> = [];

    for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(\s*\)\s+returns\s+trigger\b([\s\S]*?)\$\$([\s\S]*?)\$\$\s*;/gi)) {
      const [, name, attributes, body] = match;
      if (!wrappers.includes(name as typeof wrappers[number])) continue;
      events.push({
        index: match.index,
        apply: () => {
          const configuredPath = attributes.match(/set\s+search_path\s*(?:=|to)\s*([\w\s,"]+?)(?=\s+as\s*$|\s+(?:language|security)\b|$)/i);
          functions.set(name, {
            body,
            securityDefiner: /\bsecurity\s+definer\b/i.test(attributes),
            searchPath: configuredPath?.[1] ?? null,
          });
        },
      });
    }

    for (const match of sql.matchAll(/alter\s+function\s+public\.(\w+)\s*\(\s*\)\s+(security\s+(?:definer|invoker)|set\s+search_path\s*(?:=|to)\s*([^;]+)|reset\s+search_path)\s*;/gi)) {
      const [, name, action, path] = match;
      if (!wrappers.includes(name as typeof wrappers[number])) continue;
      events.push({
        index: match.index,
        apply: () => {
          const current = functions.get(name);
          assert.ok(current, `cannot alter missing wrapper ${name}`);
          if (/^security\s+/i.test(action)) current.securityDefiner = /definer/i.test(action);
          else current.searchPath = /^reset/i.test(action) ? null : path;
        },
      });
    }

    for (const match of sql.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?public\.(\w+)\s*\(\s*\)\s*(?:cascade|restrict)?\s*;/gi)) {
      const name = match[1];
      if (wrappers.includes(name as typeof wrappers[number])) events.push({ index: match.index, apply: () => functions.delete(name) });
    }

    for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?trigger\s+(\w+)\b[\s\S]*?\bon\s+public\.(\w+)\b[\s\S]*?execute\s+function\s+public\.(\w+)\s*\(\s*\)\s*;/gi)) {
      const [, triggerName, table, functionName] = match;
      events.push({ index: match.index, apply: () => triggers.set(`${table}.${triggerName}`, { table, functionName, enabled: true }) });
    }

    for (const match of sql.matchAll(/drop\s+trigger\s+(?:if\s+exists\s+)?(\w+)\s+on\s+public\.(\w+)\s*;/gi)) {
      const [, triggerName, table] = match;
      events.push({ index: match.index, apply: () => triggers.delete(`${table}.${triggerName}`) });
    }

    for (const match of sql.matchAll(/alter\s+trigger\s+(\w+)\s+on\s+public\.(\w+)\s+rename\s+to\s+(\w+)\s*;/gi)) {
      const [, oldName, table, newName] = match;
      events.push({
        index: match.index,
        apply: () => {
          const trigger = triggers.get(`${table}.${oldName}`);
          if (trigger) {
            triggers.delete(`${table}.${oldName}`);
            triggers.set(`${table}.${newName}`, trigger);
          }
        },
      });
    }

    for (const match of sql.matchAll(/alter\s+table\s+(?:only\s+)?public\.(\w+)\s+(enable|disable)\s+trigger\s+(\w+)\s*;/gi)) {
      const [, table, action, triggerName] = match;
      events.push({
        index: match.index,
        apply: () => {
          const trigger = triggers.get(`${table}.${triggerName}`);
          if (trigger) trigger.enabled = action.toLowerCase() === 'enable';
        },
      });
    }

    for (const match of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?public\.(\w+)\b[^;]*;/gi)) {
      const table = match[1];
      events.push({
        index: match.index,
        apply: () => {
          for (const [key, trigger] of triggers) if (trigger.table === table) triggers.delete(key);
        },
      });
    }

    events.sort((left, right) => left.index - right.index).forEach(({ apply }) => apply());
  }

  return { functions, triggers };
}

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
    /grant\s+execute\s+on\s+function\s+public\.mark_job_operation_readiness_stale\s*\(uuid\s*,\s*text\)[^;]*\bto\b[^;]*\b(public|anon|authenticated)\b/i,
  );
});

test('every effective readiness helper caller is a locked-down security-definer trigger wrapper', () => {
  const callers = allMigrations
    .flatMap(({ sql }) => [...sql.matchAll(/perform\s+public\.mark_job_operation_readiness_stale\s*\(/gi)])
    .length;
  assert.equal(callers, 7, 'review the execution context of every new helper call site');

  const { functions } = deriveFinalMigrationState();

  for (const wrapper of wrappers) {
    const effective = functions.get(wrapper);
    assert.ok(effective, `${wrapper} must exist in the final migration state`);
    assert.match(effective.body, /perform\s+public\.mark_job_operation_readiness_stale\s*\(/i, `${wrapper} must remain a helper caller`);
    assert.match(effective.body, new RegExp(wrapperReasons.get(wrapper)!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${wrapper} must retain its stale reason`);
    assert.equal(effective.securityDefiner, true, `${wrapper} must remain SECURITY DEFINER`);
    assert.equal(normalizedSearchPath(effective.searchPath ?? ''), 'pg_catalog,public', `${wrapper} must retain its controlled search_path`);
    assert.match(migration, new RegExp(`revoke all on function public\\.${wrapper}\\(\\) from public, anon, authenticated;`, 'i'));
  }
});

test('effective JHA, preflight, job, RPIC/crew, equipment, and briefing triggers stay wired', () => {
  const { triggers } = deriveFinalMigrationState();
  const expectedWiring = new Map([
    ['jha_assessments.invalidate_readiness_from_jha', 'invalidate_readiness_from_jha'],
    ['preflight_checklists.invalidate_readiness_from_preflight', 'invalidate_readiness_from_preflight'],
    ['job_personnel.invalidate_readiness_from_assignment', 'invalidate_readiness_from_assignment'],
    ['job_equipment.invalidate_readiness_from_equipment', 'invalidate_readiness_from_equipment'],
    ['jobs.advance_crew_briefing_version_from_job', 'advance_crew_briefing_version_from_job'],
    ['job_personnel.advance_crew_briefing_version_from_assignment', 'advance_crew_briefing_version_from_assignment'],
  ]);
  for (const [trigger, functionName] of expectedWiring) {
    assert.equal(triggers.get(trigger)?.functionName, functionName, `${trigger} must exist and invoke ${functionName}`);
    assert.equal(triggers.get(trigger)?.enabled, true, `${trigger} must remain enabled`);
  }

});
