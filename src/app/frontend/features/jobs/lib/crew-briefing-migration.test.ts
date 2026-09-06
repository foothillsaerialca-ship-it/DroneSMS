/**
 * File purpose: Verifies the crew-briefing database migration contains required integrity structures.
 * Fallback/error behavior: Test failures identify missing migration text or expected SQL safeguards.
 * Known limitation: Static assertions do not execute the migration against a database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260903010000_crew_briefing_acknowledgments.sql', 'utf8');
const repairMigration = readFileSync('supabase/migrations/20260905010000_fix_crew_acknowledgment_p0.sql', 'utf8');
const cryptoRepairMigration = readFileSync('supabase/migrations/20260905020000_fix_crew_invitation_crypto_schema.sql', 'utf8');
const anonymousRevocationMigration = readFileSync('supabase/migrations/20260906090000_revoke_anonymous_crew_briefing_acknowledgment.sql', 'utf8');
const anonymousLookupRevocationMigration = readFileSync('supabase/migrations/20260906100000_revoke_anonymous_crew_briefing_lookup.sql', 'utf8');
const sendFunction = readFileSync('supabase/functions/send-crew-acknowledgment/index.ts', 'utf8');

test('crew invitation resolves pgcrypto without widening its SECURITY DEFINER search path', () => {
  assert.match(cryptoRepairMigration, /create extension if not exists pgcrypto with schema extensions/i);
  assert.match(cryptoRepairMigration, /security definer set search_path=public/i);
  assert.match(cryptoRepairMigration, /extensions\.gen_random_bytes\(32\)/);
  assert.doesNotMatch(cryptoRepairMigration, /(?<!\.)gen_random_bytes\s*\(/i);
  assert.doesNotMatch(cryptoRepairMigration, /search_path\s*=\s*[^;\n$]*(?:extensions|anon|authenticated)/i);
});

test('crew invitation crypto repair preserves token and authorization semantics', () => {
  assert.match(cryptoRepairMigration, /encode\(extensions\.digest\(raw_token,'sha256'\),'hex'\)/);
  assert.match(cryptoRepairMigration, /now\(\)\+interval '7 days'/);
  assert.match(cryptoRepairMigration, /organization_id=public\.current_user_organization_id\(\)/);
  assert.match(cryptoRepairMigration, /r\.id is null or r\.user_id is distinct from auth\.uid\(\)/);
  assert.match(cryptoRepairMigration, /status='Superseded', token_hash=null/);
  assert.doesNotMatch(cryptoRepairMigration, /delete from public\.crew_briefing_acknowledgments/i);
});

test('every crew token RPC uses the same resolvable SHA-256 hash representation', () => {
  const functionNames = [
    'create_crew_briefing_invitation',
    'get_public_crew_briefing',
    'acknowledge_public_crew_briefing',
  ];

  for (const functionName of functionNames) {
    const start = cryptoRepairMigration.indexOf(`function public.${functionName}`);
    const body = cryptoRepairMigration.slice(start, cryptoRepairMigration.indexOf('end $$;', start));
    assert.ok(start >= 0, `${functionName} must be repaired`);
    assert.match(body, /security definer set search_path=public/i);
    assert.match(body, /encode\(extensions\.digest\((?:raw_token|p_token),'sha256'\),'hex'\)/);
    assert.doesNotMatch(body, /(?<!\.)digest\s*\(/i);
  }

  assert.doesNotMatch(cryptoRepairMigration, /(?<!\.)(?:gen_random_bytes|digest)\s*\(/i);
});

test('public token RPC repair retains no-login scope, expiry, and evidence invalidation', () => {
  assert.match(cryptoRepairMigration, /grant execute on function public\.get_public_crew_briefing\(text\) to anon, authenticated/i);
  assert.match(cryptoRepairMigration, /grant execute on function public\.acknowledge_public_crew_briefing\(text,text\) to anon, authenticated/i);
  assert.match(cryptoRepairMigration, /c\.token_expires_at is null or c\.token_expires_at <= now\(\)/);
  assert.match(cryptoRepairMigration, /c\.status<>'Sent'.+c\.token_expires_at<=now\(\)/);
  assert.match(cryptoRepairMigration, /status='Acknowledged',acknowledged_at=now\(\),typed_name=btrim\(p_typed_name\),token_hash=null/);
  assert.doesNotMatch(cryptoRepairMigration, /delete from public\.crew_briefing_acknowledgments/i);
});

test('crew briefing acknowledgment is no longer executable by anonymous callers', () => {
  assert.match(anonymousRevocationMigration, /revoke execute on function public\.acknowledge_public_crew_briefing\(text, text\) from anon;/i);
  assert.match(anonymousRevocationMigration, /grant execute on function public\.acknowledge_public_crew_briefing\(text, text\) to authenticated;/i);
});

test('crew briefing lookup is no longer executable by anonymous callers', () => {
  assert.match(anonymousLookupRevocationMigration, /revoke execute on function public\.get_public_crew_briefing\(text\) from anon;/i);
  assert.match(anonymousLookupRevocationMigration, /grant execute on function public\.get_public_crew_briefing\(text\) to authenticated;/i);
});

test('crew invitation crypto repair does not broaden RPC execution permissions', () => {
  const invitationRepair = cryptoRepairMigration.slice(
    cryptoRepairMigration.indexOf('function public.create_crew_briefing_invitation'),
    cryptoRepairMigration.indexOf('function public.get_public_crew_briefing'),
  );
  assert.match(cryptoRepairMigration, /revoke all on function public\.create_crew_briefing_invitation\(uuid\) from public/i);
  assert.match(cryptoRepairMigration, /grant execute on function public\.create_crew_briefing_invitation\(uuid\) to authenticated/i);
  assert.doesNotMatch(invitationRepair, /grant execute[^;]+to\s+(?:public|anon)\b/i);
});

test('RPIC lookup is not executable by PUBLIC or anonymous callers', () => {
  assert.match(migration, /revoke all on function public\.crew_briefing_assigned_rpic\(uuid\) from public/i);
  assert.doesNotMatch(migration, /grant execute on function public\.crew_briefing_assigned_rpic[^;]+to (anon|authenticated|public)/i);
});

test('every RPIC-only crew action fails closed for missing or different RPIC users', () => {
  for (const functionName of ['create_crew_briefing_invitation', 'mark_crew_briefing_email_result', 'record_manual_field_briefing']) {
    const start = migration.indexOf(`function public.${functionName}`);
    const body = migration.slice(start, migration.indexOf('end $$;', start));
    assert.match(body, /r\.id is null/);
    assert.match(body, /r\.user_id is distinct from auth\.uid\(\)/);
  }
  assert.match(migration, /grant execute on function public\.create_crew_briefing_invitation\(uuid\) to authenticated/);
  assert.match(migration, /grant execute on function public\.record_manual_field_briefing[^;]+to authenticated/);
});

test('all public briefing content sources independently advance briefing versions', () => {
  for (const field of ['job_type_scope', 'hazard_entries', 'ppe_requirements', 'crew_members', 'nearest_hospital', 'emergency_facility_address', 'emergency_contact', 'drone_incident_procedure', 'site_access', 'exclusion_zone_description', 'known_airspace_restrictions']) assert.match(migration, new RegExp(`new\\.${field}`), `${field} must be versioned`);
  for (const field of ['name', 'location', 'planned_date', 'service_type']) assert.match(migration, new RegExp(`new\\.${field}`));
  assert.match(migration, /before update on public\.jha_assessments/);
  assert.match(migration, /new\.briefing_version := old\.briefing_version\+1/);
  assert.match(migration, /after insert or update or delete on public\.job_personnel/);
});

test('operational crew changes version the briefing and preserve but stale readiness', () => {
  assert.match(migration, /perform public\.mark_job_operation_readiness_stale\(target_job_id,'Operational crew assignment changed'\)/);
  assert.match(migration, /update public\.jha_assessments set briefing_version=briefing_version\+1 where job_id=target_job_id/);
  assert.match(migration, /assigned_role in \('RPIC','Pilot','Visual Observer','Payload Operator','Ground Crew'\)/);
});

test('assignment deletion keeps durable evidence without allowing removed crew to block readiness', () => {
  assert.match(migration, /assignment_id uuid references public\.job_personnel\(id\) on delete set null/);
  assert.match(migration, /personnel_id uuid not null/);
  assert.match(migration, /assigned_role text not null/);
  assert.match(migration, /c\.assignment_id=a\.id/);
});

test('successful acknowledgment destroys token access but retains audit evidence', () => {
  assert.match(migration, /status='Acknowledged',acknowledged_at=now\(\),typed_name=btrim\(p_typed_name\),token_hash=null/);
  assert.match(migration, /where token_hash=encode\(digest\(p_token,'sha256'\),'hex'\) and status='Sent'/);
  assert.match(migration, /c\.token_expires_at is null or c\.token_expires_at <= now\(\)/);
  assert.doesNotMatch(migration, /delete from public\.crew_briefing_acknowledgments/i);
});

test('manual briefing repair matches the client RPC and persists current assignment evidence', () => {
  assert.match(repairMigration, /record_manual_field_briefing\(\s*p_assignment_id uuid,\s*p_reason text,\s*p_reason_detail text,\s*p_attested boolean\s*\)/);
  for (const value of ['j.organization_id', 'j.id', 'a.personnel_id', 'a.id', 'a.assigned_role', 'h.briefing_version', "'Manual Field Briefing'", 'p_reason', 'auth.uid()', 'r.id']) {
    assert.ok(repairMigration.includes(value), `${value} must be persisted`);
  }
  assert.match(repairMigration, /field_briefed_at[\s\S]+now\(\)/);
  assert.match(repairMigration, /r\.id is null or r\.user_id is distinct from auth\.uid\(\)/);
  assert.match(repairMigration, /crew_acknowledgment_required_at = coalesce/);
});

test('manual briefing repair preserves historical evidence and records the attesting RPIC', () => {
  assert.doesNotMatch(repairMigration, /delete from public\.crew_briefing_acknowledgments/i);
  assert.match(repairMigration, /attested_by_rpic_personnel_id uuid references public\.personnel/);
  assert.match(repairMigration, /briefing_version = h\.briefing_version/);
  assert.match(repairMigration, /grant execute on function public\.record_manual_field_briefing\(uuid,text,text,boolean\) to authenticated/);
});

test('historical attribution uses only the unambiguous RPIC assignment for that job', () => {
  const backfill = repairMigration.slice(
    repairMigration.indexOf('with unambiguous_job_rpics'),
    repairMigration.indexOf('create or replace function public.record_manual_field_briefing'),
  );
  assert.match(backfill, /jp\.job_id = c\.job_id/);
  assert.match(backfill, /jp\.organization_id = c\.organization_id/);
  assert.match(backfill, /jp\.assigned_role = 'RPIC'/);
  assert.match(backfill, /r\.id = jp\.personnel_id/);
  assert.match(backfill, /r\.user_id = c\.created_by_user_id/);
  assert.match(backfill, /having count\(distinct jp\.personnel_id\) = 1/);
  assert.match(backfill, /c\.attested_by_rpic_personnel_id is null/g);
  assert.doesNotMatch(backfill, /set attested_by_rpic_personnel_id = r\.id/);
});

test('email function accepts supabase-js preflight and only marks Sent after provider success', () => {
  assert.match(sendFunction, /Access-Control-Allow-Headers[^\n]+x-client-info/);
  assert.match(sendFunction, /Deno\.env\.get\('RESEND_FROM'\)/);
  assert.doesNotMatch(sendFunction, /briefing@dronesms\.app/);
  const providerCheck = sendFunction.indexOf('if (!emailResponse.ok)');
  const sentUpdate = sendFunction.indexOf('p_sent: true');
  assert.ok(providerCheck > -1 && sentUpdate > providerCheck);
  assert.match(sendFunction, /if \(invitationId\)[^\n]+p_sent: false/);
});
