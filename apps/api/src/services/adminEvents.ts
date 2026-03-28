import { Response } from 'express';

/**
 * In-process SSE event bus for admin-level notifications.
 * All admin users share a single broadcast channel.
 */

type Listener = Response;

const listeners = new Set<Listener>();

/** Register an SSE client for an admin */
export function addAdminListener(res: Listener) {
  listeners.add(res);

  const cleanup = () => { listeners.delete(res); };
  res.on('close', cleanup);
  res.on('error', cleanup);
}

/** Remove a dead listener safely */
function removeListener(res: Listener) {
  listeners.delete(res);
  try { res.end(); } catch { /* already closed */ }
}

/** Broadcast an event to all connected admin clients */
export function emitAdminEvent(event: string, data?: Record<string, unknown>) {
  if (listeners.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const res of listeners) {
    try {
      const ok = res.write(payload);
      if (!ok) removeListener(res);
    } catch {
      removeListener(res);
    }
  }
}

// Heartbeat every 30s — prunes dead connections and keeps proxies/LBs from closing idle SSE
const HEARTBEAT_INTERVAL_MS = 30_000;
setInterval(() => {
  if (listeners.size === 0) return;
  for (const res of listeners) {
    try {
      const ok = res.write(': heartbeat\n\n');
      if (!ok) removeListener(res);
    } catch {
      removeListener(res);
    }
  }
}, HEARTBEAT_INTERVAL_MS).unref();
