import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Plus, RefreshCw, ToggleLeft, ToggleRight, Package, ShoppingBag, Store, Megaphone, Trash2, TrendingUp, ImagePlus, X, LayoutGrid, LayoutList, Search, Truck, LogOut, ChevronDown, ListPlus, Clock, Settings } from 'lucide-react';
import QueuePanel from '../components/QueuePanel';
import OrderDetailPanel from '../components/OrderDetailPanel';
import RevenuePanel from '../components/RevenuePanel';
import { FLOORS } from '../constants/floors';
import toast from 'react-hot-toast';
import { api, clearToken } from '../api/client';
import type { ApiResponse, AppSettings, FoodCategory, MenuItem, Order, OrderStatus, Side, User, Vendor } from '../types';
import { CATEGORY_META, CATEGORY_ORDER } from '../constants/categories';
import { applyDiscount } from '../lib/utils';

// Shows what customers will actually pay under the discount field.
function DiscountHint({ price, discountPercent }: { price: number; discountPercent: number }) {
  if (discountPercent <= 0 || price <= 0) {
    return <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>0 = no discount</p>;
  }
  return (
    <p style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontWeight: 600 }}>
      Customers pay ₦{applyDiscount(price, discountPercent).toLocaleString()} instead of ₦{price.toLocaleString()}
    </p>
  );
}

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

type Tab = 'orders' | 'menu' | 'vendors' | 'sides' | 'announcements' | 'revenue' | 'queue' | 'settings';

interface Announcement {
  id: string;
  type: 'STATUS' | 'GENERAL';
  message: string;
  active: boolean;
  createdAt: string;
}

type OrderPaymentFilter = '' | 'paid' | 'unpaid';
type OrderSort = 'newest' | 'oldest' | 'total-desc' | 'total-asc';

// Order dates are compared as Lagos calendar days ("YYYY-MM-DD"), matching the date inputs.
function lagosDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
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

