import { useEffect, type ReactNode } from 'react';
import {
  X, Copy, Clock, User as UserIcon, MapPin, Phone, CreditCard,
  ShoppingBag, Package, Hash, Receipt,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Order, OrderStatus } from '../types';
import { CATEGORY_META } from '../constants/categories';

interface OrderDetailPanelProps {
  order: Order;
  allOrders: Order[];
  nextStatuses: OrderStatus[] | undefined;
  statusBadgeClass: (s: OrderStatus) => string;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

const naira = (n: number): string => `₦${n.toLocaleString()}`;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function relative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function duration(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function copy(value: string, label: string) {
  navigator.clipboard.writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error('Could not copy'));
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section style={{ padding: '16px 20px', borderTop: '1px solid var(--gray-100)' }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)', margin: '0 0 12px' }}>
        {icon}{title}
      </h4>
      {children}
    </section>
  );
}

function Row({ label, children, mono, copyValue }: { label: string; children: ReactNode; mono?: boolean; copyValue?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: 'var(--gray-500)', flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: 'right', fontWeight: 500, fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {children}
        {copyValue && (
          <button type="button" className="btn btn-ghost btn-icon-sm" onClick={() => copy(copyValue, label)} title={`Copy ${label.toLowerCase()}`} style={{ padding: 2 }}>
            <Copy size={12} />
          </button>
        )}
      </span>
    </div>
  );
}

