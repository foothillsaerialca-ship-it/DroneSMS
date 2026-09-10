/**
 * File purpose: Provides the shared public authentication layout and nested route outlet.
 * Fallback/error behavior: Delegates route content and authentication state to child routes and auth hooks.
 * Known limitation: Public route access is still governed by the application router configuration.
 */
import { BetaBadge } from '@frontend/components/beta-badge';
import { CopyrightFooter } from '@frontend/components/copyright-footer';
import { Outlet } from 'react-router-dom';
import { isBetaWelcomeEnabled } from '../lib/beta-welcome';

export function PublicAuthLayout() {
  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="flex-1">
        {isBetaWelcomeEnabled ? (
          <div className="mx-auto mb-3 flex w-full max-w-md justify-end">
            <BetaBadge />
          </div>
        ) : null}
        <Outlet />
      </div>
      <CopyrightFooter />
    </div>
  );
}
