import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, TrendingDown, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { MenuItem, Order, Vendor } from '../types';
import { CATEGORY_META } from '../constants/categories';

// ── Dates ──────────────────────────────────────────────────────────────────
// Everything is bucketed by Lagos calendar day ("YYYY-MM-DD") so the numbers match what staff see.

const TZ = 'Africa/Lagos';
const lagosDay = (iso: string | Date): string => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const lagosHour = (iso: string): number =>
  Number(new Date(iso).toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));

// Pure calendar arithmetic on "YYYY-MM-DD" strings (no timezone involved).
const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const mondayOf = (day: string): string => {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, dow === 0 ? -6 : 1 - dow);
};
const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-NG', { timeZone: 'UTC', ...opts });

type Preset = '7d' | '30d' | '90d' | 'month' | 'year' | 'all' | 'custom';
const PRESETS: { id: Preset; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

// ── Money ──────────────────────────────────────────────────────────────────

const naira = (n: number): string => `₦${Math.round(n).toLocaleString()}`;
const nairaShort = (n: number): string =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${n}`;

const sidesEach = (i: Order['items'][number]): number => i.sides.reduce((s, sd) => s + Number(sd.price), 0);
const itemsValue = (o: Order): number => o.items.reduce((s, i) => s + (Number(i.unitPrice) + sidesEach(i)) * i.quantity, 0);
const feesValue = (o: Order): number => Number(o.deliveryFee) + Number(o.packagingFee ?? 0);
const orderTotal = (o: Order): number => itemsValue(o) + feesValue(o);
const discountValue = (o: Order): number => o.items.reduce(
  (s, i) => s + (i.originalUnitPrice != null ? (Number(i.originalUnitPrice) - Number(i.unitPrice)) * i.quantity : 0), 0,
);

// ── Styling ────────────────────────────────────────────────────────────────

const INK = '#374151';
const MUTED = '#9ca3af';
const BRAND = '#2d6a4f';
const tooltipStyle = { borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' };
const STATUS_COLORS = { Delivered: '#16a34a', Active: '#3b82f6', Pending: '#f59e0b', Cancelled: '#ef4444' } as const;

function ChartCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card" style={{ padding: 20, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>{title}</p>
          {subtitle && <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ children = 'No paid orders in this period' }: { children?: ReactNode }) {
  return <p style={{ fontSize: 13, color: MUTED, padding: '24px 0', textAlign: 'center', margin: 0 }}>{children}</p>;
}

function Delta({ current, previous, label }: { current: number; previous: number | null; label: string }) {
  if (previous === null) return <span>{label}</span>;
  if (previous === 0) return <span>{current > 0 ? `New vs ${label}` : `No change vs ${label}`}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} color={up ? '#16a34a' : '#dc2626'} aria-hidden />
      <span style={{ fontWeight: 600, color: INK }}>{up ? '+' : ''}{pct}%</span> vs {label}
    </span>
  );
}

// ── Item table ─────────────────────────────────────────────────────────────

interface ItemRow {
  id: string;
  name: string;
  vendorId: string;
  vendorName: string;
  category: string;
  units: number;
  orders: number;
  revenue: number;
  discount: number;
  share: number;
}
type SortKey = 'name' | 'vendorName' | 'category' | 'units' | 'orders' | 'revenue' | 'share';

interface RevenuePanelProps {
  orders: Order[];
  menuItems: MenuItem[];
  vendors: Vendor[];
}

export default function RevenuePanel({ orders, menuItems, vendors }: RevenuePanelProps) {
  const today = lagosDay(new Date());
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState(addDays(today, -29));
  const [customTo, setCustomTo] = useState(today);
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'orders'>('revenue');

  const [itemSearch, setItemSearch] = useState('');
  const [itemVendor, setItemVendor] = useState('');
  const [includeUnsold, setIncludeUnsold] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [itemPage, setItemPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const firstOrderDay = useMemo(
    () => orders.reduce((min, o) => { const d = lagosDay(o.createdAt); return d < min ? d : min; }, today),
    [orders, today],
  );

  // Selected range [from, to] inclusive, and the equally long period just before it.
  const { from, to } = useMemo(() => {
    switch (preset) {
      case '7d': return { from: addDays(today, -6), to: today };
      case '30d': return { from: addDays(today, -29), to: today };
      case '90d': return { from: addDays(today, -89), to: today };
      case 'month': return { from: `${today.slice(0, 8)}01`, to: today };
      case 'year': return { from: `${today.slice(0, 5)}01-01`, to: today };
      case 'all': return { from: firstOrderDay, to: today };
      case 'custom': return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
    }
  }, [preset, today, firstOrderDay, customFrom, customTo]);
  const spanDays = daysBetween(from, to) + 1;
  const prevFrom = addDays(from, -spanDays);
  const prevTo = addDays(from, -1);
  const comparable = preset !== 'all';
  const periodLabel = preset === 'month' ? 'same days last month' : `previous ${spanDays} day${spanDays === 1 ? '' : 's'}`;

  const inRange = (o: Order, a: string, b: string): boolean => { const d = lagosDay(o.createdAt); return d >= a && d <= b; };
  const periodOrders = useMemo(() => orders.filter(o => inRange(o, from, to)), [orders, from, to]);
  const paid = periodOrders.filter(o => o.paid);
  const prevPaid = comparable ? orders.filter(o => o.paid && inRange(o, prevFrom, prevTo)) : [];

  // ── KPIs ──
  const revenue = paid.reduce((s, o) => s + orderTotal(o), 0);
  const prevRevenue = prevPaid.reduce((s, o) => s + orderTotal(o), 0);
  const foodSales = paid.reduce((s, o) => s + itemsValue(o), 0);
  const fees = paid.reduce((s, o) => s + feesValue(o), 0);
  const avgOrder = paid.length ? revenue / paid.length : 0;
  const prevAvg = prevPaid.length ? prevRevenue / prevPaid.length : 0;
  const discounts = paid.reduce((s, o) => s + discountValue(o), 0);
  const discountedOrders = paid.filter(o => discountValue(o) > 0).length;
  const customers = new Set(paid.map(o => o.userId)).size;
  const cancelled = periodOrders.filter(o => o.status === 'CANCELLED').length;
  const unpaid = periodOrders.length - paid.length;

  // ── Trend: daily up to ~6 weeks, weekly up to ~6 months, monthly beyond ──
  const granularity: 'day' | 'week' | 'month' = spanDays <= 45 ? 'day' : spanDays <= 186 ? 'week' : 'month';
  const trend = useMemo(() => {
    const bucketOf = (day: string): string =>
      granularity === 'day' ? day : granularity === 'week' ? mondayOf(day) : day.slice(0, 7);
    const buckets = new Map<string, { key: string; label: string; revenue: number; orders: number }>();
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const key = bucketOf(d);
      if (!buckets.has(key)) {
        const label = granularity === 'day'
          ? fmtDay(key, { day: 'numeric', month: 'short' })
          : granularity === 'week'
            ? `Wk of ${fmtDay(key, { day: 'numeric', month: 'short' })}`
            : fmtDay(`${key}-01`, { month: 'short', year: 'numeric' });
        buckets.set(key, { key, label, revenue: 0, orders: 0 });
      }
    }
    for (const o of paid) {
      const b = buckets.get(bucketOf(lagosDay(o.createdAt)));
      if (b) { b.revenue += orderTotal(o); b.orders += 1; }
    }
    return [...buckets.values()];
  }, [paid, from, to, granularity]);
  const bestBucket = trend.reduce<(typeof trend)[number] | null>((best, b) => (b.revenue > (best?.revenue ?? 0) ? b : best), null);

  // ── Peak hours ──
  const hours = useMemo(() => {
    const counts = new Map<number, number>();
    for (const o of paid) { const h = lagosHour(o.createdAt); counts.set(h, (counts.get(h) ?? 0) + 1); }
    if (counts.size === 0) return [];
    const seen = [...counts.keys()];
    const lo = Math.min(...seen), hi = Math.max(...seen);
    return Array.from({ length: hi - lo + 1 }, (_, i) => {
      const h = lo + i;
      return { label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`, orders: counts.get(h) ?? 0 };
    });
  }, [paid]);
  const peakHour = hours.reduce<(typeof hours)[number] | null>((best, h) => (h.orders > (best?.orders ?? 0) ? h : best), null);

  // ── Vendors ──
  const vendorRows = useMemo(() => {
    const m = new Map<string, { name: string; revenue: number; units: number }>();
    for (const o of paid) for (const i of o.items) {
      const id = i.menuItem.vendorId;
      const row = m.get(id) ?? { name: i.menuItem.vendor?.name ?? 'Unknown', revenue: 0, units: 0 };
      row.revenue += (Number(i.unitPrice) + sidesEach(i)) * i.quantity;
      row.units += i.quantity;
      m.set(id, row);
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  }, [paid]);

  // ── Status mix (all orders in the period, paid or not) ──
  const statusData = useMemo(() => {
    const count = (pred: (o: Order) => boolean) => periodOrders.filter(pred).length;
    return [
      { name: 'Delivered', value: count(o => o.status === 'DELIVERED') },
      { name: 'Active', value: count(o => ['CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT'].includes(o.status)) },
      { name: 'Pending', value: count(o => o.status === 'PENDING') },
      { name: 'Cancelled', value: count(o => o.status === 'CANCELLED') },
    ].filter(d => d.value > 0);
  }, [periodOrders]);

  // ── Items ──
  const itemRows = useMemo<ItemRow[]>(() => {
    const m = new Map<string, ItemRow>();
    const blank = (mi: MenuItem): ItemRow => ({
      id: mi.id, name: mi.name, vendorId: mi.vendorId, vendorName: mi.vendor?.name ?? 'Unknown',
      category: mi.category ? CATEGORY_META[mi.category]?.label ?? mi.category : '—',
      units: 0, orders: 0, revenue: 0, discount: 0, share: 0,
    });
    if (includeUnsold) for (const mi of menuItems) m.set(mi.id, blank(mi));
    for (const o of paid) {
      const seenInOrder = new Set<string>();
      for (const i of o.items) {
        const row = m.get(i.menuItem.id) ?? blank(i.menuItem);
        row.units += i.quantity;
        row.revenue += Number(i.unitPrice) * i.quantity;
        if (i.originalUnitPrice != null) row.discount += (Number(i.originalUnitPrice) - Number(i.unitPrice)) * i.quantity;
        if (!seenInOrder.has(i.menuItem.id)) { row.orders += 1; seenInOrder.add(i.menuItem.id); }
        m.set(i.menuItem.id, row);
      }
    }
    const total = [...m.values()].reduce((s, r) => s + r.revenue, 0);
    return [...m.values()].map(r => ({ ...r, share: total ? (r.revenue / total) * 100 : 0 }));
  }, [paid, menuItems, includeUnsold]);

  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const rows = itemRows.filter(r =>
      (!q || r.name.toLowerCase().includes(q)) && (!itemVendor || r.vendorId === itemVendor));
    const dir = sortDir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return cmp * dir || b.revenue - a.revenue;
    });
  }, [itemRows, itemSearch, itemVendor, sortKey, sortDir]);
  const itemPageCount = Math.max(1, Math.ceil(visibleItems.length / ITEMS_PER_PAGE));
  const currentItemPage = Math.min(itemPage, itemPageCount);
  const pagedItems = visibleItems.slice((currentItemPage - 1) * ITEMS_PER_PAGE, currentItemPage * ITEMS_PER_PAGE);
  const rankOf = useMemo(() => {
    const ranked = [...itemRows].filter(r => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
    return new Map(ranked.map((r, i) => [r.id, i + 1]));
  }, [itemRows]);

  const toggleSort = (key: SortKey) => {
    setItemPage(1);
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'vendorName' || key === 'category' ? 'asc' : 'desc'); }
  };

  const exportCsv = () => {
    const header = ['Rank', 'Item', 'Vendor', 'Category', 'Units sold', 'Orders', 'Revenue (NGN)', 'Discount given (NGN)', 'Share of item revenue (%)'];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = visibleItems.map(r => [
      rankOf.get(r.id) ?? '', r.name, r.vendorName, r.category, r.units, r.orders, Math.round(r.revenue), Math.round(r.discount), r.share.toFixed(1),
    ].map(esc).join(','));
    const blob = new Blob([[header.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pk-food-items_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ k, children, align }: { k: SortKey; children: ReactNode; align?: 'right' }) => {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th style={{ textAlign: align }} aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit' }}
        >
          {children}<Icon size={11} style={{ opacity: sortKey === k ? 1 : 0.35 }} />
        </button>
      </th>
    );
  };

  const kpis: { label: string; value: string; sub: ReactNode }[] = [
    { label: 'Revenue', value: naira(revenue), sub: <Delta current={revenue} previous={comparable ? prevRevenue : null} label={comparable ? periodLabel : 'since first order'} /> },
    { label: 'Paid orders', value: paid.length.toLocaleString(), sub: <Delta current={paid.length} previous={comparable ? prevPaid.length : null} label={comparable ? periodLabel : `${customers} customers`} /> },
    { label: 'Avg order value', value: naira(avgOrder), sub: <Delta current={avgOrder} previous={comparable ? prevAvg : null} label={comparable ? periodLabel : 'per paid order'} /> },
    { label: 'Food sales', value: naira(foodSales), sub: `+ ${naira(fees)} delivery & pack fees` },
    { label: 'Discounts given', value: naira(discounts), sub: `on ${discountedOrders} paid order${discountedOrders === 1 ? '' : 's'}` },
    { label: 'Unpaid / cancelled', value: `${unpaid} / ${cancelled}`, sub: periodOrders.length ? `of ${periodOrders.length} orders placed` : 'no orders placed' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Period picker — every number and chart below follows it */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div role="tablist" aria-label="Period" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--gray-100)', borderRadius: 10, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              role="tab"
              aria-selected={preset === p.id}
              type="button"
              onClick={() => { setPreset(p.id); setItemPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                fontWeight: preset === p.id ? 700 : 500,
                background: preset === p.id ? '#fff' : 'transparent',
                color: preset === p.id ? INK : '#6b7280',
                boxShadow: preset === p.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input className="input" type="date" value={customFrom} max={today} onChange={e => e.target.value && setCustomFrom(e.target.value)} style={{ width: 150 }} aria-label="From" />
            <span style={{ fontSize: 12, color: MUTED }}>to</span>
            <input className="input" type="date" value={customTo} max={today} onChange={e => e.target.value && setCustomTo(e.target.value)} style={{ width: 150 }} aria-label="To" />
          </div>
        )}
        <span style={{ fontSize: 12, color: MUTED, marginLeft: 'auto' }}>
          {fmtDay(from, { day: 'numeric', month: 'short', year: 'numeric' })} – {fmtDay(to, { day: 'numeric', month: 'short', year: 'numeric' })} · Lagos time · paid orders
        </span>
      </div>

      {/* KPIs */}
      <div className="admin-four-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{k.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px' }}>{k.value}</p>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Trend */}
      <ChartCard
        title={trendMetric === 'revenue' ? 'Revenue over time' : 'Paid orders over time'}
        subtitle={`By ${granularity}${bestBucket ? ` · best ${granularity}: ${bestBucket.label} (${naira(bestBucket.revenue)})` : ''}`}
        action={
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--gray-100)', borderRadius: 8 }}>
            {(['revenue', 'orders'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setTrendMetric(m)}
                aria-pressed={trendMetric === m}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: trendMetric === m ? '#fff' : 'transparent', color: trendMetric === m ? INK : '#6b7280' }}
              >
                {m === 'revenue' ? 'Revenue' : 'Orders'}
              </button>
            ))}
          </div>
        }
      >
        {paid.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUTED }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis
                axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUTED }} width={58} allowDecimals={false}
                tickFormatter={v => (trendMetric === 'revenue' ? nairaShort(Number(v)) : String(v))}
              />
              <Tooltip
                formatter={(v: unknown) => (trendMetric === 'revenue'
                  ? [naira(Number(v)), 'Revenue']
                  : [String(v), 'Paid orders']) as [string, string]}
                contentStyle={tooltipStyle}
                cursor={{ stroke: BRAND, strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area
                isAnimationActive={false}
                type="monotone" dataKey={trendMetric} stroke={BRAND} strokeWidth={2} fill="url(#trendGrad)"
                dot={trend.length <= 31 ? { fill: BRAND, r: 3, strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: BRAND, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="admin-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Vendors */}
        <ChartCard title="Revenue by vendor" subtitle="Items and sides, excluding fees">
          {vendorRows.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={Math.max(vendorRows.length * 40 + 24, 120)}>
              <BarChart data={vendorRows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUTED }} tickFormatter={v => nairaShort(Number(v))} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: INK }} width={110} />
                <Tooltip
                  formatter={(v: unknown) => [naira(Number(v)), 'Revenue'] as [string, string]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(45,106,79,0.06)' }}
                />
                <Bar isAnimationActive={false} dataKey="revenue" fill={BRAND} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Peak hours */}
        <ChartCard title="Busiest hours" subtitle={peakHour ? `Most paid orders come in around ${peakHour.label}` : 'When paid orders are placed'}>
          {hours.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hours} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUTED }} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: MUTED }} width={32} allowDecimals={false} />
                <Tooltip formatter={(v: unknown) => [String(v), 'Paid orders'] as [string, string]} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(45,106,79,0.06)' }} />
                <Bar isAnimationActive={false} dataKey="orders" fill={BRAND} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Orders by status" subtitle="All orders placed in the period, paid or not">
        {statusData.length === 0 ? <Empty>No orders placed in this period</Empty> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie isAnimationActive={false} data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" nameKey="name" stroke="#fff" strokeWidth={2}>
                    {statusData.map(d => <Cell key={d.name} fill={STATUS_COLORS[d.name as keyof typeof STATUS_COLORS]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown, name: unknown) => [String(v), String(name)] as [string, string]} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {statusData.map(d => (
                <li key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, color: INK }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[d.name as keyof typeof STATUS_COLORS] }} aria-hidden />
                  <span style={{ minWidth: 80 }}>{d.name}</span>
                  <strong>{d.value}</strong>
                  <span style={{ color: MUTED }}>({Math.round((d.value / periodOrders.length) * 100)}%)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>

      {/* Every item */}
      <ChartCard
        title="Item performance"
        subtitle={`${visibleItems.length} item${visibleItems.length === 1 ? '' : 's'} · revenue is item price only (sides and fees excluded)`}
        action={
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={visibleItems.length === 0}>
            <Download size={13} /> Export CSV
          </button>
        }
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
            <input className="input" placeholder="Search items…" value={itemSearch} onChange={e => { setItemSearch(e.target.value); setItemPage(1); }} style={{ paddingLeft: 32 }} />
          </div>
          <select className="input" value={itemVendor} onChange={e => { setItemVendor(e.target.value); setItemPage(1); }} style={{ width: 170, cursor: 'pointer' }}>
            <option value="">All vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: INK, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeUnsold} onChange={e => { setIncludeUnsold(e.target.checked); setItemPage(1); }} style={{ accentColor: BRAND }} />
            Show items with no sales
          </label>
        </div>

        {visibleItems.length === 0 ? <Empty>No items match</Empty> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <SortHeader k="name">Item</SortHeader>
                    <SortHeader k="vendorName">Vendor</SortHeader>
                    <SortHeader k="category">Category</SortHeader>
                    <SortHeader k="units" align="right">Units</SortHeader>
                    <SortHeader k="orders" align="right">Orders</SortHeader>
                    <SortHeader k="revenue" align="right">Revenue</SortHeader>
                    <SortHeader k="share" align="right">Share</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map(r => (
                    <tr key={r.id}>
                      <td style={{ color: MUTED, fontSize: 12 }}>{rankOf.get(r.id) ?? '—'}</td>
                      <td style={{ fontWeight: 600 }}>
                        {r.name}
                        {r.discount > 0 && <div style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>{naira(r.discount)} discounted</div>}
                      </td>
                      <td style={{ color: '#6b7280', fontSize: 13 }}>{r.vendorName}</td>
                      <td style={{ color: '#6b7280', fontSize: 13 }}>{r.category}</td>
                      <td style={{ textAlign: 'right' }}>{r.units.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{r.orders.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: INK }}>{naira(r.revenue)}</td>
                      <td style={{ textAlign: 'right', minWidth: 110 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 56, height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }} aria-hidden>
                            <div style={{ width: `${Math.min(100, r.share)}%`, height: '100%', background: BRAND, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 38 }}>{r.share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {itemPageCount > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12, fontSize: 13, color: '#6b7280' }}>
                <span>
                  {(currentItemPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentItemPage * ITEMS_PER_PAGE, visibleItems.length)} of {visibleItems.length}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={currentItemPage <= 1} onClick={() => setItemPage(currentItemPage - 1)}>Previous</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={currentItemPage >= itemPageCount} onClick={() => setItemPage(currentItemPage + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </ChartCard>
    </div>
  );
}
