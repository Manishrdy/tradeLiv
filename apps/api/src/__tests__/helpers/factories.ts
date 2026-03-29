import { prisma } from './setup';

/* ─── Projects ──────────────────────────────────────── */

interface CreateProjectOptions {
  designerId: string;
  clientId: string;
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'ordered' | 'closed';
  budgetMin?: number;
  budgetMax?: number;
  portalToken?: string;
}

export async function createTestProject(options: CreateProjectOptions) {
  const {
    designerId,
    clientId,
    name = 'Test Project',
    description = 'A test project',
    status = 'active',
    budgetMin,
    budgetMax,
    portalToken,
  } = options;

  return prisma.project.create({
    data: {
      designerId,
      clientId,
      name,
      description,
      status,
      budgetMin,
      budgetMax,
      portalToken,
    },
  });
}

/* ─── Rooms ─────────────────────────────────────────── */

interface CreateRoomOptions {
  projectId: string;
  name?: string;
  lengthFt?: number;
  widthFt?: number;
}

export async function createTestRoom(options: CreateRoomOptions) {
  const {
    projectId,
    name = 'Living Room',
    lengthFt = 20,
    widthFt = 15,
  } = options;

  return prisma.room.create({
    data: {
      projectId,
      name,
      lengthFt,
      widthFt,
      areaSqft: lengthFt * widthFt,
    },
  });
}

/* ─── Products ──────────────────────────────────────── */

interface CreateProductOptions {
  designerId: string;
  productName?: string;
  brandName?: string;
  sourceUrl?: string;
  price?: number;
  category?: string;
}

export async function createTestProduct(options: CreateProductOptions) {
  const {
    designerId,
    productName = 'Test Sofa',
    brandName = 'West Elm',
    sourceUrl = 'https://example.com/product',
    price = 1299.99,
    category = 'Sofas',
  } = options;

  return prisma.product.create({
    data: {
      designerId,
      productName,
      brandName,
      sourceUrl,
      price,
      category,
      currency: 'USD',
      isActive: true,
    },
  });
}

/* ─── Orders ────────────────────────────────────────── */

interface CreateOrderOptions {
  projectId: string;
  designerId: string;
  status?: 'draft' | 'submitted' | 'paid' | 'split_to_brands' | 'closed';
  totalAmount?: number;
}

export async function createTestOrder(options: CreateOrderOptions) {
  const {
    projectId,
    designerId,
    status = 'draft',
    totalAmount = 5000,
  } = options;

  return prisma.order.create({
    data: {
      projectId,
      designerId,
      status,
      totalAmount,
    },
  });
}

/* ─── Quotes ────────────────────────────────────────── */

interface CreateQuoteOptions {
  projectId: string;
  designerId: string;
  status?: 'draft' | 'sent' | 'approved' | 'revision_requested' | 'expired' | 'converted';
  title?: string;
  taxRate?: number;
}

export async function createTestQuote(options: CreateQuoteOptions) {
  const {
    projectId,
    designerId,
    status = 'draft',
    title = 'Test Quote',
    taxRate = 8.25,
  } = options;

  return prisma.quote.create({
    data: {
      projectId,
      designerId,
      status,
      title,
      taxRate,
    },
  });
}

/* ─── Furniture Categories ──────────────────────────── */

export async function createTestCategory(name?: string) {
  return prisma.furnitureCategory.create({
    data: {
      name: name || `Category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      group: 'Seating',
      active: true,
    },
  });
}
