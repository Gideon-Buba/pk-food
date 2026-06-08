import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { api, getToken } from '../api/client';
import { useCartStore } from '../store/cart';
import type { ApiResponse, JwtPayload, Order } from '../types';

const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE ?? 300);

interface PaystackInitData {
  authorization_url: string;
  reference: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, itemsTotal, clearCart } = useCartStore();
  const token = getToken();
  const userPayload = token ? jwtDecode<JwtPayload>(token) : null;

  const [floor, setFloor] = useState('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPayload) { navigate('/login'); return; }
    setLoading(true);
    setError('');

    try {
      const orderRes = await api.post<ApiResponse<Order>>('/orders', {
        items: items.map(({ menuItem, quantity }) => ({ menuItemId: menuItem.id, quantity })),
        floor,
        officeNumber,
      });

      const orderId = orderRes.data.data.id;

      const payRes = await api.post<ApiResponse<PaystackInitData>>('/payments/initialize', { orderId });

      clearCart();
      window.location.href = payRes.data.data.authorization_url;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const subtotal = itemsTotal();
  const total = subtotal + DELIVERY_FEE;

  return (
    <div style={s.root}>
      <header style={s.header}>
        <button style={s.back} onClick={() => navigate('/cart')}>← Cart</button>
        <h1 style={s.title}>Checkout</h1>
        <span />
      </header>

      <main style={s.main}>
        <div style={s.left}>
          <h2 style={s.sectionTitle}>Delivery details</h2>
          <form onSubmit={handleCheckout} style={s.form}>
            <label style={s.label}>
              Floor / Level
              <input
                style={s.input}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="e.g. 3rd Floor"
                required
              />
            </label>
            <label style={s.label}>
              Office / Room number
              <input
                style={s.input}
                value={officeNumber}
                onChange={(e) => setOfficeNumber(e.target.value)}
                placeholder="e.g. Room 305"
                required
              />
            </label>
            {error && <p style={s.error}>{error}</p>}
            <button type="submit" disabled={loading} style={s.payBtn}>
              {loading ? 'Processing…' : `Pay ₦${total.toLocaleString()} with Paystack`}
            </button>
          </form>
        </div>

        <div style={s.right}>
          <h2 style={s.sectionTitle}>Order summary</h2>
          {items.map(({ menuItem, quantity }) => (
            <div key={menuItem.id} style={s.item}>
              <span>{menuItem.name} × {quantity}</span>
              <span>₦{(Number(menuItem.price) * quantity).toLocaleString()}</span>
            </div>
          ))}
          <hr style={s.hr} />
          <div style={s.item}><span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span></div>
          <div style={s.item}><span>Delivery</span><span>₦{DELIVERY_FEE.toLocaleString()}</span></div>
          <div style={{ ...s.item, fontWeight: 700, fontSize: 18, marginTop: 8 }}>
            <span>Total</span><span>₦{total.toLocaleString()}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#15803d', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  back: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 15 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  main: { maxWidth: 840, margin: '24px auto', padding: '0 16px', display: 'flex', gap: 24, flexWrap: 'wrap' },
  left: { flex: '1 1 340px', background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.06)' },
  right: { flex: '1 1 280px', background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.06)' },
  sectionTitle: { margin: '0 0 20px', fontSize: 18, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: '#374151' },
  input: { padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, outline: 'none' },
  payBtn: { padding: '14px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  error: { color: '#dc2626', fontSize: 14, margin: 0 },
  item: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 15 },
  hr: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' },
};
