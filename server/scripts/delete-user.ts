import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const EMAIL = 'gideon.buba@nrs.gov.ng';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.log('User not found:', EMAIL);
    return;
  }
  await prisma.orderItem.deleteMany({ where: { order: { userId: user.id } } });
  await prisma.order.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Deleted:', EMAIL);
}

main().catch(console.error).finally(() => prisma.$disconnect());
