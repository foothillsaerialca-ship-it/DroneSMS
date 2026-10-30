/**
 * File purpose: Reads app-wide settings that platform admins manage, and shares them with every component that uses them.
 * Fallback/error behavior: Until settings load, or if loading fails, each setting uses its built-in default.
 * Known limitation: Settings are fetched once per page load; other open tabs see an admin's change after a reload.
 */
import { useSyncExternalStore } from 'react';
import { supabase } from '@frontend/lib/supabase';

/** The settings the app understands, with the value used before (or instead of) the database value. */
export type AppSettings = {
  beta_welcome_enabled: boolean;
};

export const defaultAppSettings: AppSettings = {
  // VITE_BETA_WELCOME_ENABLED=false remains a build-time override that hides the beta welcome everywhere.
  beta_welcome_enabled: import.meta.env.VITE_BETA_WELCOME_ENABLED !== 'false'
};

let current: AppSettings = defaultAppSettings;
let loadRequest: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: AppSettings) {
  current = next;
  listeners.forEach((listener) => listener());
}

/** Keeps only known keys whose stored value has the expected type. */
export function normalizeAppSettings(rows: { key: string; value: unknown }[] | null | undefined): Partial<AppSettings> {
  const settings: Partial<AppSettings> = {};
  for (const row of rows ?? []) {
    if (row.key === 'beta_welcome_enabled' && typeof row.value === 'boolean') settings.beta_welcome_enabled = row.value;
  }
  return settings;
}

/** Loads settings from the database once; later calls reuse the same request unless `force` is set. */
export function loadAppSettings(force = false) {
  if (loadRequest && !force) return loadRequest;
  loadRequest = (async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) return;
      publish({ ...defaultAppSettings, ...normalizeAppSettings(data as { key: string; value: unknown }[] | null) });
    } catch {
      // Keep the defaults; the app works without settings.
    }
  })();
  return loadRequest;
}

/** Records a value an admin just saved so open screens update without a reload. */
export function applyAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  publish({ ...current, [key]: value });
}

/** Forgets loaded settings. Used by tests. */
export function resetAppSettings() {
  loadRequest = null;
  current = defaultAppSettings;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadAppSettings();
  return () => listeners.delete(listener);
}

/** Returns the current app-wide settings and re-renders when they change. */
export function useAppSettings() {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

/** Whether the beta welcome screen and BETA badges are shown. The build-time override always wins. */
export function useBetaWelcomeEnabled() {
  const settings = useAppSettings();
  return defaultAppSettings.beta_welcome_enabled && settings.beta_welcome_enabled;
}
