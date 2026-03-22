import { PrismaClient } from './generated/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@tradeliv.design';
  const password = 'Qwerty123$';
  const fullName = 'Super Admin';

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