const VALID_TABS: Tab[] = ['orders', 'revenue', 'menu', 'vendors', 'sides', 'announcements', 'queue', 'settings'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return VALID_TABS.includes(t as Tab) ? (t as Tab) : 'orders';
  });

  useEffect(() => {
    const t = searchParams.get('tab');
    if (VALID_TABS.includes(t as Tab)) setTab(t as Tab);
  }, [searchParams]);
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
  const [newItem, setNewItem] = useState({ name: '', price: '', vendorId: '', totalStock: '50', onlineStock: '50', image: '', category: '' as FoodCategory | '', requiresPackaging: false, discountPercent: '0' });
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemSideIds, setItemSideIds] = useState<Set<string>>(new Set());
  const [sides, setSides] = useState<Side[]>([]);
  const [newSide, setNewSide] = useState({ name: '', price: '', vendorId: '' });
  const [addingSide, setAddingSide] = useState(false);
  const [editingSideId, setEditingSideId] = useState<string | null>(null);
  const [editingSideDraft, setEditingSideDraft] = useState({ name: '', price: '', vendorId: '' });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ type: 'GENERAL' as 'STATUS' | 'GENERAL', message: '' });
  const [addingAnnouncement, setAddingAnnouncement] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [packagingFeeInput, setPackagingFeeInput] = useState('');
  const [savingPackagingFee, setSavingPackagingFee] = useState(false);
  const [openTimeInput, setOpenTimeInput] = useState('');
  const [closeTimeInput, setCloseTimeInput] = useState('');
  const [savingHours, setSavingHours] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

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
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<OrderPaymentFilter>('');
  const [orderFloorFilter, setOrderFloorFilter] = useState('');
  const [orderVendorFilter, setOrderVendorFilter] = useState('');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [orderSort, setOrderSort] = useState<OrderSort>('newest');
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(20);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Back to page 1 whenever the result set changes shape.
  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderStatusFilter, orderPaymentFilter, orderFloorFilter, orderVendorFilter, orderDateFrom, orderDateTo, orderSort, orderPageSize]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<ApiResponse<Order[]>>('/orders'),
      api.get<ApiResponse<MenuItem[]>>('/menu/items?all=true'),
      api.get<ApiResponse<Vendor[]>>('/menu/vendors'),
      api.get<ApiResponse<Announcement[]>>('/menu/announcements/all'),
      api.get<ApiResponse<AppSettings>>('/settings'),
      api.get<ApiResponse<Side[]>>('/menu/sides?all=true'),
    ])
      .then(([o, m, v, a, s, sd]) => {
        setOrders(o.data.data);
        setMenuItems(m.data.data);
        setVendors(v.data.data);
        setAnnouncements(a.data.data);
        setSettings(s.data.data);
        setPackagingFeeInput(String(s.data.data.packagingFee));
        setOpenTimeInput(s.data.data.openTime);
        setCloseTimeInput(s.data.data.closeTime);
        setSides(sd.data.data);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get<ApiResponse<User>>('/auth/me').then(({ data }) => setMe(data.data)).catch(() => undefined);
  }, []);

  const handleLogout = () => { clearToken(); navigate('/login'); };

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

  const handleCreateSide = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSide(true);
    try {
      const res = await api.post<ApiResponse<Side>>('/menu/sides', {
        name: newSide.name,
        price: newSide.price ? Number(newSide.price) : 0,
        vendorId: newSide.vendorId,
      });
      setSides(s => [...s, res.data.data]);
      setNewSide({ name: '', price: '', vendorId: '' });
      toast.success('Side created');
    } catch { toast.error('Failed to create side'); }
    finally { setAddingSide(false); }
  };

  const handleUpdateSide = async (id: string) => {
    if (!editingSideDraft.name.trim()) return;
    try {
      const res = await api.patch<ApiResponse<Side>>(`/menu/sides/${id}`, {
        name: editingSideDraft.name,
        price: Number(editingSideDraft.price),
        vendorId: editingSideDraft.vendorId,
      });
      setSides(prev => prev.map(s => s.id === id ? res.data.data : s));
      setEditingSideId(null);
      toast.success('Side updated');
    } catch { toast.error('Failed to update side'); }
  };

  const handleToggleSideStatus = async (side: Side) => {
    const status = side.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    try {
      const res = await api.patch<ApiResponse<Side>>(`/menu/sides/${side.id}`, { status });
      setSides(prev => prev.map(s => s.id === side.id ? res.data.data : s));
    } catch { toast.error('Failed to update side'); }
  };

  const handleDeleteSide = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/menu/sides/${id}`);
      setSides(prev => prev.filter(s => s.id !== id));
      toast.success('Side deleted');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to delete side');
    }
  };

  const openEditItem = async (item: MenuItem) => {
    setEditingItem(item);
    try {
      const res = await api.get<ApiResponse<Side[]>>(`/menu/items/${item.id}/sides`);
      setItemSideIds(new Set(res.data.data.map(s => s.id)));
    } catch {
      setItemSideIds(new Set());
    }
  };

  const toggleItemSide = (id: string) => {
    setItemSideIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
        requiresPackaging: editingItem.requiresPackaging,
        discountPercent: editingItem.discountPercent ?? 0,
      });
      await api.patch(`/menu/items/${editingItem.id}/sides`, { sideIds: [...itemSideIds] });
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
        requiresPackaging: newItem.requiresPackaging,
        discountPercent: parseInt(newItem.discountPercent, 10) || 0,
      });
      setNewItem({ name: '', price: '', vendorId: '', totalStock: '50', onlineStock: '50', image: '', category: '', requiresPackaging: false, discountPercent: '0' });
      setShowAddItem(false);
      load();
      toast.success('Menu item added');
    } catch { toast.error('Failed to add item'); }
    finally { setAddingItem(false); }
  };

  const handleSavePackagingFee = async () => {
    const fee = parseInt(packagingFeeInput, 10);
    if (isNaN(fee) || fee < 0) { toast.error('Enter a valid packaging fee'); return; }
    setSavingPackagingFee(true);
    try {
      const res = await api.patch<ApiResponse<AppSettings>>('/settings', { packagingFee: fee });
      setSettings(res.data.data);
      setPackagingFeeInput(String(res.data.data.packagingFee));
      toast.success('Packaging fee updated — past orders keep their original charge');
    } catch { toast.error('Failed to update packaging fee'); }
    finally { setSavingPackagingFee(false); }
  };

  const handleSaveHours = async () => {
    setSavingHours(true);
    try {
      const res = await api.patch<ApiResponse<AppSettings>>('/settings', {
        openTime: openTimeInput,
        closeTime: closeTimeInput,
      });
      setSettings(res.data.data);
      setOpenTimeInput(res.data.data.openTime);
      setCloseTimeInput(res.data.data.closeTime);
      toast.success('Opening hours updated');
    } catch { toast.error('Failed to update opening hours'); }
    finally { setSavingHours(false); }
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

  const orderTotal = (o: Order) => Number(o.deliveryFee) + Number(o.packagingFee ?? 0) + o.items.reduce((s, i) => s + (Number(i.unitPrice) + i.sides.reduce((ss, sd) => ss + Number(sd.price), 0)) * i.quantity, 0);

  const filteredMenuItems = menuItems.filter(item => {
    if (menuSearch && !item.name.toLowerCase().includes(menuSearch.toLowerCase())) return false;
    if (menuCategoryFilter && item.category !== menuCategoryFilter) return false;
    if (menuVendorFilter && item.vendorId !== menuVendorFilter) return false;
    return true;
  });

  const filteredOrders = orders.filter(order => {
    if (orderSearch) {
      const q = orderSearch.toLowerCase().trim();
      const haystack = [
        order.user.name, order.user.email, order.user.phone, order.phone,
        order.reference, order.id, order.officeNumber, order.paymentRef,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (orderStatusFilter && order.status !== orderStatusFilter) return false;
    if (orderPaymentFilter === 'paid' && !order.paid) return false;
    if (orderPaymentFilter === 'unpaid' && order.paid) return false;
    if (orderFloorFilter && order.floor !== orderFloorFilter) return false;
    if (orderVendorFilter && !order.items.some(i => i.menuItem.vendorId === orderVendorFilter)) return false;
    if (orderDateFrom && lagosDay(order.createdAt) < orderDateFrom) return false;
    if (orderDateTo && lagosDay(order.createdAt) > orderDateTo) return false;
    return true;
  }).sort((a, b) => {
    switch (orderSort) {
      case 'oldest':     return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'total-desc': return orderTotal(b) - orderTotal(a);
      case 'total-asc':  return orderTotal(a) - orderTotal(b);
      default:           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const orderFiltersActive = Boolean(
    orderSearch || orderStatusFilter || orderPaymentFilter ||
    orderFloorFilter || orderVendorFilter || orderDateFrom || orderDateTo,
  );
  const clearOrderFilters = () => {
    setOrderSearch(''); setOrderStatusFilter(''); setOrderPaymentFilter('');
    setOrderFloorFilter(''); setOrderVendorFilter(''); setOrderDateFrom(''); setOrderDateTo('');
  };
  const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const currentOrderPage = Math.min(orderPage, orderPageCount);
  const pagedOrders = filteredOrders.slice((currentOrderPage - 1) * orderPageSize, currentOrderPage * orderPageSize);
  const closeOrderDetail = useCallback(() => setSelectedOrderId(null), []);
  const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) ?? null : null;

  const NAV_ITEMS: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'orders',        label: 'Orders',    Icon: ShoppingBag },
    { id: 'queue',         label: 'Queue',     Icon: Truck       },
    { id: 'revenue',       label: 'Revenue',   Icon: TrendingUp  },
    { id: 'menu',          label: 'Menu',      Icon: Package     },
    { id: 'vendors',       label: 'Vendors',   Icon: Store       },
    { id: 'sides',         label: 'Sides',     Icon: ListPlus    },
    { id: 'announcements', label: 'Notices',   Icon: Megaphone   },
    { id: 'settings',      label: 'Settings',  Icon: Settings    },
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
          <button className="btn btn-ghost btn-icon-sm admin-hamburger" onClick={() => setSidebarOpen(v => !v)}>
            <Menu size={20} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Admin panel</span>

          {/* Account menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setAccountMenuOpen(v => !v)}
              style={{ gap: 6, fontSize: 13 }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%', background: 'var(--primary-subtle)',
                color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11, flexShrink: 0,
              }}>
                {(me?.name || me?.email || 'A').charAt(0).toUpperCase()}
              </span>
              <span className="admin-account-label" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {me?.name || me?.email?.split('@')[0] || 'Admin'}
              </span>
              <ChevronDown size={14} style={{ transform: accountMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {accountMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setAccountMenuOpen(false)} />
                <div
                  className="card"
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100,
                    width: 220, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--gray-100)', marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.name || 'Admin'}</p>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                      background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      color: 'var(--error)', textAlign: 'left',
                    }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div style={{ display: 'flex' }}>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="admin-backdrop"
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`admin-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}
          style={{
            position: 'fixed', top: 60, bottom: 0, left: 0, zIndex: 50,
            width: 220, flexShrink: 0, overflowY: 'auto',
            background: 'var(--primary-darker)',
          }}
        >
          <SidebarContent />
        </aside>

        {/* Desktop spacer so content doesn't hide behind sidebar */}
        <div className="admin-spacer" />

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, padding: '24px', overflowX: 'hidden' }}>

          {/* Section heading */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-800)' }}>
              {NAV_ITEMS.find(n => n.id === tab)?.label}
            </h2>
          </div>

          {/* Queue tab — full-width, no card wrapper */}
          {tab === 'queue' && <QueuePanel />}

          {/* All other tabs inside the card */}
          {tab !== 'queue' && <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 20 }}>
            {/* Orders tab */}
            {tab === 'orders' && (
              <div>
                {/* Store hours */}
                <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <Clock size={16} color="var(--gray-500)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Ordering hours</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="input"
                      type="time"
                      value={openTimeInput}
                      onChange={e => setOpenTimeInput(e.target.value)}
                      style={{ width: 110 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>to</span>
                    <input
                      className="input"
                      type="time"
                      value={closeTimeInput}
                      onChange={e => setCloseTimeInput(e.target.value)}
                      style={{ width: 110 }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={savingHours || (openTimeInput === settings?.openTime && closeTimeInput === settings?.closeTime)}
                    onClick={handleSaveHours}
                  >
                    {savingHours ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Save'}
                  </button>
                  {settings && (
                    <span
                      className={`badge ${settings.isOpen ? 'badge-green' : 'badge-red'}`}
                      style={{ fontSize: 11, marginLeft: 'auto' }}
                    >
                      {settings.isOpen ? 'Open now' : 'Closed now'}
                    </span>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--gray-400)', width: '100%', margin: 0 }}>
                    Staff can't place new orders outside these hours (Africa/Lagos time). Orders already placed are unaffected.
                  </p>
                </div>

                {/* Orders toolbar */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                    <input
                      className="input"
                      placeholder="Search name, email, phone, reference, office…"
                      value={orderSearch}
                      onChange={e => setOrderSearch(e.target.value)}
                      style={{ paddingLeft: 32 }}
                    />
                  </div>
                  <select className="input" value={orderSort} onChange={e => setOrderSort(e.target.value as OrderSort)} style={{ width: 160, cursor: 'pointer', flexShrink: 0 }}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="total-desc">Highest total</option>
                    <option value="total-asc">Lowest total</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                  <select className="input" value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value as OrderStatus | '')} style={{ width: 140, cursor: 'pointer' }}>
                    <option value="">All statuses</option>
                    {(['PENDING','CONFIRMED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED'] as OrderStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select className="input" value={orderPaymentFilter} onChange={e => setOrderPaymentFilter(e.target.value as OrderPaymentFilter)} style={{ width: 170, cursor: 'pointer' }}>
                    <option value="">Any payment status</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                  <select className="input" value={orderFloorFilter} onChange={e => setOrderFloorFilter(e.target.value)} style={{ width: 140, cursor: 'pointer' }}>
                    <option value="">All floors</option>
                    {FLOORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="input" value={orderVendorFilter} onChange={e => setOrderVendorFilter(e.target.value)} style={{ width: 150, cursor: 'pointer' }}>
                    <option value="">All vendors</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="input" type="date" value={orderDateFrom} max={orderDateTo || undefined} onChange={e => setOrderDateFrom(e.target.value)} style={{ width: 145 }} aria-label="From date" />
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>to</span>
                    <input className="input" type="date" value={orderDateTo} min={orderDateFrom || undefined} onChange={e => setOrderDateTo(e.target.value)} style={{ width: 145 }} aria-label="To date" />
                  </div>
                  {orderFiltersActive && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearOrderFilters}>
                      <X size={13} /> Clear filters
                    </button>
                  )}
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
                        {pagedOrders.map(order => {
                          const total = orderTotal(order);
                          return (
                            <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} style={{ cursor: 'pointer' }} title="View order details">
                              <td style={{ fontWeight: 500 }}>
                                {order.user.name || order.user.email.split('@')[0]}
                                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>
                                  {new Date(order.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {order.reference && (
                                  <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace', fontWeight: 400 }}>{order.reference}</div>
                                )}
                              </td>
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
                                {order.paid ? (
                                  <span className="badge badge-green">Paid</span>
                                ) : (
                                  <span className="badge badge-gray">Unpaid</span>
                                )}
                              </td>
                              <td onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
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

                {filteredOrders.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14, fontSize: 13, color: 'var(--gray-500)' }}>
                    <span>
                      Showing {(currentOrderPage - 1) * orderPageSize + 1}–{Math.min(currentOrderPage * orderPageSize, filteredOrders.length)} of {filteredOrders.length}
                      {filteredOrders.length !== orders.length && ` (filtered from ${orders.length})`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select className="input" value={orderPageSize} onChange={e => setOrderPageSize(Number(e.target.value))} style={{ width: 110, cursor: 'pointer' }} aria-label="Orders per page">
                        {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
                      </select>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={currentOrderPage <= 1} onClick={() => setOrderPage(currentOrderPage - 1)}>Previous</button>
                      <span style={{ whiteSpace: 'nowrap' }}>Page {currentOrderPage} of {orderPageCount}</span>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={currentOrderPage >= orderPageCount} onClick={() => setOrderPage(currentOrderPage + 1)}>Next</button>
                    </div>
                  </div>
                )}

                {selectedOrder && (
                  <OrderDetailPanel
                    order={selectedOrder}
                    allOrders={orders}
                    nextStatuses={NEXT_STATUSES[selectedOrder.status]}
                    statusBadgeClass={statusBadgeClass}
                    onClose={closeOrderDetail}
                    onUpdateStatus={updateStatus}
                  />
                )}
              </div>
            )}

            {/* Revenue tab */}
            {tab === 'revenue' && <RevenuePanel orders={orders} menuItems={menuItems} vendors={vendors} />}

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
                        <label className="label">Discount (%)</label>
                        <input className="input" type="number" min={0} max={90} value={newItem.discountPercent} onChange={e => setNewItem({ ...newItem, discountPercent: e.target.value })} />
                        <DiscountHint price={parseFloat(newItem.price) || 0} discountPercent={parseInt(newItem.discountPercent, 10) || 0} />
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
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <button
                          type="button"
                          onClick={() => setNewItem({ ...newItem, requiresPackaging: !newItem.requiresPackaging })}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}
                        >
                          {newItem.requiresPackaging ? <ToggleRight size={20} color="var(--primary)" /> : <ToggleLeft size={20} color="var(--gray-400)" />}
                          Requires takeaway pack
                        </button>
                        <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                          Charges a per-pack packaging fee at checkout — tracked separately from food revenue.
                        </p>
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
                          <label className="label">Discount (%)</label>
                          <input className="input" type="number" min={0} max={90} value={editingItem.discountPercent ?? 0} onChange={e => setEditingItem({ ...editingItem, discountPercent: Math.min(90, Math.max(0, parseInt(e.target.value, 10) || 0)) })} />
                          <DiscountHint price={Number(editingItem.price)} discountPercent={editingItem.discountPercent ?? 0} />
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
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <button
                            type="button"
                            onClick={() => setEditingItem({ ...editingItem, requiresPackaging: !editingItem.requiresPackaging })}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}
                          >
                            {editingItem.requiresPackaging ? <ToggleRight size={20} color="var(--primary)" /> : <ToggleLeft size={20} color="var(--gray-400)" />}
                            Requires takeaway pack
                          </button>
                          <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                            Charges a per-pack packaging fee at checkout — tracked separately from food revenue.
                          </p>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label className="label">Sides offered</label>
                          {sides.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>No sides yet — add some in the Sides tab.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 8 }}>
                              {sides.map(side => (
                                <label key={side.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={itemSideIds.has(side.id)}
                                    onChange={() => toggleItemSide(side.id)}
                                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--primary)' }}
                                  />
                                  {side.name} {side.price > 0 ? `(+₦${side.price.toLocaleString()})` : ''}
                                  {side.status !== 'AVAILABLE' && <span style={{ color: 'var(--gray-400)' }}> — off</span>}
                                </label>
                              ))}
                            </div>
                          )}
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
                    {filteredMenuItems.map(item => {
                      const isSelected = selectedItemIds.has(item.id);
                      const isEditing  = editingItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-md)', transition: 'background var(--transition)', background: isSelected || isEditing ? 'var(--primary-subtle)' : 'transparent' }}
                          onMouseEnter={e => { if (!isSelected && !isEditing) e.currentTarget.style.background = 'var(--gray-50)'; }}
                          onMouseLeave={e => { if (!isSelected && !isEditing) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* Checkbox — slides in when selectMode is on */}
                          <div style={{ overflow: 'hidden', maxWidth: selectMode ? 23 : 0, opacity: selectMode ? 1 : 0, transition: 'max-width 0.22s ease, opacity 0.18s ease', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelectItem(item.id)} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--primary)' }} onClick={e => e.stopPropagation()} />
                          </div>

                          {/* Thumbnail */}
                          {item.image
                            ? <img src={item.image} alt={item.name} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--gray-100)', flexShrink: 0 }} />
                          }

                          {/* Name + meta — takes all remaining space */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                              <span className={`badge ${item.status === 'AVAILABLE' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10, flexShrink: 0 }}>{item.status === 'AVAILABLE' ? 'Live' : 'Off'}</span>
                              {(item.discountPercent ?? 0) > 0 && (
                                <span className="badge badge-red" style={{ fontSize: 10, flexShrink: 0 }} title="Discounted">-{item.discountPercent}%</span>
                              )}
                              {item.requiresPackaging && (
                                <span className="badge" style={{ fontSize: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--gray-600)', background: 'var(--gray-100)' }} title="Requires a takeaway pack">
                                  <Package size={10} /> Pack
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 1 }}>
                              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₦{Number(item.price).toLocaleString()}</span>
                              {' · '}{item.vendor.name}{' · '}{item.onlineStock} in stock
                              {item.category ? ` · ${CATEGORY_META[item.category]?.label ?? item.category}` : ''}
                            </p>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                            <button className="btn btn-ghost btn-icon-sm" onClick={() => toggleItem(item)} title="Toggle availability">
                              {item.status === 'AVAILABLE' ? <ToggleRight size={20} color="var(--primary)" /> : <ToggleLeft size={20} color="var(--gray-400)" />}
                            </button>
                            <button className="btn btn-ghost btn-icon-sm" title="Edit" onClick={() => openEditItem(item)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button className="btn btn-ghost btn-icon-sm" title="Delete" style={{ color: 'var(--error)' }} onClick={() => handleDeleteItem(item.id, item.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 }}>
                            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>₦{Number(item.price).toLocaleString()}</span>
                            <span style={{ display: 'flex', gap: 4 }}>
                              {(item.discountPercent ?? 0) > 0 && (
                                <span className="badge badge-red" style={{ fontSize: 10, flexShrink: 0 }} title="Discounted">-{item.discountPercent}%</span>
                              )}
                              {item.requiresPackaging && (
                                <span className="badge" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--gray-600)', background: 'var(--gray-100)' }} title="Requires a takeaway pack">
                                  <Package size={10} /> Pack
                                </span>
                              )}
                              <span className={`badge ${item.status === 'AVAILABLE' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>{item.status === 'AVAILABLE' ? 'Live' : 'Off'}</span>
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 10 }}>{item.onlineStock} in stock</p>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-icon-sm" onClick={() => toggleItem(item)} title="Toggle availability">
                              {item.status === 'AVAILABLE' ? <ToggleRight size={18} color="var(--primary)" /> : <ToggleLeft size={18} color="var(--gray-400)" />}
                            </button>
                            <button className="btn btn-ghost btn-icon-sm" title="Edit item" onClick={() => openEditItem(item)}>
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

            {tab === 'settings' && (
              <div>
                {/* Packaging fee setting */}
                <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <Package size={16} color="var(--gray-500)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Takeaway pack fee</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>₦</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={packagingFeeInput}
                      onChange={e => setPackagingFeeInput(e.target.value)}
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>per pack</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={savingPackagingFee || packagingFeeInput === String(settings?.packagingFee ?? '')}
                    onClick={handleSavePackagingFee}
                  >
                    {savingPackagingFee ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Save'}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--gray-400)', width: '100%', margin: 0 }}>
                    Charged once per pack on items marked "Requires takeaway pack" below. Changing this only affects orders placed after the change — past orders keep the fee they were charged at the time.
                  </p>
                </div>
              </div>
            )}

            {tab === 'sides' && (
              <div>
                <form onSubmit={handleCreateSide} style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  <input className="input" placeholder="Side name (e.g. Plantain)" value={newSide.name} onChange={e => setNewSide({ ...newSide, name: e.target.value })} required style={{ flex: 2, minWidth: 160 }} />
                  <input className="input" type="number" placeholder="Price (₦)" value={newSide.price} onChange={e => setNewSide({ ...newSide, price: e.target.value })} style={{ flex: 1, minWidth: 100 }} />
                  <select className="input" value={newSide.vendorId} onChange={e => setNewSide({ ...newSide, vendorId: e.target.value })} required style={{ flex: 1, minWidth: 140, cursor: 'pointer' }}>
                    <option value="" disabled>Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={addingSide}>
                    {addingSide ? <span className="spinner" /> : <Plus size={15} />}
                    Add side
                  </button>
                </form>
                {sides.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <ListPlus className="empty-state-icon" />
                    <h3>No sides yet</h3>
                    <p>Add a side above, then attach it to menu items from the Menu tab.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sides.map(side => (
                      <div key={side.id} className="card" style={{ padding: '14px 16px' }}>
                        {editingSideId === side.id ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input className="input" value={editingSideDraft.name} onChange={e => setEditingSideDraft({ ...editingSideDraft, name: e.target.value })} autoFocus style={{ flex: 2, minWidth: 140 }} />
                            <input className="input" type="number" value={editingSideDraft.price} onChange={e => setEditingSideDraft({ ...editingSideDraft, price: e.target.value })} style={{ flex: 1, minWidth: 90 }} />
                            <select className="input" value={editingSideDraft.vendorId} onChange={e => setEditingSideDraft({ ...editingSideDraft, vendorId: e.target.value })} style={{ flex: 1, minWidth: 120, cursor: 'pointer' }}>
                              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                            <button className="btn btn-primary btn-sm" onClick={() => handleUpdateSide(side.id)}>Save</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingSideId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <ListPlus size={16} color="var(--primary)" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {side.name}
                                <span className={`badge ${side.status === 'AVAILABLE' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>{side.status === 'AVAILABLE' ? 'Live' : 'Off'}</span>
                              </p>
                              <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                                {side.price > 0 ? `+₦${side.price.toLocaleString()}` : 'Free'} · {vendors.find(v => v.id === side.vendorId)?.name ?? '—'}
                              </p>
                            </div>
                            <button className="btn btn-ghost btn-icon-sm" onClick={() => handleToggleSideStatus(side)} title="Toggle availability">
                              {side.status === 'AVAILABLE' ? <ToggleRight size={20} color="var(--primary)" /> : <ToggleLeft size={20} color="var(--gray-400)" />}
                            </button>
                            <button
                              className="btn btn-ghost btn-icon-sm"
                              title="Edit"
                              onClick={() => { setEditingSideId(side.id); setEditingSideDraft({ name: side.name, price: String(side.price), vendorId: side.vendorId }); }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              className="btn btn-ghost btn-icon-sm"
                              title="Delete side"
                              style={{ color: 'var(--error)' }}
                              onClick={() => handleDeleteSide(side.id, side.name)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>}

        </main>
      </div>
    </div>
  );
}
