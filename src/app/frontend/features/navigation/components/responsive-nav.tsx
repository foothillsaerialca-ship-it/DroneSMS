/**
 * File purpose: Provides the reusable responsive nav React component and its local interaction behavior.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';

/**
 * Purpose: Defines the ordered nav items used for UI choices and workflow decisions in responsive nav.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
const navItems = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/proposals', label: 'Proposals' },
  { to: '/jobs', label: 'Jobs', end: true },
  { to: '/personnel', label: 'Personnel', end: true },
  { to: '/equipment', label: 'Equipment', end: true },
  { to: '/reports', label: 'Reports', end: true },
  { to: '/sms', label: 'SMS', end: true },
  { to: '/settings/organization', label: 'Settings' },
  { to: '/about', label: 'About', end: true }
];

/**
 * Determines is proposals active for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function isProposalsActive(pathname: string) {
  return pathname === '/proposals' || pathname.startsWith('/proposals/');
}

/**
 * Determines is jobs active for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function isJobsActive(pathname: string) {
  if (!pathname.startsWith('/jobs')) return false;
  return pathname === '/jobs' || (pathname.startsWith('/jobs/') && !isProposalsActive(pathname));
}

/**
 * Purpose: Defines the input contract accepted by the navigation links component.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type NavigationLinksProps = {
  onNavigate?: () => void;
  layout: 'sidebar' | 'drawer';
};

/**
 * Renders the navigation links interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
function NavigationLinks({ onNavigate, layout }: NavigationLinksProps) {
  const location = useLocation();
  const baseClass =
    'flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2';
  const inactiveClass = layout === 'sidebar' ? 'text-slate-600 hover:bg-slate-100 hover:text-brand-900' : 'text-slate-700 hover:bg-slate-100 hover:text-brand-900';
  const activeClass = 'bg-brand-700 text-white shadow-sm hover:bg-brand-700 hover:text-white';

  return (
    <ul className="space-y-1" aria-label="Primary navigation">
      {navItems.map((item) => {
        const isProposals = item.label === 'Proposals';
        const isJobs = item.label === 'Jobs';
        const activeOverride = isProposals
          ? isProposalsActive(location.pathname)
          : isJobs
            ? isJobsActive(location.pathname)
            : undefined;

        return (
          <li key={item.label}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => `${baseClass} ${(activeOverride ?? isActive) ? activeClass : inactiveClass}`}
            >
              {item.label}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Purpose: Defines the input contract accepted by the logout button component.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type LogoutButtonProps = {
  onLogout?: () => void;
};

/**
 * Renders the logout button interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
function LogoutButton({ onLogout }: LogoutButtonProps) {
  const navigate = useNavigate();

  /**
   * Handles logout while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  async function handleLogout() {
    await supabase.auth.signOut();
    onLogout?.();
    navigate('/login', { replace: true });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center rounded-xl bg-red-400/40 px-3 py-2.5 text-left text-sm font-semibold text-red-900 transition hover:bg-red-400/50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
    >
      Logout
    </button>
  );
}

/**
 * Implements support link for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
function SupportLink({ onNavigate }: { onNavigate?: () => void }) {
  const href = 'mailto:support@dronesms.app?subject=DroneSMS%20Support%20Request&body=DroneSMS%20Support%20Request%0A%0APlease%20describe%20the%20issue%20or%20question%20below%3A%0A%0A';
  return <a href={href} onClick={onNavigate} className="mb-2 flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2">Need Help? / Report a Problem</a>;
}

/**
 * Renders the brand mark interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
function BrandMark() {
  return (
    <Link to="/dashboard" className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow-sm">DS</span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-bold tracking-tight text-brand-900">DroneSMS</span>
        <span className="block text-xs font-medium text-slate-500">MVP Phase 0</span>
      </span>
    </Link>
  );
}

/**
 * Renders the desktop sidebar interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function DesktopSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-5 shadow-sm md:flex md:flex-col" aria-label="Main sidebar">
      <BrandMark />
      <nav className="mt-8 flex-1" aria-label="Desktop navigation">
        <NavigationLinks layout="sidebar" />
      </nav>
      <div className="border-t border-slate-200 pt-4">
        <SupportLink />
        <LogoutButton />
      </div>
    </aside>
  );
}

/**
 * Renders the mobile top bar interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function MobileTopBar() {
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Handles close drawer while keeping the feature state consistent.
   * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
   */
  function closeDrawer() {
    setIsOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:hidden">
        <div className="grid h-16 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl font-semibold text-brand-900 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2"
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
          >
            ☰
          </button>
          <Link to="/dashboard" className="justify-self-center rounded-lg text-lg font-bold tracking-tight text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2">
            DroneSMS
          </Link>
          <Link
            to="/settings/account"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2"
            aria-label="Open settings"
          >
            DS
          </Link>
        </div>
      </header>

      {isOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" className="absolute inset-0 h-full w-full bg-slate-900/40" aria-label="Close navigation menu" onClick={closeDrawer} />
          <aside className="relative flex h-full w-80 max-w-[85vw] flex-col bg-white px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <BrandMark />
              <button
                type="button"
                onClick={closeDrawer}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2"
                aria-label="Close navigation menu"
              >
                ×
              </button>
            </div>
            <nav className="mt-8 flex-1" aria-label="Mobile navigation">
              <NavigationLinks layout="drawer" onNavigate={closeDrawer} />
            </nav>
            <div className="border-t border-slate-200 pt-4">
              <SupportLink onNavigate={closeDrawer} />
              <LogoutButton onLogout={closeDrawer} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
