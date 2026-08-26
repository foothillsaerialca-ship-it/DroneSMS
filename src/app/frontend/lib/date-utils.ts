/**
 * File purpose: Centralizes ISO date defaults, display formatting, and local-calendar readiness calculations.
 * Fallback/error behavior: missing display dates use caller-provided labels, malformed display dates are returned unchanged, and invalid calculation dates produce `NaN`.
 * Known issues: `todayIsoDate` uses UTC while `daysUntilDate` uses the browser's local day, matching the pre-existing workflow behavior.
 */

/** Returns today's UTC calendar date in `YYYY-MM-DD` form for database/form defaults; it relies on the host clock. */
export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Formats an ISO date as `MM/DD/YYYY`; empty input uses the fallback and malformed input is returned unchanged. */
export function formatIsoDate(date: string | null | undefined, fallback = 'Not scheduled') {
  if (!date) return fallback;
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${month}/${day}/${year}`;
}

/** Returns local-calendar days until an ISO date; invalid input produces `NaN` and past dates are negative. */
export function daysUntilDate(date: string) {
  const targetDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000);
}
