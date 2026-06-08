import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart';

const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE ?? 300);

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, itemsTotal } = useCartStore();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div style={s.center}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48 }}>🛒</p>
          <h2 style={{ color: '#6b7280' }}>Your cart is empty</h2>
          <button style={s.btn} onClick={() => navigate('/menu')}>Browse menu</button>
        </div>
      </div>
    );
  }

  const subtotal = itemsTotal();
  const total = subtotal + DELIVERY_FEE;

  return (
    <div style={s.root}>
      <header style={s.header}>
        <button style={s.back} onClick={() => navigate('/menu')}>← Menu</button>
        <h1 style={s.title}>Your Cart</h1>
        <button style={s.clearBtn} onClick={clearCart}>Clear</button>
      </header>

      <main style={s.main}>
        <div style={s.items}>
          {items.map(({ menuItem, quantity }) => (
            <div key={menuItem.id} style={s.row}>
              {menuItem.image && <img src={menuItem.image} alt={menuItem.name} style={s.thumb} />}
              <div style={s.rowInfo}>
                <p style={s.name}>{menuItem.name}</p>
                <p style={s.vendor}>{menuItem.vendor.name}</p>
                <p style={s.unitPrice}>₦{Number(menuItem.price).toLocaleString()} each</p>
              </div>
              <div style={s.qtyControl}>
                <button style={s.qtyBtn} onClick={() => updateQuantity(menuItem.id, quantity - 1)}>−</button>
                <span style={s.qty}>{quantity}</span>
                <button style={s.qtyBtn} onClick={() => updateQuantity(menuItem.id, quantity + 1)}>+</button>
              </div>
              <div style={s.rowRight}>
                <p style={s.rowTotal}>₦{(Number(menuItem.price) * quantity).toLocaleString()}</p>
                <button style={s.remove} onClick={() => removeItem(menuItem.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div style={s.summary}>
          <h2 style={s.summaryTitle}>Order summary</h2>
          <div style={s.summaryRow}><span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span></div>
          <div style={s.summaryRow}><span>Delivery fee</span><span>₦{DELIVERY_FEE.toLocaleString()}</span></div>
          <div style={{ ...s.summaryRow, fontWeight: 700, fontSize: 18, marginTop: 8 }}>
            <span>Total</span><span>₦{total.toLocaleString()}</span>
          </div>
          <button style={s.checkoutBtn} onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  header: { background: '#15803d', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  back: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 15 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  clearBtn: { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  main: { maxWidth: 760, margin: '24px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 24 },
  items: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { background: '#fff', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 6px rgba(0,0,0,.06)' },
  thumb: { width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  rowInfo: { flex: 1, minWidth: 0 },
  name: { margin: 0, fontWeight: 600 },
  vendor: { margin: '2px 0', fontSize: 12, color: '#9ca3af' },
  unitPrice: { margin: 0, fontSize: 13, color: '#6b7280' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 24, textAlign: 'center', fontWeight: 600 },
  rowRight: { textAlign: 'right' },
  rowTotal: { margin: 0, fontWeight: 700, color: '#15803d', fontSize: 16 },
  remove: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, marginTop: 4, padding: 0 },
  summary: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.06)' },
  summaryTitle: { margin: '0 0 16px', fontSize: 18 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' },
  checkoutBtn: { marginTop: 20, width: '100%', padding: '14px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  btn: { padding: '12px 32px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 16 },
};
