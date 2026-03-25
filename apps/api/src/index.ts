import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import logger from './config/logger';
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
import { stripeWebhookHandler } from './routes/webhooks';
import { addProjectListener, emitProjectEvent } from './services/projectEvents';
import { setOnline, setOffline, purgeExpiredMessages } from './services/messageService';

const app = express();
const PORT = process.env.API_PORT ?? 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(cookieParser());

// Stripe webhook needs raw body — must be BEFORE express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '1mb' }));

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
});
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/portal', portalRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/furniture-categories', furnitureCategoriesRouter);
app.use('/api/admin/furniture-categories', adminFurnitureCategoriesRouter);
app.use('/api/sessions', sessionsRouter);

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
app.get('/api/portal/:portalToken/events', async (req, res) => {
  const { prisma } = await import('@furnlo/db');
  const project = await prisma.project.findUnique({
    where: { portalToken: req.params.portalToken },
    select: { id: true },
  });
  if (!project) { res.status(404).json({ error: 'Not found' }); return; }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(':\n\n');

  setOnline(project.id, 'client');
  emitProjectEvent(project.id, 'presence', { actorType: 'client', online: true });
  addProjectListener(project.id, res);

  res.on('close', () => {
    setOffline(project.id, 'client');
    emitProjectEvent(project.id, 'presence', { actorType: 'client', online: false });
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Tradeliv API running on port ${PORT}`);

  // Run message TTL cleanup every 6 hours
  purgeExpiredMessages().catch(() => {});
  setInterval(() => purgeExpiredMessages().catch(() => {}), 6 * 60 * 60 * 1000);
});

export default app;
