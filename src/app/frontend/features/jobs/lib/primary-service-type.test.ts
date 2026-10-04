import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyPrimaryServiceTypeDefault, resolveInitialJobServiceType, serviceTypes } from './workflow-types.ts';

const newJobPage = readFileSync(new URL('../pages/new-job-page.tsx', import.meta.url), 'utf8');
const settingsPage = readFileSync(new URL('../../settings/pages/settings-page.tsx', import.meta.url), 'utf8');
const organizationSettings = readFileSync(new URL('../../settings/lib/organization-settings.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../../../../supabase/migrations/20261004000000_add_primary_service_type.sql', import.meta.url), 'utf8');

test('a configured primary service type initializes a new job without restricting its options', () => {
  assert.equal(resolveInitialJobServiceType('Cleaning Operations'), 'Cleaning Operations');
  assert.deepEqual([...serviceTypes], ['Cleaning Operations', 'Thermal Inspection', 'Roof Inspection', 'Agricultural', 'Mapping / Surveying', 'Construction Progress', 'Real Estate / Property Media', 'Custom Operation']);
  assert.match(newJobPage, /serviceTypes\.map\(\(serviceType\) =>/);
});

test('a user-selected service type remains the value written to a new job', () => {
  const form = { serviceType: resolveInitialJobServiceType('Cleaning Operations') as string };
  form.serviceType = 'Roof Inspection';
  assert.equal(form.serviceType, 'Roof Inspection');
  assert.match(newJobPage, /service_type: formData\.serviceType/);
});

test('an explicit selection wins when organization settings resolve afterward', () => {
  let serviceType = serviceTypes[0] as string;
  let serviceTypeTouched = false;

  serviceType = 'Roof Inspection';
  serviceTypeTouched = true;
  serviceType = applyPrimaryServiceTypeDefault(serviceType, 'Cleaning Operations', serviceTypeTouched);

  assert.equal(serviceType, 'Roof Inspection');
  assert.match(newJobPage, /serviceTypeTouched\.current = true/);
  assert.match(newJobPage, /applyPrimaryServiceTypeDefault\(current\.serviceType, settings\?\.primaryServiceType, serviceTypeTouched\.current\)/);
});

test('the organization default applies when the service field is untouched', () => {
  assert.equal(applyPrimaryServiceTypeDefault(serviceTypes[0], 'Agricultural', false), 'Agricultural');
});

test('organizations without a preference retain the existing first-option fallback', () => {
  assert.equal(resolveInitialJobServiceType(null), serviceTypes[0]);
  assert.equal(resolveInitialJobServiceType(''), serviceTypes[0]);
  assert.equal(resolveInitialJobServiceType('Unknown legacy value'), serviceTypes[0]);
});

test('changing the preference only changes future form initialization', () => {
  const existingJob = { service_type: 'Roof Inspection' };
  assert.equal(resolveInitialJobServiceType('Cleaning Operations'), 'Cleaning Operations');
  assert.equal(resolveInitialJobServiceType('Agricultural'), 'Agricultural');
  assert.equal(existingJob.service_type, 'Roof Inspection');
  assert.doesNotMatch(migration, /update\s+public\.jobs/i);
});

test('the optional preference is persisted and loaded through organization settings', () => {
  assert.match(migration, /add column if not exists primary_service_type text/);
  assert.match(settingsPage, /primary_service_type: draft\.primaryServiceType \|\| null/);
  assert.match(organizationSettings, /primaryServiceType: String\(data\.primary_service_type \?\? ''\)/);
  assert.match(newJobPage, /settings\?\.primaryServiceType/);
});

test('preference edits and logo changes preserve unrelated organization draft fields', () => {
  assert.match(settingsPage, /setDraft\(\(currentDraft\) => \(\{ \.\.\.currentDraft, \[name\]: value \}\)\)/);
  assert.match(settingsPage, /setDraft\(\(currentDraft\) => \(\{ \.\.\.currentDraft, logoPath: updatedSettings\.logoPath, logoUrl: updatedSettings\.logoUrl \}\)\)/);
  assert.match(settingsPage, /Used as the default service type when creating a new job\. You can change it for any individual job\./);
});
