/**
 * File purpose: Shares readiness presentation data between personnel and equipment repositories.
 * Fallback/error behavior: callers select the appropriate domain state when no readiness rule matches.
 * Known issues: presentation class strings remain coupled to the Tailwind configuration.
 */

/**
 * Purpose: Represents a sortable, styled readiness result displayed by repository cards.
 * Fallback/error behavior: callers choose the domain-specific fallback state when no readiness rule matches.
 * Known limitation: style class strings are not validated against the generated Tailwind stylesheet.
 */
export type ReadinessState = {
  label: string;
  detail: string;
  className: string;
  sortOrder: number;
};
