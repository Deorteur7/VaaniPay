import { NavLink } from 'react-router-dom';
import { FileText, LayoutDashboard, Settings } from 'lucide-react';

const tabs = [
  { to: '/',          icon: FileText,        label: 'Bill'      },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/setup',     icon: Settings,        label: 'Settings'  },
];

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom" style={{ background: '#fff', borderTop: '1px solid #E8ECF0' }}>
      <div className="flex max-w-md mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-semibold transition-colors relative ${
                isActive ? 'text-[#00BAF2]' : 'text-[#9EA3B0]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{label}</span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full" style={{ background: '#00BAF2' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
