/**
 * File purpose: Renders the real Job Hazard Analysis page to guard hazard card expansion, search, and unsaved-value preservation.
 * Fallback/error behavior: The job and saved JHA come from the in-memory Supabase stand-in; no records are written anywhere real.
 * Known limitation: Photo evidence upload is not exercised; it depends on canvas image processing jsdom does not provide.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { supabaseMock } from '../../../../../test/supabase-mock';
import { renderWithRouter, signInCompletedUser } from '../../../../../test/render';
import { jhaJob, powerLineHazard, savedAssessment, trafficHazard, windHazard } from '../../../../../test/fixtures/hazard-assessment';

type User = ReturnType<typeof userEvent.setup>;

// Filtered-out cards are hidden, so lookups include hidden elements and visibility is asserted separately.
function hazardToggle(position: number) {
  return screen.getByRole('button', { name: new RegExp(`^Hazard ${position}:`), hidden: true });
}

function hazardDetails(position: number) {
  const id = hazardToggle(position).getAttribute('aria-controls');
  const details = id ? document.getElementById(id) : null;
  if (!details) throw new Error(`Hazard ${position} has no details region.`);
  return details;
}

function mitigationField(position: number) {
  return within(hazardDetails(position)).getByLabelText('Controls / Mitigation Measures') as HTMLTextAreaElement;
}

// The next-photo caption is local state inside each card, so it only survives if collapsed cards stay mounted.
function photoCaptionField(position: number) {
  return within(hazardDetails(position)).getByLabelText('Caption / notes for next photo') as HTMLInputElement;
}

function expandedStates() {
  return screen.getAllByRole('button', { name: /^Hazard \d+:/, hidden: true }).map((toggle) => toggle.getAttribute('aria-expanded'));
}

function hazardCard(position: number) {
  return hazardToggle(position).closest('h3')?.parentElement?.parentElement as HTMLElement;
}

async function openHazardsStep(user: User) {
  renderWithRouter(`/jobs/${jhaJob.id}/templates/jha`);
  await screen.findByRole('heading', { name: 'Job Hazard Analysis' });
  await user.click(within(screen.getByRole('navigation', { name: 'JHA progress' })).getByRole('button', { name: /Hazards/ }));
  await screen.findByRole('heading', { level: 2, name: 'Hazards' });
}

beforeEach(() => {
  signInCompletedUser();
  supabaseMock.setTable('jobs', [jhaJob]);
  supabaseMock.setTable('jha_assessments', [savedAssessment]);
});

describe('Hazard Assessment hazard cards', () => {
  it('starts saved hazards collapsed and expands and collapses one hazard', async () => {
    const user = userEvent.setup();
    await openHazardsStep(user);

    expect(expandedStates()).toEqual(['false', 'false', 'false']);
    expect(hazardDetails(1)).not.toBeVisible();

    await user.click(hazardToggle(1));
    expect(hazardToggle(1)).toHaveAttribute('aria-expanded', 'true');
    expect(hazardDetails(1)).toBeVisible();
    expect(mitigationField(1)).toHaveValue(windHazard.mitigation);

    await user.click(hazardToggle(1));
    expect(hazardToggle(1)).toHaveAttribute('aria-expanded', 'false');
    expect(hazardDetails(1)).not.toBeVisible();
  });

  it('keeps several hazards expanded at once', async () => {
    const user = userEvent.setup();
    await openHazardsStep(user);

    await user.click(hazardToggle(1));
    await user.click(hazardToggle(3));

    expect(expandedStates()).toEqual(['true', 'false', 'true']);
    expect(hazardDetails(1)).toBeVisible();
    expect(hazardDetails(3)).toBeVisible();
  });

  it('expands and collapses every hazard with Expand All and Collapse All', async () => {
    const user = userEvent.setup();
    await openHazardsStep(user);

    await user.click(screen.getByRole('button', { name: 'Expand All' }));
    expect(expandedStates()).toEqual(['true', 'true', 'true']);

    await user.click(screen.getByRole('button', { name: 'Collapse All' }));
    expect(expandedStates()).toEqual(['false', 'false', 'false']);
  });

  it('expands a newly added hazard automatically without expanding the others', async () => {
    const user = userEvent.setup();
    await openHazardsStep(user);

    await user.click(screen.getByRole('button', { name: 'Add Custom Hazard' }));

    expect(hazardToggle(4)).toHaveTextContent('No hazard description entered.');
    expect(expandedStates()).toEqual(['false', 'false', 'false', 'true']);
    expect(hazardDetails(4)).toBeVisible();
  });

  it('filters documented hazards by search and restores them when cleared', async () => {
    const user = userEvent.setup();
    await openHazardsStep(user);
    const search = screen.getByRole('searchbox', { name: 'Search documented hazards' });

    await user.type(search, 'traffic');

    expect(hazardCard(2)).toBeVisible();
    expect(hazardCard(1)).not.toBeVisible();
    expect(hazardCard(3)).not.toBeVisible();
    expect(screen.getByText('Showing 1 of 3 hazards. Clear the search to review every hazard.')).toBeInTheDocument();

    await user.type(search, ' no-such-hazard');
    expect(screen.getByText('No hazards match your search.')).toBeInTheDocument();

    await user.clear(search);
    for (const position of [1, 2, 3]) expect(hazardCard(position)).toBeVisible();
    expect(screen.queryByText(/^Showing \d+ of \d+ hazards/)).not.toBeInTheDocument();
  });

  it('keeps unsaved edits when a hazard is collapsed and expanded again', async () => {
    const user = userEvent.setup();
    await openHazardsStep(user);
    const writesBeforeEditing = supabaseMock.writes().length;

    await user.click(hazardToggle(1));
    await user.clear(mitigationField(1));
    await user.type(mitigationField(1), 'Stand down above 20 mph sustained.');
    await user.type(photoCaptionField(1), 'Anemometer reading at staging');
    await user.click(hazardToggle(1));

    expect(hazardDetails(1)).not.toBeVisible();
    expect(within(hazardCard(1)).getByText('Stand down above 20 mph sustained.', { selector: 'p' })).toBeVisible();

    await user.click(hazardToggle(1));
    expect(mitigationField(1)).toHaveValue('Stand down above 20 mph sustained.');
    expect(photoCaptionField(1)).toHaveValue('Anemometer reading at staging');
    expect(supabaseMock.writes()).toHaveLength(writesBeforeEditing);
  });

  it('keeps expansion and edits with the right hazard while the list is filtered', async () => {
    const user = userEvent.setup();
    await openHazardsStep(user);
    const search = screen.getByRole('searchbox', { name: 'Search documented hazards' });

    await user.click(hazardToggle(2));
    await user.type(mitigationField(2), ' Assign a spotter.');
    await user.type(photoCaptionField(2), 'Cones placed at gate');

    await user.type(search, 'power');
    expect(hazardCard(3)).toBeVisible();
    expect(hazardCard(2)).not.toBeVisible();
    expect(hazardToggle(3)).toHaveAttribute('aria-expanded', 'false');

    // The only visible card is the third hazard; toggling it must not change the first hazard in the list.
    await user.click(hazardToggle(3));
    expect(expandedStates()).toEqual(['false', 'true', 'true']);
    expect(mitigationField(3)).toHaveValue(powerLineHazard.mitigation);
    await user.click(hazardToggle(3));
    expect(expandedStates()).toEqual(['false', 'true', 'false']);

    // Expand All applies only to the hazards the filter shows.
    await user.click(screen.getByRole('button', { name: 'Expand All' }));
    expect(expandedStates()).toEqual(['false', 'true', 'true']);

    await user.clear(search);
    await waitFor(() => expect(hazardCard(1)).toBeVisible());
    expect(expandedStates()).toEqual(['false', 'true', 'true']);
    expect(mitigationField(2)).toHaveValue(`${trafficHazard.mitigation} Assign a spotter.`);
    expect(photoCaptionField(2)).toHaveValue('Cones placed at gate');
    expect(photoCaptionField(3)).toHaveValue('');
    expect(mitigationField(1)).toHaveValue(windHazard.mitigation);
    expect(mitigationField(3)).toHaveValue(powerLineHazard.mitigation);
  });
});
