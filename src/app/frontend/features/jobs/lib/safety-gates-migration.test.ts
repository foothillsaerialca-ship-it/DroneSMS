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

test('direct closeout table writes are held to the same Ready to Operate rule', () => {
  assert.match(migration, /create trigger z_enforce_closeout_readiness\s+before insert or update on public\.job_operation_closeouts/i);
  assert.match(migration, /new\.operation_result not in \('Aborted','Delayed'\)\s+and \(tg_op = 'INSERT' or new\.operation_result is distinct from old\.operation_result/);
  assert.match(migration, /revoke all on function public\.z_enforce_closeout_readiness\(\) from public, anon, authenticated;/i);
});

const reminderMigration = readFileSync('supabase/migrations/20261023000000_overdue_maintenance_reminder_only.sql', 'utf8');

test('overdue maintenance no longer blocks Ready to Operate, while the other gates stay', () => {
  assert.doesNotMatch(reminderMigration, /maintenance_due_date/);
  assert.match(reminderMigration, /assigned_rpic\.part_107_expiration_date < current_date/);
  assert.match(reminderMigration, /e\.status in \('Maintenance','Inactive','Retired'\)/);
  assert.match(reminderMigration, /o\.item_type='training_expired' and o\.item_id=p\.id and o\.item_date=p\.training_expiration_date/);
  assert.match(reminderMigration, /revoke all on function public\.confirm_job_ready_to_operate\(uuid, boolean\) from public, anon;/);
});

const part107Migration = readFileSync('supabase/migrations/20261031000000_part107_operational_compliance_gates.sql', 'utf8');

test('Part 107 weather, ATC authorization, aircraft condition, and Remote ID are server-enforced', () => {
  assert.match(part107Migration, /visibility_distance_sm numeric/);
  assert.match(part107Migration, /cloud_clearance_below_ft numeric/);
  assert.match(part107Migration, /cloud_horizontal_distance_ft numeric/);
  assert.match(part107Migration, /new\.visibility_distance_sm < 3/);
  assert.match(part107Migration, /new\.cloud_clearance_below_ft < 500/);
  assert.match(part107Migration, /new\.cloud_horizontal_distance_ft < 2000/);
  assert.match(part107Migration, /faa_airspace_class in \('B', 'C', 'D'\)/);
  assert.match(part107Migration, /e\.airworthy_confirmed is distinct from true/);
  assert.match(part107Migration, /e\.remote_id_status is null/);
  assert.match(part107Migration, /target_jha\.wind_speed > e\.maximum_wind_speed_mph/);
});

test('Part 107 certificate does not expire, recurrent training remains gated, and reportability gets a ten-day deadline', () => {
  assert.match(part107Migration, /assigned_rpic\.part_107_expiration_date is null or assigned_rpic\.part_107_expiration_date < current_date/);
  assert.match(part107Migration, /part_107_expiration_date[\s\S]*?recurrent-training due date, with no override/);
  assert.match(part107Migration, /occurred_at \+ 10/);
  assert.match(part107Migration, /non_suas_property_damage_cost_usd, 0\) > 500/);
  assert.match(part107Migration, /non_suas_property_fair_market_value_usd, 0\) > 500/);
  assert.match(part107Migration, /faa_reportability_assessed/);
});

test('regulatory JHA changes invalidate readiness with definer privileges', () => {
  assert.match(part107Migration, /function public\.zy_invalidate_regulatory_jha_review\(\)[\s\S]*?security definer[\s\S]*?update public\.job_operation_readiness/i);
});

test('MOC approval requires completed impact answers and written comments for No or Unsure', () => {
  assert.match(part107Migration, /answer is null or answer not in \('Yes', 'No', 'Unsure'\)/);
  assert.match(part107Migration, /answer in \('No', 'Unsure'\).*nullif\(btrim\(coalesce\(new\.safety_review_comments, ''\)\), ''\) is null/s);
});
