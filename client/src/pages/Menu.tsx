import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import {
  ShoppingCart, LogOut, Bike, Search, Plus, Minus, X,
  ChevronLeft, ChevronRight, Settings, UtensilsCrossed, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, clearToken, getToken } from '../api/client';
import { useCartStore } from '../store/cart';
import { CATEGORY_META, CATEGORY_ORDER } from '../constants/categories';
import type { ApiResponse, Announcement, FoodCategory, JwtPayload, MenuItem } from '../types';

interface ItemCardProps {
  item: MenuItem;
  index: number;
  cartItem: { quantity: number } | undefined;
  onAdd: (item: MenuItem) => void;
  onUpdate: (id: string, qty: number) => void;
}

function ItemCard({ item, index, cartItem, onAdd, onUpdate }: ItemCardProps) {
  const available = item.status === 'AVAILABLE';
  return (
    <div
      className="fade-up"
      style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--gray-100)',
        display: 'flex', flexDirection: 'column',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        animationDelay: `${index * 25}ms`,
        opacity: available ? 1 : 0.72,
      }}
      onMouseEnter={e => { if (available) { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.13)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--gray-100)', overflow: 'hidden' }}>
        {item.image ? (
          <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-subtle)' }}>
            <UtensilsCrossed size={36} color="var(--primary-light)" />
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: '#fff', borderRadius: 20, padding: '3px 9px', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
          {item.vendor.name}
        </div>
        {cartItem && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--primary)', color: '#fff', borderRadius: 20, padding: '3px 9px', fontSize: 10, fontWeight: 700 }}>
            {cartItem.quantity} in cart
          </div>
        )}
        {!available && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-ui)', backdropFilter: 'blur(4px)' }}>
              {item.status === 'OUT_OF_STOCK' ? 'Sold out' : 'Unavailable'}
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.35, margin: 0 }}>
          {item.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            &#8358;{Number(item.price).toLocaleString()}
          </span>
          {cartItem ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="qty-btn" onClick={() => onUpdate(item.id, cartItem.quantity - 1)}><Minus size={12} /></button>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{cartItem.quantity}</span>
              <button className="qty-btn" onClick={() => onUpdate(item.id, cartItem.quantity + 1)}><Plus size={12} /></button>
            </div>
          ) : (
            <button
              disabled={!available}
              onClick={() => onAdd(item)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, background: available ? 'var(--primary)' : 'var(--gray-200)', color: available ? '#fff' : 'var(--gray-400)', border: 'none', cursor: available ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)', transition: 'background 0.15s, transform 0.1s' }}
              onMouseEnter={e => { if (available) (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-dark)'; }}
              onMouseLeave={e => { if (available) (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'; }}
            >
              <Plus size={13} />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function today() {
  return new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Menu() {
  const [items, setItems]               = useState<MenuItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [activeVendor, setActiveVendor] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<FoodCategory | 'all'>('all');
  const [userName, setUserName]         = useState<string>('');
  const navigate = useNavigate();
  const { items: cartItems, addItem, updateQuantity, itemCount } = useCartStore();

  const token   = getToken();
  const payload = token ? jwtDecode<JwtPayload>(token) : null;
  const userRole  = payload?.role ?? 'STAFF';
  const userEmail = payload?.email ?? '';

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<MenuItem[]>>('/menu/items'),
      api.get<ApiResponse<Announcement[]>>('/menu/announcements'),
      api.get<ApiResponse<{ name?: string | null; email: string }>>('/auth/me'),
    ])
      .then(([ir, ar, ur]) => {
        setItems(ir.data.data);
        setAnnouncements(ar.data.data);
        const u = ur.data.data;
        setUserName(u.name ? u.name.split(' ')[0] : u.email.split('@')[0]);
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  const vendorNames = Array.from(new Set(items.map(i => i.vendor.name)));

  // Only show category tabs that actually have items (after vendor filter)
  const vendorFiltered = items.filter(item => activeVendor === 'all' || item.vendor.name === activeVendor);
  const availableCategories = CATEGORY_ORDER.filter(cat => vendorFiltered.some(i => i.category === cat));

  const filtered = vendorFiltered.filter(item => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getCartItem = (id: string) => cartItems.find(i => i.menuItem.id === id);

  // Group by category; only when viewing all categories and not searching
  const hasCategories = filtered.some(i => i.category != null);
  const showGrouped = !search && hasCategories && activeCategory === 'all';
  const grouped: { category: FoodCategory | null; items: MenuItem[] }[] = [];
  if (showGrouped) {
    const byCategory = new Map<FoodCategory | null, MenuItem[]>();
    for (const item of filtered) {
      const cat = item.category ?? null;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(item);
    }
    for (const cat of CATEGORY_ORDER) {
      const catItems = byCategory.get(cat);
      if (catItems?.length) grouped.push({ category: cat, items: catItems });
    }
    const uncategorized = byCategory.get(null);
    if (uncategorized?.length) grouped.push({ category: null, items: uncategorized });
  }

  const handleAdd = (item: MenuItem) => {
    addItem(item);
    toast.success(`Added to cart`, { id: item.id, duration: 1000 });
  };

  const count = itemCount();
  void userEmail;

  // Announcements
  const notices  = announcements.filter(a => a.type === 'GENERAL');
  const statuses = announcements.filter(a => a.type === 'STATUS');
  const [noticeIdx, setNoticeIdx] = useState(0);
  const [dismissedStatuses, setDismissedStatuses] = useState<Set<string>>(new Set());
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (notices.length < 2) return;
    carouselTimer.current = setInterval(() => setNoticeIdx(i => (i + 1) % notices.length), 4500);
    return () => { if (carouselTimer.current) clearInterval(carouselTimer.current); };
  }, [notices.length]);

  const prevNotice = () => { if (carouselTimer.current) clearInterval(carouselTimer.current); setNoticeIdx(i => (i - 1 + notices.length) % notices.length); };
  const nextNotice = () => { if (carouselTimer.current) clearInterval(carouselTimer.current); setNoticeIdx(i => (i + 1) % notices.length); };

  const visibleStatuses = statuses.filter(s => !dismissedStatuses.has(s.id));

  // Initials for avatar
  const initials = userName ? userName[0].toUpperCase() : '?';

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f4' }}>

      {/* ── Sticky Nav ─────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="nav-brand">
            <img src="/logo.jpeg" alt="PK" style={{ height: 36, width: 'auto', borderRadius: 6 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <div style={{ fontWeight: 400, fontSize: 18, color: 'var(--primary)', letterSpacing: '0.04em', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                PK Food
              </div>
              <div className="nav-sub" style={{ fontSize: 10, color: 'var(--gray-400)', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
                NRS Canteen
              </div>
            </div>
          </div>

          {/* Desktop search */}
          <div className="nav-search-wrap">
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
              <input className="nav-search-input" placeholder="Search menu…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', padding: 2 }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="nav-actions">
            {/* Queue + Admin buttons: desktop only — bottom nav handles mobile */}
            {(userRole === 'ADMIN' || userRole === 'RUNNER') && (
              <button className="btn btn-ghost btn-sm nav-link-btn top-nav-desktop-only" onClick={() => navigate('/runner')}>
                <Bike size={16} />
                <span className="nav-link-label">Queue</span>
              </button>
            )}
            {userRole === 'ADMIN' && (
              <button className="btn btn-ghost btn-sm nav-link-btn top-nav-desktop-only" onClick={() => navigate('/admin')}>
                <Settings size={16} />
                <span className="nav-link-label">Admin</span>
              </button>
            )}

            <div className="nav-divider top-nav-desktop-only" />

            {/* Cart button */}
            <button className="nav-cart-btn" onClick={() => navigate('/cart')} data-filled={count > 0}>
              <ShoppingCart size={16} />
              {count > 0 ? (
                <span className="nav-cart-count">{count > 9 ? '9+' : count}</span>
              ) : (
                <span className="nav-link-label">Cart</span>
              )}
            </button>

            {/* User avatar → profile: desktop only — bottom nav handles mobile */}
            <button
              className="top-nav-desktop-only"
              onClick={() => navigate('/profile')}
              title="My profile"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--primary)', color: '#fff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
                flexShrink: 0, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {loading ? <User size={14} /> : initials}
            </button>

            {/* Logout: desktop only — sign out is in Profile page */}
            <button className="btn btn-ghost btn-icon top-nav-desktop-only" onClick={() => { clearToken(); navigate('/login'); }} title="Sign out" style={{ color: 'var(--gray-500)' }}>
              <LogOut size={17} />
            </button>
          </div>
        </div>

        {/* Mobile search row */}
        <div className="nav-search-mobile">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
            <input className="nav-search-input" placeholder="Search menu…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', padding: 2 }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Greeting strip ─────────────────────────────── */}
      {!search && (
        <div style={{
          position: 'relative',
          padding: '28px 24px 32px',
          overflow: 'hidden',
          backgroundImage: 'url(/canteen.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
        }}>
          {/* Dark gradient overlay so text is readable */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(26,56,48,0.88) 0%, rgba(49,103,82,0.78) 100%)',
          }} />
          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 14, width: 120, background: 'rgba(255,255,255,0.2)', borderRadius: 6, marginBottom: 8 }} />
                <div style={{ height: 28, width: 260, background: 'rgba(255,255,255,0.2)', borderRadius: 6 }} />
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {today()}
                </p>
                <h2 style={{ fontSize: 24, fontWeight: 300, color: '#fff', fontFamily: 'var(--font-heading)', letterSpacing: '0.02em', lineHeight: 1.2 }}>
                  {greeting()}, <span style={{ fontWeight: 600 }}>{userName || 'there'}</span>
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                  What would you like today?
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="page-wrap" style={{ paddingTop: 20, paddingBottom: count > 0 ? 100 : 20 }}>

        {/* ── Status banners ─────────────────────────────── */}
        {visibleStatuses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {visibleStatuses.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px 9px 0',
                borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', overflow: 'hidden',
              }}>
                <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--primary-darker)', lineHeight: 1.5, paddingLeft: 2 }}>{s.message}</span>
                <button onClick={() => setDismissedStatuses(p => new Set([...p, s.id]))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 4, flexShrink: 0, borderRadius: 4, opacity: 0.6 }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Notice carousel ─────────────────────────────── */}
        {notices.length > 0 && (
          <div style={{ marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0, borderRight: '1px solid #fde68a' }}>
                <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--amber)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#92400e', fontFamily: 'var(--font-ui)', padding: '0 10px', whiteSpace: 'nowrap' }}>Notice</span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ display: 'flex', width: `${notices.length * 100}%`, transform: `translateX(-${noticeIdx * (100 / notices.length)}%)`, transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)' }}>
                  {notices.map(n => (
                    <div key={n.id} style={{ width: `${100 / notices.length}%`, padding: '10px 14px', flexShrink: 0 }}>
                      <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
              {notices.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0, borderLeft: '1px solid #fde68a' }}>
                  <button onClick={prevNotice} className="carousel-nav-btn"><ChevronLeft size={14} /></button>
                  <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600, minWidth: 28, textAlign: 'center', fontFamily: 'var(--font-ui)' }}>{noticeIdx + 1}/{notices.length}</span>
                  <button onClick={nextNotice} className="carousel-nav-btn"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Vendor tabs ─────────────────────────────────── */}
        <div className="vendor-tabs" style={{ marginBottom: availableCategories.length > 0 ? 10 : 20 }}>
          <button
            className={`vendor-tab ${activeVendor === 'all' ? 'active' : ''}`}
            onClick={() => { setActiveVendor('all'); setActiveCategory('all'); }}
          >
            All items
          </button>
          {vendorNames.map(v => (
            <button
              key={v}
              className={`vendor-tab ${activeVendor === v ? 'active' : ''}`}
              onClick={() => { setActiveVendor(v); setActiveCategory('all'); }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* ── Category filter pills ────────────────────────── */}
        {availableCategories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 20, scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'var(--font-ui)',
                background: activeCategory === 'all' ? 'var(--primary)' : 'transparent',
                borderColor: activeCategory === 'all' ? 'var(--primary)' : 'var(--gray-200)',
                color: activeCategory === 'all' ? '#fff' : 'var(--gray-600)',
              }}
            >
              All
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'var(--font-ui)',
                  background: activeCategory === cat ? 'var(--primary)' : 'transparent',
                  borderColor: activeCategory === cat ? 'var(--primary)' : 'var(--gray-200)',
                  color: activeCategory === cat ? '#fff' : 'var(--gray-600)',
                }}
              >
                {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        )}

        {/* ── Menu grid ─────────────────────────────────── */}
        {loading ? (
          <div className="food-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card" style={{ overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 180 }} />
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 10, width: '40%' }} />
                  <div className="skeleton" style={{ height: 16, width: '75%' }} />
                  <div className="skeleton" style={{ height: 36, marginTop: 10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <UtensilsCrossed className="empty-state-icon" />
            <h3>No items found</h3>
            <p>{search ? `No results for "${search}"` : 'No items available right now'}</p>
            {search && <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear search</button>}
          </div>
        ) : !showGrouped ? (
          <div className="food-grid">
            {filtered.map((item, i) => <ItemCard key={item.id} item={item} index={i} cartItem={getCartItem(item.id)} onAdd={handleAdd} onUpdate={updateQuantity} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {grouped.map(({ category, items: catItems }) => (
              <section key={category ?? 'other'}>
                <h2 style={{
                  fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--gray-500)',
                  marginBottom: 14,
                }}>
                  {category ? CATEGORY_META[category].label : 'Other'}
                </h2>
                <div className="food-grid">
                  {catItems.map((item, i) => <ItemCard key={item.id} item={item} index={i} cartItem={getCartItem(item.id)} onAdd={handleAdd} onUpdate={updateQuantity} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ── Sticky cart footer — sits above bottom nav on mobile ── */}
      {count > 0 && (
        <div className="cart-footer-sticky" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
          borderTop: '1px solid var(--gray-100)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
          zIndex: 50,
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={() => navigate('/cart')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', maxWidth: 480,
              background: 'var(--primary)', color: '#fff',
              border: 'none', cursor: 'pointer',
              borderRadius: 14, padding: '14px 20px',
              fontFamily: 'var(--font-ui)', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
          >
            <div style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: 8,
              padding: '4px 10px', fontSize: 13, fontWeight: 700,
            }}>
              {count} {count === 1 ? 'item' : 'items'}
            </div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>View Cart</span>
            <ShoppingCart size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
