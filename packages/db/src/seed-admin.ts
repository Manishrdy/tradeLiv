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

  // Seed default platform config entries
  const configResult = await prisma.platformConfig.createMany({
    data: [
      { key: 'platform_name', value: 'tradeLiv', type: 'string', label: 'Platform Name', group: 'general', sortOrder: 0 },
      { key: 'support_email', value: 'support@tradeliv.com', type: 'string', label: 'Support Email', group: 'general', sortOrder: 1 },
      { key: 'tax_rate', value: '0.08', type: 'number', label: 'Tax Rate (%)', group: 'tax', sortOrder: 0 },
      { key: 'default_currency', value: 'usd', type: 'string', label: 'Default Currency', group: 'payment', sortOrder: 0 },
      { key: 'payment_terms_days', value: '30', type: 'number', label: 'Payment Terms (days)', group: 'payment', sortOrder: 1 },
      { key: 'commission_percentage', value: '10', type: 'number', label: 'Commission (%)', group: 'commission', sortOrder: 0 },
    ],
    skipDuplicates: true,
  });
  console.log(`Platform config seeded: ${configResult.count} new entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
