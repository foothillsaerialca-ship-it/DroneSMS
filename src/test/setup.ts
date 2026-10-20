/**
 * File purpose: Shared Vitest setup for component tests: DOM matchers, cleanup, and the isolated Supabase stand-in.
 * Fallback/error behavior: Any attempt to use the network fails the test, so a missing mock can never reach a live service.
 * Known limitation: Applies only to the Vitest component suite; the node:test suite (npm test) does not load it.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { supabaseMock } from './supabase-mock';
import { resetAppSettings } from '../app/frontend/features/admin/lib/app-settings';

// Every import of the app's Supabase client, through either alias, receives the in-memory stand-in.
vi.mock('@frontend/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('./supabase-mock');
  return { supabase: mock.client, isSupabaseConfigured: () => true };
});
vi.mock('@backend/integrations/supabase/client', async () => {
  const { supabaseMock: mock } = await import('./supabase-mock');
  return { supabase: mock.client };
});

beforeEach(() => {
  supabaseMock.reset();
  resetAppSettings();
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', (input: unknown) => {
    throw new Error(`Network access is disabled in component tests (attempted fetch: ${String(input)}).`);
  });
  for (const name of ['XMLHttpRequest', 'WebSocket']) {
    vi.stubGlobal(name, function blockedNetworkConstructor() {
      throw new Error(`Network access is disabled in component tests (attempted ${name}).`);
    });
  }
});

// vitest.config.ts sets restoreMocks, so spies are restored between tests as well.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
