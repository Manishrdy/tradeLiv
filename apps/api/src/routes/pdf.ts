import { Router, Response } from 'express';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { generateProjectPdf, generateRoomPdf } from '../services/pdfGenerator';
import logger from '../config/logger';
import { logRouteError } from '../services/errorLogger';
import { writeAuditLog } from '../services/auditLog';

const router = Router();
router.use(requireAuth, requireRole('designer'));

/* ─── Shared select for shortlist items + product ────── */

const shortlistItemInclude = {
  product: {
    select: {
      productName: true,
      brandName: true,
      category: true,
      price: true,
      currency: true,
      activeVariant: true,
      images: true,
      imageUrl: true,
      dimensions: true,
      material: true,
      materials: true,
      finishes: true,
      features: true,
      leadTime: true,
      shipping: true,
      availability: true,
      metadata: true,
      pricing: true,
    },
  },
};

const toNum = (v: any) => (v != null ? Number(v) : null);

function mapShortlistItem(si: any) {
  return {
    ...si,
    product: {
      ...si.product,
      price: si.product.price != null ? Number(si.product.price) : null,
    },
  };
}

function mapRoom(r: any) {
  return {
    ...r,
    lengthFt: toNum(r.lengthFt),
    widthFt: toNum(r.widthFt),
    heightFt: toNum(r.heightFt),
    areaSqft: toNum(r.areaSqft),
    budgetMin: toNum(r.budgetMin),
    budgetMax: toNum(r.budgetMax),
    shortlistItems: (r.shortlistItems || []).map(mapShortlistItem),
  };
}

/* ─── GET /api/projects/:id/pdf ─────────────────────── */

router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const designerId = req.user!.id;

    const project = await prisma.project.findFirst({
      where: { id: projectId, designerId },
      include: {
        client: true,
        rooms: {
          orderBy: { createdAt: 'asc' },
          include: {
            shortlistItems: {
              orderBy: [{ isPinned: 'desc' }, { priorityRank: 'asc' }, { createdAt: 'asc' }],
              include: shortlistItemInclude,
            },
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const designer = await prisma.designer.findUnique({
      where: { id: designerId },
      select: { fullName: true, businessName: true, email: true, phone: true },
    });

    if (!designer) {
      res.status(404).json({ error: 'Designer not found.' });
      return;
    }

    const pdfData = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        budgetMin: toNum(project.budgetMin),
        budgetMax: toNum(project.budgetMax),
        stylePreference: project.stylePreference,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      designer,
      client: {
        name: project.client.name,
        email: project.client.email,
        phone: project.client.phone,
        shippingAddress: project.client.shippingAddress,
      },
      rooms: project.rooms.map(mapRoom),
    };

    const doc = generateProjectPdf(pdfData as any);
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Proposal.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    writeAuditLog({
      actorType: 'designer',
      actorId: designerId,
      action: 'project_pdf_generated',
      entityType: 'project',
      entityId: project.id,
      payload: { projectName: project.name },
    });
  } catch (err) {
    logger.error('PDF generation error', { err, path: req.path });
    logRouteError('routes/pdf.ts', err, req);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

/* ─── GET /api/projects/:id/rooms/:roomId/pdf ───────── */

router.get('/:id/rooms/:roomId/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const roomId = req.params.roomId as string;
    const designerId = req.user!.id;

    const project = await prisma.project.findFirst({
      where: { id: projectId, designerId },
      include: { client: true },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const room = await prisma.room.findFirst({
      where: { id: roomId, projectId },
      include: {
        shortlistItems: {
          orderBy: [{ isPinned: 'desc' }, { priorityRank: 'asc' }, { createdAt: 'asc' }],
          include: shortlistItemInclude,
        },
      },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    const designer = await prisma.designer.findUnique({
      where: { id: designerId },
      select: { fullName: true, businessName: true, email: true, phone: true },
    });

    if (!designer) {
      res.status(404).json({ error: 'Designer not found.' });
      return;
    }

    const pdfData = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        budgetMin: toNum(project.budgetMin),
        budgetMax: toNum(project.budgetMax),
        stylePreference: project.stylePreference,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      designer,
      client: {
        name: project.client.name,
        email: project.client.email,
        phone: project.client.phone,
        shippingAddress: project.client.shippingAddress,
      },
      room: mapRoom(room),
    };

    const doc = generateRoomPdf(pdfData as any);
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${room.name.replace(/[^a-zA-Z0-9]/g, '_')}_Spec.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    writeAuditLog({
      actorType: 'designer',
      actorId: designerId,
      action: 'room_pdf_generated',
      entityType: 'room',
      entityId: room.id,
      payload: { projectName: project.name, roomName: room.name },
    });
  } catch (err) {
    logger.error('Room PDF generation error', { err, path: req.path });
    logRouteError('routes/pdf.ts', err, req);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

export default router;
