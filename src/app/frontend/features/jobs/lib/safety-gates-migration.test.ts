/**
 * File purpose: Verifies the operational safety gates migration enforces JHA completion, readiness resource checks, overrides, and closeout gating.
 * Fallback/error behavior: Test failures flag a missing or weakened server-side gate.
 * Known limitation: This test validates migration source text rather than the hosted database state.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20261022000000_enforce_operational_safety_gates.sql', 'utf8');

test('a JHA can only become Complete with confirmations and current sign-offs', () => {
  assert.match(migration, /create trigger z_enforce_jha_completion\s+before insert or update on public\.jha_assessments/i);
  for (const clause of ['new.crew_briefed', 'new.controls_in_place', 'new.safety_manager_reviewed_at is not null', 'new.safety_manager_review_stale', 'new.rpic_accepted_at is not null', 'new.rpic_acceptance_stale']) {
    assert.ok(migration.includes(clause), clause);
  }
  assert.match(migration, /old\.status = 'Complete' then\s+new\.status := 'Draft';/);
  assert.match(migration, /revoke all on function public\.z_enforce_jha_completion\(\) from public, anon, authenticated;/i);
});

test('Ready to Operate checks the RPIC, equipment status, drone registration, and overrides', () => {
  assert.match(migration, /assigned_rpic\.part_107_certificate_number/);
  assert.match(migration, /assigned_rpic\.part_107_expiration_date < current_date/);
  assert.match(migration, /e\.status in \('Maintenance','Inactive','Retired'\)/);
  assert.match(migration, /e\.equipment_type='Drone' and nullif\(btrim\(coalesce\(e\.faa_registration_number,''\)\),''\) is null/);
  assert.match(migration, /o\.item_type='maintenance_overdue' and o\.item_id=e\.id and o\.item_date=e\.maintenance_due_date/);
  assert.match(migration, /o\.item_type='training_expired' and o\.item_id=p\.id and o\.item_date=p\.training_expiration_date/);
});

test('only the designated Safety Manager can record an override, and the table is read-only to clients', () => {
  assert.match(migration, /reviewer\.user_id is distinct from auth\.uid\(\) then raise exception 'Only the designated Safety Manager can record an override\.'/);
  assert.match(migration, /revoke all on public\.job_readiness_overrides from anon, authenticated;\s+grant select on public\.job_readiness_overrides to authenticated;/);
  assert.match(migration, /revoke all on function public\.record_job_readiness_override\(uuid, text, uuid, text\) from public, anon;/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*job_readiness_overrides/i);
});

test('closeout requires a current Ready to Operate approval unless the job was aborted or delayed', () => {
  assert.match(migration, /operation_result_value not in \('Aborted','Delayed'\) and not exists \(\s+select 1 from public\.job_operation_readiness r\s+where r\.job_id=target_job\.id and r\.approved_at is not null and not r\.approval_stale and r\.fitness_for_duty_confirmed/);
});
