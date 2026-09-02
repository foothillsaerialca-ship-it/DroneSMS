import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../../../../../../supabase/migrations/20260902000000_safety_assurance.sql', import.meta.url), 'utf8');
const closeoutPage = readFileSync(new URL('../../jobs/pages/job-file-hub-page.tsx', import.meta.url), 'utf8');
const assuranceArea = readFileSync(new URL('../components/safety-assurance-area.tsx', import.meta.url), 'utf8');

test('closeout and assurance are persisted by one transactional database function', () => {
  assert.match(closeoutPage, /rpc\('save_operation_closeout_with_assurance'/);
  assert.doesNotMatch(closeoutPage, /from\('job_operation_closeouts'\)\s*\.upsert/);
  assert.match(migration, /insert into public\.job_operation_closeouts[\s\S]*insert into public\.safety_assurance_reviews/);
});

test('a replacement makes every prior Open review non-actionable without deleting history', () => {
  assert.match(migration, /review_status in \('Not Required','Open','Completed','Superseded'\)/);
  assert.match(migration, /set review_status='Superseded'.*review_status='Open'/);
  assert.match(migration, /where id=target_review_id and review_status='Open'/);
  assert.doesNotMatch(migration, /delete from public\.safety_assurance_reviews/);
});

test('review action state resets both when switching and after completion', () => {
  assert.match(assuranceArea, /setActionType\('No further action'\);setActionReference\(''\)/);
  assert.match(assuranceArea, /setSelectedId\(record\.id\);resetActionState\(record\)/);
  assert.match(assuranceArea, /setSelectedId\(''\);resetActionState\(\)/);
});

test('evidence has no direct insert or update grant and completion is narrowly controlled', () => {
  assert.match(migration, /grant select on public\.safety_assurance_reviews to authenticated/);
  assert.doesNotMatch(migration, /grant select,insert,update on public\.safety_assurance_reviews/);
  assert.match(migration, /Only the designated Safety Manager may complete this review/);
  assert.match(migration, /set review_status='Completed', review_notes=.*resulting_action_links=.*reviewed_by=.*reviewed_at=/);
});

test('all supplied relationship IDs are checked against the originating job and organization', () => {
  assert.match(migration, /Related JHA hazard is not part of this job/);
  assert.match(migration, /Related control is not part of this job/);
  assert.match(migration, /event\.job_id<>target_job\.id or event\.organization_id<>target_job\.organization_id/);
});
