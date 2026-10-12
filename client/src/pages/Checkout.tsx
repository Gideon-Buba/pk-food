import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CreditCard, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { lineTotal, useCartStore } from '../store/cart';
import { FLOORS } from '../constants/floors';
import type { FloorValue } from '../constants/floors';
import type { AppSettings, ApiResponse, Order } from '../types';

const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE ?? 300);
const FALLBACK_PACKAGING_FEE = Number(import.meta.env.VITE_PACKAGING_FEE ?? 50);

interface FlutterwaveInitData { link: string; }

export default function Checkout() {
  const navigate = useNavigate();
  const { items, itemsTotal, clearCart } = useCartStore();
  const [floor, setFloor] = useState<FloorValue | ''>('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [packagingFeePerUnit, setPackagingFeePerUnit] = useState(FALLBACK_PACKAGING_FEE);
  const [discountPercent, setDiscountPercent] = useState(0);

  useEffect(() => {
    api.get<ApiResponse<AppSettings>>('/settings')
      .then(({ data }) => {
        setPackagingFeePerUnit(data.data.packagingFee);
        setDiscountPercent(data.data.discountPercent);
      })
      .catch(() => undefined);
  }, []);

  if (items.length === 0) { navigate('/cart'); return null; }

  const subtotal = itemsTotal(discountPercent);
  const packagingUnits = items.reduce((s, ci) => s + (ci.menuItem.requiresPackaging ? ci.quantity : 0), 0);
  const packagingFee = packagingUnits * packagingFeePerUnit;
  const total = subtotal + DELIVERY_FEE + packagingFee;

  const apiMessage = (err: unknown): string => {
    const e = err as { response?: { data?: { message?: string } } };
    return e.response?.data?.message ?? 'Something went wrong. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const orderRes = await api.post<ApiResponse<Order>>('/orders', {
        items: items.map(({ menuItem, quantity, selectedSides }) => ({
          menuItemId: menuItem.id,
          quantity,
          sideIds: selectedSides.map((s) => s.id),
        })),
        floor, officeNumber, phone,
      });
      const payRes = await api.post<ApiResponse<FlutterwaveInitData>>('/payments/initialize', { orderId: orderRes.data.data.id });
      clearCart();
      window.location.href = payRes.data.data.link;
    } catch (err: unknown) {
      toast.error(apiMessage(err));
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
        <div className="checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {/* Left column */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Delivery details</h2>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="label" htmlFor="floor">Floor</label>
                <select id="floor" className="input" value={floor} onChange={e => setFloor(e.target.value as FloorValue)} required>
                  <option value="">Select floor</option>
                  {FLOORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
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
                {loading ? 'Processing…' : `Pay ₦${total.toLocaleString()} with Flutterwave`}
              </button>
            </form>
          </div>

          {/* Summary */}
          <div className="card" style={{ padding: 20 }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Order summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {items.map(ci => {
                return (
                  <div key={ci.lineId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
                    <span style={{ color: 'var(--gray-600)', flex: 1 }}>
                      {ci.menuItem.name} <span style={{ color: 'var(--gray-400)' }}>×{ci.quantity}</span>
                      {ci.selectedSides.length > 0 && (
                        <><br /><span style={{ color: 'var(--gray-400)', fontSize: 12 }}>+ {ci.selectedSides.map(s => s.name).join(', ')}</span></>
                      )}
                    </span>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>₦{lineTotal(ci, discountPercent).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            <hr className="divider" style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: 6 }}>
              <span>Subtotal{discountPercent > 0 && ` (${discountPercent}% off)`}</span><span>₦{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: packagingUnits > 0 ? 6 : 12 }}>
              <span>Delivery</span><span>₦{DELIVERY_FEE.toLocaleString()}</span>
            </div>
            {packagingUnits > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
                <span>Takeaway packs ({packagingUnits})</span><span>₦{packagingFee.toLocaleString()}</span>
              </div>
            )}
            <hr className="divider" style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>
              <span>Total</span><span style={{ color: 'var(--primary)' }}>₦{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 700px) {
            .checkout-grid { grid-template-columns: 1fr !important; }
            .checkout-grid > *:last-child { order: -1; }
          }
        `}</style>
      </div>
    </div>
  );
}
