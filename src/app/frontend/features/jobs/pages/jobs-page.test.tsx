/**
 * File purpose: Renders the real router, auth provider, and Jobs page to guard Jobs/Proposals navigation and page identity.
 * Fallback/error behavior: Supabase is replaced by the in-memory stand-in from src/test, so no live service is contacted.
 * Known limitation: History is an in-memory router; browser chrome (address bar, real back button) is not exercised.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDeferred, supabaseMock, type QueryResult } from '../../../../../test/supabase-mock';
import { renderWithRouter, signInCompletedUser } from '../../../../../test/render';
import { activeJob, archivedJob, completedJob, draftProposal } from '../../../../../test/fixtures/jobs';

function pageHeading() {
  return screen.getByRole('heading', { level: 1 });
}

function sidebarLink(name: string) {
  return within(screen.getByRole('navigation', { name: 'Desktop navigation' })).getByRole('link', { name });
}

function expectNoProposalContent() {
  expect(screen.queryByText(draftProposal.proposal_name)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Active Proposals' })).not.toBeInTheDocument();
  expect(screen.queryByText('Proposal Company Information')).not.toBeInTheDocument();
}

function expectNoJobContent() {
  for (const job of [activeJob, completedJob, archivedJob]) {
    expect(screen.queryByText(job.name)).not.toBeInTheDocument();
  }
  expect(screen.queryByRole('tablist', { name: 'Jobs sections' })).not.toBeInTheDocument();
}

beforeEach(() => {
  signInCompletedUser();
  supabaseMock.setTable('jobs', [activeJob, completedJob, archivedJob]);
  supabaseMock.setTable('proposals', [draftProposal]);
});

describe('Jobs and Proposals page identity', () => {
  it('shows Jobs content under the Jobs heading at /jobs', async () => {
    renderWithRouter('/jobs');

    expect(await screen.findByText(activeJob.name)).toBeInTheDocument();
    expect(pageHeading()).toHaveTextContent('Jobs');
    expect(screen.getByRole('tab', { name: 'Active Jobs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(completedJob.name)).not.toBeInTheDocument();
    expectNoProposalContent();
  });

  it('shows Proposals content under the Proposals heading at /proposals', async () => {
    renderWithRouter('/proposals');

    expect(await screen.findByText(draftProposal.proposal_name)).toBeInTheDocument();
    expect(pageHeading()).toHaveTextContent('Proposals');
    expect(screen.getByRole('heading', { name: 'Active Proposals' })).toBeInTheDocument();
    expectNoJobContent();
  });

  it.each([
    ['/jobs', 'Active Jobs', activeJob.name],
    ['/jobs?tab=completed', 'Completed Jobs', completedJob.name],
    ['/jobs?tab=archived', 'Archived', archivedJob.name]
  ])('selects the tab named by the URL %s', async (path, tabName, visibleJob) => {
    renderWithRouter(path);

    expect(await screen.findByText(visibleJob)).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.textContent)).toEqual([tabName]);
    for (const job of [activeJob, completedJob, archivedJob].filter((job) => job.name !== visibleJob)) {
      expect(screen.queryByText(job.name)).not.toBeInTheDocument();
    }
  });

  it('never opens the proposals view from /jobs?tab=proposals and drops the stale tab from the URL', async () => {
    const view = renderWithRouter('/jobs?tab=proposals');

    expect(await screen.findByText(activeJob.name)).toBeInTheDocument();
    expect(pageHeading()).toHaveTextContent('Jobs');
    expect(screen.getByRole('tab', { name: 'Active Jobs' })).toHaveAttribute('aria-selected', 'true');
    expectNoProposalContent();
    await waitFor(() => expect(view.currentLocation()).toBe('/jobs'));
  });

  it('writes the selected Jobs tab to the URL', async () => {
    const user = userEvent.setup();
    const view = renderWithRouter('/jobs');
    await screen.findByText(activeJob.name);

    await user.click(screen.getByRole('tab', { name: 'Completed Jobs' }));

    expect(view.currentLocation()).toBe('/jobs?tab=completed');
    expect(screen.getByRole('tab', { name: 'Completed Jobs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(completedJob.name)).toBeInTheDocument();
    expect(screen.queryByText(activeJob.name)).not.toBeInTheDocument();
  });
});

describe('switching between Jobs and Proposals', () => {
  it('keeps each page identity when switching through the sidebar', async () => {
    const user = userEvent.setup();
    const view = renderWithRouter('/jobs');
    await screen.findByText(activeJob.name);

    await user.click(sidebarLink('Proposals'));
    expect(view.currentLocation()).toBe('/proposals');
    expect(pageHeading()).toHaveTextContent('Proposals');
    expect(await screen.findByText(draftProposal.proposal_name)).toBeInTheDocument();
    expectNoJobContent();

    await user.click(sidebarLink('Jobs'));
    expect(view.currentLocation()).toBe('/jobs');
    expect(pageHeading()).toHaveTextContent('Jobs');
    expect(screen.getByRole('tab', { name: 'Active Jobs' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(activeJob.name)).toBeInTheDocument();
    expectNoProposalContent();
  });

  it('restores the right page on browser back and forward', async () => {
    const user = userEvent.setup();
    const view = renderWithRouter('/jobs?tab=completed');
    await screen.findByText(completedJob.name);
    await user.click(sidebarLink('Proposals'));
    await screen.findByText(draftProposal.proposal_name);

    view.navigate(-1);
    expect(view.currentLocation()).toBe('/jobs?tab=completed');
    expect(pageHeading()).toHaveTextContent('Jobs');
    expect(screen.getByRole('tab', { name: 'Completed Jobs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(completedJob.name)).toBeInTheDocument();
    expectNoProposalContent();

    view.navigate(1);
    expect(view.currentLocation()).toBe('/proposals');
    expect(pageHeading()).toHaveTextContent('Proposals');
    expect(screen.getByText(draftProposal.proposal_name)).toBeInTheDocument();
    expectNoJobContent();
  });

  it('refreshes the section being entered so records changed elsewhere appear', async () => {
    const user = userEvent.setup();
    renderWithRouter('/jobs');
    await screen.findByText(activeJob.name);
    await user.click(sidebarLink('Proposals'));
    await screen.findByText(draftProposal.proposal_name);

    const newJob = { ...activeJob, id: 'job-new', name: 'Parking Structure Wash' };
    supabaseMock.setTable('jobs', [activeJob, newJob]);
    await user.click(sidebarLink('Jobs'));

    expect(await screen.findByText(newJob.name)).toBeInTheDocument();
    expect(screen.getByText(activeJob.name)).toBeInTheDocument();
  });
});

describe('Jobs page loading, empty, and failure states', () => {
  it('shows the loading state until jobs arrive', async () => {
    const jobsResponse = createDeferred<QueryResult>();
    supabaseMock.respond((call) => (call.table === 'jobs' && call.operation === 'select' ? jobsResponse.promise : undefined));
    renderWithRouter('/jobs');

    expect(await screen.findByText('Loading jobs...')).toBeInTheDocument();
    expect(screen.queryByText(activeJob.name)).not.toBeInTheDocument();

    jobsResponse.resolve({ data: [activeJob], error: null });
    expect(await screen.findByText(activeJob.name)).toBeInTheDocument();
    expect(screen.queryByText('Loading jobs...')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no active jobs', async () => {
    supabaseMock.setTable('jobs', []);
    renderWithRouter('/jobs');

    expect(await screen.findByRole('heading', { name: 'No active jobs yet' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no proposals', async () => {
    supabaseMock.setTable('proposals', []);
    renderWithRouter('/proposals');

    expect(await screen.findByRole('heading', { name: 'No proposals yet' })).toBeInTheDocument();
  });

  it('reports a proposals load failure on Proposals only', async () => {
    const user = userEvent.setup();
    supabaseMock.respond((call) =>
      call.table === 'proposals' && call.operation === 'select' ? { data: null, error: { message: 'Proposals service unavailable.' } } : undefined
    );
    renderWithRouter('/proposals');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load or update proposals');
    expect(alert).toHaveTextContent('Proposals service unavailable.');

    await user.click(sidebarLink('Jobs'));
    expect(await screen.findByText(activeJob.name)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
