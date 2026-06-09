import { PrismaClient, Role } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=480&h=320&fit=crop&auto=format&q=80`;

async function main(): Promise<void> {
  console.log('Seeding database...');

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.announcement.deleteMany();

  // Test users — dev login only
  await Promise.all([
    prisma.user.upsert({
      where: { email: 'staff@nrs.gov.ng' },
      update: { role: Role.STAFF },
      create: { email: 'staff@nrs.gov.ng', role: Role.STAFF },
    }),
    prisma.user.upsert({
      where: { email: 'admin@nrs.gov.ng' },
      update: { role: Role.ADMIN },
      create: { email: 'admin@nrs.gov.ng', role: Role.ADMIN },
    }),
    prisma.user.upsert({
      where: { email: 'runner@nrs.gov.ng' },
      update: { role: Role.RUNNER },
      create: { email: 'runner@nrs.gov.ng', role: Role.RUNNER },
    }),
  ]);
  console.log('Test users: staff@nrs.gov.ng | admin@nrs.gov.ng | runner@nrs.gov.ng');

  const [canteen, snacks, bar] = await Promise.all([
    prisma.vendor.create({ data: { name: 'PK Canteen' } }),
    prisma.vendor.create({ data: { name: 'Snack Corner' } }),
    prisma.vendor.create({ data: { name: 'Fresh Bar' } }),
  ]);

  await prisma.menuItem.createMany({
    data: [
      // ── PK Canteen ─────────────────────────────────────────────
      {
        name: 'Jollof Rice + Chicken',
        price: 800,
        vendorId: canteen.id,
        totalStock: 50,
        onlineStock: 50,
        image: img('1604329760661-03067f6b1e00'),
      },
      {
        name: 'Jollof Rice + Fish',
        price: 700,
        vendorId: canteen.id,
        totalStock: 50,
        onlineStock: 50,
        image: img('1512058564366-18510be2db19'),
      },
      {
        name: 'Fried Rice + Beef',
        price: 850,
        vendorId: canteen.id,
        totalStock: 40,
        onlineStock: 40,
        image: img('1603360946369-dc9bb6258143'),
      },
      {
        name: 'White Rice + Stew + Fish',
        price: 650,
        vendorId: canteen.id,
        totalStock: 60,
        onlineStock: 60,
        image: img('1546069901-ba9599a7e63c'),
      },
      {
        name: 'Egusi Soup + Eba',
        price: 600,
        vendorId: canteen.id,
        totalStock: 30,
        onlineStock: 30,
        image: img('1547592180-85f173990554'),
      },
      {
        name: 'Okra Soup + Pounded Yam',
        price: 700,
        vendorId: canteen.id,
        totalStock: 30,
        onlineStock: 30,
        image: img('1476224203421-9ac39bcb3327'),
      },
      {
        name: 'Goat Meat Pepper Soup',
        price: 950,
        vendorId: canteen.id,
        totalStock: 20,
        onlineStock: 20,
        image: img('1530469912745-a215c6b256ea'),
      },
      {
        name: 'Fried Chicken (2 pcs)',
        price: 700,
        vendorId: canteen.id,
        totalStock: 35,
        onlineStock: 35,
        image: img('1562967914-608f82629710'),
      },
      {
        name: 'Beans + Plantain',
        price: 500,
        vendorId: canteen.id,
        totalStock: 40,
        onlineStock: 40,
        image: img('1585937421612-70a008356fbe'),
      },
      {
        name: 'Yam + Egg Sauce',
        price: 450,
        vendorId: canteen.id,
        totalStock: 35,
        onlineStock: 35,
        image: img('1490645935967-10de6ba17061'),
      },

      // ── Snack Corner ───────────────────────────────────────────
      {
        name: 'Beef Suya (3 sticks)',
        price: 500,
        vendorId: snacks.id,
        totalStock: 60,
        onlineStock: 60,
        image: img('1544025162-d76538925058'),
      },
      {
        name: 'Chicken Suya (3 sticks)',
        price: 600,
        vendorId: snacks.id,
        totalStock: 40,
        onlineStock: 40,
        image: img('1555126634-323283e090fa'),
      },
      {
        name: 'Beef Shawarma',
        price: 800,
        vendorId: snacks.id,
        totalStock: 25,
        onlineStock: 25,
        image: img('1529193591184-b1d58069ecdd'),
      },
      {
        name: 'Grilled Chicken Burger',
        price: 750,
        vendorId: snacks.id,
        totalStock: 20,
        onlineStock: 20,
        image: img('1568901346375-23c9450c58cd'),
      },
      {
        name: 'Spring Rolls (4 pcs)',
        price: 300,
        vendorId: snacks.id,
        totalStock: 80,
        onlineStock: 80,
        image: img('1563245372-f21724e3856d'),
      },
      {
        name: 'Moi Moi (2 wraps)',
        price: 250,
        vendorId: snacks.id,
        totalStock: 50,
        onlineStock: 50,
        image: img('1504674900247-0877df9cc836'),
      },
      {
        name: 'Akara (5 pcs)',
        price: 200,
        vendorId: snacks.id,
        totalStock: 60,
        onlineStock: 60,
        image: img('1567620905732-2d1ec7ab7445'),
      },
      {
        name: 'Fried Plantain (Dodo)',
        price: 250,
        vendorId: snacks.id,
        totalStock: 50,
        onlineStock: 50,
        image: img('1587132137056-bfbf0166836e'),
      },
      {
        name: 'Scotch Egg (2 pcs)',
        price: 200,
        vendorId: snacks.id,
        totalStock: 40,
        onlineStock: 40,
        image: img('1482049016688-2d3e1b311543'),
      },

      // ── Fresh Bar ──────────────────────────────────────────────
      {
        name: 'Zobo Drink (50cl)',
        price: 150,
        vendorId: bar.id,
        totalStock: 100,
        onlineStock: 100,
        image: img('1600271886742-f049cd451bba'),
      },
      {
        name: 'Chapman (50cl)',
        price: 350,
        vendorId: bar.id,
        totalStock: 50,
        onlineStock: 50,
        image: img('1625772299848-391b6a87d7b3'),
      },
      {
        name: 'Malta Guinness (33cl)',
        price: 300,
        vendorId: bar.id,
        totalStock: 80,
        onlineStock: 80,
        image: img('1608270586636-c4f8e56b29f3'),
      },
      {
        name: 'Coke (60cl)',
        price: 200,
        vendorId: bar.id,
        totalStock: 100,
        onlineStock: 100,
        image: img('1622483767028-3f9952cf1917'),
      },
      {
        name: 'Bottled Water (75cl)',
        price: 100,
        vendorId: bar.id,
        totalStock: 200,
        onlineStock: 200,
        image: img('1548839140-29a749e1cf4d'),
      },
      {
        name: 'Fresh Orange Juice',
        price: 400,
        vendorId: bar.id,
        totalStock: 30,
        onlineStock: 30,
        image: img('1534353436294-0dbd4bdac845'),
      },
      {
        name: 'Chin Chin (100g pack)',
        price: 150,
        vendorId: bar.id,
        totalStock: 100,
        onlineStock: 100,
        image: img('1599490659213-e2b9527bd087'),
      },
    ],
  });

  await prisma.announcement.createMany({
    data: [
      {
        type: 'STATUS',
        message: '🟢 Canteen open — last orders by 2:00 PM daily.',
        active: true,
      },
      {
        type: 'GENERAL',
        message: '🎉 Free delivery on all orders this week!',
        active: true,
      },
    ],
  });

  const count = await prisma.menuItem.count();
  console.log(`Done — ${count} menu items seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
