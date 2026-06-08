import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ApiResponse, Order } from '../types';

export default function RunnerQueue() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQueue = () => {
    setLoading(true);
    api
      .get<ApiResponse<Order[]>>('/orders/queue')
      .then(({ data }) => setOrders(data.data))
      .catch(() => setError('Failed to load delivery queue.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadQueue(); }, []);

  const markInTransit = async (orderId: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'IN_TRANSIT' });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'IN_TRANSIT' } : o));
    } catch { setError('Failed to update status.'); }
  };

  const markDelivered = async (orderId: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'DELIVERED' });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch { setError('Failed to update status.'); }
  };

  const ready = orders.filter((o) => o.status === 'READY');
  const inTransit = orders.filter((o) => o.status === 'IN_TRANSIT');

  if (loading) return <div style={s.center}>Loading queue…</div>;

  return (
    <div style={s.root}>
      <header style={s.header}>
        <span style={s.logo}>🛵 Delivery Queue</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.navBtn} onClick={loadQueue}>Refresh</button>
          <button style={s.navBtn} onClick={() => navigate('/menu')}>← Menu</button>
        </div>
      </header>

      {error && <div style={s.errorBanner}>{error}</div>}

      <main style={s.main}>
        <section style={s.section}>
          <h2 style={s.sectionTitle}>
            <span style={{ ...s.dot, background: '#10b981' }} /> Ready for pickup ({ready.length})
          </h2>
          {ready.length === 0 && <p style={s.empty}>No orders ready yet.</p>}
          {ready.map((order) => (
            <div key={order.id} style={s.card}>
              <div style={s.topRow}>
                <div>
                  <strong>{order.user.email}</strong>
                  <p style={s.location}>📍 {order.floor} · {order.officeNumber}</p>
                </div>
                <button style={{ ...s.actionBtn, background: '#f97316' }} onClick={() => markInTransit(order.id)}>
                  Pick up →
                </button>
              </div>
              <p style={s.items}>
                {order.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
              </p>
              <p style={s.meta}>
                {order.paid ? '✅ Paid' : '⏳ Unpaid'} · ₦{(
                  Number(order.deliveryFee) + order.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0)
                ).toLocaleString()}
              </p>
            </div>
          ))}
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>
            <span style={{ ...s.dot, background: '#f97316' }} /> In transit ({inTransit.length})
          </h2>
          {inTransit.length === 0 && <p style={s.empty}>Nothing in transit.</p>}
          {inTransit.map((order) => (
            <div key={order.id} style={{ ...s.card, borderLeft: '4px solid #f97316' }}>
              <div style={s.topRow}>
                <div>
                  <strong>{order.user.email}</strong>
                  <p style={s.location}>📍 {order.floor} · {order.officeNumber}</p>
                </div>
                <button style={{ ...s.actionBtn, background: '#16a34a' }} onClick={() => markDelivered(order.id)}>
                  ✓ Delivered
                </button>
              </div>
              <p style={s.items}>
                {order.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
              </p>
            </div>
          ))}
        </section>

        {orders.length === 0 && (
          <div style={s.emptyState}>
            <p style={{ fontSize: 48 }}>✅</p>
            <h2 style={{ color: '#6b7280' }}>All clear — no pending deliveries</h2>
          </div>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  header: { background: '#92400e', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  logo: { fontWeight: 700, fontSize: 18 },
  navBtn: { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  errorBanner: { background: '#fee2e2', color: '#dc2626', padding: '12px 24px', fontSize: 14 },
  main: { maxWidth: 700, margin: '24px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 32 },
  section: {},
  sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: '50%', display: 'inline-block' },
  empty: { color: '#9ca3af', fontSize: 14 },
  emptyState: { textAlign: 'center', padding: 48 },
  card: { background: '#fff', borderRadius: 10, padding: 16, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)' },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  location: { margin: '4px 0 0', fontSize: 14, color: '#6b7280' },
  actionBtn: { color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  items: { margin: '0 0 4px', fontSize: 13, color: '#374151' },
  meta: { margin: 0, fontSize: 12, color: '#9ca3af' },
};
