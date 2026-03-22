import { Router, Response } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { config } from '../config';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('designer'));

const stripe = new Stripe(config.stripeSecretKey);

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const checkoutSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

/* ─── POST /api/payments/create-checkout-session ─────── */

router.post('/create-checkout-session', async (req: AuthRequest, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, designerId: req.user!.id },
      include: {
        lineItems: {
          include: {
            product: { select: { id: true, productName: true, brandName: true, imageUrl: true } },
          },
        },
        project: { select: { id: true, name: true } },
      },
    });

    if (!order) { res.status(404).json({ error: 'Order not found.' }); return; }

    if (order.status !== 'draft' && order.status !== 'submitted') {
      res.status(400).json({ error: `Cannot pay for an order with status "${order.status}".` }); return;
    }

    // Build Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.lineItems.map((li) => {
      const unitAmount = Math.round(Number(li.unitPrice ?? 0) * 100); // cents
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: li.product.productName,
            ...(li.product.brandName ? { description: li.product.brandName } : {}),
            ...(li.product.imageUrl ? { images: [li.product.imageUrl] } : {}),
          },
          unit_amount: unitAmount,
        },
        quantity: li.quantity,
      };
    });

    const totalAmount = Number(order.totalAmount ?? 0);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      metadata: {
        orderId: order.id,
        projectId: order.projectId,
        designerId: req.user!.id,
      },
      payment_intent_data: {
        metadata: { orderId: order.id },
      },
      success_url: `${config.frontendUrl}/projects/${order.projectId}/orders/${order.id}?payment=success`,
      cancel_url: `${config.frontendUrl}/projects/${order.projectId}/orders/${order.id}?payment=cancelled`,
    });

    // Create Payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        stripeSessionId: session.id,
        amount: totalAmount,
        currency: 'usd',
        status: 'pending',
      },
    });

    // Link session to order
    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentId: session.id },
    });

    res.json({ sessionUrl: session.url });
  } catch (err) {
    logger.error('payments route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
});

/* ─── GET /api/payments/order/:orderId ────────────────── */

router.get('/order/:orderId', async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { orderId: req.params.orderId, order: { designerId: req.user!.id } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(payments.map((p) => ({
      ...p,
      amount: toNum(p.amount),
    })));
  } catch (err) {
    logger.error('payments route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
