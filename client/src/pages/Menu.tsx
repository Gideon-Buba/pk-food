import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { api, clearToken, getToken } from '../api/client';
import { useCartStore } from '../store/cart';
import type { ApiResponse, Announcement, JwtPayload, MenuItem } from '../types';

export default function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addItem, itemCount } = useCartStore();
  const navigate = useNavigate();

  const token = getToken();
  const userRole = token ? jwtDecode<JwtPayload>(token).role : 'STAFF';

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<MenuItem[]>>('/menu/items'),
      api.get<ApiResponse<Announcement[]>>('/menu/announcements'),
    ])
      .then(([itemsRes, announcementsRes]) => {
        setItems(itemsRes.data.data);
        setAnnouncements(announcementsRes.data.data);
      })
      .catch(() => setError('Failed to load menu.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  if (loading) return <div style={s.center}>Loading menu…</div>;
  if (error) return <div style={s.center}>{error}</div>;

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.vendor.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div style={s.root}>
      <header style={s.header}>
        <span style={s.logo}>🍽️ PK Food</span>
        <nav style={s.nav}>
          {userRole === 'ADMIN' && (
            <button style={s.navBtn} onClick={() => navigate('/admin')}>Admin</button>
          )}
          {(userRole === 'RUNNER' || userRole === 'ADMIN') && (
            <button style={s.navBtn} onClick={() => navigate('/runner')}>Runner</button>
          )}
          <button style={s.navBtn} onClick={() => navigate('/orders')}>My Orders</button>
          <button style={{ ...s.navBtn, position: 'relative' }} onClick={() => navigate('/cart')}>
            Cart {itemCount() > 0 && <span style={s.badge}>{itemCount()}</span>}
          </button>
          <button style={{ ...s.navBtn, color: '#dc2626' }} onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      <main style={s.main}>
        {announcements.map((a) => (
          <div key={a.id} style={{ ...s.banner, background: a.type === 'STATUS' ? '#fef3c7' : '#dbeafe' }}>
            {a.message}
          </div>
        ))}

        {Object.entries(grouped).map(([vendor, vendorItems]) => (
          <section key={vendor} style={s.section}>
            <h2 style={s.vendorTitle}>{vendor}</h2>
            <div style={s.grid}>
              {vendorItems.map((item) => (
                <div key={item.id} style={s.card}>
                  {item.image && (
                    <img src={item.image} alt={item.name} style={s.img} />
                  )}
                  <div style={s.cardBody}>
                    <h3 style={s.itemName}>{item.name}</h3>
                    <p style={s.price}>₦{Number(item.price).toLocaleString()}</p>
                    <p style={{ ...s.stockLabel, color: item.status === 'AVAILABLE' ? '#16a34a' : '#dc2626' }}>
                      {item.status === 'AVAILABLE' ? `${item.onlineStock} left` : item.status.replace('_', ' ')}
                    </p>
                    <button
                      style={{ ...s.addBtn, opacity: item.status === 'AVAILABLE' ? 1 : 0.4 }}
                      disabled={item.status !== 'AVAILABLE'}
                      onClick={() => addItem(item)}
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {items.length === 0 && (
          <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 64 }}>
            No items available right now.
          </p>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#15803d', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  logo: { fontWeight: 700, fontSize: 20 },
  nav: { display: 'flex', gap: 8 },
  navBtn: { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500, position: 'relative' },
  badge: { position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  main: { maxWidth: 960, margin: '0 auto', padding: 24 },
  banner: { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 },
  section: { marginBottom: 32 },
  vendorTitle: { fontSize: 18, fontWeight: 700, color: '#15803d', marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  card: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,.07)' },
  img: { width: '100%', height: 140, objectFit: 'cover' },
  cardBody: { padding: 16 },
  itemName: { margin: '0 0 4px', fontWeight: 600, fontSize: 15 },
  price: { margin: '0 0 4px', color: '#16a34a', fontWeight: 700, fontSize: 16 },
  stockLabel: { margin: '0 0 12px', fontSize: 12 },
  addBtn: { width: '100%', padding: '8px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
};
