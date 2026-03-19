import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: 'Authorization token required' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string; role: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export async function authenticateApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return next();

    const crypto = await import('crypto');
    const keyHash = crypto.default.createHash('sha256').update(apiKey).digest('hex');

    const record = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (record && (!record.expiresAt || record.expiresAt > new Date())) {
      req.user = { id: record.user.id, email: record.user.email, role: record.user.role };
      await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsed: new Date() } });
    }
    next();
  } catch {
    next();
  }
}
