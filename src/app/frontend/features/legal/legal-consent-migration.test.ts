import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20261031010000_legal_document_consent.sql', 'utf8');

test('profiles store explicit versioned acceptance flags and timestamps', () => {
  for (const column of [
    'terms_of_service_accepted boolean not null default false',
    'terms_of_service_accepted_at timestamptz',
    'terms_of_service_accepted_version text',
    'privacy_policy_accepted boolean not null default false',
    'privacy_policy_accepted_at timestamptz',
    'privacy_policy_accepted_version text',
  ]) assert.ok(migration.includes(column), column);
});

test('changing either legal version resets that acceptance across all profiles', () => {
  assert.match(migration, /new\.terms_of_service_version is distinct from old\.terms_of_service_version[\s\S]*?terms_of_service_accepted = false[\s\S]*?terms_of_service_accepted_at = null/);
  assert.match(migration, /new\.privacy_policy_version is distinct from old\.privacy_policy_version[\s\S]*?privacy_policy_accepted = false[\s\S]*?privacy_policy_accepted_at = null/);
});

test('clients cannot forge acceptance fields and RPC acceptance is authenticated and version-bound', () => {
  assert.match(migration, /guard_profile_legal_acceptance\(\)[\s\S]*?Legal document acceptance must be recorded through the acceptance workflow/);
  assert.match(migration, /auth\.uid\(\) is null then raise exception 'Authentication is required\.'/);
  assert.match(migration, /expected_terms_version is distinct from current_versions\.terms_of_service_version/);
  assert.match(migration, /expected_privacy_version is distinct from current_versions\.privacy_policy_version/);
  assert.match(migration, /grant execute on function public\.accept_current_legal_documents\(text, text\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.accept_current_legal_documents\(text, text\) to public|grant execute on function public\.accept_current_legal_documents\(text, text\) to anon/i);
});
