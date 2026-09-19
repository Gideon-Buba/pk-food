import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, ChevronLeft, CreditCard, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useCartStore } from '../store/cart';
import { FLOORS } from '../constants/floors';
import type { FloorValue } from '../constants/floors';
import type { AppSettings, ApiResponse, Order } from '../types';

const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE ?? 300);
const FALLBACK_PACKAGING_FEE = Number(import.meta.env.VITE_PACKAGING_FEE ?? 50);

interface FlutterwaveInitData { link: string; }
interface BankDetails { bankName: string; accountName: string; accountNumber: string; contactPhone: string; }
interface BankTransferData { reference: string; }

type Method = 'flutterwave' | 'bank';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, itemsTotal, clearCart } = useCartStore();
  const [floor, setFloor] = useState<FloorValue | ''>('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<Method>('flutterwave');
  const [loading, setLoading] = useState(false);

  // Bank-transfer second step
  const [bankStep, setBankStep] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [orderId, setOrderId] = useState('');
  const [reference, setReference] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [packagingFeePerUnit, setPackagingFeePerUnit] = useState(FALLBACK_PACKAGING_FEE);

  useEffect(() => {
    api.get<ApiResponse<AppSettings>>('/settings')
      .then(({ data }) => setPackagingFeePerUnit(data.data.packagingFee))
      .catch(() => undefined);
  }, []);

  if (items.length === 0) { navigate('/cart'); return null; }

  const subtotal = itemsTotal();
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
      const newOrderId = orderRes.data.data.id;

      if (method === 'flutterwave') {
        const payRes = await api.post<ApiResponse<FlutterwaveInitData>>('/payments/initialize', { orderId: newOrderId });
        clearCart();
        window.location.href = payRes.data.data.link;
        return;
      }

      // Bank transfer — show account details + reference, then confirm.
      const detailsRes = await api.get<ApiResponse<BankDetails>>('/payments/bank-details');
      setBankDetails(detailsRes.data.data);
      setOrderId(newOrderId);
      setReference(orderRes.data.data.reference);
      setBankStep(true);
      setLoading(false);
    } catch (err: unknown) {
      toast.error(apiMessage(err));
      setLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    setLoading(true);
    try {
      const res = await api.post<ApiResponse<BankTransferData>>('/payments/bank-transfer', {
        orderId,
        transferReference: transferNote.trim() || undefined,
      });
      clearCart();
      navigate(`/order-confirmation?method=bank&orderId=${orderId}&ref=${res.data.data.reference}`);
    } catch (err: unknown) {
      toast.error(apiMessage(err));
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => (bankStep ? setBankStep(false) : navigate('/cart'))}><ChevronLeft size={20} /></button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Checkout</span>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 840 }}>
        <div className="checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {/* Left column */}
          {!bankStep ? (
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

                <div className="form-group">
                  <span className="label">Payment method</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label className={`method-option ${method === 'flutterwave' ? 'method-option-active' : ''}`}>
                      <input type="radio" name="method" checked={method === 'flutterwave'} onChange={() => setMethod('flutterwave')} />
                      <CreditCard size={16} />
                      <span>Pay online with Flutterwave</span>
                    </label>
                    <label className={`method-option ${method === 'bank' ? 'method-option-active' : ''}`}>
                      <input type="radio" name="method" checked={method === 'bank'} onChange={() => setMethod('bank')} />
                      <Banknote size={16} />
                      <span>Bank transfer (manual verification)</span>
                    </label>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 4 }}>
                  {loading ? <span className="spinner" /> : method === 'flutterwave' ? <CreditCard size={17} /> : <Banknote size={17} />}
                  {loading
                    ? 'Processing…'
                    : method === 'flutterwave'
                      ? `Pay ₦${total.toLocaleString()} with Flutterwave`
                      : `Continue to bank transfer`}
                </button>
              </form>
            </div>
          ) : (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Banknote size={18} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Bank transfer</h2>
              </div>

              <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: 16 }}>
                Transfer <strong>₦{total.toLocaleString()}</strong> to the account below, then tap
                “I’ve made the transfer”. An admin verifies it against the bank statement using your
                reference and confirms your order.
              </p>

              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <Row label="Bank" value={bankDetails?.bankName || '—'} />
                <Row label="Account name" value={bankDetails?.accountName || '—'} />
                <Row label="Account number" value={bankDetails?.accountNumber || '—'} mono />
                <Row label="Amount" value={`₦${total.toLocaleString()}`} />
              </div>

              <div style={{ marginTop: 16, background: 'var(--primary-subtle)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 4 }}>Use this as your transfer narration / reference</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace', color: 'var(--primary)' }}>{reference}</div>
              </div>

              {bankDetails?.contactPhone && (
                <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 14 }}>
                  <Phone size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  After transferring, call <strong>{bankDetails.contactPhone}</strong> to speed up verification.
                </p>
              )}

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="label" htmlFor="note">Your transfer reference (optional)</label>
                <input id="note" className="input" placeholder="e.g. the narration your bank shows"
                  value={transferNote} onChange={e => setTransferNote(e.target.value)} />
              </div>

              <button disabled={loading} onClick={handleConfirmTransfer} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 4 }}>
                {loading ? <span className="spinner" /> : <Banknote size={17} />}
                {loading ? 'Submitting…' : 'I’ve made the transfer'}
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="card" style={{ padding: 20 }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Order summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {items.map(ci => {
                const sidesPrice = ci.selectedSides.reduce((s, side) => s + side.price, 0);
                return (
                  <div key={ci.lineId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
                    <span style={{ color: 'var(--gray-600)', flex: 1 }}>
                      {ci.menuItem.name} <span style={{ color: 'var(--gray-400)' }}>×{ci.quantity}</span>
                      {ci.selectedSides.length > 0 && (
                        <><br /><span style={{ color: 'var(--gray-400)', fontSize: 12 }}>+ {ci.selectedSides.map(s => s.name).join(', ')}</span></>
                      )}
                    </span>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>₦{((Number(ci.menuItem.price) + sidesPrice) * ci.quantity).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            <hr className="divider" style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: 6 }}>
              <span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span>
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
          .method-option {
            display: flex; align-items: center; gap: 10px;
            padding: 12px 14px; border: 1.5px solid var(--gray-200);
            border-radius: var(--radius-md); cursor: pointer; font-size: 14px;
          }
          .method-option-active { border-color: var(--primary); background: var(--primary-subtle); }
          .method-option input { accent-color: var(--primary); }
        `}</style>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  );
}
