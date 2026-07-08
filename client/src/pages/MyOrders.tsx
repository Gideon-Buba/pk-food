import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Package, Clock, ChefHat, CheckCircle, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ApiResponse, Order, OrderStatus } from '../types';

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode; step: number }> = {
  PENDING:    { label: 'Pending',     color: 'var(--gray-500)',   bg: 'var(--gray-100)',      icon: <Clock size={14} />,        step: 0 },
  CONFIRMED:  { label: 'Confirmed',   color: 'var(--info)',       bg: 'var(--info-light)',     icon: <Package size={14} />,      step: 1 },
  PREPARING:  { label: 'Preparing',   color: 'var(--warning)',    bg: 'var(--warning-light)',  icon: <ChefHat size={14} />,      step: 2 },
  READY:      { label: 'Ready',       color: 'var(--primary)',    bg: 'var(--primary-light)',  icon: <CheckCircle size={14} />,  step: 3 },
  IN_TRANSIT: { label: 'On the way',  color: 'var(--orange)',     bg: '#fff7ed',               icon: <Truck size={14} />,        step: 4 },
  DELIVERED:  { label: 'Delivered',   color: 'var(--primary)',    bg: 'var(--primary-light)',  icon: <CheckCircle size={14} />,  step: 5 },
  CANCELLED:  { label: 'Cancelled',   color: 'var(--error)',      bg: 'var(--error-light)',    icon: <XCircle size={14} />,      step: -1 },
};

const STEPS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED'];

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<ApiResponse<Order[]>>('/orders')
      .then(({ data }) => setOrders(data.data))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  const handleCancelled = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' as const } : o));
  };

  useEffect(() => { load(); }, []);

  const active = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  const past = orders.filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate('/menu')}><ChevronLeft size={20} /></button>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>My orders</span>
          <button className="btn btn-ghost btn-icon" onClick={load} title="Refresh">
            {loading ? <span className="spinner spinner-dark" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 680 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 10, width: '70%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 10, width: '50%' }} />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state card" style={{ padding: 60 }}>
            <Package className="empty-state-icon" style={{ color: 'var(--primary)' }} />
            <h3>No orders yet</h3>
            <p>Your order history will appear here</p>
            <button className="btn btn-primary" onClick={() => navigate('/menu')}>Browse menu</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {active.length > 0 && (
              <section>
                <h2 className="section-title" style={{ marginBottom: 12 }}>Active ({active.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {active.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      expanded={expanded === order.id}
                      onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
                      onCancelled={handleCancelled}
                    />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="section-title" style={{ marginBottom: 12 }}>Past orders</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {past.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      expanded={expanded === order.id}
                      onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
                      onCancelled={handleCancelled}
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

function OrderCard({ order, expanded, onToggle, onCancelled }: { order: Order; expanded: boolean; onToggle: () => void; onCancelled: (id: string) => void }) {
  const [cancelling, setCancelling] = useState(false);
  const meta = STATUS_META[order.status];
  const total = Number(order.deliveryFee) + order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const isActive = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const canCancel = order.status === 'PENDING' && !order.paid;

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Cancel this order?')) return;
    setCancelling(true);
    try {
      await api.delete(`/orders/${order.id}`);
      toast.success('Order cancelled');
      onCancelled(order.id);
    } catch {
      toast.error('Could not cancel order');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 16, textAlign: 'left' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  background: meta.bg, color: meta.color,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {meta.icon}{meta.label}
              </span>
              {order.paid && <span className="badge badge-green" style={{ fontSize: 11 }}>Paid</span>}
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 2 }}>
              {order.items.map(i => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
              Floor {order.floor} · Wing {order.officeNumber} · {new Date(order.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 15 }}>₦{total.toLocaleString()}</p>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{expanded ? 'Hide' : 'Details'}</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--gray-100)', padding: '14px 16px', background: 'var(--gray-50)' }}>
          {/* Progress tracker */}
          {order.status !== 'CANCELLED' && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order progress</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {STEPS.map((step, idx) => {
                  const stepMeta = STATUS_META[step];
                  const currentStep = STATUS_META[order.status].step;
                  const done = stepMeta.step <= currentStep;
                  const active = stepMeta.step === currentStep;
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: done ? 'var(--primary)' : 'var(--gray-200)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: done ? '#fff' : 'var(--gray-400)',
                          boxShadow: active ? '0 0 0 3px var(--primary-light)' : undefined,
                          transition: 'all 0.2s',
                          flexShrink: 0,
                        }}>
                          {done
                            ? <CheckCircle size={14} />
                            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gray-300)' }} />
                          }
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 600, color: done ? 'var(--primary)' : 'var(--gray-400)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {stepMeta.label}
                        </span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div style={{
                          flex: 1, height: 2, margin: '0 2px', marginBottom: 14,
                          background: STATUS_META[STEPS[idx + 1]].step <= currentStep ? 'var(--primary)' : 'var(--gray-200)',
                          transition: 'background 0.3s',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--gray-600)' }}>{item.menuItem.name} <span style={{ color: 'var(--gray-400)' }}>×{item.quantity}</span></span>
                <span style={{ fontWeight: 600 }}>₦{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', paddingTop: 6, borderTop: '1px solid var(--gray-100)' }}>
              <span>Delivery</span>
              <span>₦{Number(order.deliveryFee).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14 }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>₦{total.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {isActive && (
              <p style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={11} /> Pull down to refresh for latest status
              </p>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: cancelling ? 0.6 : 1 }}
              >
                {cancelling ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <XCircle size={13} />}
                Cancel order
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
