/**
 * File purpose: Renders the real AuthProvider and ProtectedRoute to guard sign-in, onboarding, and redirect timing rules.
 * Fallback/error behavior: Sessions and profile lookups come from the in-memory Supabase stand-in; no credentials are used.
 * Known limitation: Most cases mount stub pages behind the real guard; two cases mount the full AppRouter end to end.
 */
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from './protected-route';
import { createDeferred, createSession, supabaseMock, type QueryResult } from '../../../../../test/supabase-mock';
import { renderWithRouter, signInCompletedUser, testUserId } from '../../../../../test/render';

function SignInStub() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? 'none';
  return <h1>Sign in stub (from {from})</h1>;
}

const guardedRoutes = (
  <Routes>
    <Route path="/login" element={<SignInStub />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/onboarding/company" element={<h1>Onboarding stub</h1>} />
      <Route path="/dashboard" element={<h1>Dashboard stub</h1>} />
      <Route path="/jobs" element={<h1>Protected jobs stub</h1>} />
    </Route>
  </Routes>
);

function renderGuarded(path: string) {
  return renderWithRouter(path, guardedRoutes);
}

function signInWithoutCompany() {
  supabaseMock.setSession(createSession(testUserId));
  supabaseMock.setTable('profiles', [{ id: testUserId, organization_id: null, company_name: null }]);
  supabaseMock.setTable('organizations', []);
}

function deferProfileLookup() {
  const profileResponse = createDeferred<QueryResult>();
  supabaseMock.respond((call) => (call.table === 'profiles' && call.operation === 'select' ? profileResponse.promise : undefined));
  return profileResponse;
}

describe('ProtectedRoute', () => {
  it('waits for auth initialization before deciding, then keeps the requested route', async () => {
    const session = createDeferred<ReturnType<typeof createSession> | null>();
    signInCompletedUser();
    supabaseMock.setSessionLoader(() => session.promise);
    const view = renderGuarded('/jobs');

    expect(screen.getByText('Checking company setup...')).toBeInTheDocument();
    expect(screen.queryByText('Protected jobs stub')).not.toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');

    session.resolve(createSession(testUserId));

    expect(await screen.findByRole('heading', { name: 'Protected jobs stub' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');
  });

  it('lets a signed-in user with a completed company open a deep link directly', async () => {
    signInCompletedUser();
    const view = renderGuarded('/jobs');

    expect(await screen.findByRole('heading', { name: 'Protected jobs stub' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');
  });

  it('sends a signed-out user to sign in, remembering the requested route', async () => {
    const view = renderGuarded('/jobs');

    expect(await screen.findByRole('heading', { name: 'Sign in stub (from /jobs)' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/login');
    expect(screen.queryByText('Protected jobs stub')).not.toBeInTheDocument();
  });

  it('signs the user out of protected pages when the session ends', async () => {
    signInCompletedUser();
    const view = renderGuarded('/jobs');
    await screen.findByRole('heading', { name: 'Protected jobs stub' });

    supabaseMock.emitAuthChange('SIGNED_OUT', null);

    expect(await screen.findByRole('heading', { name: /Sign in stub/ })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/login');
    expect(screen.queryByText('Protected jobs stub')).not.toBeInTheDocument();
  });

  it('sends a user without a company to onboarding', async () => {
    signInWithoutCompany();
    const view = renderGuarded('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Onboarding stub' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/onboarding/company');
    expect(screen.queryByText('Dashboard stub')).not.toBeInTheDocument();
  });

  it('sends a user with a completed company away from onboarding to the dashboard', async () => {
    signInCompletedUser();
    const view = renderGuarded('/onboarding/company');

    expect(await screen.findByRole('heading', { name: 'Dashboard stub' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/dashboard');
  });

  it('treats an owned organization as complete and relinks the profile to it', async () => {
    supabaseMock.setSession(createSession(testUserId));
    supabaseMock.setTable('profiles', [{ id: testUserId, organization_id: null, company_name: null }]);
    supabaseMock.setTable('organizations', [{ id: 'org-owned', name: 'Owned Aerial LLC', owner_user_id: testUserId }]);
    const view = renderGuarded('/jobs');

    expect(await screen.findByRole('heading', { name: 'Protected jobs stub' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');
    expect(supabaseMock.writes()).toEqual([
      expect.objectContaining({
        table: 'profiles',
        operation: 'upsert',
        payload: expect.objectContaining({ id: testUserId, organization_id: 'org-owned', company_name: 'Owned Aerial LLC' })
      })
    ]);
  });

  it('does not redirect to onboarding while the company profile lookup is still pending', async () => {
    signInCompletedUser();
    const profileResponse = deferProfileLookup();
    const view = renderGuarded('/jobs');

    expect(await screen.findByText('Checking company setup...')).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');
    expect(screen.queryByText('Onboarding stub')).not.toBeInTheDocument();

    profileResponse.resolve({ data: { id: testUserId, organization_id: 'org-1', company_name: 'Test Aerial Co' }, error: null });

    expect(await screen.findByRole('heading', { name: 'Protected jobs stub' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');
  });

  it('only redirects to onboarding after a delayed lookup confirms the company is missing', async () => {
    signInWithoutCompany();
    const profileResponse = deferProfileLookup();
    const view = renderGuarded('/jobs');

    expect(await screen.findByText('Checking company setup...')).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');

    profileResponse.resolve({ data: { id: testUserId, organization_id: null, company_name: null }, error: null });

    expect(await screen.findByRole('heading', { name: 'Onboarding stub' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/onboarding/company');
  });

  it('blocks protected pages when the company check fails', async () => {
    signInCompletedUser();
    supabaseMock.respond((call) =>
      call.table === 'profiles' && call.operation === 'select' ? { data: null, error: { message: 'Profile service unavailable.' } } : undefined
    );
    const view = renderGuarded('/jobs');

    expect(await screen.findByRole('heading', { name: 'Unable to check company setup' })).toBeInTheDocument();
    // Supabase reports query errors as plain objects, so the guard shows its generic message.
    expect(screen.getByText('Unable to check company onboarding status.')).toBeInTheDocument();
    expect(screen.queryByText('Protected jobs stub')).not.toBeInTheDocument();
    expect(view.currentLocation()).toBe('/jobs');
  });
});

describe('ProtectedRoute in the full application router', () => {
  it('shows the welcome sign-in page instead of Jobs for a signed-out visitor', async () => {
    const view = renderWithRouter('/jobs');

    expect(await screen.findByRole('heading', { name: 'Welcome to DroneSMS' })).toBeInTheDocument();
    expect(view.currentLocation()).toBe('/login');
    expect(screen.queryByRole('heading', { name: 'Jobs' })).not.toBeInTheDocument();
  });

  it('shows Company Onboarding instead of Jobs when onboarding is incomplete', async () => {
    signInWithoutCompany();
    const view = renderWithRouter('/jobs');

    expect(await screen.findByRole('heading', { name: 'Company Onboarding' })).toBeInTheDocument();
    await waitFor(() => expect(view.currentLocation()).toBe('/onboarding/company'));
    expect(screen.queryByRole('heading', { name: 'Jobs' })).not.toBeInTheDocument();
  });
});
