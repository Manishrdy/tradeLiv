import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '@furnlo/db';
import { config } from '../config';
import { writeAuditLog } from '../services/auditLog';
import logger from '../config/logger';

const stripe = new Stripe(config.stripeSecretKey);

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  if (!sig) { res.status(400).json({ error: 'Missing stripe-signature header.' }); return; }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (err: any) {
    logger.warn('Stripe webhook signature verification failed', { error: err.message });
    res.status(400).json({ error: `Webhook signature verification failed.` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (!orderId) { logger.warn('Stripe webhook: no orderId in metadata'); break; }

        // Update payment record
        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: {
            status: 'paid',
            stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            paymentMethod: session.payment_method_types?.[0] ?? 'card',
            stripeResponse: event.data.object as any,
          },
        });

        // Update order status to paid
        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'paid',
            stripePaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
          },
        });

        writeAuditLog({
          actorType: 'system',
          action: 'payment_received',
          entityType: 'project',
          entityId: order.projectId,
          payload: {
            orderId,
            amount: session.amount_total,
            currency: session.currency,
            stripeSessionId: session.id,
            paymentIntent: session.payment_intent,
          },
        });

        logger.info(`Payment received for order ${orderId}`, { sessionId: session.id });
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: { status: 'expired' },
        });
        logger.info(`Checkout session expired`, { sessionId: session.id });
        break;
      }

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook processing error', { err, eventType: event.type });
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
}
