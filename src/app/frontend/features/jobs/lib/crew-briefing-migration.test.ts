import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260903010000_crew_briefing_acknowledgments.sql', 'utf8');
const repairMigration = readFileSync('supabase/migrations/20260905010000_fix_crew_acknowledgment_p0.sql', 'utf8');
const sendFunction = readFileSync('supabase/functions/send-crew-acknowledgment/index.ts', 'utf8');

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

test('email function accepts supabase-js preflight and only marks Sent after provider success', () => {
  assert.match(sendFunction, /Access-Control-Allow-Headers[^\n]+x-client-info/);
  assert.match(sendFunction, /Deno\.env\.get\('RESEND_FROM'\)/);
  assert.doesNotMatch(sendFunction, /briefing@dronesms\.app/);
  const providerCheck = sendFunction.indexOf('if (!emailResponse.ok)');
  const sentUpdate = sendFunction.indexOf('p_sent: true');
  assert.ok(providerCheck > -1 && sentUpdate > providerCheck);
  assert.match(sendFunction, /if \(invitationId\)[^\n]+p_sent: false/);
});
