import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './setup';

const JWT_SECRET = process.env.JWT_SECRET!;

interface CreateDesignerOptions {
  email?: string;
  password?: string;
  fullName?: string;
  businessName?: string;
  status?: 'pending_review' | 'approved' | 'rejected' | 'suspended';
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

interface CreateClientOptions {
  designerId: string;
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * Create a designer directly in the database (bypasses signup validation).
 * Returns the designer record + a valid JWT access token.
 */
export async function createTestDesigner(options: CreateDesignerOptions = {}) {
  const {
    email = `designer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password = 'TestPassword123!',
    fullName = 'Test Designer',
    businessName = 'Test Studio',
    status = 'approved',
    isAdmin = false,
    isSuperAdmin = false,
  } = options;

  const passwordHash = await bcrypt.hash(password, 10);

  const designer = await prisma.designer.create({
    data: {
      email,
      passwordHash,
      fullName,
      businessName,
      status,
      isAdmin,
      isSuperAdmin,
    },
  });

  const accessToken = jwt.sign(
    { id: designer.id, role: isAdmin ? 'admin' : 'designer' },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' },
  );

  return { designer, accessToken, password };
}

/**
 * Create an admin user. Shorthand for createTestDesigner with isAdmin: true.
 */
export async function createTestAdmin(options: Omit<CreateDesignerOptions, 'isAdmin'> = {}) {
  return createTestDesigner({ ...options, isAdmin: true, status: 'approved' });
}

/**
 * Create a super admin user.
 */
export async function createTestSuperAdmin(options: Omit<CreateDesignerOptions, 'isAdmin' | 'isSuperAdmin'> = {}) {
  return createTestDesigner({ ...options, isAdmin: true, isSuperAdmin: true, status: 'approved' });
}

/**
 * Create a client directly in the database.
 */
export async function createTestClient(options: CreateClientOptions) {
  const {
    designerId,
    name = 'Test Client',
    email = `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    phone = '555-0100',
  } = options;

  return prisma.client.create({
    data: { designerId, name, email, phone },
  });
}

/**
 * Generate a JWT for an arbitrary user ID and role (useful for edge cases).
 */
export function generateToken(
  id: string,
  role: 'designer' | 'admin' | 'client',
  expiresIn = '15m',
) {
  return jwt.sign({ id, role }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn,
  });
}

/**
 * Generate an expired token (for testing 401 responses).
 */
export function generateExpiredToken(id: string, role: 'designer' | 'admin' | 'client') {
  return jwt.sign({ id, role }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '0s',
  });
}
