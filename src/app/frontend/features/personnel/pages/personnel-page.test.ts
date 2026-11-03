import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const personnelPage = readFileSync(new URL('./personnel-page.tsx', import.meta.url), 'utf8');
const archiveMigration = readFileSync(new URL('../../../../../../supabase/migrations/20261016000000_archive_personnel_and_jobs.sql', import.meta.url), 'utf8');
const memberReadPolicyMigration = readFileSync(new URL('../../../../../../supabase/migrations/20261103000000_allow_members_to_read_organization_personnel.sql', import.meta.url), 'utf8');

test('personnel name requirement is visible and enforced by the browser', () => {
  const field = personnelPage.match(/Full name[\s\S]*?<\/label>/)?.[0];

  assert.ok(field, 'Full name field should be present');
  assert.match(field, /\(required\)/);
  assert.match(field, /\n\s+required\s*\n/);
});

test('the roster query archive field is provided by the personnel archive migration', () => {
  assert.match(personnelPage, /\.select\([^)]*archived_at/);
  assert.match(archiveMigration, /alter table public\.personnel add column if not exists archived_at timestamptz/);
});

test('active organization members can read the roster under the current membership model', () => {
  assert.match(memberReadPolicyMigration, /public\.is_organization_member\(organization_id\)/);
  assert.match(memberReadPolicyMigration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(memberReadPolicyMigration, /drop policy if exists "Users can view organization personnel"/);
});
