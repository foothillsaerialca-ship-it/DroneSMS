import { Outlet } from 'react-router-dom';
import { BottomNav } from '../features/navigation/components/bottom-nav';

export function AppShell() {
  return (
    <>
      <div className="app-shell mx-auto flex w-full max-w-5xl flex-col bg-slate-50">
        <header className="shrink-0 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-safe-area-inset-top backdrop-blur">
          <div className="flex items-center justify-between py-3">
            <p className="text-lg font-semibold text-brand-900">DroneSMS</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">MVP Phase 0</span>
          </div>
        </header>

        <main className="mobile-bottom-nav-offset flex-1 overflow-y-auto px-4 py-4">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </>
  );
}
