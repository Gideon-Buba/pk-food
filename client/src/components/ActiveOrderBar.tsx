import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getToken, api } from '../api/client';
import { jwtDecode } from 'jwt-decode';
import type { JwtPayload, Order, OrderStatus, ApiResponse } from '../types';

const ACTIVE_STATUSES = new Set<OrderStatus>(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT']);

const HIDE_PATHS = new Set(['/orders', '/order-confirmation', '/login', '/verify-email', '/forgot-password', '/reset-password']);

const STATUS_LABEL: Record<string, { text: string; urgent: boolean }> = {
  PENDING:    { text: 'Waiting for confirmation',  urgent: false },
  CONFIRMED:  { text: 'Order confirmed',            urgent: false },
  PREPARING:  { text: 'Being prepared',             urgent: false },
  READY:      { text: 'Ready for pickup!',          urgent: true  },
  IN_TRANSIT: { text: 'On the way to you!',         urgent: true  },
};

export default function ActiveOrderBar() {
  const [order, setOrder] = useState<Order | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const token = getToken();
  let role = '';
  try {
    if (token) role = jwtDecode<JwtPayload>(token).role;
  } catch { /* */ }

  useEffect(() => {
    if (role !== 'STAFF') return;

    const load = () => {
      api.get<ApiResponse<Order[]>>('/orders')
        .then(({ data }) => {
          const active = data.data
            .filter(o => ACTIVE_STATUSES.has(o.status))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrder(active[0] ?? null);
        })
        .catch(() => {});
    };

    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [role]);

  const visible = !!order && !HIDE_PATHS.has(pathname) && role === 'STAFF';

  useEffect(() => {
    document.body.classList.toggle('has-active-order-bar', visible);
    return () => document.body.classList.remove('has-active-order-bar');
  }, [visible]);

  if (!visible) return null;

  const info = STATUS_LABEL[order.status] ?? { text: order.status, urgent: false };
  const firstName = order.items[0]?.menuItem.name ?? 'your order';
  const extraCount = order.items.length - 1;
  const summary = extraCount > 0 ? `${firstName} +${extraCount} more` : firstName;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/orders')}
      onKeyDown={e => e.key === 'Enter' && navigate('/orders')}
      className={`active-order-bar${info.urgent ? ' active-order-bar--urgent' : ''}`}
    >
      <span className="active-order-bar__dot" />
      <div className="active-order-bar__body">
        <span className="active-order-bar__status">{info.text}</span>
        <span className="active-order-bar__summary">{summary}</span>
      </div>
      <ChevronRight size={16} style={{ flexShrink: 0, opacity: 0.75 }} />
    </div>
  );
}
