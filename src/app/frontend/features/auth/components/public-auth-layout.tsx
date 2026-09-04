import { BetaBadge } from '@frontend/components/beta-badge';
import { Outlet } from 'react-router-dom';
import { isBetaWelcomeEnabled } from '../lib/beta-welcome';

export function PublicAuthLayout() {
  return (
    <div className="w-full">
      {isBetaWelcomeEnabled ? (
        <div className="mx-auto mb-3 flex w-full max-w-md justify-end">
          <BetaBadge />
        </div>
      ) : null}
      <Outlet />
    </div>
  );
}
