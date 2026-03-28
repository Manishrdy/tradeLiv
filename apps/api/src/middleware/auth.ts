import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: { id: string; role: 'designer' | 'client' | 'admin' };
}

const accessTokenPayloadSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['designer', 'admin', 'client']),
});

function parseBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token =
    req.cookies?.session ?? parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: [config.jwtAlgorithm],
    });
    const payload = accessTokenPayloadSchema.safeParse(decoded);
    if (!payload.success) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    req.user = payload.data;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...roles: Array<'designer' | 'client' | 'admin'>) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // For admin role, verify against DB — a revoked admin's JWT still carries role:'admin'
    if (req.user.role === 'admin') {
      const designer = await prisma.designer.findUnique({
        where: { id: req.user.id },
        select: { isAdmin: true },
      });
      if (!designer?.isAdmin) {
        res.status(403).json({ error: 'Admin access has been revoked.' });
        return;
      }
    }

    next();
  };
}

export async function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const designer = await prisma.designer.findUnique({
    where: { id: req.user.id },
    select: { isSuperAdmin: true },
  });
  if (!designer?.isSuperAdmin) {
    res.status(403).json({ error: 'Super admin access required.' });
    return;
  }
  next();
}
