import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Truck, CheckCircle, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ApiResponse, Order } from '../types';

export default function RunnerQueue() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<ApiResponse<Order[]>>('/orders/queue')
      .then(({ data }) => setOrders(data.data))
      .catch(() => toast.error('Failed to load queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markStatus = async (orderId: string, status: 'IN_TRANSIT' | 'DELIVERED') => {
    setUpdating(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      if (status === 'DELIVERED') {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        toast.success('Marked as delivered');
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        toast.success('Picked up — en route');
      }
    } catch { toast.error('Failed to update'); }
    finally { setUpdating(null); }
  };

  const ready = orders.filter(o => o.status === 'READY');
  const inTransit = orders.filter(o => o.status === 'IN_TRANSIT');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate('/menu')}><ChevronLeft size={20} /></button>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Delivery queue</span>
          <button className="btn btn-ghost btn-icon" onClick={load} title="Refresh">
            {loading ? <span className="spinner spinner-dark" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 720 }}>
        {orders.length === 0 && !loading ? (
          <div className="empty-state card" style={{ padding: 60 }}>
            <CheckCircle className="empty-state-icon" style={{ color: 'var(--primary)' }} />
            <h3>All clear</h3>
            <p>No pending deliveries right now</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Ready */}
            {ready.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
                  <h2 className="section-title">Ready for pickup ({ready.length})</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ready.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      action={{ label: 'Pick up', icon: <Truck size={14} />, variant: 'primary' as const }}
                      onAction={() => markStatus(order.id, 'IN_TRANSIT')}
                      loading={updating === order.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* In transit */}
            {inTransit.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)' }} />
                  <h2 className="section-title">In transit ({inTransit.length})</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {inTransit.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      action={{ label: 'Delivered', icon: <CheckCircle size={14} />, variant: 'outline' as const }}
                      onAction={() => markStatus(order.id, 'DELIVERED')}
                      loading={updating === order.id}
                      accent
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  action: { label: string; icon: React.ReactNode; variant: 'primary' | 'outline' };
  onAction: () => void;
  loading: boolean;
  accent?: boolean;
}

function OrderCard({ order, action, onAction, loading, accent }: OrderCardProps) {
  const total = Number(order.deliveryFee) + order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  return (
    <div className="card" style={{ padding: 16, borderLeft: accent ? '3px solid var(--orange)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{order.user.email.split('@')[0]}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: 'var(--gray-500)', fontSize: 13 }}>
            <MapPin size={12} />
            {order.floor} · {order.officeNumber}
          </div>
        </div>
        <button
          className={`btn btn-sm btn-${action.variant}`}
          onClick={onAction}
          disabled={loading}
          style={{ flexShrink: 0 }}
        >
          {loading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : action.icon}
          {action.label}
        </button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 8, lineHeight: 1.5 }}>
        {order.items.map(i => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>₦{total.toLocaleString()}</span>
        <span className={`badge ${order.paid ? 'badge-green' : 'badge-yellow'}`}>
          {order.paid ? 'Paid' : 'Unpaid'}
        </span>
      </div>
    </div>
  );
}
