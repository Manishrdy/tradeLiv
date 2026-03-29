import { request, authRequest } from './helpers/app';
import { cleanDatabase, disconnectDatabase, prisma } from './helpers/setup';
import { createTestDesigner, createTestAdmin, createTestClient, generateExpiredToken } from './helpers/auth';
import { createTestProject, createTestRoom, createTestProduct } from './helpers/factories';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});

/* ─── Database connection ──────────────────────────── */

describe('Test infrastructure', () => {
  it('connects to the dev database', async () => {
    const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;
    expect(result[0].now).toBeInstanceOf(Date);
  });

  it('cleanDatabase() truncates all tables', async () => {
    await createTestDesigner();
    const before = await prisma.designer.count();
    expect(before).toBeGreaterThan(0);

    await cleanDatabase();
    const after = await prisma.designer.count();
    expect(after).toBe(0);
  });
});

/* ─── App + supertest ──────────────────────────────── */

describe('Express app', () => {
  it('GET /health returns ok', async () => {
    const res = await request().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'furnlo-api' });
  });

  it('rejects state-changing requests without X-Requested-With', async () => {
    const res = await request().post('/api/auth/login').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/X-Requested-With/);
  });
});

/* ─── Auth helpers ─────────────────────────────────── */

describe('Auth helpers', () => {
  it('createTestDesigner() creates a designer with valid token', async () => {
    const { designer, accessToken } = await createTestDesigner();
    expect(designer.id).toBeDefined();
    expect(designer.email).toContain('@test.com');
    expect(accessToken).toBeDefined();

    // Token works for authenticated endpoints
    const res = await authRequest(accessToken).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(designer.id);
  });

  it('createTestAdmin() creates an admin that passes requireRole("admin")', async () => {
    const { designer, accessToken } = await createTestAdmin();
    expect(designer.isAdmin).toBe(true);

    const res = await authRequest(accessToken).get('/api/admin/me');
    expect(res.status).toBe(200);
  });

  it('expired tokens return 401', async () => {
    const { designer } = await createTestDesigner();
    const expiredToken = generateExpiredToken(designer.id, 'designer');

    const res = await authRequest(expiredToken).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

/* ─── Factory helpers ──────────────────────────────── */

describe('Factory helpers', () => {
  it('creates a full project hierarchy (designer → client → project → room → product)', async () => {
    const { designer } = await createTestDesigner();
    const client = await createTestClient({ designerId: designer.id });
    const project = await createTestProject({ designerId: designer.id, clientId: client.id });
    const room = await createTestRoom({ projectId: project.id });
    const product = await createTestProduct({ designerId: designer.id });

    expect(client.designerId).toBe(designer.id);
    expect(project.designerId).toBe(designer.id);
    expect(project.clientId).toBe(client.id);
    expect(room.projectId).toBe(project.id);
    expect(product.designerId).toBe(designer.id);
  });
});
