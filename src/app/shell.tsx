import { Outlet } from 'react-router-dom';
import { BottomNav } from '../features/navigation/components/bottom-nav';

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-safe-area-inset-top backdrop-blur">
        <div className="flex items-center justify-between py-3">
          <p className="text-lg font-semibold text-brand-900">DroneSMS</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">MVP Phase 0</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
