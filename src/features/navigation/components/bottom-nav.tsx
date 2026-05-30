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
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">
      <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-2 px-2">
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
