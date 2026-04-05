import { PrismaClient } from './generated/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@tradeliv.design';
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_SEED_PASSWORD env var is required. Set it before running the seed.');
  }
  const fullName = process.env.ADMIN_SEED_NAME ?? 'Super Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.designer.upsert({
    where: { email },
    update: { isAdmin: true, isSuperAdmin: true, status: 'approved' },
    create: {
      email,
      passwordHash,
      fullName,
      isAdmin: true,
      isSuperAdmin: true,
      status: 'approved',
    },
  });

  console.log(`Super admin seeded: ${admin.email} (id: ${admin.id})`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
