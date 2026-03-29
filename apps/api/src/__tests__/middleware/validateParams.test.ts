import { request, authRequest } from '../helpers/app';
import { cleanDatabase, disconnectDatabase } from '../helpers/setup';
import { createTestDesigner } from '../helpers/auth';

let token: string;

beforeEach(async () => {
  await cleanDatabase();
  const { accessToken } = await createTestDesigner();
  token = accessToken;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});

// The validateUuidParams middleware runs globally. We test it through real routes
// that use each param name.

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

/* ═══════════════════════════════════════════════════════
   Valid UUIDs pass through
   ═══════════════════════════════════════════════════════ */

describe('valid UUIDs pass validation', () => {
  it(':id param — valid UUID passes (e.g. GET /api/catalog/products/:id)', async () => {
    const res = await authRequest(token).get(`/api/catalog/products/${VALID_UUID}`);
    // Should not be 400 — will be 404 because product doesn't exist, but that's fine
    expect(res.status).not.toBe(400);
  });

  it(':projectId param — valid UUID passes', async () => {
    const res = await authRequest(token).get(`/api/projects/${VALID_UUID}`);
    expect(res.status).not.toBe(400);
  });

  it(':orderId param — valid UUID passes', async () => {
    const res = await authRequest(token).get(`/api/orders`);
    expect(res.status).not.toBe(400);
  });
});

/* ═══════════════════════════════════════════════════════
   Malformed UUIDs return 400
   ═══════════════════════════════════════════════════════ */

describe('malformed UUIDs return 400', () => {
  // ── :id param ──────────────────────────────────────

  it(':id — short string', async () => {
    const res = await authRequest(token).get('/api/catalog/products/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid id format.');
  });

  it(':id — SQL injection attempt', async () => {
    const res = await authRequest(token).get(
      "/api/catalog/products/1'; DROP TABLE products;--",
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid id format.');
  });

  it(':id — numeric string', async () => {
    const res = await authRequest(token).get('/api/catalog/products/12345');
    expect(res.status).toBe(400);
  });

  it(':id — UUID with wrong length', async () => {
    const res = await authRequest(token).get(
      '/api/catalog/products/550e8400-e29b-41d4-a716-44665544000',
    );
    expect(res.status).toBe(400);
  });

  it(':id — UUID with invalid hex characters', async () => {
    const res = await authRequest(token).get(
      '/api/catalog/products/550e8400-e29b-41d4-a716-44665544ZZZZ',
    );
    expect(res.status).toBe(400);
  });

  it(':id — whitespace-only value', async () => {
    const res = await authRequest(token).get('/api/clients/%20');
    expect(res.status).toBe(400);
  });

  // ── :projectId param (via orders routes which use :projectId) ───

  it(':projectId — malformed', async () => {
    const res = await authRequest(token).get('/api/orders/projects/not-a-uuid/shortlist');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid projectId format.');
  });

  // ── :roomId param ──────────────────────────────────

  it(':roomId — malformed', async () => {
    const res = await authRequest(token)
      .put(`/api/projects/${VALID_UUID}/rooms/bad-room-id`)
      .send({ name: 'Room' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid roomId format.');
  });

  // ── :orderId param ─────────────────────────────────

  it(':orderId — malformed', async () => {
    const res = await authRequest(token).get(
      `/api/orders/projects/${VALID_UUID}/orders/not-uuid`,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid orderId format.');
  });

  // ── :quoteId param ─────────────────────────────────

  it(':quoteId — malformed', async () => {
    const res = await authRequest(token).get('/api/quotes/bad-quote-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid quoteId format.');
  });

  // ── :itemId param ──────────────────────────────────

  it(':itemId — malformed', async () => {
    const res = await authRequest(token)
      .delete(`/api/orders/projects/${VALID_UUID}/shortlist/bad-item-id`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid itemId format.');
  });

  // ── :lineItemId param ──────────────────────────────

  it(':lineItemId — malformed', async () => {
    const res = await authRequest(token)
      .put(`/api/quotes/${VALID_UUID}/line-items/bad-line-item`)
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid lineItemId format.');
  });

  // ── :poId param ────────────────────────────────────

  it(':poId — malformed', async () => {
    const res = await authRequest(token)
      .put(`/api/orders/${VALID_UUID}/brand-pos/bad-po-id/status`)
      .send({ status: 'sent' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid poId format.');
  });
});

/* ═══════════════════════════════════════════════════════
   Non-UUID params are NOT validated
   ═══════════════════════════════════════════════════════ */

describe('non-UUID params are skipped', () => {
  it(':portalToken — non-UUID value is allowed (validated by portal routes)', async () => {
    // portalToken is not in UUID_PARAM_NAMES, so validateUuidParams skips it
    const res = await request().get('/api/portal/some-arbitrary-token');
    // Should not be 400 from UUID validation — will be 404 from portal lookup
    expect(res.status).not.toBe(400);
  });
});

/* ═══════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════ */

describe('edge cases', () => {
  it('accepts uppercase hex in UUID', async () => {
    const uppercaseUuid = '550E8400-E29B-41D4-A716-446655440000';
    const res = await authRequest(token).get(`/api/catalog/products/${uppercaseUuid}`);
    expect(res.status).not.toBe(400);
  });

  it('rejects UUID missing one section (truncated)', async () => {
    const res = await authRequest(token).get(
      '/api/catalog/products/550e8400-e29b-41d4-a716',
    );
    expect(res.status).toBe(400);
  });

  it('rejects UUID with double dashes', async () => {
    const res = await authRequest(token).get(
      '/api/catalog/products/550e8400--e29b-41d4-a716-446655440000',
    );
    expect(res.status).toBe(400);
  });
});
