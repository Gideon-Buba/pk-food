import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { ShoppingCart, LogOut, Settings, Bike, Search, Plus, Minus, X, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
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

  const notices = announcements.filter(a => a.type === 'GENERAL');
  const statuses = announcements.filter(a => a.type === 'STATUS');
  const [noticeIdx, setNoticeIdx] = useState(0);
  const [dismissedStatuses, setDismissedStatuses] = useState<Set<string>>(new Set());
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (notices.length < 2) return;
    carouselTimer.current = setInterval(() => {
      setNoticeIdx(i => (i + 1) % notices.length);
    }, 4500);
    return () => { if (carouselTimer.current) clearInterval(carouselTimer.current); };
  }, [notices.length]);

  const prevNotice = () => {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    setNoticeIdx(i => (i - 1 + notices.length) % notices.length);
  };
  const nextNotice = () => {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    setNoticeIdx(i => (i + 1) % notices.length);
  };

  const visibleStatuses = statuses.filter(s => !dismissedStatuses.has(s.id));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          {/* Brand */}
          <div className="nav-brand">
            <img
              src="/logo.jpeg"
              alt="PK"
              style={{ height: 38, width: 'auto', borderRadius: 6 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <div style={{ fontWeight: 400, fontSize: 19, color: 'var(--primary)', letterSpacing: '0.04em', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                PK Food
              </div>
              <div className="nav-sub" style={{ fontSize: 10, color: 'var(--gray-400)', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
                NRS Canteen
              </div>
            </div>
          </div>

          {/* Search — desktop: inline centre; mobile: own row below */}
          <div className="nav-search-wrap">
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
              <input
                className="nav-search-input"
                placeholder="Search menu…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', padding: 2 }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="nav-actions">
            {userRole === 'STAFF' && (
              <button className="btn btn-ghost btn-sm nav-link-btn" onClick={() => navigate('/orders')}>
                <ClipboardList size={16} />
                <span className="nav-link-label">My Orders</span>
              </button>
            )}
            {(userRole === 'ADMIN' || userRole === 'RUNNER') && (
              <button className="btn btn-ghost btn-sm nav-link-btn" onClick={() => navigate('/runner')}>
                <Bike size={16} />
                <span className="nav-link-label">Queue</span>
              </button>
            )}
            {userRole === 'ADMIN' && (
              <button className="btn btn-ghost btn-sm nav-link-btn" onClick={() => navigate('/admin')}>
                <Settings size={16} />
                <span className="nav-link-label">Admin</span>
              </button>
            )}

            <div className="nav-divider" />

            <button className="nav-cart-btn" onClick={() => navigate('/cart')} data-filled={count > 0}>
              <ShoppingCart size={16} />
              {count > 0 ? (
                <span className="nav-cart-count">{count > 9 ? '9+' : count}</span>
              ) : (
                <span className="nav-link-label">Cart</span>
              )}
            </button>

            <button
              className="btn btn-ghost btn-icon"
              onClick={() => { clearToken(); navigate('/login'); }}
              title="Sign out"
              style={{ color: 'var(--gray-500)' }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>

        {/* Mobile-only search row */}
        <div className="nav-search-mobile">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
            <input
              className="nav-search-input"
              placeholder="Search menu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', padding: 2 }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="page-wrap">
        {/* Status banners — each dismissible */}
        {visibleStatuses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: notices.length > 0 ? 8 : 20 }}>
            {visibleStatuses.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px 9px 0',
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-subtle)',
                border: '1px solid var(--primary-light)',
                overflow: 'hidden',
              }}>
                <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--primary-darker)', lineHeight: 1.5, paddingLeft: 2 }}>{s.message}</span>
                <button
                  onClick={() => setDismissedStatuses(p => new Set([...p, s.id]))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 4, flexShrink: 0, borderRadius: 4, opacity: 0.6 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notices — sliding carousel */}
        {notices.length > 0 && (
          <div style={{ marginBottom: 20, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {/* Left accent bar + label */}
              <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0, borderRight: '1px solid #fde68a' }}>
                <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--amber)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#92400e', fontFamily: 'var(--font-ui)', padding: '0 10px', whiteSpace: 'nowrap' }}>Notice</span>
              </div>

              {/* Sliding track */}
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  width: `${notices.length * 100}%`,
                  transform: `translateX(-${noticeIdx * (100 / notices.length)}%)`,
                  transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                }}>
                  {notices.map(n => (
                    <div key={n.id} style={{ width: `${100 / notices.length}%`, padding: '10px 14px', flexShrink: 0 }}>
                      <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls */}
              {notices.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0, borderLeft: '1px solid #fde68a' }}>
                  <button onClick={prevNotice} className="carousel-nav-btn"><ChevronLeft size={14} /></button>
                  <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600, minWidth: 28, textAlign: 'center', fontFamily: 'var(--font-ui)' }}>
                    {noticeIdx + 1}/{notices.length}
                  </span>
                  <button onClick={nextNotice} className="carousel-nav-btn"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
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
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
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
