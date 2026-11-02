import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithRouter, signInCompletedUser } from '../../../../test/render';
import { supabaseMock } from '../../../../test/supabase-mock';

const pendingConsent = {
  terms_version: '2026-10-30-v1',
  privacy_version: '2026-10-30-v1',
  terms_accepted: false,
  privacy_accepted: false,
};

beforeEach(() => {
  signInCompletedUser();
  supabaseMock.respondRpc('get_legal_consent_status', () => ({ data: pendingConsent, error: null }));
});

describe('legal consent gate', () => {
  it('blocks the app until both documents are acknowledged and records current-version acceptance', async () => {
    const user = userEvent.setup();
    supabaseMock.respondRpc('accept_current_legal_documents', (args) => {
      expect(args).toEqual({
        expected_terms_version: '2026-10-30-v1',
        expected_privacy_version: '2026-10-30-v1',
      });
      return {
        data: { ...pendingConsent, terms_accepted: true, privacy_accepted: true },
        error: null,
      };
    });

    renderWithRouter('/dashboard');
    const dialog = await screen.findByRole('dialog', { name: 'Review DroneSMS legal documents' });
    const accept = await screen.findByRole('button', { name: 'Accept and continue' });
    expect(accept).toBeDisabled();
    expect(screen.queryByRole('navigation', { name: 'Desktop navigation' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Privacy Policy/ }));
    expect(accept).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/ }));
    expect(accept).toBeEnabled();
    await user.click(accept);

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'Desktop navigation' })).toBeInTheDocument();
    expect(supabaseMock.rpcCalls.some((call) => call.name === 'accept_current_legal_documents')).toBe(true);
  });

  it('allows the app when the account accepted both current document versions', async () => {
    supabaseMock.respondRpc('get_legal_consent_status', () => ({
      data: { ...pendingConsent, terms_accepted: true, privacy_accepted: true },
      error: null,
    }));

    renderWithRouter('/dashboard');

    expect(await screen.findByRole('navigation', { name: 'Desktop navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Review DroneSMS legal documents' })).not.toBeInTheDocument();
  });

  it('re-prompts an active user when the current legal versions change', async () => {
    supabaseMock.respondRpc('get_legal_consent_status', () => ({
      data: { ...pendingConsent, terms_accepted: true, privacy_accepted: true },
      error: null,
    }));
    renderWithRouter('/dashboard');
    expect(await screen.findByRole('navigation', { name: 'Desktop navigation' })).toBeInTheDocument();

    supabaseMock.respondRpc('get_legal_consent_status', () => ({
      data: { ...pendingConsent, terms_version: '2026-11-01-v2' },
      error: null,
    }));
    fireEvent.focus(window);

    expect(await screen.findByRole('dialog', { name: 'Review DroneSMS legal documents' })).toBeInTheDocument();
    expect(screen.getByText('Terms 2026-11-01-v2')).toBeInTheDocument();
  });
});
