function enabled(value: unknown) {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const featureFlags = Object.freeze({
  reports: enabled(import.meta.env.VITE_ENABLE_REPORTS)
});
