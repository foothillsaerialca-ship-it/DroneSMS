/**
 * File purpose: Displays the beta-status badge on public authentication surfaces.
 * Fallback/error behavior: Renders nothing when the beta welcome feature is disabled.
 * Known limitation: Visibility is controlled by the build-time beta feature flag.
 */
import { isBetaWelcomeEnabled } from '../features/auth/lib/beta-welcome';

export function BetaBadge() {
  if (!isBetaWelcomeEnabled) return null;

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide text-amber-800">
      BETA
    </span>
  );
}
