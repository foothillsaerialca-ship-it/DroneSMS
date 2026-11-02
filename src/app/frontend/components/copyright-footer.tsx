/**
 * File purpose: Provides the shared DroneSMS copyright notice used across all page shells.
 */
export function CopyrightFooter() {
  return (
    <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
      <span>© {new Date().getFullYear()} DroneSMS. All rights reserved.</span>
      <a className="ml-3 font-medium text-brand-700 underline" href="/vendor-licenses.txt" target="_blank" rel="noreferrer">Third-party licenses</a>
    </footer>
  );
}
