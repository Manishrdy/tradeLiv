import { writeAuditLog } from './auditLog';

/**
 * Lightweight comparison event logger.
 * Async, non-blocking — never slows down the comparison view.
 */

type ComparisonEvent =
  | 'comparison_started'
  | 'comparison_product_added'
  | 'comparison_product_removed'
  | 'comparison_pin_changed'
  | 'recommendation_generated'
  | 'recommendation_accepted'
  | 'recommendation_edited'
  | 'recommendation_discarded'
  | 'product_shortlisted_from_comparison'
  | 'product_rejected_from_comparison';

export function logComparisonEvent(
  event: ComparisonEvent,
  designerId: string,
  payload: Record<string, unknown>,
): void {
  // Fire-and-forget — don't await
  writeAuditLog({
    actorType: 'designer',
    actorId: designerId,
    action: event,
    entityType: 'comparison',
    entityId: (payload.comparisonId as string) || (payload.comparison_id as string) || undefined,
    payload,
  }).catch(() => {
    // Silently swallow — audit logging must never break the flow
  });
}
