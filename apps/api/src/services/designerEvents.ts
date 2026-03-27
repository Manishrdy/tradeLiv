import { Response } from 'express';

/**
 * In-process SSE event bus for designer-level notifications.
 * Each designer ID maps to a set of connected SSE response streams.
 * A designer may have multiple tabs/devices connected simultaneously.
 */

type Listener = Response;

const listeners = new Map<string, Set<Listener>>();

/** Register an SSE client for a given designer */
export function addDesignerListener(designerId: string, res: Listener) {
  if (!listeners.has(designerId)) listeners.set(designerId, new Set());
  listeners.get(designerId)!.add(res);

  res.on('close', () => {
    listeners.get(designerId)?.delete(res);
    if (listeners.get(designerId)?.size === 0) listeners.delete(designerId);
  });
}

/** Broadcast an event to all clients listening for a designer */
export function emitDesignerEvent(designerId: string, event: string, data?: Record<string, unknown>) {
  const clients = listeners.get(designerId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}
