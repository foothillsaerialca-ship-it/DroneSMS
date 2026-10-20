/**
 * File purpose: Verifies the platform admin migration keeps admin data closed to browsers and every admin RPC gated.
 * Fallback/error behavior: Test failures flag a missing admin check, grant, or browser write path.
 * Known limitation: This test validates migration source text rather than the hosted database state.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const migrationName = '20261021000000_platform_admins.sql';
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const laterSql = readdirSync('supabase/migrations')
  .filter((name) => name > migrationName && name.endsWith('.sql'))
  .map((name) => readFileSync(`supabase/migrations/${name}`, 'utf8'))
  .join('\n');

const adminRpcs = [
  ['list_platform_admins', ''],
  ['grant_platform_admin', 'text, text'],
  ['revoke_platform_admin', 'uuid'],
  ['set_app_setting', 'text, jsonb']
] as const;

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function functionBody(name: string) {
  const match = migration.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, 'i'));
  assert.ok(match, `${name} is defined`);
  return match[1];
}

test('admin tables have RLS on and no browser write access', () => {
  for (const table of ['platform_admins', 'app_settings', 'platform_admin_audit']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`, 'i'), table);
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated;`, 'i'), table);
    assert.doesNotMatch(migration + laterSql, new RegExp(`grant[^;]*(insert|update|delete|all)[^;]*on table public\\.${table}[^;]*to[^;]*(anon|authenticated)`, 'i'), table);
  }
  assert.doesNotMatch(migration, /policy[^;]*on public\.platform_admins/i);
});

test('settings are readable by everyone but the audit log only by admins', () => {
  assert.match(migration, /grant select on table public\.app_settings to anon, authenticated;/i);
  assert.match(migration, /on public\.platform_admin_audit for select to authenticated\s+using \(\(select public\.is_platform_admin\(\)\)\);/i);
});

test('every admin RPC checks admin status before doing anything', () => {
  for (const [name] of adminRpcs) {
    const body = functionBody(name);
    assert.match(body, /^\s*(declare[\s\S]*?)?begin\s+if not public\.is_platform_admin\(\) then raise exception/i, name);
  }
});

test('admin functions are SECURITY DEFINER with a fixed search_path and no anonymous execution', () => {
  for (const [name, signature] of [...adminRpcs, ['is_platform_admin', ''] as const]) {
    assert.match(migration, new RegExp(`function public\\.${name}\\([^$]*security definer set search_path = pg_catalog, public`, 'i'), name);
    const fn = `public.${name}(${signature})`;
    assert.match(migration, new RegExp(`revoke all on function ${escaped(fn)} from public, anon;`, 'i'), fn);
    assert.match(migration, new RegExp(`grant execute on function ${escaped(fn)} to authenticated;`, 'i'), fn);
  }
});

test('the last admin cannot be removed and every change is audited', () => {
  const revoke = functionBody('revoke_platform_admin');
  assert.match(revoke, /lock table public\.platform_admins/i);
  assert.match(revoke, /You cannot remove the last admin\./);
  for (const [name] of adminRpcs.filter(([name]) => name !== 'list_platform_admins')) {
    assert.match(functionBody(name), /insert into public\.platform_admin_audit/i, name);
  }
});

test('the beta welcome setting is seeded on', () => {
  assert.match(migration, /values \('beta_welcome_enabled', 'true'::jsonb\)\s+on conflict \(key\) do nothing;/i);
});
