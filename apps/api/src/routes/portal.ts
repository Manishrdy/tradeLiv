import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';

const router = Router();

// GET /api/portal/:portalToken
// Public — no auth. Returns full project data safe for client view.
// designerNotes is NEVER included (enforced via explicit select).
router.get('/:portalToken', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { portalToken: req.params.portalToken },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        designer: {
          select: {
            fullName: true,
            businessName: true,
            phone: true,
            email: true,
          },
        },
        client: {
          select: {
            name: true,
            shippingAddress: true,
          },
        },
        rooms: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            areaSqft: true,
            lengthFt: true,
            widthFt: true,
            shortlistItems: {
              select: {
                id: true,
                status: true,
                selectedVariant: true,
                sharedNotes: true,
                clientNotes: true,
                // designerNotes intentionally omitted
                product: {
                  select: {
                    id: true,
                    productName: true,
                    brandName: true,
                    price: true,
                    imageUrl: true,
                    productUrl: true,
                    dimensions: true,
                    material: true,
                  },
                },
              },
            },
          },
        },
        orders: {
          where: {
            status: { in: ['submitted', 'paid', 'split_to_brands', 'closed'] },
          },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Portal link not found or has been removed.' });
      return;
    }

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

const reviewSchema = z.object({
  clientNotes: z.string().optional(),
  status: z.enum(['suggested', 'approved', 'rejected']).optional(),
});

// PUT /api/portal/:portalToken/shortlist/:itemId
// Public — client updates their own notes or approves/rejects an item.
router.put('/:portalToken/shortlist/:itemId', async (req: Request, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { clientNotes, status } = parsed.data;

  if (clientNotes === undefined && status === undefined) {
    res.status(400).json({ error: 'Nothing to update.' });
    return;
  }

  try {
    // Verify the item belongs to the project identified by this portalToken
    const item = await prisma.shortlistItem.findFirst({
      where: {
        id: req.params.itemId,
        project: { portalToken: req.params.portalToken },
      },
      select: { id: true },
    });

    if (!item) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }

    const updated = await prisma.shortlistItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(clientNotes !== undefined && { clientNotes }),
        ...(status !== undefined && { status }),
      },
      select: {
        id: true,
        status: true,
        clientNotes: true,
        sharedNotes: true,
        selectedVariant: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
