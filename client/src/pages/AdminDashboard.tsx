import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, RefreshCw, ToggleLeft, ToggleRight, Package, ShoppingBag, Store, Megaphone, Trash2, TrendingUp, ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ApiResponse, MenuItem, Order, OrderStatus, Vendor } from '../types';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<ApiResponse<{ url: string }>>('/uploads/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.data.url);
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {value ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={value} alt="preview" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--gray-200)' }} />
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--error)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={10} color="#fff" />
          </button>
        </div>
      ) : (
        <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ImagePlus size={22} color="var(--gray-400)" />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <ImagePlus size={13} />}
          {uploading ? 'Uploading…' : value ? 'Change image' : 'Upload image'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>JPEG, PNG or WebP — max 5 MB</p>
      </div>
    </div>
  );
}

type Tab = 'orders' | 'menu' | 'vendors' | 'announcements' | 'revenue';

interface Announcement {
  id: string;
  type: 'STATUS' | 'GENERAL';
  message: string;
  active: boolean;
  createdAt: string;
}

const STATUS_OPTIONS: OrderStatus[] = ['PENDING','CONFIRMED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED'];

function statusBadgeClass(s: OrderStatus): string {
  const m: Record<OrderStatus, string> = {
    PENDING: 'badge-yellow', CONFIRMED: 'badge-blue', PREPARING: 'badge-blue',
    READY: 'badge-green', IN_TRANSIT: 'badge-orange', DELIVERED: 'badge-green', CANCELLED: 'badge-red',
  };
  return m[s];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editingVendorName, setEditingVendorName] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', vendorId: '', totalStock: '50', onlineStock: '50', image: '' });
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ type: 'GENERAL' as 'STATUS' | 'GENERAL', message: '' });
  const [addingAnnouncement, setAddingAnnouncement] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<ApiResponse<Order[]>>('/orders'),
      api.get<ApiResponse<MenuItem[]>>('/menu/items?all=true'),
      api.get<ApiResponse<Vendor[]>>('/menu/vendors'),
      api.get<ApiResponse<Announcement[]>>('/menu/announcements/all'),
    ])
      .then(([o, m, v, a]) => { setOrders(o.data.data); setMenuItems(m.data.data); setVendors(v.data.data); setAnnouncements(a.data.data); })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      toast.success('Order status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingVendor(true);
    try {
      const res = await api.post<ApiResponse<Vendor>>('/menu/vendors', { name: newVendorName });
      setVendors(v => [...v, res.data.data]);
      setNewVendorName('');
      toast.success('Vendor created');
    } catch { toast.error('Failed to create vendor'); }
    finally { setAddingVendor(false); }
  };

  const handleRenameVendor = async (id: string) => {
    if (!editingVendorName.trim()) return;
    try {
      const res = await api.patch<ApiResponse<Vendor>>(`/menu/vendors/${id}`, { name: editingVendorName });
      setVendors(prev => prev.map(v => v.id === id ? res.data.data : v));
      setEditingVendorId(null);
      toast.success('Vendor renamed');
    } catch { toast.error('Failed to rename vendor'); }
  };

  const handleDeleteVendor = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/menu/vendors/${id}`);
      setVendors(prev => prev.filter(v => v.id !== id));
      toast.success('Vendor deleted');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to delete vendor');
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/menu/items/${id}`);
      setMenuItems(prev => prev.filter(m => m.id !== id));
      toast.success('Item deleted');
    } catch { toast.error('Failed to delete item'); }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await api.patch(`/menu/items/${editingItem.id}`, {
        name: editingItem.name,
        price: Number(editingItem.price),
        totalStock: Number(editingItem.totalStock),
        onlineStock: Number(editingItem.onlineStock),
        image: editingItem.image ?? undefined,
        vendorId: editingItem.vendorId,
      });
      setMenuItems(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...editingItem } : m));
      setEditingItem(null);
      toast.success('Item updated');
    } catch { toast.error('Failed to update item'); }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingItem(true);
    try {
      await api.post('/menu/items', {
        name: newItem.name,
        price: parseFloat(newItem.price),
        vendorId: newItem.vendorId,
        totalStock: parseInt(newItem.totalStock, 10),
        onlineStock: parseInt(newItem.onlineStock, 10),
        image: newItem.image || undefined,
      });
      setNewItem({ name: '', price: '', vendorId: '', totalStock: '50', onlineStock: '50', image: '' });
      setShowAddItem(false);
      load();
      toast.success('Menu item added');
    } catch { toast.error('Failed to add item'); }
    finally { setAddingItem(false); }
  };

  const toggleItem = async (item: MenuItem) => {
    const status = item.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    try {
      await api.patch(`/menu/items/${item.id}`, { status });
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, status } : m));
      toast.success(`${item.name} ${status === 'AVAILABLE' ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed to update item'); }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingAnnouncement(true);
    try {
      const res = await api.post<ApiResponse<Announcement>>('/menu/announcements', newAnnouncement);
      setAnnouncements(prev => [res.data.data, ...prev]);
      setNewAnnouncement({ type: 'GENERAL', message: '' });
      toast.success('Announcement posted');
    } catch { toast.error('Failed to post announcement'); }
    finally { setAddingAnnouncement(false); }
  };

  const handleToggleAnnouncement = async (id: string) => {
    try {
      const res = await api.patch<ApiResponse<Announcement>>(`/menu/announcements/${id}/toggle`);
      setAnnouncements(prev => prev.map(a => a.id === id ? res.data.data : a));
    } catch { toast.error('Failed to update announcement'); }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await api.delete(`/menu/announcements/${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Announcement deleted');
    } catch { toast.error('Failed to delete announcement'); }
  };

  const orderTotal = (o: Order) => Number(o.deliveryFee) + o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);

  const today = new Date().toDateString();
  const paidOrders   = orders.filter(o => o.paid);
  const todayOrders  = orders.filter(o => new Date(o.createdAt).toDateString() === today);
  const todayPaid    = todayOrders.filter(o => o.paid);
  const pending      = orders.filter(o => o.status === 'PENDING').length;
  const active       = orders.filter(o => ['CONFIRMED','PREPARING','READY','IN_TRANSIT'].includes(o.status)).length;
  const delivered    = orders.filter(o => o.status === 'DELIVERED').length;
  const cancelled    = orders.filter(o => o.status === 'CANCELLED').length;
  const revenue      = paidOrders.reduce((s, o) => s + orderTotal(o), 0);
  const revenueToday = todayPaid.reduce((s, o) => s + orderTotal(o), 0);
  const avgOrder     = paidOrders.length ? Math.round(revenue / paidOrders.length) : 0;

  // Top items by units sold
  const itemSales = new Map<string, { name: string; vendorName: string; qty: number; revenue: number }>();
  orders.forEach(o => {
    o.items.forEach(i => {
      const prev = itemSales.get(i.menuItem.id) ?? { name: i.menuItem.name, vendorName: i.menuItem.vendor?.name ?? '—', qty: 0, revenue: 0 };
      itemSales.set(i.menuItem.id, {
        name: i.menuItem.name,
        vendorName: prev.vendorName,
        qty: prev.qty + i.quantity,
        revenue: prev.revenue + (o.paid ? Number(i.unitPrice) * i.quantity : 0),
      });
    });
  });
  const topItems = [...itemSales.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Vendor performance
  const vendorStats = new Map<string, { name: string; orders: number; revenue: number; qty: number }>();
  orders.forEach(o => {
    o.items.forEach(i => {
      const vid = i.menuItem.vendorId ?? i.menuItem.vendor?.name ?? '?';
      const vname = i.menuItem.vendor?.name ?? '?';
      const prev = vendorStats.get(vid) ?? { name: vname, orders: 0, revenue: 0, qty: 0 };
      vendorStats.set(vid, {
        name: vname,
        orders: prev.orders + 1,
        revenue: prev.revenue + (o.paid ? Number(i.unitPrice) * i.quantity : 0),
        qty: prev.qty + i.quantity,
      });
    });
  });
  const vendorList = [...vendorStats.values()].sort((a, b) => b.revenue - a.revenue);
  const maxVendorRev = Math.max(...vendorList.map(v => v.revenue), 1);

  // Last 7 days revenue
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const dayOrders = paidOrders.filter(o => new Date(o.createdAt).toDateString() === ds);
    return { label: d.toLocaleDateString('en-NG', { weekday: 'short' }), value: dayOrders.reduce((s, o) => s + orderTotal(o), 0) };
  });
  const maxDay = Math.max(...last7.map(d => d.value), 1);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'orders', label: 'Orders', icon: <ShoppingBag size={15} /> },
    { id: 'revenue', label: 'Revenue', icon: <TrendingUp size={15} /> },
    { id: 'menu', label: 'Menu', icon: <Package size={15} /> },
    { id: 'vendors', label: 'Vendors', icon: <Store size={15} /> },
    { id: 'announcements', label: 'Notices', icon: <Megaphone size={15} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate('/menu')}><ChevronLeft size={20} /></button>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Admin panel</span>
          <button className="btn btn-ghost btn-icon" onClick={load} title="Refresh">
            {loading ? <span className="spinner spinner-dark" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <div className="page-wrap">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total revenue', value: `₦${revenue.toLocaleString()}`, sub: `₦${revenueToday.toLocaleString()} today`, color: 'var(--primary)' },
            { label: 'Avg order value', value: `₦${avgOrder.toLocaleString()}`, sub: `${paidOrders.length} paid orders`, color: 'var(--info)' },
            { label: 'Active orders', value: active, sub: `${pending} pending`, color: 'var(--warning)' },
            { label: 'Delivered', value: delivered, sub: `${cancelled} cancelled`, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: tab === t.id ? 'var(--primary)' : 'var(--gray-500)',
                  borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all var(--transition)', fontFamily: 'inherit',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            {/* Orders tab */}
            {tab === 'orders' && (
              <div>
                {orders.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <ShoppingBag className="empty-state-icon" />
                    <h3>No orders yet</h3>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Location</th>
                          <th>Items</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Payment</th>
                          <th>Update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => {
                          const total = Number(order.deliveryFee) + order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
                          return (
                            <tr key={order.id}>
                              <td style={{ fontWeight: 500 }}>{order.user.email.split('@')[0]}</td>
                              <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{order.floor}, {order.officeNumber}</td>
                              <td style={{ fontSize: 13, color: 'var(--gray-600)', maxWidth: 200 }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                  {order.items.map(i => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₦{total.toLocaleString()}</td>
                              <td>
                                <span className={`badge ${statusBadgeClass(order.status)}`}>{order.status}</span>
                              </td>
                              <td>
                                <span className={`badge ${order.paid ? 'badge-green' : 'badge-gray'}`}>
                                  {order.paid ? 'Paid' : 'Unpaid'}
                                </span>
                              </td>
                              <td>
                                <select
                                  value={order.status}
                                  onChange={e => updateStatus(order.id, e.target.value as OrderStatus)}
                                  style={{ padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray-200)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
                                >
                                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Revenue tab */}
            {tab === 'revenue' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Total revenue', value: `₦${revenue.toLocaleString()}`, sub: `from ${paidOrders.length} paid orders`, color: 'var(--primary)' },
                    { label: "Today's revenue", value: `₦${revenueToday.toLocaleString()}`, sub: `${todayOrders.length} orders today`, color: '#16a34a' },
                    { label: 'Avg order value', value: `₦${avgOrder.toLocaleString()}`, sub: 'across paid orders', color: 'var(--info)' },
                    { label: 'Payment rate', value: orders.length ? `${Math.round((paidOrders.length / orders.length) * 100)}%` : '—', sub: `${orders.length - paidOrders.length} unpaid`, color: 'var(--warning)' },
                  ].map(c => (
                    <div key={c.label} style={{ padding: '16px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                      <p style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 6 }}>{c.label}</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: c.color, letterSpacing: '-0.03em', marginBottom: 2 }}>{c.value}</p>
                      <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>{c.sub}</p>
                    </div>
                  ))}
                </div>

                {/* 7-day bar chart */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 14 }}>Revenue — last 7 days</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
                    {last7.map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {d.value > 0 ? `₦${(d.value / 1000).toFixed(1)}k` : ''}
                        </span>
                        <div style={{ width: '100%', borderRadius: '4px 4px 2px 2px', background: d.value > 0 ? 'var(--primary)' : 'var(--gray-100)', height: `${Math.max((d.value / maxDay) * 76, d.value > 0 ? 6 : 4)}px`, transition: 'height 0.35s ease' }} />
                        <span style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 600 }}>{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vendor performance */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 12 }}>Vendor performance</p>
                  {vendorList.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No orders yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {vendorList.map((v, i) => (
                        <div key={v.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-100)', background: i === 0 ? 'var(--primary-subtle)' : '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? 'var(--primary-light)' : 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Store size={13} color={i === 0 ? 'var(--primary)' : 'var(--gray-400)'} />
                            </div>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--gray-800)' }}>{v.name}</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>₦{v.revenue.toLocaleString()}</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 99, background: 'var(--gray-100)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 99, background: i === 0 ? 'var(--primary)' : 'var(--gray-300)', width: `${(v.revenue / maxVendorRev) * 100}%`, transition: 'width 0.4s ease' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{v.qty} units sold</span>
                            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{v.orders} order lines</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top items + status side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                  {/* Top items */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 12 }}>Top items</p>
                    {topItems.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No orders yet</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {topItems.map((item, i) => (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: i === 0 ? 'var(--primary-subtle)' : 'transparent' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? 'var(--primary)' : 'var(--gray-300)', width: 18 }}>#{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                              <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.vendorName}</p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>₦{item.revenue.toLocaleString()}</p>
                              <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.qty} sold</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Order status breakdown */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 12 }}>Orders by status</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Delivered', count: delivered, color: '#16a34a' },
                        { label: 'Active', count: active, color: 'var(--info)' },
                        { label: 'Pending', count: pending, color: 'var(--warning)' },
                        { label: 'Cancelled', count: cancelled, color: 'var(--error)' },
                      ].map(row => (
                        <div key={row.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{row.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.count}</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 99, background: 'var(--gray-100)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 99, background: row.color, width: orders.length ? `${(row.count / orders.length) * 100}%` : '0%', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* Menu tab */}
            {tab === 'menu' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="section-title">{menuItems.length} items</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddItem(true)}>
                    <Plus size={14} /> Add item
                  </button>
                </div>

                {showAddItem && (
                  <div className="card" style={{ padding: 20, marginBottom: 16, border: '1.5px solid var(--primary-light)' }}>
                    <h4 style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>New menu item</h4>
                    <form onSubmit={handleCreateItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label className="label">Name</label>
                        <input className="input" placeholder="Item name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="label">Price (₦)</label>
                        <input className="input" type="number" placeholder="0" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="label">Vendor</label>
                        <select className="input" value={newItem.vendorId} onChange={e => setNewItem({ ...newItem, vendorId: e.target.value })} required style={{ cursor: 'pointer' }}>
                          <option value="">Select vendor</option>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="label">Total stock</label>
                        <input className="input" type="number" value={newItem.totalStock} onChange={e => setNewItem({ ...newItem, totalStock: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="label">Online stock</label>
                        <input className="input" type="number" value={newItem.onlineStock} onChange={e => setNewItem({ ...newItem, onlineStock: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label className="label">Image</label>
                        <ImageUploader value={newItem.image} onChange={url => setNewItem({ ...newItem, image: url })} />
                      </div>
                      <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddItem(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={addingItem}>
                          {addingItem ? <span className="spinner" /> : <Plus size={13} />}
                          Add item
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {editingItem && (
                  <div className="card" style={{ padding: 20, marginBottom: 16, border: '1.5px solid var(--primary-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14 }}>Edit — {editingItem.name}</h4>
                      <button className="btn btn-ghost btn-icon-sm" onClick={() => setEditingItem(null)}>✕</button>
                    </div>
                    <form onSubmit={handleUpdateItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label className="label">Name</label>
                        <input className="input" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="label">Price (₦)</label>
                        <input className="input" type="number" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })} required />
                      </div>
                      <div className="form-group">
                        <label className="label">Vendor</label>
                        <select className="input" value={editingItem.vendorId} onChange={e => setEditingItem({ ...editingItem, vendorId: e.target.value })} style={{ cursor: 'pointer' }}>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="label">Total stock</label>
                        <input className="input" type="number" value={editingItem.totalStock} onChange={e => setEditingItem({ ...editingItem, totalStock: Number(e.target.value) })} />
                      </div>
                      <div className="form-group">
                        <label className="label">Online stock</label>
                        <input className="input" type="number" value={editingItem.onlineStock} onChange={e => setEditingItem({ ...editingItem, onlineStock: Number(e.target.value) })} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label className="label">Image</label>
                        <ImageUploader value={editingItem.image ?? ''} onChange={url => setEditingItem({ ...editingItem, image: url })} />
                      </div>
                      <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingItem(null)}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-sm">Save changes</button>
                      </div>
                    </form>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {menuItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', transition: 'background var(--transition)', background: editingItem?.id === item.id ? 'var(--primary-subtle)' : 'transparent' }} onMouseEnter={e => { if (editingItem?.id !== item.id) e.currentTarget.style.background = 'var(--gray-50)'; }} onMouseLeave={e => { if (editingItem?.id !== item.id) e.currentTarget.style.background = 'transparent'; }}>
                      {item.image ? <img src={item.image} alt={item.name} style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--gray-100)', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{item.vendor.name} · {item.onlineStock} in stock</p>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14, flexShrink: 0 }}>₦{Number(item.price).toLocaleString()}</span>
                      <span className={`badge ${item.status === 'AVAILABLE' ? 'badge-green' : 'badge-red'}`}>{item.status === 'AVAILABLE' ? 'Live' : 'Off'}</span>
                      <button className="btn btn-ghost btn-icon-sm" onClick={() => toggleItem(item)} title="Toggle availability">
                        {item.status === 'AVAILABLE' ? <ToggleRight size={20} color="var(--primary)" /> : <ToggleLeft size={20} color="var(--gray-400)" />}
                      </button>
                      <button className="btn btn-ghost btn-icon-sm" title="Edit item" onClick={() => setEditingItem(item)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="btn btn-ghost btn-icon-sm" title="Delete item" style={{ color: 'var(--error)' }} onClick={() => handleDeleteItem(item.id, item.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Announcements tab */}
            {tab === 'announcements' && (
              <div>
                <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>Post an announcement</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select
                      className="input"
                      value={newAnnouncement.type}
                      onChange={e => setNewAnnouncement(a => ({ ...a, type: e.target.value as 'STATUS' | 'GENERAL' }))}
                      style={{ width: 130, flexShrink: 0, cursor: 'pointer' }}
                    >
                      <option value="GENERAL">Notice</option>
                      <option value="STATUS">Status</option>
                    </select>
                    <input
                      className="input"
                      placeholder="e.g. Canteen closes at 2pm today"
                      value={newAnnouncement.message}
                      onChange={e => setNewAnnouncement(a => ({ ...a, message: e.target.value }))}
                      required
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={addingAnnouncement} style={{ flexShrink: 0 }}>
                      {addingAnnouncement ? <span className="spinner" /> : <Plus size={15} />}
                      Post
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                    <strong>Status</strong> = pinned banner with dismiss button · <strong>Notice</strong> = scrolling carousel
                  </p>
                </form>

                {announcements.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <Megaphone className="empty-state-icon" />
                    <h3>No announcements</h3>
                    <p>Post one above to show it on the menu page</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {announcements.map(a => (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 'var(--radius-md)',
                        border: `1px solid ${a.active ? (a.type === 'STATUS' ? 'var(--primary-light)' : '#fde68a') : 'var(--gray-200)'}`,
                        background: a.active ? (a.type === 'STATUS' ? 'var(--primary-subtle)' : '#fffbeb') : '#fff',
                        opacity: a.active ? 1 : 0.55,
                        transition: 'all 0.15s',
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                          textTransform: 'uppercase', flexShrink: 0, width: 46,
                          color: a.type === 'STATUS' ? 'var(--primary)' : 'var(--amber)',
                        }}>
                          {a.type === 'STATUS' ? 'Status' : 'Notice'}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--gray-800)' }}>{a.message}</span>
                        <span style={{ fontSize: 11, color: 'var(--gray-400)', flexShrink: 0 }}>{a.active ? 'Live' : 'Hidden'}</span>
                        <button className="btn btn-ghost btn-icon-sm" onClick={() => handleToggleAnnouncement(a.id)} title={a.active ? 'Hide' : 'Show'}>
                          {a.active ? <ToggleRight size={20} color="var(--primary)" /> : <ToggleLeft size={20} color="var(--gray-400)" />}
                        </button>
                        <button className="btn btn-ghost btn-icon-sm" onClick={() => handleDeleteAnnouncement(a.id)} title="Delete" style={{ color: 'var(--error)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Vendors tab */}
            {tab === 'vendors' && (
              <div>
                <form onSubmit={handleCreateVendor} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <input className="input" placeholder="New vendor name" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} required style={{ flex: 1 }} />
                  <button type="submit" className="btn btn-primary" disabled={addingVendor}>
                    {addingVendor ? <span className="spinner" /> : <Plus size={15} />}
                    Add vendor
                  </button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vendors.map(v => (
                    <div key={v.id} className="card" style={{ padding: '14px 16px' }}>
                      {editingVendorId === v.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="input"
                            value={editingVendorName}
                            onChange={e => setEditingVendorName(e.target.value)}
                            autoFocus
                            style={{ flex: 1 }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => handleRenameVendor(v.id)}>Save</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingVendorId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Store size={16} color="var(--primary)" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</p>
                            <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                              {menuItems.filter(m => m.vendorId === v.id).length} menu items
                            </p>
                          </div>
                          <button
                            className="btn btn-ghost btn-icon-sm"
                            title="Rename"
                            onClick={() => { setEditingVendorId(v.id); setEditingVendorName(v.name); }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn btn-ghost btn-icon-sm"
                            title="Delete vendor"
                            style={{ color: 'var(--error)' }}
                            onClick={() => handleDeleteVendor(v.id, v.name)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
