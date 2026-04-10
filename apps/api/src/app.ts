import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import logger from './config/logger';
import { logRouteError } from './services/errorLogger';
import authRouter from './routes/auth';
import clientsRouter from './routes/clients';
import portalRouter from './routes/portal';
import projectsRouter from './routes/projects';
import catalogRouter from './routes/catalog';
import ordersRouter from './routes/orders';
import adminRouter from './routes/admin';
import paymentsRouter from './routes/payments';
import { furnitureCategoriesRouter, adminFurnitureCategoriesRouter } from './routes/furnitureCategories';
import sessionsRouter from './routes/sessions';
import comparisonsRouter from './routes/comparisons';
import quotesRouter from './routes/quotes';
import pdfRouter from './routes/pdf';
import notificationsRouter from './routes/notifications';
import { stripeWebhookHandler, githubWebhookHandler } from './routes/webhooks';
import { addProjectListener, emitProjectEvent } from './services/projectEvents';
import { addDesignerListener } from './services/designerEvents';
import { addAdminListener } from './services/adminEvents';
import { setOnline, setOffline } from './services/messageService';
import { getUnreadCount, notifyProjectDesigner } from './services/notificationService';
import { getAdminUnreadCount } from './services/adminNotificationService';
import { requireAuth, requireRole, AuthRequest } from './middleware/auth';


export function createApp() {
  const app = express();
  const configuredOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedOrigins = new Set<string>([configuredOrigin]);

  // In production, allow both apex + www variants to avoid CORS failures when users
  // hit either hostname (e.g. https://tradeliv.design and https://www.tradeliv.design).
  try {
    const parsed = new URL(configuredOrigin);
    if (!parsed.hostname.startsWith('www.')) {
      const withWww = new URL(configuredOrigin);
      withWww.hostname = `www.${parsed.hostname}`;
      allowedOrigins.add(withWww.toString().replace(/\/$/, ''));
    } else {
      const withoutWww = new URL(configuredOrigin);
      withoutWww.hostname = parsed.hostname.replace(/^www\./, '');
      allowedOrigins.add(withoutWww.toString().replace(/\/$/, ''));
    }
  } catch {
    // Ignore malformed FRONTEND_URL and fall back to the configured value only.
  }

  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header), and configured browser origins.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));
  app.use(cookieParser());

  // Stripe webhook needs raw body — must be BEFORE express.json()
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);
  // GitHub webhook signature is calculated against the raw body.
  app.post('/api/webhooks/github', express.raw({ type: 'application/json' }), githubWebhookHandler);

  app.use(express.json({ limit: '1mb' }));

  // CSRF mitigation: require X-Requested-With header on state-changing requests.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.path.startsWith('/api/webhooks/')) return next();
      if (!req.headers['x-requested-with']) {
        res.status(403).json({ error: 'Missing required X-Requested-With header.' });
        return;
      }
    }
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      logger.info('http', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ip: req.ip,
      });
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'furnlo-api' });
  });

  // Auth endpoints: stricter limit to prevent brute force
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in 15 minutes.' },
  });

  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  });

  const portalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });

  app.use('/api/auth/admin/login', adminLoginLimiter);
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/portal', portalLimiter, portalRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/furniture-categories', furnitureCategoriesRouter);
  app.use('/api/admin/furniture-categories', adminFurnitureCategoriesRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/comparisons', comparisonsRouter);
  app.use('/api/quotes', quotesRouter);
  app.use('/api/projects', pdfRouter);
  app.use('/api/notifications', notificationsRouter);

  /* ─── SSE: real-time designer notifications ───────── */
  app.get('/api/notifications/stream', requireAuth, requireRole('designer'), async (req: AuthRequest, res) => {
    const designerId = req.user!.id;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(':\n\n');
    const count = await getUnreadCount(designerId);
    res.write(`event: unread_count\ndata: ${JSON.stringify({ count })}\n\n`);
    addDesignerListener(designerId, res);
  });

  /* ─── SSE: real-time admin notifications ─────────── */
  app.get('/api/admin/notifications/stream', requireAuth, requireRole('admin'), async (_req: AuthRequest, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(':\n\n');
    const count = await getAdminUnreadCount();
    res.write(`event: admin_unread_count\ndata: ${JSON.stringify({ count })}\n\n`);
    addAdminListener(res);
  });

  /* ─── SSE: real-time project events ───────────────── */
  app.get('/api/projects/:projectId/events', (req, res) => {
    const projectId = req.params.projectId;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(':\n\n');
    setOnline(projectId, 'designer');
    emitProjectEvent(projectId, 'presence', { actorType: 'designer', online: true });
    addProjectListener(projectId, res);
    res.on('close', () => {
      setOffline(projectId, 'designer');
      emitProjectEvent(projectId, 'presence', { actorType: 'designer', online: false });
    });
  });

  /* ─── SSE: portal events (public, by portalToken) ── */
  const portalSSEConnections = new Map<string, number>();
  const MAX_PORTAL_SSE_PER_TOKEN = 3;
  const PORTAL_SSE_KEEPALIVE_MS = 30_000;
  const PORTAL_SSE_TIMEOUT_MS = 30 * 60_000;

  app.get('/api/portal/:portalToken/events', async (req, res) => {
    const { prisma } = await import('@furnlo/db');
    const portalToken = req.params.portalToken;
    const project = await prisma.project.findUnique({
      where: { portalToken },
      select: { id: true },
    });
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const current = portalSSEConnections.get(portalToken) ?? 0;
    if (current >= MAX_PORTAL_SSE_PER_TOKEN) {
      res.status(429).json({ error: 'Too many open connections. Please close other tabs.' });
      return;
    }
    portalSSEConnections.set(portalToken, current + 1);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(':\n\n');

    const keepalive = setInterval(() => { res.write(':\n\n'); }, PORTAL_SSE_KEEPALIVE_MS);
    const timeout = setTimeout(() => { res.end(); }, PORTAL_SSE_TIMEOUT_MS);

    setOnline(project.id, 'client');
    emitProjectEvent(project.id, 'presence', { actorType: 'client', online: true });
    addProjectListener(project.id, res);

    notifyProjectDesigner(
      project.id, 'client_portal_view',
      'Your client is viewing the portal',
    ).catch(() => {});

    res.on('close', () => {
      clearInterval(keepalive);
      clearTimeout(timeout);
      const count = portalSSEConnections.get(portalToken) ?? 1;
      if (count <= 1) portalSSEConnections.delete(portalToken);
      else portalSSEConnections.set(portalToken, count - 1);
      setOffline(project.id, 'client');
      emitProjectEvent(project.id, 'presence', { actorType: 'client', online: false });
    });
  });

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error(err.message, { stack: err.stack });
    logRouteError('global-error-handler', err, req as any);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
