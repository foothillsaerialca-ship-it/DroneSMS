/**
 * File purpose: Guards the Jobs/Proposals navigation fix where /jobs showed proposal content after leaving /proposals.
 * Fallback/error behavior: Assertions inspect page and router source, so they do not depend on Supabase availability.
 * Known limitation: These tests do not render React components; browser navigation was verified separately.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const jobsPage = readFileSync(new URL('./jobs-page.tsx', import.meta.url), 'utf8');
const router = readFileSync(new URL('../../../../router.tsx', import.meta.url), 'utf8');

test('/jobs and /proposals share one JobsPage instance, distinguished only by mode', () => {
  assert.match(router, /<Route path="\/jobs" element=\{<JobsPage \/>\} \/>/);
  assert.match(router, /<Route path="\/proposals" element=\{<JobsPage mode="proposals" \/>\} \/>/);
});

test('the selected tab is derived from mode and the URL on every render, not captured once in state', () => {
  assert.match(
    jobsPage,
    /const activeTab: JobsTab =\s*mode === "proposals" \? "proposals" : getInitialTab\(searchParams\.get\("tab"\)\);/,
  );
  assert.doesNotMatch(jobsPage, /useState<JobsTab>/);
  assert.doesNotMatch(jobsPage, /setActiveTab/);
});

test('jobs mode never resolves to the proposals view', () => {
  const getInitialTab = jobsPage.slice(jobsPage.indexOf('function getInitialTab('), jobsPage.indexOf('export function JobsPage('));
  assert.match(getInitialTab, /if \(tab === "completed" \|\| tab === "archived"\) return tab;\s*return "active";/);
  assert.match(jobsPage, /const showProposalsView = mode === "proposals" \|\| activeTab === "proposals";/);
  assert.match(jobsPage, /const showJobsView = mode !== "proposals" && activeTab !== "proposals";/);
});

test('selecting a jobs tab writes the URL that drives the view', () => {
  assert.match(jobsPage, /function selectTab\(tab: JobsTab\) \{\s*if \(mode === "proposals"\) return;\s*setSearchParams\(tab === "active" \? \{\} : \{ tab \}\);\s*\}/);
});
