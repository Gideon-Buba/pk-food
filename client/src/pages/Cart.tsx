import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../store/cart';

const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE ?? 300);

export default function Cart() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart, itemsTotal } = useCartStore();

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
        <header className="nav-header">
          <div className="nav-inner">
            <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate('/menu')}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Your cart</span>
          </div>
        </header>
        <div className="empty-state" style={{ flex: 1 }}>
          <ShoppingCart className="empty-state-icon" />
          <h3>Your cart is empty</h3>
          <p>Add some food from the menu to get started</p>
          <button className="btn btn-primary" onClick={() => navigate('/menu')}>
            Browse menu
          </button>
        </div>
      </div>
    );
  }

  const subtotal = itemsTotal();
  const total = subtotal + DELIVERY_FEE;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate('/menu')}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Your cart</span>
          <button className="btn btn-ghost btn-sm" onClick={clearCart} style={{ color: 'var(--error)' }}>
            <Trash2 size={14} />
            Clear all
          </button>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Items */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {items.map((ci, idx) => (
              <div key={ci.menuItem.id}>
                <div style={{ padding: '16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  {ci.menuItem.image ? (
                    <img src={ci.menuItem.image} alt={ci.menuItem.name} style={{ width: 60, height: 60, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 60, height: 60, borderRadius: 'var(--radius-md)', background: 'var(--gray-100)', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ci.menuItem.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>{ci.menuItem.vendor.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="qty-btn" onClick={() => updateQuantity(ci.menuItem.id, ci.quantity - 1)}><Minus size={12} /></button>
                      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{ci.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQuantity(ci.menuItem.id, ci.quantity + 1)}><Plus size={12} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>₦{(Number(ci.menuItem.price) * ci.quantity).toLocaleString()}</span>
                    <button className="btn btn-ghost btn-icon-sm" onClick={() => removeItem(ci.menuItem.id)} style={{ color: 'var(--gray-400)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {idx < items.length - 1 && <hr className="divider" />}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="card" style={{ padding: 20 }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Order summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--gray-600)' }}>
                <span>Subtotal</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--gray-600)' }}>
                <span>Delivery fee</span>
                <span>₦{DELIVERY_FEE.toLocaleString()}</span>
              </div>
              <hr className="divider" style={{ margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>₦{total.toLocaleString()}</span>
              </div>
            </div>
            <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: 20 }} onClick={() => navigate('/checkout')}>
              Proceed to checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
