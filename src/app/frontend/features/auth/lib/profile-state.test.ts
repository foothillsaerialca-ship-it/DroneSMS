/**
 * File purpose: Guards the refresh/direct-link fix where a restored session was redirected to onboarding and then the Dashboard.
 * Fallback/error behavior: Assertions use pure state functions and provider/route source, so they do not depend on Supabase availability.
 * Known limitation: These tests do not render React components; browser refresh and navigation were verified separately.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getSessionProfileState } from './profile-state.ts';

const authProvider = readFileSync(new URL('../components/auth-provider.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../components/protected-route.tsx', import.meta.url), 'utf8');

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';

test('a restored session whose profile has not been checked yet is loading, not missing', () => {
  // Before the session restores, the provider records "missing" for no user. The first render after
  // restoration must not reuse that value, or the route guard redirects to onboarding.
  assert.deepEqual(getSessionProfileState('authenticated', userId, { userId: null, state: 'missing', error: null }), {
    profileState: 'loading',
    profileError: null
  });
  assert.deepEqual(getSessionProfileState('authenticated', userId, { userId: null, state: 'loading', error: null }), {
    profileState: 'loading',
    profileError: null
  });
});

test('a lookup still in flight for the signed-in user stays loading', () => {
  assert.equal(getSessionProfileState('authenticated', userId, { userId, state: 'loading', error: null }).profileState, 'loading');
});

test('a completed lookup for the signed-in user is reported as resolved', () => {
  assert.equal(getSessionProfileState('authenticated', userId, { userId, state: 'complete', error: null }).profileState, 'complete');
  assert.equal(getSessionProfileState('authenticated', userId, { userId, state: 'incomplete', error: null }).profileState, 'incomplete');
});

test('a failed lookup is reported as an error, never as a missing or incomplete profile', () => {
  assert.deepEqual(getSessionProfileState('authenticated', userId, { userId, state: 'error', error: 'upstream timeout' }), {
    profileState: 'error',
    profileError: 'upstream timeout'
  });
});

test("another user's result is never applied to the signed-in user", () => {
  for (const state of ['complete', 'incomplete', 'error'] as const) {
    assert.deepEqual(getSessionProfileState('authenticated', userId, { userId: otherUserId, state, error: state === 'error' ? 'x' : null }), {
      profileState: 'loading',
      profileError: null
    });
  }
});

test('signed-out and initializing sessions pass the stored result through for the auth-status checks', () => {
  assert.equal(getSessionProfileState('unauthenticated', null, { userId: null, state: 'missing', error: null }).profileState, 'missing');
  assert.equal(getSessionProfileState('loading', null, { userId: null, state: 'loading', error: null }).profileState, 'loading');
});

test('the provider exposes only the session-matched profile state and drops superseded lookups', () => {
  assert.match(authProvider, /getSessionProfileState\(status, session\?\.user\?\.id \?\? null, profileResult\)/);
  assert.match(authProvider, /if \(requestId !== profileRequestId\.current\) return;\s*setProfileResult\(result\);/);
  // Signing out invalidates any lookup that is still running.
  assert.match(authProvider, /profileRequestId\.current \+= 1;\s*setProfileResult\(\{ userId: null, state: 'missing', error: null \}\);/);
});

test('the route guard waits for auth and profile loading before any redirect', () => {
  const loadingGate = protectedRoute.indexOf("status === 'loading' || (status === 'authenticated' && profileState === 'loading')");
  assert.ok(loadingGate > 0);
  for (const redirect of ['<Navigate to="/login"', "profileState === 'error'", '<Navigate to="/dashboard"', '<Navigate to="/onboarding/company"']) {
    assert.ok(protectedRoute.indexOf(redirect) > loadingGate, `${redirect} must come after the loading gate`);
  }
});
