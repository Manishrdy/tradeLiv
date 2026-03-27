import { prisma, ActorType } from '@furnlo/db';

/* ─── Types ────────────────────────────────────────────── */

export interface QuoteCommentPayload {
  quoteId: string;
  senderType: ActorType;
  senderId?: string;
  senderName: string;
  text: string;
  lineItemId?: string;
}

/* ─── CRUD ─────────────────────────────────────────────── */

export async function createQuoteComment(payload: QuoteCommentPayload) {
  return prisma.quoteComment.create({ data: payload });
}

export async function getQuoteComments(quoteId: string, after?: string, limit = 100) {
  return prisma.quoteComment.findMany({
    where: {
      quoteId,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export async function markQuoteCommentsRead(quoteId: string, readerType: 'designer' | 'client') {
  const senderType: ActorType = readerType === 'designer' ? 'client' : 'designer';
  const result = await prisma.quoteComment.updateMany({
    where: { quoteId, senderType, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function getQuoteCommentUnreadCount(quoteId: string, readerType: 'designer' | 'client') {
  const senderType: ActorType = readerType === 'designer' ? 'client' : 'designer';
  return prisma.quoteComment.count({
    where: { quoteId, senderType, readAt: null },
  });
}
