import { Router, Response } from 'express';
import { prisma } from '@furnlo/db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth);

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
    await prisma.designerSession.updateMany({
      where: { id: req.params.id, designerId: req.user!.id, endedAt: null },
      data: { lastPing: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error('session heartbeat error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* PUT /api/sessions/:id/end */
router.put('/:id/end', async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.designerSession.findFirst({
      where: { id: req.params.id, designerId: req.user!.id, endedAt: null },
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
