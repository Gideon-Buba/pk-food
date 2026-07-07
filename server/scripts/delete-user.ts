import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const EMAILS = [
  'olumuyiwa.sobowale@nrs.gov.ng',
  'victor.onogu@nrs.gov.ng',
  'linda.adole@nrs.gov.ng',
  'Philip.Friday@nrs.gov.ng',
  'gideon.buba@nrs.gov.ng',
];

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: EMAILS } } });

  if (users.length === 0) {
    console.log('No matching users found.');
    return;
  }

  const userIds = users.map(u => u.id);

  await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log(`Deleted ${users.length} user(s):`);
  users.forEach(u => console.log(' -', u.email));

  const notFound = EMAILS.filter(e => !users.find(u => u.email === e));
  if (notFound.length) {
    console.log('Not found in DB:');
    notFound.forEach(e => console.log(' -', e));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
