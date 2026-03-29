import dotenv from 'dotenv';
import path from 'path';

// Load .env before anything else in each test worker
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

// Force dev database
const useDb = (process.env.USE_DB || 'dev').toLowerCase();
if (useDb === 'prod') {
  throw new Error('Refusing to run tests against production database.');
}
process.env.DATABASE_URL = process.env.DEV_DATABASE_URL;

// Ensure JWT_SECRET is set for auth middleware
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long!!';
}

import { prisma } from '@furnlo/db';

/**
 * Truncate all tables in the correct order (respecting FK constraints).
 * Uses TRUNCATE CASCADE so we don't need to worry about ordering.
 */
export async function cleanDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "QuoteComment",
      "QuoteLineItem",
      "Quote",
      "Payment",
      "OrderLineItem",
      "BrandPurchaseOrder",
      "Order",
      "CartItem",
      "ShortlistItem",
      "PinnedComparison",
      "Message",
      "Notification",
      "AdminNotification",
      "AuditLog",
      "Room",
      "Product",
      "Project",
      "Client",
      "DesignerSession",
      "RefreshToken",
      "Designer",
      "FurnitureCategory",
      "PlatformConfig"
    CASCADE
  `);
}

/**
 * Disconnect Prisma after all tests in a suite are done.
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

export { prisma };