export default function OrderDetailPanel({
  order, allOrders, nextStatuses, statusBadgeClass, onClose, onUpdateStatus,
}: OrderDetailPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const itemsSubtotal = order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const sidesSubtotal = order.items.reduce(
    (s, i) => s + i.sides.reduce((ss, side) => ss + Number(side.price), 0) * i.quantity, 0,
  );
  // Only lines placed after discounts were recorded carry originalUnitPrice.
  const discountTotal = order.items.reduce(
    (s, i) => s + (i.originalUnitPrice != null ? (Number(i.originalUnitPrice) - Number(i.unitPrice)) * i.quantity : 0), 0,
  );
  const deliveryFee = Number(order.deliveryFee);
  const packagingFee = Number(order.packagingFee ?? 0);
  const total = itemsSubtotal + sidesSubtotal + deliveryFee + packagingFee;
  const unitCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const packCount = order.items.reduce((s, i) => s + (i.requiresPackaging ? i.quantity : 0), 0);

  const customerOrders = allOrders.filter(o => o.userId === order.userId);
  const customerSpend = customerOrders
    .filter(o => o.paid)
    .reduce((s, o) => s + o.items.reduce((t, i) => t + (Number(i.unitPrice) + i.sides.reduce((ss, sd) => ss + Number(sd.price), 0)) * i.quantity, 0) + Number(o.deliveryFee) + Number(o.packagingFee ?? 0), 0);
  const orderNumberForCustomer = [...customerOrders]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .findIndex(o => o.id === order.id) + 1;

  const isFinal = order.status === 'DELIVERED' || order.status === 'CANCELLED';
  const customerName = order.user.name || order.user.email.split('@')[0];
  const accountLocation = [order.user.floor, order.user.officeNumber].filter(Boolean).join(', ');
  const deliveryLocation = `${order.floor}, ${order.officeNumber}`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <aside
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, height: '100%', background: '#fff', overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)', animation: 'fadeIn .15s ease' }}
        aria-label={`Order ${order.reference}`}
      >
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--gray-100)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18 }}>{order.reference}</span>
              <button type="button" className="btn btn-ghost btn-icon-sm" onClick={() => copy(order.reference, 'Reference')} title="Copy reference" style={{ padding: 2 }}>
                <Copy size={13} />
              </button>
              <span className={`badge ${statusBadgeClass(order.status)}`}>{order.status}</span>
              <span className={`badge ${order.paid ? 'badge-green' : 'badge-gray'}`}>{order.paid ? 'Paid' : 'Unpaid'}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '4px 0 0' }}>
              {customerName} · {naira(total)} · placed {relative(order.createdAt)}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon-sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        {!isFinal && (
          <div style={{ padding: '12px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--gray-50)' }}>
            {nextStatuses?.map(s => (
              <button
                key={s}
                type="button"
                className={`btn btn-sm ${s === 'CANCELLED' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => {
                  if (s === 'CANCELLED' && !window.confirm(`Cancel order ${order.reference}?`)) return;
                  onUpdateStatus(order.id, s);
                }}
              >
                {s === 'CANCELLED' ? 'Cancel order' : `Move to ${s}`}
              </button>
            ))}
          </div>
        )}

        <Section title="Timeline" icon={<Clock size={13} />}>
          <Row label="Placed">{formatDateTime(order.createdAt)}</Row>
          <Row label="Last updated">{formatDateTime(order.updatedAt)}</Row>
          <Row label={isFinal ? 'Time to close' : 'Open for'}>
            {duration(order.createdAt, isFinal ? order.updatedAt : new Date().toISOString())}
          </Row>
          <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '6px 0 0' }}>
            Times are Lagos time. "Last updated" is the most recent change of any kind (status or payment).
          </p>
        </Section>

        <Section title="Customer" icon={<UserIcon size={13} />}>
          <Row label="Name">{order.user.name || <em style={{ color: 'var(--gray-400)' }}>Not set</em>}</Row>
          <Row label="Email" copyValue={order.user.email}>
            <a href={`mailto:${order.user.email}`} style={{ color: 'var(--primary)' }}>{order.user.email}</a>
          </Row>
          <Row label="Account phone">
            {order.user.phone
              ? <a href={`tel:${order.user.phone}`} style={{ color: 'var(--primary)' }}>{order.user.phone}</a>
              : <em style={{ color: 'var(--gray-400)' }}>Not set</em>}
          </Row>
          <Row label="Account location">{accountLocation || <em style={{ color: 'var(--gray-400)' }}>Not set</em>}</Row>
          {order.user.createdAt && <Row label="Customer since">{formatDate(order.user.createdAt)}</Row>}
          <Row label="Orders by customer">
            {customerOrders.length}{orderNumberForCustomer > 0 && ` (this is #${orderNumberForCustomer})`}
          </Row>
          <Row label="Total paid by customer">{naira(customerSpend)}</Row>
          <Row label="User ID" mono copyValue={order.userId}>{order.userId}</Row>
        </Section>

        <Section title="Delivery" icon={<MapPin size={13} />}>
          <Row label="Deliver to">{deliveryLocation}</Row>
          {accountLocation && accountLocation !== deliveryLocation && (
            <p style={{ fontSize: 11, color: 'var(--warning, #b45309)', margin: '2px 0 6px' }}>
              Different from the location on their account ({accountLocation}).
            </p>
          )}
          <Row label="Contact phone">
            {order.phone
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} /><a href={`tel:${order.phone}`} style={{ color: 'var(--primary)' }}>{order.phone}</a></span>
              : <em style={{ color: 'var(--gray-400)' }}>Not given</em>}
          </Row>
          <Row label="Takeaway packs">{packCount}</Row>
        </Section>

        <Section title={`Items (${unitCount})`} icon={<ShoppingBag size={13} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {order.items.map(item => {
              const unit = Number(item.unitPrice);
              const sidesEach = item.sides.reduce((s, sd) => s + Number(sd.price), 0);
              const lineTotal = (unit + sidesEach) * item.quantity;
              const currentPrice = Number(item.menuItem.price);
              const originalPrice = item.originalUnitPrice != null ? Number(item.originalUnitPrice) : unit;
              const discounted = (item.discountPercent ?? 0) > 0 && originalPrice !== unit;
              const category = item.menuItem.category ? CATEGORY_META[item.menuItem.category]?.label : undefined;
              return (
                <div key={item.id} style={{ display: 'flex', gap: 12, padding: 10, border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md, 10px)' }}>
                  {item.menuItem.image ? (
                    <img src={item.menuItem.image} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package size={18} color="var(--gray-400)" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{item.quantity} × {item.menuItem.name}</span>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{naira(lineTotal)}</span>
                    </div>
                    <div style={{ color: 'var(--gray-500)', fontSize: 12, marginTop: 2 }}>
                      {[item.menuItem.vendor?.name, category, item.requiresPackaging ? 'Needs pack' : null].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ color: 'var(--gray-500)', fontSize: 12, marginTop: 4 }}>
                      {naira(unit)} each
                      {discounted && (
                        <>
                          {' '}<span style={{ textDecoration: 'line-through', color: 'var(--gray-400)' }}>{naira(originalPrice)}</span>
                          {' '}<span className="badge badge-red" style={{ fontSize: 10 }}>-{item.discountPercent}%</span>
                        </>
                      )}
                      {currentPrice !== originalPrice && (
                        <span style={{ color: 'var(--gray-400)' }}> (menu price now {naira(currentPrice)})</span>
                      )}
                    </div>
                    {item.sides.length > 0 && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: 16, color: 'var(--gray-600)', fontSize: 12 }}>
                        {item.sides.map(sd => (
                          <li key={sd.id}>+ {sd.name} {Number(sd.price) > 0 ? `(${naira(Number(sd.price))} each)` : '(free)'}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Charges" icon={<Receipt size={13} />}>
          {discountTotal > 0 && <Row label="Items before discount">{naira(itemsSubtotal + discountTotal)}</Row>}
          {discountTotal > 0 && <Row label="Discount"><span style={{ color: '#b91c1c' }}>−{naira(discountTotal)}</span></Row>}
          <Row label="Items">{naira(itemsSubtotal)}</Row>
          {sidesSubtotal > 0 && <Row label="Sides">{naira(sidesSubtotal)}</Row>}
          <Row label={`Takeaway packs (${packCount})`}>{naira(packagingFee)}</Row>
          <Row label="Delivery">{naira(deliveryFee)}</Row>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, paddingTop: 8, marginTop: 6, borderTop: '1px solid var(--gray-100)' }}>
            <span>Total</span><span style={{ color: 'var(--primary)' }}>{naira(total)}</span>
          </div>
        </Section>

        <Section title="Payment" icon={<CreditCard size={13} />}>
          {/* Bank transfer is no longer offered; older orders may still carry it. */}
          <Row label="Method">{order.paymentMethod === 'BANK_TRANSFER' ? 'Bank transfer (old)' : 'Flutterwave'}</Row>
          <Row label="Status">
            <span className={`badge ${order.paid ? 'badge-green' : 'badge-gray'}`}>{order.paid ? 'Paid' : 'Unpaid'}</span>
          </Row>
          {order.paymentRef && <Row label="Payment ref" mono copyValue={order.paymentRef}>{order.paymentRef}</Row>}
          {order.transferReference && <Row label="Transfer note" mono copyValue={order.transferReference}>{order.transferReference}</Row>}
        </Section>

        <Section title="Record" icon={<Hash size={13} />}>
          <Row label="Order ID" mono copyValue={order.id}>{order.id}</Row>
          <Row label="Reference" mono copyValue={order.reference}>{order.reference}</Row>
        </Section>
      </aside>
    </div>
  );
}
