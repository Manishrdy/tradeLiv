import { Router, Response } from 'express';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth);
router.use(requireRole('designer'));

function paramId(req: { params: { id?: string | string[] } }): string | undefined {
  const v = req.params.id;
  return typeof v === 'string' ? v : v?.[0];
}

/* POST /api/sessions/start */
router.post('/start', async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.designerSession.create({
      data: {
        designerId: req.user!.id,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
    res.status(201).json({ sessionId: session.id });
  } catch (err) {
    logger.error('session start error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* PUT /api/sessions/:id/heartbeat */
router.put('/:id/heartbeat', async (req: AuthRequest, res: Response) => {
  try {
    const sid = paramId(req);
    if (!sid) {
      res.status(400).json({ error: 'Invalid session id' });
      return;
    }
    const updated = await prisma.designerSession.updateMany({
      where: { id: sid, designerId: req.user!.id, endedAt: null },
      data: { lastPing: new Date() },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('session heartbeat error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* PUT /api/sessions/:id/end */
router.put('/:id/end', async (req: AuthRequest, res: Response) => {
  try {
    const sid = paramId(req);
    if (!sid) {
      res.status(400).json({ error: 'Invalid session id' });
      return;
    }
    const session = await prisma.designerSession.findFirst({
      where: { id: sid, designerId: req.user!.id, endedAt: null },
    });
    if (!session) {
      res.json({ ok: true });
      return;
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - session.startedAt.getTime();

    await prisma.designerSession.update({
      where: { id: session.id },
      data: { endedAt, durationMs },
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('session end error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
