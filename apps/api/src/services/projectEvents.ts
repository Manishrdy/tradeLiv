import { Response } from 'express';

/**
 * Simple in-process SSE event bus for project-level updates.
 * Each project ID maps to a set of connected SSE response streams.
 */

type Listener = Response;

const listeners = new Map<string, Set<Listener>>();

/** Register an SSE client for a given project */
export function addProjectListener(projectId: string, res: Listener) {
  if (!listeners.has(projectId)) listeners.set(projectId, new Set());
  listeners.get(projectId)!.add(res);

  res.on('close', () => {
    listeners.get(projectId)?.delete(res);
    if (listeners.get(projectId)?.size === 0) listeners.delete(projectId);
  });
}

/** Broadcast an event to all clients listening on a project */
export function emitProjectEvent(projectId: string, event: string, data?: Record<string, unknown>) {
  const clients = listeners.get(projectId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}
