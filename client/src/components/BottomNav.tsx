import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ClipboardList, User, Settings, Bike } from 'lucide-react';
import { getToken, api } from '../api/client';
import { jwtDecode } from 'jwt-decode';
import type { JwtPayload, Order, ApiResponse } from '../types';

type TabDef = { label: string; Icon: React.ElementType; path: string };

const STAFF_TABS: TabDef[] = [
  { label: 'Menu',    Icon: UtensilsCrossed, path: '/menu'    },
  { label: 'Orders',  Icon: ClipboardList,   path: '/orders'  },
  { label: 'Profile', Icon: User,            path: '/profile' },
];

const ADMIN_TABS: TabDef[] = [
  { label: 'Menu',    Icon: UtensilsCrossed, path: '/menu'    },
  { label: 'Queue',   Icon: Bike,            path: '/runner'  },
  { label: 'Admin',   Icon: Settings,        path: '/admin'   },
  { label: 'Profile', Icon: User,            path: '/profile' },
];

const RUNNER_TABS: TabDef[] = [
  { label: 'Queue',   Icon: Bike, path: '/runner'  },
  { label: 'Profile', Icon: User, path: '/profile' },
];

const TABS_BY_ROLE: Record<string, TabDef[]> = {
  STAFF:  STAFF_TABS,
  ADMIN:  ADMIN_TABS,
  RUNNER: RUNNER_TABS,
};

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT']);

function useActiveOrderCount(role: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (role !== 'STAFF') return;

    const fetch = () => {
      api.get<ApiResponse<Order[]>>('/orders')
        .then(({ data }) => {
          setCount(data.data.filter(o => ACTIVE_STATUSES.has(o.status)).length);
        })
        .catch(() => {});
    };

    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [role]);

  return count;
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();

  const token = getToken();
  let role = '';
  try {
    if (token) role = jwtDecode<JwtPayload>(token).role;
  } catch { /* */ }

  const tabs = TABS_BY_ROLE[role] ?? [];
  const activeOrderCount = useActiveOrderCount(role);

  if (!tabs.length) return null;

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {tabs.map(({ label, Icon, path }) => {
        const active     = pathname === path || pathname.startsWith(path + '/');
        const showBadge  = path === '/orders' && activeOrderCount > 0;

        return (
          <button
            key={path}
            className={`bottom-nav-tab${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
            aria-current={active ? 'page' : undefined}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
              {showBadge && (
                <span style={{
                  position: 'absolute', top: -5, right: -7,
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: 'var(--error, #ef4444)', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', lineHeight: 1,
                }}>
                  {activeOrderCount}
                </span>
              )}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
