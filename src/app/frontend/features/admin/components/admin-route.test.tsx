/**
 * File purpose: Verifies admin-only navigation, the /admin route guard, the admin page actions, and the admin-managed beta setting.
 * Fallback/error behavior: Admin status and settings come from the in-memory Supabase stand-in; no credentials are used.
 * Known limitation: Database-side refusal of non-admins is covered by the migration test, not here.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createSession, supabaseMock } from '../../../../../test/supabase-mock';
import { renderWithRouter, signInCompletedUser, testUserId } from '../../../../../test/render';

function signInAdmin() {
  signInCompletedUser();
  supabaseMock.respondRpc('is_platform_admin', () => ({ data: true, error: null }));
  supabaseMock.respondRpc('list_platform_admins', () => ({
    data: [
      { user_id: testUserId, email: 'pilot@example.test', granted_at: '2026-10-01T00:00:00.000Z', granted_by_email: null, note: 'Initial admin' },
      { user_id: 'user-2', email: 'nico@example.test', granted_at: '2026-10-02T00:00:00.000Z', granted_by_email: 'pilot@example.test', note: null }
    ],
    error: null
  }));
}

function desktopNav() {
  return screen.getByRole('navigation', { name: 'Desktop navigation' });
}

describe('Platform admin access', () => {
  it('hides the Admin link from regular users and sends them away from /admin', async () => {
    signInCompletedUser();
    supabaseMock.respondRpc('is_platform_admin', () => ({ data: false, error: null }));
    const view = renderWithRouter('/admin');

    await waitFor(() => expect(view.currentLocation()).toBe('/dashboard'));
    expect(within(desktopNav()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Platform Admin' })).not.toBeInTheDocument();
    expect(supabaseMock.rpcCalls.map((call) => call.name)).not.toContain('list_platform_admins');
  });

  it('treats a failed admin check as a regular user', async () => {
    signInCompletedUser();
    supabaseMock.respondRpc('is_platform_admin', () => ({ data: null, error: { message: 'permission denied' } }));
    const view = renderWithRouter('/admin');

    await waitFor(() => expect(view.currentLocation()).toBe('/dashboard'));
    expect(within(desktopNav()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows admins the Admin link and the admin page', async () => {
    signInAdmin();
    const view = renderWithRouter('/admin');

    expect(await screen.findByRole('heading', { name: 'Platform Admin' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/admin');
    expect(within(desktopNav()).getByRole('link', { name: 'Admin' })).toBeInTheDocument();
    expect(await screen.findByText('nico@example.test')).toBeInTheDocument();
  });

  it('sends signed-out visitors to sign in', async () => {
    const view = renderWithRouter('/admin');

    await waitFor(() => expect(view.currentLocation()).toBe('/login'));
    expect(screen.queryByRole('heading', { name: 'Platform Admin' })).not.toBeInTheDocument();
  });

  it('lets an admin without a company profile open the admin page', async () => {
    supabaseMock.setSession(createSession(testUserId));
    supabaseMock.setTable('profiles', [{ id: testUserId, organization_id: null, company_name: null }]);
    supabaseMock.setTable('organizations', []);
    supabaseMock.respondRpc('is_platform_admin', () => ({ data: true, error: null }));
    const view = renderWithRouter('/admin');

    expect(await screen.findByRole('heading', { name: 'Platform Admin' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/admin');
  });

  it('removes the admin page when admin access is revoked while it is open', async () => {
    signInAdmin();
    let isAdmin = true;
    supabaseMock.respondRpc('is_platform_admin', () => ({ data: isAdmin, error: null }));
    const view = renderWithRouter('/admin');
    expect(await screen.findByRole('heading', { name: 'Platform Admin' })).toBeInTheDocument();

    isAdmin = false;
    fireEvent.focus(window);

    await waitFor(() => expect(view.currentLocation()).toBe('/dashboard'));
    expect(within(desktopNav()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('adds an admin by email through the database function', async () => {
    signInAdmin();
    renderWithRouter('/admin');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Account email'), ' new.admin@example.test ');
    await user.click(screen.getByRole('button', { name: 'Add Admin' }));

    expect(await screen.findByText('new.admin@example.test is now an admin.')).toBeInTheDocument();
    expect(supabaseMock.rpcCalls).toContainEqual({ name: 'grant_platform_admin', args: { target_email: 'new.admin@example.test', grant_note: null } });
  });

  it('shows the database refusal when removing an admin fails', async () => {
    signInAdmin();
    supabaseMock.respondRpc('revoke_platform_admin', () => ({ data: null, error: { message: 'You cannot remove the last admin.' } }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithRouter('/admin');
    const user = userEvent.setup();

    await screen.findByText('nico@example.test');
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);

    expect(await screen.findByText('You cannot remove the last admin.')).toBeInTheDocument();
    expect(supabaseMock.rpcCalls).toContainEqual({ name: 'revoke_platform_admin', args: { target_user_id: 'user-2' } });
  });

  it('turns the beta badge off for everyone when an admin flips the setting', async () => {
    signInAdmin();
    supabaseMock.setTable('app_settings', [{ key: 'beta_welcome_enabled', value: true }]);
    renderWithRouter('/admin');
    const user = userEvent.setup();

    const toggle = await screen.findByRole('switch', { name: 'Beta welcome and BETA badges' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getAllByText('BETA').length).toBeGreaterThan(0);

    await user.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(screen.queryByText('BETA')).not.toBeInTheDocument();
    expect(supabaseMock.rpcCalls).toContainEqual({ name: 'set_app_setting', args: { setting_key: 'beta_welcome_enabled', setting_value: false } });
  });

  it('skips the beta welcome screen for signed-out visitors when the setting is off', async () => {
    supabaseMock.setTable('app_settings', [{ key: 'beta_welcome_enabled', value: false }]);
    renderWithRouter('/');

    expect(await screen.findByRole('heading', { name: 'Pilot Login' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Proceed to Sign In' })).not.toBeInTheDocument();
    expect(screen.queryByText('BETA')).not.toBeInTheDocument();
  });

  it('keeps the beta welcome screen when settings cannot be loaded', async () => {
    supabaseMock.respond((call) => (call.table === 'app_settings' ? { data: null, error: { message: 'offline' } } : undefined));
    renderWithRouter('/');

    expect(await screen.findByRole('button', { name: 'Proceed to Sign In' })).toBeInTheDocument();
  });
});
