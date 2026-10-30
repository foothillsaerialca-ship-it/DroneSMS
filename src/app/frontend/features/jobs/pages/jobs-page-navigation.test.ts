/**
 * File purpose: Guards the Jobs/Proposals navigation fixes: /jobs showing proposal content after leaving /proposals,
 * stale lists and notices when switching sections, and the post-save return to /proposals.
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

const newProposalPage = readFileSync(new URL('./new-proposal-page.tsx', import.meta.url), 'utf8');

test('switching between /jobs and /proposals refreshes the entered section without the loading swap', () => {
  const effect = jobsPage.slice(jobsPage.indexOf('if (previousModeRef.current === mode) return;'));
  assert.match(effect, /^if \(previousModeRef\.current === mode\) return;\s*previousModeRef\.current = mode;/);
  assert.match(effect, /if \(mode === "proposals"\) \{\s*void loadProposals\(\{ background: true \}\);\s*\} else \{\s*void loadJobs\(\{ background: true \}\);\s*\}\s*\}, \[mode, loadJobs, loadProposals\]\);/);
});

test('only the latest jobs or proposals load may write its list', () => {
  for (const name of ['jobs', 'proposals']) {
    const ref = `${name}RequestIdRef`;
    assert.match(jobsPage, new RegExp(`const requestId = \\+\\+${ref}\\.current;`));
    assert.match(jobsPage, new RegExp(`if \\(requestId !== ${ref}\\.current\\) return;`));
    assert.match(jobsPage, new RegExp(`finally \\{\\s*if \\(requestId === ${ref}\\.current\\) setIsLoading${name === 'jobs' ? 'Jobs' : 'Proposals'}\\(false\\);`));
  }
});

test('success and warning notices only render in the section that raised them and clear on section change', () => {
  assert.match(jobsPage, /\{workspaceMessage\?\.mode === mode \? \(/);
  assert.match(jobsPage, /\{workspaceWarning\?\.mode === mode \? \(/);
  assert.doesNotMatch(jobsPage, /setWorkspace(Message|Warning)\(\s*["`]/);
  const effect = jobsPage.slice(jobsPage.indexOf('if (previousModeRef.current === mode) return;'));
  assert.match(effect, /setWorkspaceMessage\(null\);\s*setWorkspaceWarning\(null\);/);
});

test('saving a proposal returns to the Proposals page only after the write succeeds', () => {
  const submit = newProposalPage.slice(newProposalPage.indexOf('async function handleSubmit('));
  assert.doesNotMatch(newProposalPage, /\/jobs\?tab=proposals/);
  assert.match(submit, /if \(proposalError\) throw proposalError;\s*\}\s*navigate\('\/proposals', \{ replace: true \}\);\s*\} catch \(saveError\) \{/);
});

test('a successful load clears only the error a load raised, never a save failure', () => {
  for (const [name, setter] of [['jobs', 'setJobsError'], ['proposals', 'setProposalsError']]) {
    const ref = `${name}LoadErrorRef`;
    assert.match(jobsPage, new RegExp(`const staleLoadError = ${ref}\\.current;\\s*${ref}\\.current = null;\\s*${setter}\\(\\(current\\) => \\(current === staleLoadError \\? null : current\\)\\);`));
    assert.match(jobsPage, new RegExp(`${ref}\\.current = message;\\s*${setter}\\(\\(current\\) =>\\s*background && current && current !== staleLoadError \\? current : message,\\s*\\);`));
  }
});
