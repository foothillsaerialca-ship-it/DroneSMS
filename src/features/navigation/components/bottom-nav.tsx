import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/personnel', label: 'Personnel' },
  { to: '/equipment', label: 'Equipment' },
  { to: '/settings', label: 'Settings' }
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-2">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-center text-sm font-medium ${
                  isActive ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
