/**
 * File purpose: Defines the authenticated application shell shared by feature routes.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { Outlet } from 'react-router-dom';
import { DesktopSidebar, MobileTopBar } from './features/navigation/components/responsive-nav';

/**
 * Implements app shell for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
export function AppShell() {
  return (
    <div className="app-shell flex w-full bg-slate-50">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
