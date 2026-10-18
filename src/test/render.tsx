/**
 * File purpose: Render helpers that mount real app routing and auth around components under test.
 * Fallback/error behavior: Helpers only compose providers; data comes from the Supabase stand-in configured by each test.
 * Known limitation: MemoryRouter replaces BrowserRouter, so history is in-memory and driven through the returned navigate helper.
 */
import type { ReactElement } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { AppRouter } from '../app/router';
import { AuthProvider } from '../app/frontend/features/auth/components/auth-provider';
import { createSession, supabaseMock } from './supabase-mock';

export const testUserId = 'user-1';
export const testOrganizationId = 'org-1';

/** Signs in a fixture user whose company onboarding is complete. */
export function signInCompletedUser() {
  supabaseMock.setSession(createSession(testUserId));
  supabaseMock.setTable('profiles', [{ id: testUserId, organization_id: testOrganizationId, company_name: 'Test Aerial Co' }]);
  supabaseMock.setTable('organizations', [{ id: testOrganizationId, name: 'Test Aerial Co', owner_user_id: testUserId }]);
}

type RouterHandle = { navigate: NavigateFunction | null };

function RouterProbe({ handle }: { handle: RouterHandle }) {
  const location = useLocation();
  handle.navigate = useNavigate();
  return (
    <output data-testid="current-location" hidden>
      {`${location.pathname}${location.search}`}
    </output>
  );
}

/**
 * Mounts AuthProvider and router around `ui` (the real AppRouter by default) at `path`.
 * The current URL is readable from the `current-location` test id, and `navigate` drives history.
 */
export function renderWithRouter(path: string, ui: ReactElement = <AppRouter />) {
  const handle: RouterHandle = { navigate: null };
  const result = render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        {ui}
        <RouterProbe handle={handle} />
      </MemoryRouter>
    </AuthProvider>
  );
  return {
    ...result,
    navigate(to: string | number) {
      const navigate = handle.navigate;
      if (!navigate) throw new Error('Router has not rendered yet.');
      act(() => {
        if (typeof to === 'number') navigate(to);
        else navigate(to);
      });
    },
    currentLocation() {
      return result.getByTestId('current-location').textContent;
    }
  };
}
