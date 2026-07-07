import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Plus, RefreshCw, ToggleLeft, ToggleRight, Package, ShoppingBag, Store, Megaphone, Trash2, TrendingUp, ImagePlus, X, LayoutGrid, LayoutList, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ApiResponse, FoodCategory, MenuItem, Order, OrderStatus, Vendor } from '../types';
import { CATEGORY_META, CATEGORY_ORDER } from '../constants/categories';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PREPARING', 'CANCELLED'],
  PREPARING:  ['READY',     'CANCELLED'],
  READY:      ['IN_TRANSIT','CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
};

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editingVendorName, setEditingVendorName] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', vendorId: '', totalStock: '50', onlineStock: '50', image: '', category: '' as FoodCategory | '' });
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ type: 'GENERAL' as 'STATUS' | 'GENERAL', message: '' });
  const [addingAnnouncement, setAddingAnnouncement] = useState(false);

  // Menu filters + view + bulk select
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<FoodCategory | ''>('');
  const [menuVendorFilter, setMenuVendorFilter] = useState('');
  const [menuView, setMenuView] = useState<'list' | 'grid'>('list');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const exitSelectMode = () => { setSelectMode(false); setSelectedItemIds(new Set()); };

  // Orders filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | ''>('');

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
      setSelectedItemIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast.success('Item deleted');
    } catch { toast.error('Failed to delete item'); }
  };

  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.size} item${selectedItemIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = [...selectedItemIds];
    const results = await Promise.allSettled(ids.map(id => api.delete(`/menu/items/${id}`)));
    const failed = results.filter(r => r.status === 'rejected').length;
    setMenuItems(prev => prev.filter(m => !ids.includes(m.id) || results[ids.indexOf(m.id)].status === 'rejected'));
    setSelectedItemIds(new Set());
    setBulkDeleting(false);
    if (failed > 0) toast.error(`${failed} item${failed > 1 ? 's' : ''} could not be deleted`);
    else toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} deleted`);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredMenuItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredMenuItems.map(i => i.id)));
    }
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
        category: editingItem.category ?? undefined,
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
        category: newItem.category || undefined,
      });
      setNewItem({ name: '', price: '', vendorId: '', totalStock: '50', onlineStock: '50', image: '', category: '' });
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

  // Last 7 days revenue
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const dayOrders = paidOrders.filter(o => new Date(o.createdAt).toDateString() === ds);
    return { label: d.toLocaleDateString('en-NG', { weekday: 'short' }), value: dayOrders.reduce((s, o) => s + orderTotal(o), 0) };
  });

  const statusPieData = [
    { name: 'Delivered', value: delivered, color: '#16a34a' },
    { name: 'Active',    value: active,    color: '#3b82f6' },
    { name: 'Pending',   value: pending,   color: '#f59e0b' },
    { name: 'Cancelled', value: cancelled, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const VENDOR_COLORS = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7'];

  const filteredMenuItems = menuItems.filter(item => {
    if (menuSearch && !item.name.toLowerCase().includes(menuSearch.toLowerCase())) return false;
    if (menuCategoryFilter && item.category !== menuCategoryFilter) return false;
    if (menuVendorFilter && item.vendorId !== menuVendorFilter) return false;
    return true;
  });

  const filteredOrders = orders.filter(order => {
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      const name = order.user.email.split('@')[0].toLowerCase();
      if (!name.includes(q) && !order.user.email.toLowerCase().includes(q)) return false;
    }
    if (orderStatusFilter && order.status !== orderStatusFilter) return false;
    return true;
  });

  const NAV_ITEMS: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'orders',        label: 'Orders',    Icon: ShoppingBag },
    { id: 'revenue',       label: 'Revenue',   Icon: TrendingUp  },
    { id: 'menu',          label: 'Menu',      Icon: Package     },
    { id: 'vendors',       label: 'Vendors',   Icon: Store       },
    { id: 'announcements', label: 'Notices',   Icon: Megaphone   },
  ];

  const goTab = (t: Tab) => { setTab(t); setSidebarOpen(false); };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sidebar header */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpeg" alt="PK Food" style={{ height: 34, width: 'auto', borderRadius: 6 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>PK Food</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => goTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 500,
                background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.62)',
                transition: 'all var(--transition)',
                boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.1)' : 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.62)'; } }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          className="btn btn-ghost"
          onClick={load}
          style={{ width: '100%', color: 'rgba(255,255,255,0.5)', fontSize: 12, gap: 8, justifyContent: 'flex-start' }}
        >
          {loading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <RefreshCw size={13} />}
          Refresh data
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/menu')}
          style={{ width: '100%', color: 'rgba(255,255,255,0.35)', fontSize: 12, gap: 8, justifyContent: 'flex-start' }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--gray-50)', minHeight: '100dvh' }}>
      {/* Header */}
      <header className="nav-header">
        <div className="nav-inner">
          {/* Hamburger — mobile only */}
          <button className="btn btn-ghost btn-icon-sm lg:hidden" onClick={() => setSidebarOpen(v => !v)}>
            <Menu size={20} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Admin panel</span>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div style={{ display: 'flex' }}>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="lg:hidden"
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          style={{
            position: 'fixed', top: 60, bottom: 0, left: 0, zIndex: 50,
            width: 220, flexShrink: 0, overflowY: 'auto',
            background: 'var(--primary-darker)',
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <SidebarContent />
        </aside>

        {/* Desktop spacer so content doesn't hide behind sidebar */}
        <div className="hidden lg:block" style={{ width: 220, flexShrink: 0 }} />

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, padding: '24px', overflowX: 'hidden' }}>

          {/* Section heading */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-800)' }}>
              {NAV_ITEMS.find(n => n.id === tab)?.label}
            </h2>
          </div>

          {/* Tab content card */}
          <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 20 }}>
            {/* Orders tab */}
            {tab === 'orders' && (
              <div>
                {/* Orders toolbar */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                    <input
                      className="input"
                      placeholder="Search by customer…"
                      value={orderSearch}
                      onChange={e => setOrderSearch(e.target.value)}
                      style={{ paddingLeft: 32 }}
                    />
                  </div>
                  <select
                    className="input"
                    value={orderStatusFilter}
                    onChange={e => setOrderStatusFilter(e.target.value as OrderStatus | '')}
                    style={{ width: 150, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <option value="">All statuses</option>
                    {(['PENDING','CONFIRMED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED'] as OrderStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <ShoppingBag className="empty-state-icon" />
                    <h3>{orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}</h3>
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
                        {filteredOrders.map(order => {
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
                                {NEXT_STATUSES[order.status] ? (
                                  <select
                                    key={order.status}
                                    defaultValue=""
                                    onChange={e => { if (e.target.value) updateStatus(order.id, e.target.value as OrderStatus); }}
                                    style={{ padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray-200)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
                                  >
                                    <option value="" disabled>Move to…</option>
                                    {NEXT_STATUSES[order.status]!.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>
                                    {order.status === 'DELIVERED' ? 'Delivered' : 'Cancelled'}
                                  </span>
                                )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

                {/* KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                  {[
                    { label: 'Total revenue',  value: `₦${revenue.toLocaleString()}`,       sub: `from ${paidOrders.length} paid orders`, color: '#2d6a4f', bg: '#f0faf5' },
                    { label: "Today's revenue", value: `₦${revenueToday.toLocaleString()}`,  sub: `${todayOrders.length} orders today`,    color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Avg order value', value: `₦${avgOrder.toLocaleString()}`,      sub: 'across paid orders',                    color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Payment rate',    value: orders.length ? `${Math.round((paidOrders.length / orders.length) * 100)}%` : '—', sub: `${orders.length - paidOrders.length} unpaid`, color: '#f59e0b', bg: '#fffbeb' },
                  ].map(c => (
                    <div key={c.label} style={{ padding: '18px 20px', borderRadius: 'var(--radius-lg)', background: c.bg, border: `1px solid ${c.color}22` }}>
                      <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{c.label}</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: c.color, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>{c.value}</p>
                      <p style={{ fontSize: 11, color: '#9ca3af' }}>{c.sub}</p>
                    </div>
                  ))}
                </div>

                {/* 7-day revenue area chart */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 16 }}>Revenue — last 7 days</p>
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={last7} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#2d6a4f" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <YAxis
                        axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        tickFormatter={v => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`}
                        width={58}
                      />
                      <Tooltip
                        formatter={(v: unknown) => [`₦${Number(v).toLocaleString()}`, 'Revenue']}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                        cursor={{ stroke: '#2d6a4f', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area
                        type="monotone" dataKey="value" stroke="#2d6a4f" strokeWidth={2.5}
                        fill="url(#revGrad)"
                        dot={{ fill: '#2d6a4f', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#2d6a4f', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Vendor bar + Status donut side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>

                  {/* Vendor revenue - horizontal bar chart */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 16 }}>Revenue by vendor</p>
                    {vendorList.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9ca3af' }}>No orders yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(vendorList.length * 44 + 16, 120)}>
                        <BarChart data={vendorList} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                          <XAxis
                            type="number" axisLine={false} tickLine={false}
                            tick={{ fontSize: 11, fill: '#9ca3af' }}
                            tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`}
                          />
                          <YAxis
                            type="category" dataKey="name" axisLine={false} tickLine={false}
                            tick={{ fontSize: 12, fill: '#374151' }} width={88}
                          />
                          <Tooltip
                            formatter={(v: unknown) => [`₦${Number(v).toLocaleString()}`, 'Revenue']}
                            contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                            cursor={{ fill: 'rgba(45,106,79,0.06)' }}
                          />
                          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={20}>
                            {vendorList.map((_, i) => (
                              <Cell key={i} fill={VENDOR_COLORS[i % VENDOR_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Order status donut */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 16 }}>Orders by status</p>
                    {statusPieData.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9ca3af' }}>No orders yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={statusPieData} cx="50%" cy="50%"
                            innerRadius={52} outerRadius={80}
                            paddingAngle={3} dataKey="value" nameKey="name"
                            strokeWidth={0}
                          >
                            {statusPieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: unknown, name: unknown) => [String(v), String(name)] as [string, string]}
                            contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                          />
                          <Legend
                            iconType="circle" iconSize={8}
                            formatter={(value: string) => <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                </div>

                {/* Top items table */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>Top items by revenue</p>
                  {topItems.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9ca3af' }}>No orders yet</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: 32 }}>#</th>
                            <th>Item</th>
                            <th>Vendor</th>
                            <th>Units sold</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topItems.map((item, i) => (
                            <tr key={item.name}>
                              <td>
                                <span style={{ fontWeight: 800, color: i === 0 ? '#2d6a4f' : '#d1d5db', fontSize: 13 }}>#{i + 1}</span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{item.name}</td>
                              <td style={{ color: '#6b7280', fontSize: 13 }}>{item.vendorName}</td>
                              <td style={{ color: '#374151' }}>{item.qty}</td>
                              <td style={{ fontWeight: 700, color: '#2d6a4f' }}>₦{item.revenue.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Menu tab */}
            {tab === 'menu' && (
              <div>
                {/* Menu toolbar */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                    <input
                      className="input"
                      placeholder="Search items…"
                      value={menuSearch}
                      onChange={e => setMenuSearch(e.target.value)}
                      style={{ paddingLeft: 32 }}
                    />
                  </div>
                  <select
                    className="input"
                    value={menuCategoryFilter}
                    onChange={e => setMenuCategoryFilter(e.target.value as FoodCategory | '')}
                    style={{ width: 140, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <option value="">All categories</option>
                    {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                  </select>
                  <select
                    className="input"
                    value={menuVendorFilter}
                    onChange={e => setMenuVendorFilter(e.target.value)}
                    style={{ width: 130, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <option value="">All vendors</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  {/* View toggle */}
                  <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--gray-200)', overflow: 'hidden', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setMenuView('list')}
                      style={{ padding: '7px 10px', border: 'none', cursor: 'pointer', background: menuView === 'list' ? 'var(--primary)' : 'transparent', color: menuView === 'list' ? '#fff' : 'var(--gray-400)', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                      title="List view"
                    >
                      <LayoutList size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuView('grid')}
                      style={{ padding: '7px 10px', border: 'none', cursor: 'pointer', background: menuView === 'grid' ? 'var(--primary)' : 'transparent', color: menuView === 'grid' ? '#fff' : 'var(--gray-400)', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                      title="Grid view"
                    >
                      <LayoutGrid size={15} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${selectMode ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                    style={{ flexShrink: 0, border: '1.5px solid var(--gray-200)' }}
                  >
                    {selectMode ? 'Cancel' : 'Select'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddItem(true)} style={{ flexShrink: 0 }}>
                    <Plus size={14} /> Add item
                  </button>
                </div>
                {/* Bulk action bar — only visible in select mode */}
                <div style={{
                  overflow: 'hidden',
                  maxHeight: selectMode ? 80 : 0,
                  opacity: selectMode ? 1 : 0,
                  transition: 'max-height 0.25s ease, opacity 0.2s ease',
                  marginBottom: selectMode ? 12 : 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: selectedItemIds.size > 0 ? 'var(--primary-subtle)' : 'var(--gray-50)', border: `1.5px solid ${selectedItemIds.size > 0 ? 'var(--primary-light)' : 'var(--gray-200)'}`, transition: 'background 0.15s, border-color 0.15s' }}>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.size === filteredMenuItems.length && filteredMenuItems.length > 0}
                      onChange={toggleSelectAll}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: selectedItemIds.size > 0 ? 'var(--primary)' : 'var(--gray-500)', flex: 1, fontWeight: selectedItemIds.size > 0 ? 600 : 400 }}>
                      {selectedItemIds.size > 0 ? `${selectedItemIds.size} item${selectedItemIds.size > 1 ? 's' : ''} selected` : 'Select items to perform bulk actions'}
                    </span>
                    {selectedItemIds.size > 0 && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={handleBulkDelete}
                          disabled={bulkDeleting}
                          style={{ background: 'var(--error)', color: '#fff', border: 'none', flexShrink: 0 }}
                        >
                          {bulkDeleting ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <Trash2 size={13} />}
                          Delete {selectedItemIds.size}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedItemIds(new Set())} style={{ fontSize: 12, flexShrink: 0 }}>
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
                  {filteredMenuItems.length} of {menuItems.length} items
                </p>

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
                        <label className="label">Category</label>
                        <select className="input" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value as FoodCategory | '' })} style={{ cursor: 'pointer' }}>
                          <option value="">— none —</option>
                          {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
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
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.45)' }}
                    onClick={() => setEditingItem(null)}
                  >
                    <div
                      className="card"
                      style={{ width: '100%', maxWidth: 520, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h4 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Edit — {editingItem.name}</h4>
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
                          <label className="label">Category</label>
                          <select className="input" value={editingItem.category ?? ''} onChange={e => setEditingItem({ ...editingItem, category: (e.target.value as FoodCategory) || null })} style={{ cursor: 'pointer' }}>
                            <option value="">— none —</option>
                            {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
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
                  </div>
                )}

                {filteredMenuItems.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <Package className="empty-state-icon" />
                    <h3>{menuItems.length === 0 ? 'No menu items yet' : 'No items match your filters'}</h3>
                  </div>
                ) : menuView === 'list' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {filteredMenuItems.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', transition: 'background var(--transition)', background: selectedItemIds.has(item.id) ? 'var(--primary-subtle)' : editingItem?.id === item.id ? 'var(--primary-subtle)' : 'transparent' }} onMouseEnter={e => { if (!selectedItemIds.has(item.id) && editingItem?.id !== item.id) e.currentTarget.style.background = 'var(--gray-50)'; }} onMouseLeave={e => { if (!selectedItemIds.has(item.id) && editingItem?.id !== item.id) e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ overflow: 'hidden', maxWidth: selectMode ? 23 : 0, opacity: selectMode ? 1 : 0, transition: 'max-width 0.22s ease, opacity 0.18s ease', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedItemIds.has(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--primary)' }}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                        {item.image ? <img src={item.image} alt={item.name} style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--gray-100)', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</p>
                          <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                            {item.vendor.name} · {item.onlineStock} in stock
                            {item.category ? ` · ${CATEGORY_META[item.category]?.label ?? item.category}` : ''}
                          </p>
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
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                    {filteredMenuItems.map(item => (
                      <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: item.status === 'AVAILABLE' ? 1 : 0.65, outline: selectedItemIds.has(item.id) ? '2px solid var(--primary)' : 'none', outlineOffset: 1 }}>
                        <div style={{ position: 'relative' }}>
                          {item.image
                            ? <img src={item.image} alt={item.name} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', height: 120, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={28} color="var(--gray-300)" /></div>
                          }
                          <div style={{ position: 'absolute', top: 8, left: 8, opacity: selectMode ? 1 : 0, transform: selectMode ? 'scale(1)' : 'scale(0.5)', transition: 'opacity 0.2s ease, transform 0.2s ease', pointerEvents: selectMode ? 'auto' : 'none' }}>
                            <input
                              type="checkbox"
                              checked={selectedItemIds.has(item.id)}
                              onChange={() => toggleSelectItem(item.id)}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }}
                            />
                          </div>
                        </div>
                        <div style={{ padding: '10px 12px 12px' }}>
                          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.vendor.name}{item.category ? ` · ${CATEGORY_META[item.category]?.label ?? item.category}` : ''}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>₦{Number(item.price).toLocaleString()}</span>
                            <span className={`badge ${item.status === 'AVAILABLE' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>{item.status === 'AVAILABLE' ? 'Live' : 'Off'}</span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 10 }}>{item.onlineStock} in stock</p>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-icon-sm" onClick={() => toggleItem(item)} title="Toggle availability">
                              {item.status === 'AVAILABLE' ? <ToggleRight size={18} color="var(--primary)" /> : <ToggleLeft size={18} color="var(--gray-400)" />}
                            </button>
                            <button className="btn btn-ghost btn-icon-sm" title="Edit item" onClick={() => setEditingItem(item)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button className="btn btn-ghost btn-icon-sm" title="Delete item" style={{ color: 'var(--error)' }} onClick={() => handleDeleteItem(item.id, item.name)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
        </main>
      </div>
    </div>
  );
}
