import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ApiResponse, MenuItem, Order, OrderStatus, Vendor } from '../types';

type Tab = 'orders' | 'menu' | 'vendors';

const STATUS_OPTIONS: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED',
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newVendorName, setNewVendorName] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '', vendorId: '', totalStock: '0', onlineStock: '0', image: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get<ApiResponse<Order[]>>('/orders'),
      api.get<ApiResponse<MenuItem[]>>('/menu/items?all=true'),
      api.get<ApiResponse<Vendor[]>>('/menu/vendors'),
    ])
      .then(([o, m, v]) => {
        setOrders(o.data.data);
        setMenuItems(m.data.data);
        setVendors(v.data.data);
      })
      .catch(() => setError('Failed to load admin data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    } catch { setError('Failed to update order status.'); }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    try {
      const res = await api.post<ApiResponse<Vendor>>('/menu/vendors', { name: newVendorName });
      setVendors((v) => [...v, res.data.data]);
      setNewVendorName('');
      setFormSuccess('Vendor created!');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setFormError(e.response?.data?.message ?? 'Error creating vendor.');
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    try {
      await api.post('/menu/items', {
        name: newItem.name,
        price: parseFloat(newItem.price),
        vendorId: newItem.vendorId,
        totalStock: parseInt(newItem.totalStock, 10),
        onlineStock: parseInt(newItem.onlineStock, 10),
        image: newItem.image || undefined,
      });
      setNewItem({ name: '', price: '', vendorId: '', totalStock: '0', onlineStock: '0', image: '' });
      setFormSuccess('Menu item created!');
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setFormError(e.response?.data?.message ?? 'Error creating item.');
    }
  };

  const toggleItemStatus = async (item: MenuItem) => {
    const newStatus = item.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    try {
      await api.patch(`/menu/items/${item.id}`, { status: newStatus });
      setMenuItems((prev) => prev.map((m) => m.id === item.id ? { ...m, status: newStatus } : m));
    } catch { setError('Failed to update item status.'); }
  };

  if (loading) return <div style={s.center}>Loading…</div>;

  return (
    <div style={s.root}>
      <header style={s.header}>
        <span style={s.logo}>⚙️ Admin Panel</span>
        <button style={s.navBtn} onClick={() => navigate('/menu')}>← Menu</button>
      </header>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.tabs}>
        {(['orders', 'menu', 'vendors'] as Tab[]).map((t) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <main style={s.main}>
        {tab === 'orders' && (
          <div>
            <h2 style={s.sectionTitle}>All Orders ({orders.length})</h2>
            {orders.map((order) => (
              <div key={order.id} style={s.card}>
                <div style={s.cardRow}>
                  <div>
                    <strong>{order.user.email}</strong>
                    <span style={s.meta}> · Floor {order.floor} · {order.officeNumber}</span>
                  </div>
                  <span style={{ ...s.badge, background: statusColor(order.status) }}>
                    {order.status}
                  </span>
                </div>
                <div style={s.cardRow}>
                  <span style={s.meta}>{order.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', ')}</span>
                  <span style={s.meta}>₦{(Number(order.deliveryFee) + order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)).toLocaleString()}</span>
                </div>
                <div style={s.cardRow}>
                  <span style={s.meta}>{order.paid ? '✅ Paid' : '⏳ Unpaid'}</span>
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                    style={s.select}
                  >
                    {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'menu' && (
          <div>
            <h2 style={s.sectionTitle}>Add Menu Item</h2>
            {formError && <p style={s.formErr}>{formError}</p>}
            {formSuccess && <p style={s.formOk}>{formSuccess}</p>}
            <form onSubmit={handleCreateItem} style={s.form}>
              <input style={s.input} placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} required />
              <input style={s.input} placeholder="Price (₦)" type="number" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} required />
              <select style={s.input} value={newItem.vendorId} onChange={(e) => setNewItem({ ...newItem, vendorId: e.target.value })} required>
                <option value="">Select vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input style={s.input} placeholder="Total stock" type="number" value={newItem.totalStock} onChange={(e) => setNewItem({ ...newItem, totalStock: e.target.value })} />
              <input style={s.input} placeholder="Online stock" type="number" value={newItem.onlineStock} onChange={(e) => setNewItem({ ...newItem, onlineStock: e.target.value })} />
              <input style={s.input} placeholder="Image URL (optional)" value={newItem.image} onChange={(e) => setNewItem({ ...newItem, image: e.target.value })} />
              <button type="submit" style={s.btn}>Add item</button>
            </form>

            <h2 style={{ ...s.sectionTitle, marginTop: 32 }}>Menu Items ({menuItems.length})</h2>
            <div style={s.table}>
              {menuItems.map((item) => (
                <div key={item.id} style={s.tableRow}>
                  <div style={{ flex: 2 }}>
                    <strong>{item.name}</strong>
                    <span style={s.meta}> · {item.vendor.name}</span>
                  </div>
                  <div style={{ flex: 1, color: '#15803d', fontWeight: 600 }}>₦{Number(item.price).toLocaleString()}</div>
                  <div style={s.meta}>{item.onlineStock} in stock</div>
                  <button
                    style={{ ...s.smallBtn, background: item.status === 'AVAILABLE' ? '#dc2626' : '#16a34a' }}
                    onClick={() => toggleItemStatus(item)}
                  >
                    {item.status === 'AVAILABLE' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'vendors' && (
          <div>
            <h2 style={s.sectionTitle}>Add Vendor</h2>
            {formError && <p style={s.formErr}>{formError}</p>}
            {formSuccess && <p style={s.formOk}>{formSuccess}</p>}
            <form onSubmit={handleCreateVendor} style={{ ...s.form, flexDirection: 'row', maxWidth: 400 }}>
              <input style={{ ...s.input, flex: 1 }} placeholder="Vendor name" value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} required />
              <button type="submit" style={s.btn}>Add</button>
            </form>
            <h2 style={{ ...s.sectionTitle, marginTop: 32 }}>Vendors</h2>
            {vendors.map((v) => <div key={v.id} style={s.card}>{v.name}</div>)}
          </div>
        )}
      </main>
    </div>
  );
}

function statusColor(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PENDING: '#f59e0b', CONFIRMED: '#3b82f6', PREPARING: '#8b5cf6',
    READY: '#10b981', IN_TRANSIT: '#f97316', DELIVERED: '#16a34a', CANCELLED: '#dc2626',
  };
  return map[status];
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  header: { background: '#1e3a5f', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  logo: { fontWeight: 700, fontSize: 18 },
  navBtn: { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  errorBanner: { background: '#fee2e2', color: '#dc2626', padding: '12px 24px', fontSize: 14 },
  tabs: { background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', display: 'flex', gap: 0 },
  tab: { padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: '#6b7280', borderBottom: '2px solid transparent', fontWeight: 500 },
  tabActive: { color: '#1e3a5f', borderBottomColor: '#1e3a5f' },
  main: { maxWidth: 900, margin: '24px auto', padding: '0 16px' },
  sectionTitle: { fontSize: 18, fontWeight: 700, marginBottom: 16 },
  card: { background: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badge: { color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  meta: { fontSize: 13, color: '#6b7280' },
  select: { padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 },
  form: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 },
  input: { padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, outline: 'none' },
  btn: { padding: '10px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  formErr: { color: '#dc2626', fontSize: 14 },
  formOk: { color: '#16a34a', fontSize: 14 },
  table: { display: 'flex', flexDirection: 'column', gap: 8 },
  tableRow: { background: '#fff', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  smallBtn: { padding: '4px 12px', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
