/**
 * File purpose: Renders the Equipment and Personnel pages to guard inline record editing (edit in place, save, cancel, one at a time).
 * Fallback/error behavior: Supabase is replaced by the in-memory stand-in from src/test, so no live service is contacted.
 * Known limitation: jsdom has no layout, so scroll position is asserted only by checking that the page never calls window.scrollTo.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseMock } from '../../../../../test/supabase-mock';
import { renderWithRouter, signInCompletedUser } from '../../../../../test/render';

const baseEquipment = {
  make: 'DJI',
  model: 'M3E',
  serial_number: null,
  faa_registration_number: null,
  assigned_location: null,
  status: 'Available',
  maintenance_due_date: null,
  notes: null,
  product_category: null,
  typical_mix_ratio: null,
  application_notes: null,
  purpose: null,
  epa_registration_number: null,
  signal_word: null,
  restricted_use_product: null,
  equipment_reference_documents: [],
  updated_at: '2026-01-01T00:00:00.000Z'
};

const basePerson = {
  role: 'Visual Observer',
  email: null,
  phone: null,
  part_107_certificate_number: null,
  part_107_expiration_date: null,
  training_expiration_date: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  status: 'Active',
  professional_bio: null,
  certifications_summary: null,
  profile_photo_url: null,
  notes: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  archived_at: null
};

function updates(table: string) {
  return supabaseMock.calls.filter((call) => call.table === table && call.operation === 'update');
}

function recordCard(name: string) {
  return screen.getByRole('heading', { name }).closest('article') as HTMLElement;
}

beforeEach(() => {
  signInCompletedUser();
  supabaseMock.setTable('equipment', [
    { ...baseEquipment, id: 'eq-1', name: 'Alpha Drone', equipment_type: 'Drone', notes: 'Original notes' },
    { ...baseEquipment, id: 'eq-2', name: 'Bravo Controller', equipment_type: 'Controller' }
  ]);
  supabaseMock.setTable('personnel', [
    { ...basePerson, id: 'p-1', full_name: 'Avery Lane' },
    { ...basePerson, id: 'p-2', full_name: 'Blake Reed' }
  ]);
});

describe('Equipment inline editing', () => {
  it('opens the edit form in place of the record, prefilled, without scrolling the page', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderWithRouter('/equipment');
    const user = userEvent.setup();

    await screen.findByText('Bravo Controller');
    await user.click(within(recordCard('Alpha Drone')).getByRole('button', { name: 'Edit' }));

    const form = screen.getByRole('form', { name: 'Edit Alpha Drone' });
    expect(within(form).getByText('Editing')).toBeInTheDocument();
    expect(within(form).getByLabelText('Equipment name')).toHaveValue('Alpha Drone');
    expect(within(form).getByLabelText('Notes')).toHaveValue('Original notes');
    expect(within(form).getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(within(form).getAllByRole('button', { name: 'Cancel' }).length).toBeGreaterThan(0);
    expect(within(form).queryByLabelText(/new operational capability/)).not.toBeInTheDocument();
    // The form sits in the list, before the other record, and the Add panel stays where it was.
    expect(form.compareDocumentPosition(recordCard('Bravo Controller')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Add Equipment' })).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('saves changes through the existing update and confirms on the record', async () => {
    renderWithRouter('/equipment');
    const user = userEvent.setup();
    await screen.findByText('Alpha Drone');
    await user.click(within(recordCard('Alpha Drone')).getByRole('button', { name: 'Edit' }));

    const form = screen.getByRole('form', { name: 'Edit Alpha Drone' });
    await user.clear(within(form).getByLabelText('Notes'));
    await user.type(within(form).getByLabelText('Notes'), 'Props replaced');
    await user.click(within(form).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(updates('equipment')).toHaveLength(1));
    expect(updates('equipment')[0].filters).toContainEqual({ kind: 'eq', column: 'id', value: 'eq-1' });
    expect(updates('equipment')[0].payload).toMatchObject({ name: 'Alpha Drone', notes: 'Props replaced' });
    expect(await within(recordCard('Alpha Drone')).findByText('Equipment record updated.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('keeps validation inside the inline form', async () => {
    renderWithRouter('/equipment');
    const user = userEvent.setup();
    await screen.findByText('Alpha Drone');
    await user.click(within(recordCard('Alpha Drone')).getByRole('button', { name: 'Edit' }));

    const form = screen.getByRole('form', { name: 'Edit Alpha Drone' });
    await user.clear(within(form).getByLabelText('Equipment name'));
    await user.click(within(form).getByRole('button', { name: 'Save Changes' }));

    expect(within(screen.getByRole('form')).getByText('Equipment name is required.')).toBeInTheDocument();
    expect(updates('equipment')).toHaveLength(0);
  });

  it('cancel discards unsaved changes and only one record is editable at a time', async () => {
    renderWithRouter('/equipment');
    const user = userEvent.setup();
    await screen.findByText('Alpha Drone');
    await user.click(within(recordCard('Alpha Drone')).getByRole('button', { name: 'Edit' }));

    let form = screen.getByRole('form', { name: 'Edit Alpha Drone' });
    await user.type(within(form).getByLabelText('Notes'), ' unsaved');
    const cancelButtons = within(form).getAllByRole('button', { name: 'Cancel' });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(within(recordCard('Alpha Drone')).getByText('Original notes')).toBeInTheDocument();
    expect(updates('equipment')).toHaveLength(0);

    await user.click(within(recordCard('Alpha Drone')).getByRole('button', { name: 'Edit' }));
    expect(within(screen.getByRole('form')).getByLabelText('Notes')).toHaveValue('Original notes');
    await user.click(within(recordCard('Bravo Controller')).getByRole('button', { name: 'Edit' }));

    expect(screen.getAllByRole('form')).toHaveLength(1);
    form = screen.getByRole('form', { name: 'Edit Bravo Controller' });
    expect(within(form).getByLabelText('Equipment name')).toHaveValue('Bravo Controller');
    expect(recordCard('Alpha Drone')).toBeInTheDocument();
  });

  it('leaves Add Equipment above the list', async () => {
    renderWithRouter('/equipment');
    const user = userEvent.setup();
    await screen.findByText('Alpha Drone');
    await user.click(screen.getByRole('button', { name: '+ Add Equipment' }));

    const form = screen.getByRole('form', { name: 'Add equipment' });
    expect(within(form).getByRole('heading', { name: 'Add Equipment' })).toBeInTheDocument();
    expect(within(form).getByLabelText('Equipment name')).toHaveValue('');
    expect(within(form).getByRole('button', { name: 'Add Equipment' })).toBeInTheDocument();
    expect(form.compareDocumentPosition(recordCard('Alpha Drone')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Personnel inline editing', () => {
  it('opens the edit form in place of the record, prefilled, without scrolling the page', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderWithRouter('/personnel');
    const user = userEvent.setup();
    await screen.findByText('Blake Reed');
    await user.click(within(recordCard('Blake Reed')).getByRole('button', { name: 'Edit' }));

    const form = screen.getByRole('form', { name: 'Edit Blake Reed' });
    expect(within(form).getByText('Editing')).toBeInTheDocument();
    expect(within(form).getByLabelText('Full name')).toHaveValue('Blake Reed');
    expect(within(form).getByLabelText('Role')).toHaveValue('Visual Observer');
    expect(within(form).getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(recordCard('Avery Lane').compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('saves changes, confirms on the record, and keeps validation inline', async () => {
    renderWithRouter('/personnel');
    const user = userEvent.setup();
    await screen.findByText('Avery Lane');
    await user.click(within(recordCard('Avery Lane')).getByRole('button', { name: 'Edit' }));

    const form = screen.getByRole('form', { name: 'Edit Avery Lane' });
    await user.clear(within(form).getByLabelText('Full name'));
    await user.click(within(form).getByRole('button', { name: 'Save Changes' }));
    expect(within(screen.getByRole('form')).getByRole('alert')).toHaveTextContent('Full name is required.');
    expect(updates('personnel')).toHaveLength(0);

    await user.type(within(screen.getByRole('form')).getByLabelText('Full name'), 'Avery Lane');
    await user.type(within(screen.getByRole('form')).getByLabelText('Phone'), '555-0100');
    await user.click(within(screen.getByRole('form')).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(updates('personnel')).toHaveLength(1));
    expect(updates('personnel')[0].filters).toContainEqual({ kind: 'eq', column: 'id', value: 'p-1' });
    expect(updates('personnel')[0].payload).toMatchObject({ full_name: 'Avery Lane', phone: '555-0100' });
    expect(await within(recordCard('Avery Lane')).findByText('Personnel record updated.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('cancel discards unsaved changes and only one record is editable at a time', async () => {
    renderWithRouter('/personnel');
    const user = userEvent.setup();
    await screen.findByText('Avery Lane');
    await user.click(within(recordCard('Avery Lane')).getByRole('button', { name: 'Edit' }));
    await user.type(within(screen.getByRole('form')).getByLabelText('Notes'), 'Unsaved note');
    await user.click(within(recordCard('Blake Reed')).getByRole('button', { name: 'Edit' }));

    expect(screen.getAllByRole('form')).toHaveLength(1);
    expect(screen.getByRole('form', { name: 'Edit Blake Reed' })).toBeInTheDocument();

    const cancelButtons = within(screen.getByRole('form')).getAllByRole('button', { name: 'Cancel' });
    await user.click(cancelButtons[cancelButtons.length - 1]);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText('Unsaved note')).not.toBeInTheDocument();
    expect(updates('personnel')).toHaveLength(0);

    await user.click(within(recordCard('Avery Lane')).getByRole('button', { name: 'Edit' }));
    expect(within(screen.getByRole('form')).getByLabelText('Notes')).toHaveValue('');
  });

  it('leaves Add Personnel above the list', async () => {
    renderWithRouter('/personnel');
    const user = userEvent.setup();
    await screen.findByText('Avery Lane');
    await user.click(screen.getByRole('button', { name: '+ Add Personnel' }));

    const form = screen.getByRole('form', { name: 'Add personnel' });
    expect(within(form).getByLabelText('Full name')).toHaveValue('');
    expect(within(form).getByRole('button', { name: 'Add Personnel' })).toBeInTheDocument();
    expect(form.compareDocumentPosition(recordCard('Avery Lane')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
