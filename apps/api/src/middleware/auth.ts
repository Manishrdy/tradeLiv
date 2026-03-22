import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@furnlo/db';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: { id: string; role: 'designer' | 'client' | 'admin' };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Prefer HTTP-only cookie; fall back to Authorization header for API clients
  const token = req.cookies?.session ?? req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthRequest['user'];
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...roles: Array<'designer' | 'client' | 'admin'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
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
