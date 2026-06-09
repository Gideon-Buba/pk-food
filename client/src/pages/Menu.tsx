import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { ShoppingCart, LogOut, Settings, Bike, Search, Plus, Minus, X, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, clearToken, getToken } from '../api/client';
import { useCartStore } from '../store/cart';
import type { ApiResponse, Announcement, JwtPayload, MenuItem } from '../types';

export default function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeVendor, setActiveVendor] = useState<string>('all');
  const navigate = useNavigate();
  const { items: cartItems, addItem, updateQuantity, itemCount } = useCartStore();

  const token = getToken();
  const userRole = token ? jwtDecode<JwtPayload>(token).role : 'STAFF';
  const userEmail = token ? jwtDecode<JwtPayload>(token).email : '';

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<MenuItem[]>>('/menu/items'),
      api.get<ApiResponse<Announcement[]>>('/menu/announcements'),
    ])
      .then(([ir, ar]) => {
        setItems(ir.data.data);
        setAnnouncements(ar.data.data);
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  const vendors = ['all', ...Array.from(new Set(items.map(i => i.vendor.name)))];

  const filtered = items.filter(item => {
    const matchVendor = activeVendor === 'all' || item.vendor.name === activeVendor;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchVendor && matchSearch;
  });

  const getCartItem = (id: string) => cartItems.find(i => i.menuItem.id === id);

  const handleAdd = (item: MenuItem) => {
    addItem(item);
    toast.success(`${item.name} added to cart`, { id: item.id });
  };

  const count = itemCount();

  // suppress unused variable warning for userEmail
  void userEmail;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Header */}
      <header className="nav-header">
        <div className="nav-inner">
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary)', letterSpacing: '-0.03em', flexShrink: 0 }}>
            PK Food
          </span>

          {/* Search */}
          <div className="search-wrap" style={{ flex: 1 }}>
            <Search size={15} className="search-icon" />
            <input
              className="input"
              style={{ paddingLeft: 36, fontSize: 13 }}
              placeholder="Search menu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {userRole === 'STAFF' && (
              <button className="btn btn-ghost btn-icon" onClick={() => navigate('/orders')} title="My orders">
                <ClipboardList size={18} />
              </button>
            )}
            {userRole === 'ADMIN' && (
              <>
                <button className="btn btn-ghost btn-icon" onClick={() => navigate('/admin')} title="Admin dashboard">
                  <Settings size={18} />
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => navigate('/runner')} title="Delivery queue">
                  <Bike size={18} />
                </button>
              </>
            )}
            {userRole === 'RUNNER' && (
              <button className="btn btn-ghost btn-icon" onClick={() => navigate('/runner')} title="Delivery queue">
                <Bike size={18} />
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/cart')}
              style={{ position: 'relative', paddingRight: count > 0 ? 14 : undefined }}
            >
              <ShoppingCart size={15} />
              Cart
              {count > 0 && (
                <span className="cart-badge">{count > 9 ? '9+' : count}</span>
              )}
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => { clearToken(); navigate('/login'); }} title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="page-wrap">
        {/* Announcements */}
        {announcements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {announcements.map(a => (
              <div key={a.id} className={`announcement announcement-${a.type.toLowerCase()}`}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                {a.message}
              </div>
            ))}
          </div>
        )}

        {/* Vendor filter */}
        <div className="vendor-tabs" style={{ marginBottom: 20 }}>
          {vendors.map(v => (
            <button
              key={v}
              className={`vendor-tab ${activeVendor === v ? 'active' : ''}`}
              onClick={() => setActiveVendor(v)}
            >
              {v === 'all' ? 'All items' : v}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="food-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card" style={{ overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 160 }} />
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 12, width: '60%' }} />
                  <div className="skeleton" style={{ height: 16, width: '80%' }} />
                  <div className="skeleton" style={{ height: 32, marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Search className="empty-state-icon" />
            <h3>No items found</h3>
            <p>{search ? `No results for "${search}"` : 'No items available right now'}</p>
            {search && <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear search</button>}
          </div>
        ) : (
          <div className="food-grid">
            {filtered.map((item, i) => {
              const cartItem = getCartItem(item.id);
              const available = item.status === 'AVAILABLE';
              return (
                <div key={item.id} className="card card-hover fade-up" style={{ overflow: 'hidden', animationDelay: `${i * 30}ms` }}>
                  <div style={{ position: 'relative', aspectRatio: '16/10', background: 'var(--gray-100)' }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingCart size={32} color="var(--gray-300)" />
                      </div>
                    )}
                    {!available && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span className="badge badge-gray" style={{ fontSize: 12 }}>
                          {item.status === 'OUT_OF_STOCK' ? 'Sold out' : 'Unavailable'}
                        </span>
                      </div>
                    )}
                    {cartItem && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'var(--primary)', color: '#fff',
                        borderRadius: 'var(--radius-full)', padding: '2px 9px',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {cartItem.quantity} in cart
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '12px 14px 14px' }}>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 500, marginBottom: 3 }}>
                      {item.vendor.name}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10, lineHeight: 1.3 }}>
                      {item.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                        ₦{Number(item.price).toLocaleString()}
                      </span>
                      {cartItem ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            className="qty-btn"
                            onClick={() => updateQuantity(item.id, cartItem.quantity - 1)}
                            style={{ width: 26, height: 26 }}
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                            {cartItem.quantity}
                          </span>
                          <button
                            className="qty-btn"
                            onClick={() => updateQuantity(item.id, cartItem.quantity + 1)}
                            style={{ width: 26, height: 26 }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!available}
                          onClick={() => handleAdd(item)}
                          style={{ padding: '6px 12px' }}
                        >
                          <Plus size={13} />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
