// Fills a LOCAL database with ~5 months of realistic-looking orders so dashboards have something to show.
// Run after the main seed:  npm run seed:demo-orders   (from server/)
// Refuses to run unless DATABASE_URL points at localhost.
import { Floor, OrderStatus, PaymentMethod, Prisma, PrismaClient, Role } from '@prisma/client';
import * as dotenv from 'dotenv';
import { generateOrderReference } from '../src/orders/order-reference.util';
import { applyDiscount } from '../src/menu/discount.util';

dotenv.config();

const url = process.env['DATABASE_URL'] ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to seed demo orders: DATABASE_URL is not a localhost database.');
  process.exit(1);
}

const prisma = new PrismaClient();

const DAYS = 150;
const DELIVERY_FEE = 300;
const PACK_FEE = 50;
const FLOORS: Floor[] = ['GF', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
const WINGS = ['A', 'B', 'C'];
const FIRST_NAMES = ['Amaka', 'Tunde', 'Ngozi', 'Ibrahim', 'Funke', 'Chidi', 'Zainab', 'Emeka', 'Bisi', 'Musa', 'Kemi', 'Obinna', 'Halima', 'Segun', 'Ada', 'Yusuf', 'Tolu', 'Ifeoma', 'Bola', 'Sani'];

// Deterministic PRNG so every run produces the same data.
let seed = 42;
const rand = (): number => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

// Lunch-heavy hour distribution (Lagos time).
const HOUR_WEIGHTS: [number, number][] = [[8, 2], [9, 4], [10, 6], [11, 10], [12, 18], [13, 20], [14, 12], [15, 7], [16, 4], [17, 2]];
const pickHour = (): number => {
  const total = HOUR_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [h, w] of HOUR_WEIGHTS) { if ((r -= w) < 0) return h; }
  return 13;
};

async function main(): Promise<void> {
  const menuItems = await prisma.menuItem.findMany();
  if (menuItems.length === 0) throw new Error('No menu items. Run `npx prisma db seed` first.');

  // A handful of discounted items so discount reporting has data.
  const discounted = menuItems.slice(0, 4);
  await Promise.all(discounted.map((m, i) =>
    prisma.menuItem.update({ where: { id: m.id }, data: { discountPercent: [10, 15, 20, 25][i] } })));
  const discountOf = new Map(discounted.map((m, i) => [m.id, [10, 15, 20, 25][i]]));

  const users = await Promise.all(FIRST_NAMES.map((name, i) => prisma.user.upsert({
    where: { email: `demo${i + 1}@example.com` },
    update: {},
    create: {
      email: `demo${i + 1}@example.com`, name: `${name} Demo`, role: Role.STAFF, emailVerified: true,
      phone: `080${String(10000000 + i * 7919).slice(0, 8)}`, floor: pick(FLOORS), officeNumber: pick(WINGS),
    },
  })));

  // Popular items get picked more often.
  const weighted = menuItems.flatMap((m, i) => Array<typeof m>(i % 7 === 0 ? 6 : i % 3 === 0 ? 3 : 1).fill(m));

  const now = new Date();
  let created = 0;
  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(now.getTime() - d * 86400000);
    const dow = day.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const growth = 1 + (DAYS - d) / DAYS; // business picks up over time
    const count = isWeekend ? between(0, 2) : Math.round(between(2, 6) * growth);

    for (let n = 0; n < count; n++) {
      const user = pick(users);
      // Lagos is UTC+1.
      const createdAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), pickHour() - 1, between(0, 59), between(0, 59)));
      if (createdAt > now) continue;

      const lines = Array.from({ length: between(1, 3) }, () => pick(weighted));
      const unique = [...new Map(lines.map(m => [m.id, m])).values()];
      const recent = d <= 30;
      const items = unique.map(m => {
        const price = m.price.toNumber();
        const pct = recent ? discountOf.get(m.id) ?? 0 : 0;
        return {
          menuItemId: m.id,
          quantity: rand() < 0.8 ? 1 : 2,
          unitPrice: applyDiscount(price, pct),
          originalUnitPrice: price,
          discountPercent: pct,
          requiresPackaging: m.requiresPackaging,
        };
      });
      const packs = items.reduce((s, i) => s + (i.requiresPackaging ? i.quantity : 0), 0);

      const roll = rand();
      const paid = roll < 0.86;
      const status: OrderStatus = !paid
        ? (rand() < 0.6 ? OrderStatus.CANCELLED : OrderStatus.PENDING)
        : d === 0 ? pick([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED])
          : rand() < 0.04 ? OrderStatus.CANCELLED : OrderStatus.DELIVERED;

      const data: Prisma.OrderCreateInput = {
        reference: generateOrderReference(),
        user: { connect: { id: user.id } },
        floor: user.floor ?? 'GF',
        officeNumber: user.officeNumber ?? 'A',
        phone: user.phone ?? '08000000000',
        deliveryFee: DELIVERY_FEE,
        packagingFee: packs * PACK_FEE,
        status,
        paid,
        paymentMethod: PaymentMethod.FLUTTERWAVE,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + between(10, 45) * 60000),
        items: { create: items },
      };
      await prisma.order.create({ data });
      created++;
    }
  }
  console.log(`Created ${created} demo orders over the last ${DAYS} days for ${users.length} demo customers.`);
}

main().finally(() => prisma.$disconnect());
