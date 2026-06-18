import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, RefreshCw, ToggleLeft, ToggleRight, Package, ShoppingBag, Store, Megaphone, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ApiResponse, MenuItem, Order, OrderStatus, Vendor } from '../types';

type Tab = 'orders' | 'menu' | 'vendors' | 'announcements';

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
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', vendorId: '', totalStock: '50', onlineStock: '50', image: '' });
  const [addingItem, setAddingItem] = useState(false);
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

  const pending = orders.filter(o => o.status === 'PENDING').length;
  const revenue = orders.filter(o => o.paid).reduce((s, o) => s + Number(o.deliveryFee) + o.items.reduce((is, i) => is + Number(i.unitPrice) * i.quantity, 0), 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'orders', label: 'Orders', icon: <ShoppingBag size={15} /> },
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total orders', value: orders.length, color: 'var(--info)' },
            { label: 'Pending', value: pending, color: 'var(--warning)' },
            { label: 'Revenue', value: `₦${revenue.toLocaleString()}`, color: 'var(--primary)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</p>
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
                        <label className="label">Image URL</label>
                        <input className="input" placeholder="https://…" value={newItem.image} onChange={e => setNewItem({ ...newItem, image: e.target.value })} />
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {menuItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', transition: 'background var(--transition)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
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
                    Add
                  </button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vendors.map(v => (
                    <div key={v.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Store size={16} color="var(--primary)" />
                      </div>
                      <span style={{ fontWeight: 600 }}>{v.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 'auto' }}>
                        {menuItems.filter(m => m.vendorId === v.id).length} items
                      </span>
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
