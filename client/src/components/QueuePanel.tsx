import { useEffect, useState } from 'react';
import {
  RefreshCw, Truck, CheckCircle, MapPin, Phone,
  Clock, ChefHat, Package, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ApiResponse, Order } from '../types';

const LONG_WAIT_MINUTES = 15;

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function timeAgo(iso: string): string {
  const diff = minutesAgo(iso);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  return `${h}h ${diff % 60}m ago`;
}

function displayName(order: Order): string {
  return order.user.name || order.user.email.split('@')[0];
}

function totalValue(order: Order): number {
  return Number(order.deliveryFee) + order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/^\+234/, '0').replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return raw;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED:  { label: 'Confirmed',  color: '#1d4ed8', bg: '#dbeafe' },
  PREPARING:  { label: 'Preparing',  color: '#b45309', bg: '#fef3c7' },
  READY:      { label: 'Ready',      color: '#15803d', bg: '#dcfce7' },
  IN_TRANSIT: { label: 'In transit', color: '#7c3aed', bg: '#ede9fe' },
};

type MainTab = 'queue' | 'history';
type Filter  = 'all' | 'transit' | 'ready' | 'upcoming';

export default function QueuePanel() {
  const [mainTab, setMainTab]         = useState<MainTab>('queue');
  const [orders, setOrders]           = useState<Order[]>([]);
  const [history, setHistory]         = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [updating, setUpdating]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter]           = useState<Filter>('all');

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      api.get<ApiResponse<Order[]>>('/orders/queue'),
      api.get<ApiResponse<Order[]>>('/orders/history'),
    ])
      .then(([q, h]) => {
        setOrders(q.data.data);
        setHistory(h.data.data);
        setLastRefresh(new Date());
      })
      .catch(() => { if (!silent) toast.error('Failed to load queue'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, []);

  const markStatus = async (orderId: string, status: 'IN_TRANSIT' | 'DELIVERED') => {
    setUpdating(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      if (status === 'DELIVERED') {
        const done = orders.find(o => o.id === orderId);
        setOrders(prev => prev.filter(o => o.id !== orderId));
        if (done) setHistory(prev => [{ ...done, status: 'DELIVERED', updatedAt: new Date().toISOString() }, ...prev]);
        toast.success('Marked as delivered');
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        toast.success('Picked up — en route');
      }
    } catch { toast.error('Failed to update'); }
    finally { setUpdating(null); }
  };

  const inTransit  = orders.filter(o => o.status === 'IN_TRANSIT');
  const ready      = orders.filter(o => o.status === 'READY').sort((a, b) => a.floor.localeCompare(b.floor));
  const upcoming   = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING');
  const longWaits  = ready.filter(o => minutesAgo(o.updatedAt) >= LONG_WAIT_MINUTES).length;
  const activeCount = inTransit.length + ready.length;
  const totalHistoryValue = history.reduce((s, o) => s + totalValue(o), 0);

  const showTransit  = filter === 'all' || filter === 'transit';
  const showReady    = filter === 'all' || filter === 'ready';
  const showUpcoming = filter === 'all' || filter === 'upcoming';

  return (
    <div>
      {/* Refresh row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12, gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'var(--font-ui)' }}>
          {timeAgo(lastRefresh.toISOString())}
        </span>
        <button className="btn btn-ghost btn-icon" onClick={() => load()} title="Refresh">
          {loading ? <span className="spinner spinner-dark" /> : <RefreshCw size={15} />}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-200)', background: '#fff', marginBottom: 16, overflow: 'hidden' }}>
        <StatPill label="Active"     value={activeCount}      color="var(--primary)" />
        <StatPill label="In transit" value={inTransit.length} color="#7c3aed" />
        <StatPill label="Delivered"  value={history.length}   color="#15803d" />
        {longWaits > 0 && <StatPill label="Long wait" value={longWaits} color="var(--error)" alert />}
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--gray-100)', padding: '0 16px', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--gray-200)' }}>
        <TabButton active={mainTab === 'queue'} onClick={() => setMainTab('queue')}>
          <Package size={14} /> Queue {orders.length > 0 ? `(${orders.length})` : ''}
        </TabButton>
        <TabButton active={mainTab === 'history'} onClick={() => setMainTab('history')}>
          <CheckCircle size={14} /> Today&apos;s history {history.length > 0 ? `(${history.length})` : ''}
        </TabButton>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
        {mainTab === 'queue' ? (
          <>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid var(--gray-100)' }}>
              {([
                { key: 'all',      label: 'All',        count: orders.length },
                { key: 'transit',  label: 'In transit', count: inTransit.length },
                { key: 'ready',    label: 'Ready',      count: ready.length },
                { key: 'upcoming', label: 'Coming up',  count: upcoming.length },
              ] as { key: Filter; label: string; count: number }[]).map(f => (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  count={f.count}
                  active={filter === f.key}
                  onClick={() => setFilter(f.key)}
                />
              ))}
            </div>

            <div style={{ padding: '16px 16px 20px' }}>
              {orders.length === 0 && !loading ? (
                <div className="empty-state" style={{ padding: 48 }}>
                  <CheckCircle className="empty-state-icon" style={{ color: 'var(--primary)' }} />
                  <h3>All clear</h3>
                  <p>No active deliveries. Auto-refreshing every 30s.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {showTransit && inTransit.length > 0 && (
                    <section>
                      <SectionHeader icon={<Truck size={14} />} label="In transit" count={inTransit.length} color="#7c3aed" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {inTransit.map(order => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            action={{ label: 'Delivered', icon: <CheckCircle size={14} />, variant: 'primary' }}
                            onAction={() => markStatus(order.id, 'DELIVERED')}
                            loading={updating === order.id}
                            highlight
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {showReady && ready.length > 0 && (
                    <section>
                      <SectionHeader icon={<Package size={14} />} label="Ready for pickup" count={ready.length} color="#15803d" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {ready.map(order => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            action={{ label: 'Pick up', icon: <Truck size={14} />, variant: 'outline' }}
                            onAction={() => markStatus(order.id, 'IN_TRANSIT')}
                            loading={updating === order.id}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {showUpcoming && upcoming.length > 0 && (
                    <section>
                      <SectionHeader icon={<ChefHat size={14} />} label="Coming up" count={upcoming.length} color="var(--gray-400)" />
                      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                        {upcoming.map((order, i) => (
                          <UpcomingRow key={order.id} order={order} last={i === upcoming.length - 1} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '16px 16px 20px' }}>
            {history.length === 0 ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <Package className="empty-state-icon" />
                <h3>No deliveries yet today</h3>
                <p>Completed deliveries will appear here throughout the day.</p>
              </div>
            ) : (
              <>
                <div className="card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex' }}>
                  <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--gray-100)' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                      {history.length}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'var(--font-ui)', fontWeight: 600, textTransform: 'uppercase', marginTop: 3 }}>
                      Delivered
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                      ₦{totalHistoryValue.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'var(--font-ui)', fontWeight: 600, textTransform: 'uppercase', marginTop: 3 }}>
                      Total value
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {history.map(order => <HistoryCard key={order.id} order={order} />)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 16px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        color: active ? 'var(--primary)' : 'var(--gray-400)',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 20,
        border: `1.5px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`,
        background: active ? 'var(--primary-subtle)' : '#fff',
        color: active ? 'var(--primary-darker)' : 'var(--gray-500)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: active ? 'var(--primary)' : 'var(--gray-200)',
          color: active ? '#fff' : 'var(--gray-600)',
          borderRadius: 20, padding: '0 5px', fontSize: 10, fontWeight: 700, lineHeight: '16px',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function StatPill({ label, value, color, alert }: { label: string; value: number; color: string; alert?: boolean }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 4px', borderRight: '1px solid var(--gray-100)',
      background: alert ? '#fff5f5' : undefined,
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font-display)' }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: alert ? color : 'var(--gray-400)', fontFamily: 'var(--font-ui)', fontWeight: 600, letterSpacing: '0.04em', marginTop: 2, textTransform: 'uppercase', textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}

function SectionHeader({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ color, display: 'flex' }}>{icon}</span>
      <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-500)', margin: 0 }}>
        {label}
      </h2>
      <span style={{ fontSize: 12, fontWeight: 700, color, background: color + '1a', borderRadius: 20, padding: '1px 8px' }}>
        {count}
      </span>
    </div>
  );
}

function UpcomingRow({ order, last }: { order: Order; last: boolean }) {
  const meta = STATUS_META[order.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--gray-100)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{displayName(order)}</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, color: meta?.color, background: meta?.bg }}>
            {meta?.label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>
          Floor {order.floor}{order.officeNumber ? ` · Wing ${order.officeNumber}` : ''} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--gray-400)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={11} /> {timeAgo(order.createdAt)}
      </span>
    </div>
  );
}

function HistoryCard({ order }: { order: Order }) {
  const value = totalValue(order);
  return (
    <div className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #15803d' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} color="#15803d" />
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{displayName(order)}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--gray-500)', fontSize: 12 }}>
            <MapPin size={11} />
            Floor {order.floor}{order.officeNumber ? ` · Wing ${order.officeNumber}` : ''}
            <span style={{ color: 'var(--gray-300)' }}>·</span>
            <span>Delivered at {new Date(order.updatedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14, flexShrink: 0 }}>
          ₦{value.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.6 }}>
        {order.items.map(i => `${i.menuItem.name} ×${i.quantity}`).join(' · ')}
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  action?: { label: string; icon: React.ReactNode; variant: 'primary' | 'outline' };
  onAction?: () => void;
  loading: boolean;
  highlight?: boolean;
}

function OrderCard({ order, action, onAction, loading, highlight }: OrderCardProps) {
  const meta = STATUS_META[order.status];
  const waitMins = minutesAgo(order.updatedAt);
  const isLongWait = order.status === 'READY' && waitMins >= LONG_WAIT_MINUTES;

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        borderLeft: isLongWait ? '3px solid var(--error)' : highlight ? '3px solid var(--primary)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, margin: 0, lineHeight: 1.2 }}>{displayName(order)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: meta?.color, background: meta?.bg }}>
              {meta?.label ?? order.status}
            </span>
            {isLongWait ? (
              <span style={{ fontSize: 11, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                <AlertTriangle size={11} /> Waiting {waitMins}m
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} /> {timeAgo(order.createdAt)}
              </span>
            )}
          </div>
        </div>
        {action && onAction && (
          <button className={`btn btn-sm btn-${action.variant}`} onClick={onAction} disabled={loading} style={{ flexShrink: 0 }}>
            {loading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : action.icon}
            {action.label}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--primary-subtle)', borderRadius: 20, padding: '4px 12px',
        }}>
          <MapPin size={12} color="var(--primary)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-darker)' }}>
            Floor {order.floor}
          </span>
          {order.officeNumber && (
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>· Wing {order.officeNumber}</span>
          )}
        </div>

        {order.phone ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--gray-600)', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
              {formatPhone(order.phone)}
            </span>
            <a
              href={`tel:${order.phone}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 600, color: '#fff',
                background: 'var(--primary)',
                padding: '3px 10px', borderRadius: 20,
                textDecoration: 'none',
              }}
              onClick={e => e.stopPropagation()}
            >
              <Phone size={11} /> Call
            </a>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>No phone number</span>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 10, marginBottom: 10 }}>
        {order.items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.9 }}>
            <span>
              {item.menuItem.name}
              <span style={{ color: 'var(--gray-400)', marginLeft: 4 }}>×{item.quantity}</span>
            </span>
            <span style={{ fontWeight: 600 }}>₦{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
          + ₦{Number(order.deliveryFee).toLocaleString()} delivery
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${order.paid ? 'badge-green' : 'badge-yellow'}`}>
            {order.paid ? 'Paid' : 'Unpaid'}
          </span>
          <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>
            ₦{totalValue(order).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
