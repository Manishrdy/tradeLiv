import { request, authRequest } from '../helpers/app';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup';
import {
  createTestDesigner,
  createTestAdmin,
  createTestSuperAdmin,
  generateToken,
  generateExpiredToken,
} from '../helpers/auth';
import crypto from 'crypto';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});

// We test middleware through /api/auth/me (requireAuth) and /api/admin/me (requireRole('admin'))
// since middleware is not exported as standalone testable units — it's applied on routes.

/* ═══════════════════════════════════════════════════════
   requireAuth
   ═══════════════════════════════════════════════════════ */

describe('requireAuth', () => {
  /* ── Token delivery methods ─────────────────────────── */

  describe('token from cookie', () => {
    it('accepts a valid session cookie', async () => {
      const { designer, accessToken } = await createTestDesigner();
      const res = await request()
        .get('/api/auth/me')
        .set('Cookie', `session=${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(designer.id);
    });
  });

  describe('token from Authorization header', () => {
    it('accepts a valid Bearer token', async () => {
      const { designer, accessToken } = await createTestDesigner();
      const res = await request()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(designer.id);
    });

    it('rejects malformed Authorization header (no Bearer prefix)', async () => {
      const { accessToken } = await createTestDesigner();
      const res = await request()
        .get('/api/auth/me')
        .set('Authorization', accessToken);
      expect(res.status).toBe(401);
    });

    it('rejects "Bearer " with empty token', async () => {
      const res = await request()
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
    });

    it('rejects "Bearer  " with only spaces', async () => {
      const res = await request()
        .get('/api/auth/me')
        .set('Authorization', 'Bearer    ');
      expect(res.status).toBe(401);
    });
  });

  /* ── Missing token ──────────────────────────────────── */

  describe('missing token', () => {
    it('returns 401 when no cookie and no header', async () => {
      const res = await request().get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  /* ── Expired token ──────────────────────────────────── */

  describe('expired token', () => {
    it('returns 401 for an expired JWT', async () => {
      const { designer } = await createTestDesigner();
      const expired = generateExpiredToken(designer.id, 'designer');
      const res = await request()
        .get('/api/auth/me')
        .set('Cookie', `session=${expired}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired session');
    });
  });

  /* ── Invalid token ──────────────────────────────────── */

  describe('invalid token', () => {
    it('returns 401 for a completely bogus string', async () => {
      const res = await request()
        .get('/api/auth/me')
        .set('Cookie', 'session=not-a-real-jwt');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a JWT signed with a different secret', async () => {
      const { designer } = await createTestDesigner();
      const wrongToken = require('jsonwebtoken').sign(
        { id: designer.id, role: 'designer' },
        'wrong-secret-that-is-at-least-32-characters-long!!',
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const res = await request()
        .get('/api/auth/me')
        .set('Cookie', `session=${wrongToken}`);
      expect(res.status).toBe(401);
    });
  });

  /* ── Payload validation (zod schema) ────────────────── */

  describe('payload validation', () => {
    it('rejects a token with missing id field', async () => {
      const token = require('jsonwebtoken').sign(
        { role: 'designer' },
        process.env.JWT_SECRET!,
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const res = await request()
        .get('/api/auth/me')
        .set('Cookie', `session=${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects a token with non-UUID id', async () => {
      const token = require('jsonwebtoken').sign(
        { id: 'not-a-uuid', role: 'designer' },
        process.env.JWT_SECRET!,
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const res = await request()
        .get('/api/auth/me')
        .set('Cookie', `session=${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects a token with invalid role', async () => {
      const token = require('jsonwebtoken').sign(
        { id: crypto.randomUUID(), role: 'superuser' },
        process.env.JWT_SECRET!,
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const res = await request()
        .get('/api/auth/me')
        .set('Cookie', `session=${token}`);
      expect(res.status).toBe(401);
    });
  });
});

/* ═══════════════════════════════════════════════════════
   requireRole
   ═══════════════════════════════════════════════════════ */

describe('requireRole', () => {
  /* ── Designer role ──────────────────────────────────── */

  describe('designer role', () => {
    it('allows a designer to access designer-only routes', async () => {
      const { accessToken } = await createTestDesigner();
      // /api/clients requires designer role
      const res = await authRequest(accessToken).get('/api/clients');
      expect(res.status).toBe(200);
    });

    it('forbids a designer from accessing admin routes', async () => {
      const { accessToken } = await createTestDesigner();
      const res = await authRequest(accessToken).get('/api/admin/me');
      expect(res.status).toBe(403);
    });
  });

  /* ── Admin role ─────────────────────────────────────── */

  describe('admin role', () => {
    it('allows an admin to access admin routes', async () => {
      const { accessToken } = await createTestAdmin();
      const res = await authRequest(accessToken).get('/api/admin/me');
      expect(res.status).toBe(200);
    });

    it('verifies admin status in DB — revoked admin gets 403', async () => {
      const { designer, accessToken } = await createTestAdmin();

      // Revoke admin in DB while JWT still carries role:'admin'
      await prisma.designer.update({
        where: { id: designer.id },
        data: { isAdmin: false },
      });

      const res = await authRequest(accessToken).get('/api/admin/me');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access has been revoked.');
    });

    it('returns 403 if admin user is deleted from DB', async () => {
      const { designer, accessToken } = await createTestAdmin();

      // Delete the designer entirely
      await prisma.designer.delete({ where: { id: designer.id } });

      const res = await authRequest(accessToken).get('/api/admin/me');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access has been revoked.');
    });
  });

  /* ── Token with mismatched role ─────────────────────── */

  describe('role mismatch', () => {
    it('forbids a client-role token from accessing designer routes', async () => {
      const { designer } = await createTestDesigner();
      const clientToken = generateToken(designer.id, 'client');
      const res = await authRequest(clientToken).get('/api/projects');
      expect(res.status).toBe(403);
    });

    it('forbids an admin-role token (forged) when user is not admin in DB', async () => {
      const { designer } = await createTestDesigner(); // isAdmin: false
      const forgedAdminToken = generateToken(designer.id, 'admin');
      const res = await authRequest(forgedAdminToken).get('/api/admin/me');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access has been revoked.');
    });
  });
});

/* ═══════════════════════════════════════════════════════
   requireSuperAdmin
   ═══════════════════════════════════════════════════════ */

describe('requireSuperAdmin', () => {
  it('allows a super admin to access super-admin-only endpoints', async () => {
    const { accessToken } = await createTestSuperAdmin();
    // POST /api/admin/admins is super-admin only
    const res = await authRequest(accessToken)
      .post('/api/admin/admins')
      .send({ email: 'new-admin@test.com' });
    // May return 400 for missing fields, but NOT 403 — proving auth passed
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('forbids a regular admin from super-admin endpoints', async () => {
    const { accessToken } = await createTestAdmin();
    const res = await authRequest(accessToken)
      .post('/api/admin/admins')
      .send({ email: 'new-admin@test.com' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Super admin access required.');
  });

  it('forbids a designer from super-admin endpoints', async () => {
    const { accessToken } = await createTestDesigner();
    const res = await authRequest(accessToken)
      .post('/api/admin/admins')
      .send({ email: 'new-admin@test.com' });
    expect(res.status).toBe(403);
  });

  it('returns 403 if super-admin flag is revoked in DB', async () => {
    const { designer, accessToken } = await createTestSuperAdmin();

    await prisma.designer.update({
      where: { id: designer.id },
      data: { isSuperAdmin: false },
    });

    const res = await authRequest(accessToken)
      .post('/api/admin/admins')
      .send({ email: 'new-admin@test.com' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Super admin access required.');
  });
});

/* ═══════════════════════════════════════════════════════
   CSRF middleware (X-Requested-With)
   ═══════════════════════════════════════════════════════ */

describe('CSRF middleware', () => {
  it('rejects POST without X-Requested-With header', async () => {
    const { accessToken } = await createTestDesigner();
    const res = await request()
      .post('/api/clients')
      .set('Cookie', `session=${accessToken}`)
      .send({ name: 'Test' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/X-Requested-With/);
  });

  it('rejects PUT without X-Requested-With header', async () => {
    const { accessToken } = await createTestDesigner();
    const res = await request()
      .put('/api/auth/me')
      .set('Cookie', `session=${accessToken}`)
      .send({ fullName: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('rejects DELETE without X-Requested-With header', async () => {
    const { accessToken } = await createTestDesigner();
    const res = await request()
      .delete('/api/clients/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `session=${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('allows GET requests without X-Requested-With', async () => {
    const res = await request().get('/health');
    expect(res.status).toBe(200);
  });

  it('allows POST with X-Requested-With header', async () => {
    const { accessToken } = await createTestDesigner();
    const res = await request()
      .post('/api/clients')
      .set('Cookie', `session=${accessToken}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'Test Client' });
    // Should pass CSRF check (may fail on validation, but not 403)
    expect(res.status).not.toBe(403);
  });
});
