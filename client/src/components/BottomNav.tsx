import { useLocation, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ClipboardList, User, Settings, Bike } from 'lucide-react';
import { getToken } from '../api/client';
import { jwtDecode } from 'jwt-decode';
import type { JwtPayload } from '../types';

type TabDef = { label: string; Icon: React.ElementType; path: string; roles: string[] };

const TABS: TabDef[] = [
  { label: 'Menu',    Icon: UtensilsCrossed, path: '/menu',    roles: ['STAFF', 'ADMIN', 'RUNNER'] },
  { label: 'Queue',   Icon: Bike,            path: '/runner',  roles: ['RUNNER', 'ADMIN'] },
  { label: 'Admin',   Icon: Settings,        path: '/admin',   roles: ['ADMIN'] },
  { label: 'Orders',  Icon: ClipboardList,   path: '/orders',  roles: ['STAFF'] },
  { label: 'Profile', Icon: User,            path: '/profile', roles: ['STAFF', 'ADMIN', 'RUNNER'] },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const token = getToken();
  let role = 'STAFF';
  try {
    if (token) role = jwtDecode<JwtPayload>(token).role;
  } catch { /* */ }

  const tabs = TABS.filter(t => t.roles.includes(role));

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {tabs.map(({ label, Icon, path }) => {
        const active = pathname === path || pathname.startsWith(path + '/');
        return (
          <button
            key={path}
            className={`bottom-nav-tab${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
