import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle, MapPin, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ApiResponse, Order } from '../types';

function displayName(order: Order): string {
  return order.user.name || order.user.email.split('@')[0];
}

function deliveredAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function RunnerHistory() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<Order[]>>('/orders/history')
      .then(({ data }) => setOrders(data.data))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  const totalValue = orders.reduce(
    (s, o) => s + Number(o.deliveryFee) + o.items.reduce((si, i) => si + Number(i.unitPrice) * i.quantity, 0),
    0,
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate('/runner')}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontWeight: 800, fontSize: 17, flex: 1, letterSpacing: '-0.02em' }}>
            Today&apos;s deliveries
          </span>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 680 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 100 }} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state card" style={{ padding: 60 }}>
            <Package className="empty-state-icon" />
            <h3>No deliveries yet today</h3>
            <p>Completed deliveries will appear here throughout the day.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/runner')}>
              Back to queue
            </button>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 0 }}>
              <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--gray-100)' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {orders.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'var(--font-ui)', fontWeight: 600, textTransform: 'uppercase', marginTop: 3 }}>
                  Delivered
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  ₦{totalValue.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'var(--font-ui)', fontWeight: 600, textTransform: 'uppercase', marginTop: 3 }}>
                  Total value
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map(order => {
                const orderTotal = Number(order.deliveryFee) + order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
                return (
                  <div key={order.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #15803d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle size={14} color="#15803d" />
                          <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{displayName(order)}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--gray-500)', fontSize: 12 }}>
                          <MapPin size={11} />
                          Floor {order.floor} · Wing {order.officeNumber}
                          <span style={{ color: 'var(--gray-300)' }}>·</span>
                          <span>Delivered at {deliveredAt(order.updatedAt)}</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14, flexShrink: 0 }}>
                        ₦{orderTotal.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                      {order.items.map(i => `${i.menuItem.name} ×${i.quantity}`).join(' · ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
