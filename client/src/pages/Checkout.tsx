import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CreditCard, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useCartStore } from '../store/cart';
import type { ApiResponse, Order } from '../types';

const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE ?? 300);

interface PaystackInitData { authorization_url: string; reference: string; }

export default function Checkout() {
  const navigate = useNavigate();
  const { items, itemsTotal, clearCart } = useCartStore();
  const [floor, setFloor] = useState('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  if (items.length === 0) { navigate('/cart'); return null; }

  const subtotal = itemsTotal();
  const total = subtotal + DELIVERY_FEE;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const orderRes = await api.post<ApiResponse<Order>>('/orders', {
        items: items.map(({ menuItem, quantity }) => ({ menuItemId: menuItem.id, quantity })),
        floor, officeNumber, phone,
      });
      const orderId = orderRes.data.data.id;
      const payRes = await api.post<ApiResponse<PaystackInitData>>('/payments/initialize', { orderId });
      clearCart();
      window.location.href = payRes.data.data.authorization_url;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate('/cart')}><ChevronLeft size={20} /></button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Checkout</span>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 840 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {/* Delivery form */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Delivery details</h2>
            </div>
            <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="label" htmlFor="floor">Floor / Level</label>
                <input id="floor" className="input" placeholder="e.g. 3rd Floor" value={floor} onChange={e => setFloor(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="label" htmlFor="office">Wing</label>
                <select id="office" className="input" value={officeNumber} onChange={e => setOfficeNumber(e.target.value)} required>
                  <option value="">Select wing</option>
                  <option value="A">Wing A</option>
                  <option value="B">Wing B</option>
                  <option value="C">Wing C</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label" htmlFor="phone">
                  <Phone size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Phone number
                </label>
                <input id="phone" className="input" type="tel" placeholder="e.g. 08012345678"
                  value={phone} onChange={e => setPhone(e.target.value)}
                  pattern="^(\+?234|0)[789]\d{9}$" required
                  title="Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)" />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 4 }}>
                {loading ? <span className="spinner" /> : <CreditCard size={17} />}
                {loading ? 'Processing…' : `Pay ₦${total.toLocaleString()} with Paystack`}
              </button>
            </form>
          </div>

          {/* Summary */}
          <div className="card" style={{ padding: 20 }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Order summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {items.map(ci => (
                <div key={ci.menuItem.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
                  <span style={{ color: 'var(--gray-600)', flex: 1 }}>{ci.menuItem.name} <span style={{ color: 'var(--gray-400)' }}>×{ci.quantity}</span></span>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>₦{(Number(ci.menuItem.price) * ci.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <hr className="divider" style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: 6 }}>
              <span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
              <span>Delivery</span><span>₦{DELIVERY_FEE.toLocaleString()}</span>
            </div>
            <hr className="divider" style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>
              <span>Total</span><span style={{ color: 'var(--primary)' }}>₦{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 680px) {
            .checkout-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
