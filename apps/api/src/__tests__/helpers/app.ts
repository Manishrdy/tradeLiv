import './setup'; // must be first — loads .env and sets DATABASE_URL
import supertest from 'supertest';
import { createApp } from '../../app';

/**
 * Shared Express app instance for tests.
 * Uses createApp() without calling listen() — no port conflicts.
 */
const app = createApp();

/**
 * Pre-configured supertest agent.
 * Automatically includes the X-Requested-With header required by CSRF middleware.
 */
export function request() {
  return supertest(app);
}

/**
 * Helper to make authenticated requests.
 * Pass the session cookie value (JWT access token).
 */
export function authRequest(sessionCookie: string) {
  const agent = supertest(app);
  // Return a proxy that adds cookie + CSRF header to every request
  return {
    get: (url: string) =>
      agent.get(url).set('Cookie', `session=${sessionCookie}`),
    post: (url: string) =>
      agent.post(url)
        .set('Cookie', `session=${sessionCookie}`)
        .set('X-Requested-With', 'XMLHttpRequest'),
    put: (url: string) =>
      agent.put(url)
        .set('Cookie', `session=${sessionCookie}`)
        .set('X-Requested-With', 'XMLHttpRequest'),
    delete: (url: string) =>
      agent.delete(url)
        .set('Cookie', `session=${sessionCookie}`)
        .set('X-Requested-With', 'XMLHttpRequest'),
  };
}

export { app };
