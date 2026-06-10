import { Outlet } from 'react-router-dom';
import { DesktopSidebar, MobileTopBar } from './features/navigation/components/responsive-nav';

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
