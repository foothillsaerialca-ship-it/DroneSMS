import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const migrationName = '20260905030000_security_advisor_function_acl_audit.sql';
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const baseMigration = readFileSync('supabase/migrations/20260524000000_merged.sql', 'utf8');
const settingsPage = readFileSync('src/app/frontend/features/settings/pages/settings-page.tsx', 'utf8');
const laterSql = readdirSync('supabase/migrations')
  .filter((name) => name > migrationName && name.endsWith('.sql'))
  .map((name) => readFileSync(`supabase/migrations/${name}`, 'utf8'))
  .join('\n');

const authenticatedRpcs = [
  ['accept_operational_jha_as_rpic', 'uuid'],
  ['review_operational_jha_as_safety_manager', 'uuid'],
  ['start_management_of_change', 'text,text,text,text,uuid,uuid,text,uuid'],
  ['approve_management_of_change', 'uuid,text,text'],
  ['correct_completed_management_of_change', 'uuid,jsonb,text'],
  ['save_operation_closeout_with_assurance', 'uuid,text,text,text,text,text,boolean,text,boolean,text[],text[],text[],uuid[]'],
  ['complete_safety_assurance_review', 'uuid,text,jsonb'],
  ['confirm_job_ready_to_operate', 'uuid,boolean'],
  ['create_crew_briefing_invitation', 'uuid'],
  ['mark_crew_briefing_email_result', 'uuid,boolean'],
  ['record_manual_field_briefing', 'uuid,text,text,boolean'],
] as const;

const internalFunctions = [
  ['capture_custom_hazard_reviews', ''],
  ['capture_safety_event_review', ''],
  ['log_moc_change', ''],
  ['log_moc_child_change', ''],
  ['crew_briefing_assigned_rpic', 'uuid'],
] as const;

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('authenticated business RPCs revoke inherited anonymous execution and retain authenticated access', () => {
  for (const [name, signature] of authenticatedRpcs) {
    const fn = `public.${name}(${signature})`;
    assert.match(migration, new RegExp(`revoke all on function ${escaped(fn)} from public, anon;`, 'i'), fn);
    assert.match(migration, new RegExp(`grant execute on function ${escaped(fn)} to authenticated;`, 'i'), fn);
  }
});

test('internal SECURITY DEFINER helpers have no broad client execution grants', () => {
  for (const [name, signature] of internalFunctions) {
    const fn = `public.${name}(${signature})`;
    assert.match(migration, new RegExp(`revoke all on function ${escaped(fn)} from public, anon, authenticated;`, 'i'), fn);
    assert.doesNotMatch(laterSql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${escaped(fn)}[^;]*to[^;]*(public|anon|authenticated)`, 'i'), fn);
  }
});

test('public token RPCs remain explicitly available without granting PUBLIC', () => {
  for (const [name, signature] of [['get_public_crew_briefing', 'text'], ['acknowledge_public_crew_briefing', 'text,text']]) {
    const fn = `public.${name}(${signature})`;
    assert.match(migration, new RegExp(`revoke all on function ${escaped(fn)} from public;`, 'i'));
    assert.match(migration, new RegExp(`grant execute on function ${escaped(fn)} to anon, authenticated;`, 'i'));
  }
});

test('all audited SECURITY DEFINER functions retain a controlled search_path', () => {
  const altered = [...migration.matchAll(/alter function public\.([a-z0-9_]+)\([^;]*?\) set search_path = pg_catalog, public;/gi)];
  assert.equal(altered.length, 21);
});

test('trigger paths remain wired and trigger helpers remain SECURITY DEFINER', () => {
  const schema = readdirSync('supabase/migrations').sort().map((name) => readFileSync(`supabase/migrations/${name}`, 'utf8')).join('\n');
  for (const name of ['capture_custom_hazard_reviews', 'capture_safety_event_review', 'log_moc_change', 'log_moc_child_change']) {
    assert.match(schema, new RegExp(`create or replace function public\\.${name}\\(\\) returns trigger[^$]*security definer`, 'i'));
    assert.match(schema, new RegExp(`execute function public\\.${name}\\(\\)`, 'i'));
  }
});

test('broad organization logo listing policy is replaced with organization-folder SELECT', () => {
  assert.match(migration, /drop policy if exists "Users can view organization logos" on storage\.objects/i);
  const scopedSelect = migration.slice(migration.indexOf('create policy "Users can view own organization logos"'));
  assert.match(scopedSelect, /for select\s+to authenticated/i);
  assert.match(scopedSelect, /bucket_id = 'organization-logos'/i);
  assert.match(scopedSelect, /profiles\.id = auth\.uid\(\)/i);
  assert.match(scopedSelect, /profiles\.organization_id::text = \(storage\.foldername\(name\)\)\[1\]/i);
  assert.doesNotMatch(scopedSelect, /\bto anon\b|\bto public\b/i);
  assert.doesNotMatch(migration, /create policy "Users can view organization logos"/i);
});

test('logo bucket remains public and existing organization-scoped write policies remain intact', () => {
  assert.match(baseMigration, /values \(\s*'organization-logos',\s*'organization-logos',\s*true,/i);
  for (const operation of ['insert', 'update', 'delete']) {
    const policyName = `${operation === 'insert' ? 'upload' : operation} organization logos`;
    const policyStart = baseMigration.indexOf(`create policy "Users can ${policyName}"`);
    const policy = baseMigration.slice(policyStart, baseMigration.indexOf(';', policyStart));
    assert.match(policy, /bucket_id = 'organization-logos'/i, operation);
    assert.match(policy, /profiles\.id = auth\.uid\(\)/i, operation);
    assert.match(policy, /profiles\.organization_id::text = \(storage\.foldername\(name\)\)\[1\]/i, operation);
  }
  assert.doesNotMatch(migration, /update\s+storage\.buckets|public\s*=\s*false/i);
});

test('settings logo workflow uses the organization folder and remains compatible with scoped policies', () => {
  assert.match(settingsPage, /return `\$\{organizationId\}\/logo-\$\{Date\.now\(\)\}\.\$\{extension\}`/);
  assert.match(settingsPage, /\.upload\(logoPath, file,[\s\S]*?upsert: true/);
  assert.match(settingsPage, /\.getPublicUrl\(logoPath\)/);
  assert.match(settingsPage, /\.remove\(\[settings\.logoPath\]\)/);
});
