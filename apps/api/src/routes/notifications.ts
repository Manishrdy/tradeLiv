import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { getNotifications, markRead, markAllRead, getUnreadCount } from '../services/notificationService';
import { registerUuidValidation } from '../middleware/validateParams';

const router = Router();
router.use(requireAuth, requireRole('designer'));
registerUuidValidation(router);

/* ─── GET /api/notifications ─────────────────────────── */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { unread, limit, cursor } = req.query;
    const notifications = await getNotifications(req.user!.id, {
      unreadOnly: unread === 'true',
      limit: limit ? Math.min(Number(limit), 100) : 50,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/* ─── GET /api/notifications/unread ──────────────────── */
router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const count = await getUnreadCount(req.user!.id);
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/* ─── PUT /api/notifications/read-all ────────────────── */
router.put('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const count = await markAllRead(req.user!.id);
    res.json({ marked: count });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

/* ─── PUT /api/notifications/:id/read ────────────────── */
router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await markRead(req.params.id, req.user!.id);
    if (updated === 0) {
      res.status(404).json({ error: 'Notification not found or already read' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

export default router;
